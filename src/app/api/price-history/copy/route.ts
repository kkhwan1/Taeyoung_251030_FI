import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { APIError, handleAPIError } from '@/lib/api-utils';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

/**
 * POST /api/price-history/copy
 * 단가 이력 복사 (이전 월에서 다음 월로)
 * 
 * Request body:
 * {
 *   fromMonth: string,  // YYYY-MM 형식
 *   toMonth: string     // YYYY-MM 형식
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/price-history/copy';

  try {
    // 권한 체크 (관대하게 처리)
    const user = await getCurrentUser(request).catch(() => null);
    
    logger.info('Price history copy POST request', { endpoint });
    const supabase = getSupabaseClient();
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);

    const { fromMonth, toMonth } = body;

    if (!fromMonth || !toMonth) {
      throw new APIError('fromMonth와 toMonth가 필요합니다.', 400);
    }

    // 월 형식 검증 및 DATE 형식으로 변환
    let normalizedFromMonth = fromMonth;
    let normalizedToMonth = toMonth;
    
    if (fromMonth.length > 7) {
      normalizedFromMonth = fromMonth.substring(0, 7);
    }
    if (toMonth.length > 7) {
      normalizedToMonth = toMonth.substring(0, 7);
    }

    if (!/^\d{4}-\d{2}$/.test(normalizedFromMonth) || !/^\d{4}-\d{2}$/.test(normalizedToMonth)) {
      throw new APIError('월은 YYYY-MM 형식이어야 합니다.', 400);
    }

    const fromMonthDate = `${normalizedFromMonth}-01`;
    const toMonthDate = `${normalizedToMonth}-01`;

    // 1. 이전 월의 단가 이력 조회
    const { data: fromHistory, error: fetchError } = await supabase
      .from('item_price_history')
      .select('item_id, unit_price, note')
      .eq('price_month', fromMonthDate);

    if (fetchError) {
      throw new APIError('이전 월의 단가 이력을 조회하지 못했습니다.', 500, fetchError.message);
    }

    if (!fromHistory || fromHistory.length === 0) {
      return NextResponse.json({
        success: true,
        message: '복사할 단가 이력이 없습니다.',
        data: [],
      });
    }

    // 2. 대상 월의 기존 데이터 확인
    const itemIds = fromHistory.map((h: any) => h.item_id);
    const { data: existing, error: existingError } = await supabase
      .from('item_price_history')
      .select('item_id')
      .eq('price_month', toMonthDate)
      .in('item_id', itemIds);

    if (existingError) {
      throw new APIError('기존 단가 이력을 확인하지 못했습니다.', 500, existingError.message);
    }

    const existingItemIds = new Set((existing || []).map((e: any) => e.item_id));

    // 3. 복사할 데이터 준비 (기존 데이터가 없는 것만)
    const toInsert = fromHistory
      .filter((h: any) => !existingItemIds.has(h.item_id))
      .map((h: any) => ({
        item_id: h.item_id,
        price_month: toMonthDate,
        unit_price: h.unit_price,
        note: h.note,
        created_by: user?.email || null,
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 항목이 이미 존재합니다.',
        data: [],
        stats: {
          copied: 0,
          skipped: existingItemIds.size,
        },
      });
    }

    // 4. 단가 이력 삽입
    const { data: inserted, error: insertError } = await supabase
      .from('item_price_history')
      .insert(toInsert)
      .select();

    if (insertError) {
      throw new APIError('단가 이력을 복사하지 못했습니다.', 500, insertError.message);
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Price history copy POST success', { endpoint, duration, fromMonth, toMonth, count: inserted?.length || 0 });

    return NextResponse.json({
      success: true,
      message: `${fromMonth}의 단가 이력을 ${toMonth}로 복사했습니다.`,
      data: inserted || [],
      stats: {
        copied: inserted?.length || 0,
        skipped: existingItemIds.size,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Price history copy POST error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

