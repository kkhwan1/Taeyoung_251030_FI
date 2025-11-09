import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


/**
 * POST /api/invoices
 *
 * 계산서 + 품목 일괄 저장
 *
 * Request Body:
 * {
 *   invoice: {
 *     transaction_no: string,
 *     customer_id: number,
 *     transaction_date: string,
 *     total_amount: number,
 *     ...
 *   },
 *   items: [
 *     {
 *       item_id: number,
 *       quantity: number,
 *       unit_price: number
 *     },
 *     ...
 *   ]
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     invoice_id: number,
 *     ...
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // 한글 깨짐 방지 패턴
    const text = await request.text();
    const data = JSON.parse(text);

    const { invoice, items } = data;

    // 검증: 필수 필드 확인
    if (!invoice || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '계산서 정보와 품목 정보가 필요합니다'
        },
        { status: 400 }
      );
    }

    // 1. 계산서 삽입
    const { data: newInvoice, error: invoiceError } = await supabase
      .from('sales_transactions')
      .insert(invoice)
      .select()
      .single();

    if (invoiceError) {
      console.error('Invoice insert error:', invoiceError);
      return handleSupabaseError('insert', 'sales_transactions', invoiceError);
    }

    // 2. 품목 데이터 준비
    const invoiceItems = items.map((item: any, index: number) => ({
      transaction_id: newInvoice.transaction_id,
      item_id: item.item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_amount: item.quantity * item.unit_price,
      line_no: index + 1,
      notes: item.notes || null
    }));

    // 3. 품목 일괄 삽입
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsError) {
      console.error('Invoice items insert error:', itemsError);

      // 롤백: 계산서 삭제
      await supabase
        .from('sales_transactions')
        .delete()
        .eq('transaction_id', newInvoice.transaction_id);

      return handleSupabaseError('insert', 'invoice_items', itemsError);
    }

    // 4. 전체 데이터 조회 (품목 포함)
    const { data: completeInvoice, error: selectError } = await supabase
      .from('sales_transactions')
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code),
        items:invoice_items(
          invoice_item_id,
          item_id,
          quantity,
          unit_price,
          total_amount,
          line_no,
          notes,
          item:items(item_code, item_name, unit, spec)
        )
      `)
      .eq('transaction_id', newInvoice.transaction_id)
      .order('line_no', { referencedTable: 'invoice_items', ascending: true })
      .single();

    if (selectError) {
      console.error('Invoice select error:', selectError);
      return handleSupabaseError('select', 'sales_transactions', selectError);
    }

    return createSuccessResponse(completeInvoice);

  } catch (error) {
    console.error('Invoice creation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '계산서 생성 중 오류가 발생했습니다'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invoices
 *
 * 계산서 목록 조회 (품목 포함)
 *
 * Query Parameters:
 * - page: number (기본값: 1)
 * - limit: number (기본값: 20)
 * - customer_id: number (선택)
 * - start_date: string (선택, YYYY-MM-DD)
 * - end_date: string (선택, YYYY-MM-DD)
 *
 * Response:
 * {
 *   success: true,
 *   data: [...],
 *   pagination: {
 *     page: number,
 *     limit: number,
 *     totalCount: number,
 *     totalPages: number
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const offset = (page - 1) * limit;

    // 기본 쿼리 구성
    let query = supabase
      .from('sales_transactions')
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code),
        items:invoice_items(
          invoice_item_id,
          item_id,
          quantity,
          unit_price,
          total_amount,
          line_no,
          notes,
          item:items(item_code, item_name, unit, spec)
        )
      `, { count: 'exact' });

    // 필터 적용
    if (customerId) {
      query = query.eq('customer_id', parseInt(customerId, 10));
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    // 정렬 및 페이지네이션
    const { data: invoices, error, count } = await query
      .order('transaction_date', { ascending: false })
      .order('transaction_no', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Invoices list error:', error);
      return handleSupabaseError('select', 'sales_transactions', error);
    }

    // 각 계산서의 품목을 line_no 순으로 정렬
    const sortedInvoices = invoices?.map(invoice => ({
      ...invoice,
      items: invoice.items?.sort((a, b) => a.line_no - b.line_no) || []
    }));

    return NextResponse.json({
      success: true,
      data: sortedInvoices || [],
      pagination: {
        page,
        limit,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Invoices list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '계산서 목록 조회 중 오류가 발생했습니다'
      },
      { status: 500 }
    );
  }
}
