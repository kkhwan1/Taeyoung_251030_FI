import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const warehouseFrom = searchParams.get('from');
    const warehouseTo = searchParams.get('to');

    const supabase = getSupabaseClient();

    // Build safe query using Supabase client
    let query = supabase
      .from('inventory_transactions')
      .select(`
        transaction_id,
        transaction_date,
        item_id,
        quantity,
        unit_price,
        warehouse_id,
        location,
        notes,
        created_by,
        created_at,
        items!inner(item_code, item_name, spec, unit),
        users!inner(username)
      `)
      .eq('transaction_type', '이동')
      .eq('status', '완료');

    // Apply filters safely
    if (dateFrom) {
      query = query.gte('transaction_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('transaction_date', dateTo);
    }

    if (warehouseFrom) {
      query = query.eq('warehouse_id', parseInt(warehouseFrom, 10));
    }

    // Apply ordering and limit
    query = query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: transfers, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Transform data to match expected format
    const formattedTransfers = (transfers || []).map((t: any) => ({
      transaction_id: t.transaction_id,
      transaction_date: t.transaction_date,
      item_id: t.item_id,
      item_code: t.items?.item_code,
      item_name: t.items?.item_name,
      spec: t.items?.spec,
      quantity: t.quantity,
      unit: t.items?.unit,
      warehouse_from: t.warehouse_id,
      warehouse_to: null, // Not available in current schema
      notes: t.notes,
      created_by: t.created_by,
      created_by_name: t.users?.username,
      created_at: t.created_at
    }));

    return NextResponse.json({
      success: true,
      data: formattedTransfers
    });

  } catch (error) {
    console.error('Error fetching transfers:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch transfers'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Use request.text() + JSON.parse() for proper Korean character handling
    const text = await request.text();
    const body = JSON.parse(text);

    const {
      item_id,
      quantity,
      warehouse_from,
      warehouse_to,
      notes,
      transaction_date
    } = body;

    // Validate required fields
    if (!item_id || !quantity || !warehouse_from || !warehouse_to) {
      return NextResponse.json({
        success: false,
        error: 'item_id, quantity, warehouse_from, and warehouse_to are required'
      }, { status: 400 });
    }

    if (quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'quantity must be greater than 0'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // SECURITY FIX: Check if item exists and get current stock using Supabase client
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock')
      .eq('item_id', item_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({
        success: false,
        error: 'Item not found'
      }, { status: 404 });
    }

    const currentStock = item.current_stock || 0;

    if (currentStock < quantity) {
      return NextResponse.json({
        success: false,
        error: `재고가 부족합니다. 현재 재고: ${currentStock}, 요청 수량: ${quantity}`
      }, { status: 400 });
    }

    // SECURITY FIX: Create transfer transaction using Supabase client
    const { data: transferData, error: transferError } = await supabase
      .from('inventory_transactions')
      .insert({
        transaction_date: transaction_date || new Date().toISOString().split('T')[0],
        transaction_type: '이동',
        item_id: item_id,
        quantity: quantity,
        warehouse_id: warehouse_from,
        location: warehouse_to,
        notes: notes || '',
        status: '완료',
        created_at: new Date().toISOString()
      })
      .select('transaction_id')
      .single();

    if (transferError || !transferData) {
      console.error('Transfer creation error:', transferError);
      return NextResponse.json({
        success: false,
        error: '이동 거래 생성에 실패했습니다'
      }, { status: 500 });
    }

    const transactionId = transferData.transaction_id;

    // SECURITY FIX: Update item stock using Supabase client
    const { error: stockError } = await supabase
      .from('items')
      .update({
        current_stock: currentStock - quantity,
        updated_at: new Date().toISOString()
      })
      .eq('item_id', item_id);

    if (stockError) {
      console.error('Stock update error:', stockError);
      // Rollback: Delete the transaction
      await supabase
        .from('inventory_transactions')
        .delete()
        .eq('transaction_id', transactionId);

      return NextResponse.json({
        success: false,
        error: '재고 업데이트에 실패했습니다'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        transaction_id: transactionId,
        message: '이동 거래가 생성되었습니다',
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: quantity,
        warehouse_from: warehouse_from,
        warehouse_to: warehouse_to
      }
    });

  } catch (error) {
    console.error('Error creating transfer:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '이동 거래 생성 중 오류가 발생했습니다'
    }, { status: 500 });
  }
}
