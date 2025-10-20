import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import {
  PurchaseTransactionUpdateSchema
} from '@/lib/validation';
import {
  createValidatedRoute,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/validationMiddleware';

/**
 * GET /api/purchase-transactions/[id]
 * Retrieve a single purchase transaction by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return createErrorResponse('유효하지 않은 거래 ID입니다.', 400);
    }

    const supabase = getSupabaseClient();

    // Fetch transaction with joined supplier and item details
    const { data, error } = await supabase
      .from('purchase_transactions')
      .select(`
        *,
        supplier:companies!supplier_id(
          company_id,
          company_name,
          company_code,
          business_number,
          representative,
          phone,
          email
        ),
        item:items!item_id(
          item_id,
          item_code,
          item_name,
          spec,
          unit,
          current_stock,
          safety_stock
        )
      `)
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[purchase-transactions] Query error:', error);
      return createErrorResponse('매입 거래 정보를 조회하지 못했습니다.', 500, error.message);
    }

    if (!data) {
      return createErrorResponse('매입 거래를 찾을 수 없습니다.', 404);
    }

    return createSuccessResponse(data);

  } catch (error) {
    console.error('[purchase-transactions] GET error:', error);
    return createErrorResponse('매입 거래 조회 중 오류가 발생했습니다.', 500);
  }
}

/**
 * PUT /api/purchase-transactions/[id]
 * Update a purchase transaction
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return createErrorResponse('유효하지 않은 거래 ID입니다.', 400);
    }

    // Use request.text() + JSON.parse() for proper Korean character handling
    const text = await request.text();
    const data = JSON.parse(text);

    const supabase = getSupabaseClient();

    // Validate data against schema
    const validation = PurchaseTransactionUpdateSchema.safeParse({
      ...data,
      transaction_id: transactionId
    });

    if (!validation.success) {
      return createErrorResponse(
        '입력값을 확인해주세요.',
        400,
        validation.error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      );
    }

    const validData = validation.data;

    // Check if transaction exists
    const { data: existingTransaction, error: checkError } = await supabase
      .from('purchase_transactions')
      .select('transaction_id, supplier_id, item_id')
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .single();

    if (checkError || !existingTransaction) {
      return createErrorResponse('수정할 매입 거래를 찾을 수 없습니다.', 404);
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // If supplier_id changed, update cached supplier_name
    if (validData.supplier_id && validData.supplier_id !== existingTransaction.supplier_id) {
      const { data: supplier, error: supplierError } = await supabase
        .from('companies')
        .select('company_name')
        .eq('company_id', validData.supplier_id)
        .single();

      if (supplierError || !supplier) {
        return createErrorResponse('공급사 정보를 찾을 수 없습니다.', 404);
      }

      updateData.supplier_id = validData.supplier_id;
      updateData.supplier_name = supplier.company_name;
    }

    // If item_id changed, update cached item details
    if (validData.item_id && validData.item_id !== existingTransaction.item_id) {
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('item_name, spec')
        .eq('item_id', validData.item_id)
        .single();

      if (itemError || !item) {
        return createErrorResponse('품목 정보를 찾을 수 없습니다.', 404);
      }

      updateData.item_id = validData.item_id;
      updateData.item_name = item.item_name;
      updateData.spec = item.spec;
    }

    // Add other updatable fields
    const updatableFields = [
      'transaction_date',
      'vehicle_model',
      'material_type',
      'quantity',
      'unit',
      'unit_price',
      'supply_amount',
      'tax_amount',
      'total_amount',
      'receiving_date',
      'warehouse_location',
      'tax_invoice_id',
      'tax_invoice_received',
      'payment_status',
      'paid_amount',
      'payment_due_date',
      'notes'
    ];

    for (const field of updatableFields) {
      if (validData[field as keyof typeof validData] !== undefined) {
        updateData[field] = validData[field as keyof typeof validData];
      }
    }

    // Update transaction
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('purchase_transactions')
      .update(updateData)
      .eq('transaction_id', transactionId)
      .select()
      .single();

    if (updateError || !updatedTransaction) {
      console.error('[purchase-transactions] Update error:', updateError);
      return createErrorResponse('매입 거래 정보를 수정하지 못했습니다.', 500, updateError?.message);
    }

    return createSuccessResponse(
      updatedTransaction,
      '매입 거래 정보가 수정되었습니다.'
    );

  } catch (error) {
    console.error('[purchase-transactions] PUT error:', error);
    return createErrorResponse('매입 거래 수정 중 오류가 발생했습니다.', 500);
  }
}

/**
 * DELETE /api/purchase-transactions/[id]
 * Soft delete a purchase transaction
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return createErrorResponse('유효하지 않은 거래 ID입니다.', 400);
    }

    const supabase = getSupabaseClient();

    // Soft delete: set is_active to false
    const { data, error } = await supabase
      .from('purchase_transactions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', transactionId)
      .select('transaction_id')
      .single();

    if (error) {
      console.error('[purchase-transactions] Delete error:', error);
      return createErrorResponse('매입 거래를 비활성화하지 못했습니다.', 500, error.message);
    }

    if (!data) {
      return createErrorResponse('삭제할 매입 거래를 찾을 수 없습니다.', 404);
    }

    return createSuccessResponse(
      { transaction_id: transactionId },
      '매입 거래가 삭제되었습니다.'
    );

  } catch (error) {
    console.error('[purchase-transactions] DELETE error:', error);
    return createErrorResponse('매입 거래 삭제 중 오류가 발생했습니다.', 500);
  }
}
