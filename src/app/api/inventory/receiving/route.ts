import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APIError, handleAPIError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/receiving';

  try {
    logger.info('Inventory receiving GET request', { endpoint });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query to get receiving transactions
    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('transaction_type', '입고')
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Get related data separately
    const itemIds = [...new Set(transactions?.map(t => t.item_id) || [])];
    const companyIds = [...new Set(transactions?.map(t => t.company_id).filter(Boolean) || [])];

    const { data: items } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, spec, unit')
      .in('item_id', itemIds);

    const { data: companies } = await supabase
      .from('companies')
      .select('company_id, company_name')
      .in('company_id', companyIds);

    // Combine data
    const enrichedTransactions = transactions?.map(transaction => ({
      ...transaction,
      item: items?.find(item => item.item_id === transaction.item_id),
      company: companies?.find(company => company.company_id === transaction.company_id)
    })) || [];

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory receiving GET success', { endpoint, duration, transactionCount: enrichedTransactions.length });

    return NextResponse.json({
      success: true,
      data: {
        transactions: enrichedTransactions,
        summary: {
          total_count: enrichedTransactions.length,
          total_quantity: enrichedTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0),
          total_value: enrichedTransactions.reduce((sum, t) => sum + ((t.quantity || 0) * (t.unit_price || 0)), 0)
        }
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory receiving GET error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/inventory/receiving';

  try {
    logger.info('Inventory receiving POST request', { endpoint });
    const body = await request.json();
    const {
      transaction_date,
      item_id,
      quantity,
      unit_price,
      company_id,
      reference_number,
      reference_no,
      notes
    } = body;

    // 필수 필드 검증
    if (!transaction_date || !item_id || !quantity || unit_price === undefined) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다. (거래일자, 품목, 수량, 단가 필수)'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate total amount
    const total_amount = quantity * unit_price;

    // OPTIMIZATION: Use transaction to ensure atomicity and reduce trigger overhead
    const { data, error } = await supabase.rpc('create_receiving_transaction', {
      p_item_id: item_id,
      p_quantity: quantity,
      p_unit_price: unit_price,
      p_total_amount: total_amount,
      p_company_id: company_id,
      p_reference_number: reference_no || reference_number,
      p_transaction_date: transaction_date,
      p_notes: notes
    });

    if (error) {
      console.error('Supabase transaction error:', error);
      return NextResponse.json({
        success: false,
        error: '입고 등록 중 오류가 발생했습니다.',
        details: error.message
      }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Inventory receiving POST success', { endpoint, duration, transactionId: data[0]?.transaction_id });

    return NextResponse.json({
      success: true,
      message: '입고가 성공적으로 등록되었습니다.',
      data: data[0]
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Inventory receiving POST error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}