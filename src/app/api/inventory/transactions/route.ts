import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { nextSerial, getTransactionPrefix } from '@/lib/serial';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/supabase';

// GET: 재고 이동 목록 조회
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = request.headers.get('x-correlation-id') ||
                       `inventory_transactions_get_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  logger.setCorrelationId(correlationId);

  try {
    logger.debug('재고 이동 목록 조회 요청 시작');
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const warehouse = searchParams.get('warehouse');

    const supabase = getSupabaseClient();

    // Build safe query using Supabase client
    let query = supabase
      .from('inventory_transactions')
      .select(`
        transaction_id,
        transaction_date,
        item_id,
        quantity,
        notes,
        document_number,
        status,
        transaction_type,
        items!inner(item_code, item_name, unit)
      `)
      .in('transaction_type', ['입고', '출고', '생산입고', '생산출고', '이동', '조정', '폐기', '재고조정']);

    // Apply filters safely
    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    if (warehouse) {
      query = query.eq('warehouse_id', parseInt(warehouse, 10));
    }

    if (search) {
      query = query.or(`items.item_code.ilike.%${search}%,items.item_name.ilike.%${search}%`);
    }

    // Apply ordering and limit
    query = query
      .order('transaction_date', { ascending: false })
      .limit(100);

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Transform data to match expected format
    const formattedTransfers = transactions?.map((t: any) => ({
      id: t.transaction_id,
      transfer_date: t.transaction_date,
      item_id: t.item_id,
      item_code: t.items?.item_code,
      item_name: t.items?.item_name,
      quantity: t.quantity,
      unit: t.items?.unit,
      notes: t.notes,
      document_number: t.document_number,
      document_status: t.status,
      transaction_type: t.transaction_type,
      from_warehouse: 'Main',
      to_warehouse: 'Sub'
    })) || [];

    const responseTime = Date.now() - startTime;
    logger.logRequest('GET', '/api/inventory/transactions', 200, responseTime);
    logger.info(`재고 이동 목록 조회 완료: ${formattedTransfers.length}개 이동내역`, {
      transferCount: formattedTransfers.length,
      filters: { search, startDate, endDate, warehouse }
    });

    return NextResponse.json({
      success: true,
      data: formattedTransfers,
      meta: {
        total: formattedTransfers.length,
        responseTime
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.logRequest('GET', '/api/inventory/transactions', 500, responseTime);
    logger.error('재고 이동 목록 조회 실패', error as Error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch inventory transactions'
    }, { status: 500 });
  }
}

// POST: 재고 이동 등록
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = request.headers.get('x-correlation-id') ||
                       `inventory_transactions_post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  logger.setCorrelationId(correlationId);

  try {
    logger.debug('재고 이동 등록 요청 시작');

    // SECURITY FIX: Use request.text() + JSON.parse() for proper Korean character handling
    const text = await request.text();
    const body = JSON.parse(text);

    const {
      item_id,
      quantity,
      transaction_type,
      from_warehouse_id,
      to_warehouse_id,
      notes,
      transfer_date
    } = body;

    // Validate required fields
    if (!item_id || !quantity || !transaction_type) {
      return NextResponse.json({
        success: false,
        error: 'item_id, quantity, and transaction_type are required'
      }, { status: 400 });
    }

    if (quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'quantity must be greater than 0'
      }, { status: 400 });
    }

    // Validate transaction type
    const validTypes = ['입고', '출고', '생산입고', '생산출고', '이동', '조정', '폐기', '재고조정'];
    if (!validTypes.includes(transaction_type)) {
      return NextResponse.json({
        success: false,
        error: `Invalid transaction_type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Get transaction prefix and generate document number
    const prefix = getTransactionPrefix(transaction_type);
    const documentNumber = await nextSerial(prefix);

    // For 출고 types, check stock availability first
    if (['출고', '생산출고', '폐기'].includes(transaction_type)) {
      // SECURITY FIX: Check stock using Supabase client
      const { data: item, error: stockError } = await supabase
        .from('items')
        .select('current_stock')
        .eq('item_id', item_id)
        .single();

      if (stockError || !item) {
        return NextResponse.json({
          success: false,
          error: '품목을 찾을 수 없습니다'
        }, { status: 404 });
      }

      const currentStock = (item as { current_stock: number }).current_stock || 0;
      if (currentStock < quantity) {
        return NextResponse.json({
          success: false,
          error: `재고가 부족합니다. 현재 재고: ${currentStock}, 요청 수량: ${quantity}`
        }, { status: 400 });
      }
    }

    // SECURITY FIX: Create inventory transaction using Supabase client
    type TransactionRow = Database['public']['Tables']['inventory_transactions']['Row'];
    const { data: createData, error: createError } = await supabase
      .from('inventory_transactions')
      .insert({
        transaction_date: transfer_date || new Date().toISOString().split('T')[0],
        transaction_type: transaction_type as Database['public']['Enums']['transaction_type'],
        item_id: item_id,
        quantity: quantity,
        warehouse_id: from_warehouse_id || null,
        notes: notes || '',
        document_number: documentNumber,
        status: '완료',
        created_at: new Date().toISOString()
      } as Database['public']['Tables']['inventory_transactions']['Insert'])
      .select('transaction_id')
      .single() as { data: { transaction_id: number } | null; error: any };

    if (createError || !createData) {
      console.error('Transaction creation error:', createError);
      return NextResponse.json({
        success: false,
        error: '거래 생성에 실패했습니다'
      }, { status: 500 });
    }

    const transactionId = createData.transaction_id;

    // SECURITY FIX: Update item stock using Supabase client
    if (['입고', '생산입고'].includes(transaction_type)) {
      // Increase stock - Get current stock first
      type ItemStock = { current_stock: number };
      const { data: currentItem, error: getError } = await supabase
        .from('items')
        .select('current_stock')
        .eq('item_id', item_id)
        .single() as { data: ItemStock | null; error: any };

      if (getError || !currentItem) {
        // Rollback: Delete transaction
        await supabase
          .from('inventory_transactions')
          .delete()
          .eq('transaction_id', transactionId);

        return NextResponse.json({
          success: false,
          error: '품목 조회에 실패했습니다'
        }, { status: 500 });
      }

      const newStock = (currentItem.current_stock || 0) + quantity;
      const { error: stockError } = await supabase
        .from('items')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString()
        } as Database['public']['Tables']['items']['Update'])
        .eq('item_id', item_id);

      if (stockError) {
        console.error('Stock update error:', stockError);
        // Rollback: Delete transaction
        await supabase
          .from('inventory_transactions')
          .delete()
          .eq('transaction_id', transactionId);

        return NextResponse.json({
          success: false,
          error: '재고 업데이트에 실패했습니다'
        }, { status: 500 });
      }
    } else if (['출고', '생산출고', '폐기'].includes(transaction_type)) {
      // Decrease stock - Already checked stock availability above
      type ItemStock = { current_stock: number };
      const { data: currentItem, error: getError } = await supabase
        .from('items')
        .select('current_stock')
        .eq('item_id', item_id)
        .single() as { data: ItemStock | null; error: any };

      if (getError || !currentItem) {
        // Rollback: Delete transaction
        await supabase
          .from('inventory_transactions')
          .delete()
          .eq('transaction_id', transactionId);

        return NextResponse.json({
          success: false,
          error: '품목 조회에 실패했습니다'
        }, { status: 500 });
      }

      const newStock = (currentItem.current_stock || 0) - quantity;
      const { error: stockError } = await supabase
        .from('items')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString()
        } as Database['public']['Tables']['items']['Update'])
        .eq('item_id', item_id);

      if (stockError) {
        console.error('Stock update error:', stockError);
        // Rollback: Delete transaction
        await supabase
          .from('inventory_transactions')
          .delete()
          .eq('transaction_id', transactionId);

        return NextResponse.json({
          success: false,
          error: '재고 업데이트에 실패했습니다'
        }, { status: 500 });
      }
    }

    const responseTime = Date.now() - startTime;
    logger.logRequest('POST', '/api/inventory/transactions', 201, responseTime);

    logger.info('재고 이동 등록 완료', {
      transactionId,
      item_id,
      quantity,
      transaction_type
    });

    return NextResponse.json({
      success: true,
      data: {
        transaction_id: transactionId,
        document_number: documentNumber,
        message: '재고 거래가 성공적으로 생성되었습니다'
      }
    }, { status: 201 });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.logRequest('POST', '/api/inventory/transactions', 500, responseTime);
    logger.error('재고 이동 등록 실패', error as Error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '재고 거래 생성 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}
