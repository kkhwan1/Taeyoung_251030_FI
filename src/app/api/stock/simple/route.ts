import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


/**
 * Simplified stock history API without complex balance calculations
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build safe query using Supabase client
    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select(`
        transaction_id,
        transaction_date,
        transaction_type,
        quantity,
        unit_price,
        total_amount,
        reference_no,
        notes,
        items!inner(item_code, item_name, spec, item_type),
        companies!left(company_name),
        users!left(username)
      `)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Transform data to include calculated stock_change
    const formattedTransactions = transactions?.map((t: any) => {
      let stockChange = 0;
      switch (t.transaction_type) {
        case '입고':
        case 'MATERIAL_IN':
        case 'PRODUCTION_IN':
        case '생산입고':
          stockChange = t.quantity;
          break;
        case '출고':
        case 'PRODUCT_OUT':
        case '생산출고':
          stockChange = -t.quantity;
          break;
        case '조정':
          stockChange = t.quantity;
          break;
        default:
          stockChange = 0;
      }

      return {
        transaction_id: t.transaction_id,
        transaction_date: t.transaction_date,
        transaction_type: t.transaction_type,
        quantity: t.quantity,
        unit_price: t.unit_price,
        total_amount: t.total_amount,
        reference_no: t.reference_no,
        notes: t.notes,
        item_code: t.items?.item_code,
        item_name: t.items?.item_name,
        specification: t.items?.spec,
        item_type: t.items?.item_type,
        company_name: t.companies?.company_name,
        created_by_name: t.users?.username,
        stock_change: stockChange
      };
    }) || [];

    // Get total count using safe query
    const { count: totalCount, error: countError } = await supabase
      .from('inventory_transactions')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          total: totalCount || 0,
          limit,
          offset,
          hasMore: offset + limit < (totalCount || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching simple stock history:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '재고 이력 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.stack : 'No details'
    }, { status: 500 });
  }
}