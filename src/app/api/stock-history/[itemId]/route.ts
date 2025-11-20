// GET /api/stock-history/:itemId - Get stock history for a specific item
// Returns complete audit trail with before/after snapshots
// Supports pagination and filtering

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const itemId = parseInt(params.itemId);

    if (isNaN(itemId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 품목 ID입니다' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get query parameters for filtering and pagination
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const referenceType = searchParams.get('reference_type'); // process_operation, manual_adjustment, etc.
    const lotNumber = searchParams.get('lot_number');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Step 1: Verify item exists
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock, unit')
      .eq('item_id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { success: false, error: '품목을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Step 2: Query stock_history with company information
    let query = supabase
      .from('stock_history')
      .select(`
        *,
        companies(
          company_name,
          company_code
        )
      `, { count: 'exact' })
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (referenceType) {
      query = query.eq('reference_type', referenceType);
    }

    if (lotNumber) {
      query = query.eq('lot_number', lotNumber);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: historyRecords, error: historyError, count } = await query;

    if (historyError) {
      console.error('재고 이력 조회 오류:', historyError);
      return NextResponse.json(
        { success: false, error: `재고 이력 조회 실패: ${historyError.message}` },
        { status: 500 }
      );
    }

    // Map database columns to component-expected format
    const mappedHistory = (historyRecords || []).map((record: any) => ({
      history_id: record.history_id,
      item_id: record.item_id,
      movement_type: record.change_type,  // change_type → movement_type
      quantity_change: record.quantity_change,
      stock_quantity: record.stock_after, // stock_after → stock_quantity
      reference_type: record.reference_type,
      reference_id: record.reference_id,
      created_at: record.created_at,
      company_id: record.company_id || null,
      company_name: record.companies?.company_name || null,
      company_code: record.companies?.company_code || null
    }));

    // Step 3: Get summary statistics
    const { data: stats } = await supabase
      .from('stock_history')
      .select('quantity_change')
      .eq('item_id', itemId);

    const totalIncrease = (stats || [])
      .filter(s => s.quantity_change > 0)
      .reduce((sum, s) => sum + s.quantity_change, 0);

    const totalDecrease = Math.abs((stats || [])
      .filter(s => s.quantity_change < 0)
      .reduce((sum, s) => sum + s.quantity_change, 0));

    return NextResponse.json({
      success: true,
      data: {
        item: {
          item_id: item.item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          current_stock: item.current_stock,
          unit: item.unit
        },
        history: mappedHistory,
        statistics: {
          total_records: count || 0,
          total_increase: totalIncrease,
          total_decrease: totalDecrease,
          net_change: totalIncrease - totalDecrease
        },
        pagination: {
          limit,
          offset,
          total: count || 0,
          has_more: offset + limit < (count || 0),
          current_page: Math.floor(offset / limit) + 1,
          total_pages: Math.ceil((count || 0) / limit)
        },
        filters_applied: {
          reference_type: referenceType,
          lot_number: lotNumber,
          start_date: startDate,
          end_date: endDate
        }
      }
    });

  } catch (error: any) {
    console.error('재고 이력 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '재고 이력 조회 중 오류 발생' },
      { status: 500 }
      );
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
