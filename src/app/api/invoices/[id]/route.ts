import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';

/**
 * GET /api/invoices/[id]
 *
 * 계산서 + 품목 상세 조회
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     transaction_id: number,
 *     transaction_no: string,
 *     customer: { company_id, company_name, ... },
 *     items: [
 *       {
 *         invoice_item_id: number,
 *         item: { item_code, item_name, ... },
 *         quantity: number,
 *         unit_price: number,
 *         total_amount: number,
 *         line_no: number
 *       },
 *       ...
 *     ],
 *     ...
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const invoiceId = parseInt(params.id, 10);

    if (isNaN(invoiceId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 계산서 ID입니다' },
        { status: 400 }
      );
    }

    const { data: invoice, error } = await supabase
      .from('sales_transactions')
      .select(`
        *,
        customer:companies!customer_id(
          company_id,
          company_name,
          company_code,
          business_registration_no,
          representative_name,
          address,
          phone,
          email
        ),
        items:invoice_items(
          invoice_item_id,
          item_id,
          quantity,
          unit_price,
          total_amount,
          line_no,
          notes,
          item:items(
            item_id,
            item_code,
            item_name,
            unit,
            spec,
            category,
            current_stock
          )
        )
      `)
      .eq('transaction_id', invoiceId)
      .single();

    if (error) {
      console.error('Invoice detail error:', error);
      return handleSupabaseError('select', 'sales_transactions', error);
    }

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: '계산서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 품목을 line_no 순으로 정렬
    invoice.items = invoice.items?.sort((a, b) => a.line_no - b.line_no) || [];

    return createSuccessResponse(invoice);

  } catch (error) {
    console.error('Invoice detail error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '계산서 조회 중 오류가 발생했습니다'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/invoices/[id]
 *
 * 계산서 + 품목 수정
 *
 * Request Body:
 * {
 *   invoice: {
 *     transaction_no: string,
 *     total_amount: number,
 *     ...
 *   },
 *   items: [
 *     {
 *       invoice_item_id?: number,  // 기존 품목인 경우
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
 *   data: { ... }
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const invoiceId = parseInt(params.id, 10);

    if (isNaN(invoiceId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 계산서 ID입니다' },
        { status: 400 }
      );
    }

    // 한글 깨짐 방지 패턴
    const text = await request.text();
    const data = JSON.parse(text);

    const { invoice, items } = data;

    // 검증
    if (!invoice || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: '계산서 정보와 품목 정보가 필요합니다' },
        { status: 400 }
      );
    }

    // 1. 계산서 업데이트
    const { error: invoiceError } = await supabase
      .from('sales_transactions')
      .update({
        ...invoice,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', invoiceId);

    if (invoiceError) {
      console.error('Invoice update error:', invoiceError);
      return handleSupabaseError('update', 'sales_transactions', invoiceError);
    }

    // 2. 기존 품목 삭제
    const { error: deleteError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('transaction_id', invoiceId);

    if (deleteError) {
      console.error('Invoice items delete error:', deleteError);
      return handleSupabaseError('delete', 'invoice_items', deleteError);
    }

    // 3. 새 품목 삽입
    if (items.length > 0) {
      const invoiceItems = items.map((item: any, index: number) => ({
        transaction_id: invoiceId,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.quantity * item.unit_price,
        line_no: index + 1,
        notes: item.notes || null
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) {
        console.error('Invoice items insert error:', itemsError);
        return handleSupabaseError('insert', 'invoice_items', itemsError);
      }
    }

    // 4. 업데이트된 계산서 조회
    const { data: updatedInvoice, error: selectError } = await supabase
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
      .eq('transaction_id', invoiceId)
      .order('line_no', { referencedTable: 'invoice_items', ascending: true })
      .single();

    if (selectError) {
      console.error('Invoice select error:', selectError);
      return handleSupabaseError('select', 'sales_transactions', selectError);
    }

    return createSuccessResponse(updatedInvoice);

  } catch (error) {
    console.error('Invoice update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '계산서 수정 중 오류가 발생했습니다'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/invoices/[id]
 *
 * 계산서 삭제 (품목도 CASCADE 삭제)
 *
 * Response:
 * {
 *   success: true,
 *   data: { deleted: true }
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const invoiceId = parseInt(params.id, 10);

    if (isNaN(invoiceId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 계산서 ID입니다' },
        { status: 400 }
      );
    }

    // 계산서 삭제 (invoice_items는 ON DELETE CASCADE로 자동 삭제)
    const { error } = await supabase
      .from('sales_transactions')
      .delete()
      .eq('transaction_id', invoiceId);

    if (error) {
      console.error('Invoice delete error:', error);
      return handleSupabaseError('delete', 'sales_transactions', error);
    }

    return createSuccessResponse({ deleted: true });

  } catch (error) {
    console.error('Invoice delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '계산서 삭제 중 오류가 발생했습니다'
      },
      { status: 500 }
    );
  }
}
