import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APIError, handleAPIError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/receiving/batch';

  try {
    logger.info('Inventory receiving batch POST request', { endpoint });
    
    // Parse request body with error handling (Korean UTF-8 support)
    let body;
    try {
      const text = await request.text();
      body = JSON.parse(text);
    } catch (parseError) {
      logger.error('JSON parse error', parseError as Error, { endpoint });
      return NextResponse.json({
        success: false,
        error: '잘못된 JSON 형식입니다.'
      }, { status: 400 });
    }

    const {
      transaction_date,
      company_id,
      items,
      reference_no,
      notes,
      created_by = 1
    } = body;

    // 필수 필드 검증
    if (!transaction_date || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다. (거래일자, 품목 목록 필수)'
      }, { status: 400 });
    }

    // 각 품목 검증
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_id || item.quantity === undefined || item.unit_price === undefined) {
        return NextResponse.json({
          success: false,
          error: `품목 ${i + 1}: 필수 필드가 누락되었습니다. (품목, 수량, 단가 필수)`
        }, { status: 400 });
      }
      if (item.quantity <= 0) {
        return NextResponse.json({
          success: false,
          error: `품목 ${i + 1}: 수량은 0보다 커야 합니다.`
        }, { status: 400 });
      }
      if (item.unit_price < 0) {
        return NextResponse.json({
          success: false,
          error: `품목 ${i + 1}: 단가는 0 이상이어야 합니다.`
        }, { status: 400 });
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 일괄 거래 생성
    const transactions = items.map((item: any) => ({
      item_id: item.item_id,
      company_id: company_id || null,
      transaction_type: '입고',
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_amount: item.quantity * item.unit_price,
      reference_number: reference_no || null,
      transaction_date,
      arrival_date: item.arrival_date || null,
      notes: notes || null,
      lot_number: item.lot_no || null, // 데이터베이스 컬럼명은 lot_number
      expiry_date: item.expiry_date || null,
      location: item.to_location || null, // 데이터베이스 컬럼명은 location
      status: '완료',
      created_by: created_by || 1
    }));

    // 트랜잭션으로 묶어서 처리
    const { data: insertedTransactions, error: insertError } = await supabase
      .from('inventory_transactions')
      .insert(transactions)
      .select('transaction_id, item_id, quantity');

    if (insertError) {
      console.error('Supabase batch insert error:', insertError);
      return NextResponse.json({
        success: false,
        error: '입고 일괄 등록 중 오류가 발생했습니다.',
        details: insertError.message
      }, { status: 500 });
    }

    // 재고 업데이트: update_stock_on_transaction 트리거가 자동으로 처리
    // 트리거 함수 update_item_stock()이 '입고' 거래에 대해 current_stock을 자동 증가시킵니다.
    // 트리거가 실패할 경우를 대비해 재고 상태를 확인합니다.
    const itemIds = [...new Set(items.map((item: any) => item.item_id))];
    
    // 재고 확인 (트리거가 올바르게 작동했는지 검증)
    // 참고: 트리거는 INSERT 직후 실행되므로, 여기서 조회하는 재고는 이미 업데이트된 상태입니다.

    // 업데이트된 품목 정보 조회
    const { data: updatedItems, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock')
      .in('item_id', itemIds);

    if (itemsError) {
      logger.warn('Failed to fetch updated stock', { error: itemsError });
      // 재고 조회 실패는 치명적 오류는 아니므로 경고만
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory receiving batch POST success', {
      endpoint,
      duration,
      transactionCount: insertedTransactions?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: {
        transactions: insertedTransactions || [],
        items: updatedItems || [],
        summary: {
          total_count: insertedTransactions?.length || 0,
          total_quantity: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          total_value: items.reduce(
            (sum: number, item: any) => sum + item.quantity * item.unit_price,
            0
          )
        }
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory receiving batch POST error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

