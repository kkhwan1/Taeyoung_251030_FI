import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { ERPError, ErrorType, handleError as handleErrorResponse } from '@/lib/errorHandler';
import type { Database } from '@/types/supabase';

type PurchaseTransactionRow = Database['public']['Tables']['purchase_transactions']['Row'];
type PurchaseTransactionUpdate = Database['public']['Tables']['purchase_transactions']['Update'];

function normalizeString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeInteger(value: unknown): number | null {
  const numeric = normalizeNumber(value);
  if (numeric === null) return null;
  return Math.trunc(numeric);
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  const str = normalizeString(value);
  if (!str) return null;

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return null;
  }

  return str;
}

/**
 * GET /api/purchases/[id]
 * Get single purchase transaction by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const transactionId = normalizeInteger(id);

    if (!transactionId) {
      throw new ERPError(ErrorType.VALIDATION, '유효한 거래 ID가 필요합니다.');
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('purchase_transactions')
      .select(`
        *,
        supplier:companies!supplier_id(company_id, company_name, company_code, company_type, phone, email, address),
        item:items(item_id, item_code, item_name, spec, unit, category, current_stock)
      `)
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ERPError(ErrorType.NOT_FOUND, '매입 거래를 찾을 수 없습니다.');
      }
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '매입 거래를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'purchase_transactions', action: 'read' });
  }
}

/**
 * PUT /api/purchases/[id]
 * Update purchase transaction
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const transactionId = normalizeInteger(id);

    if (!transactionId) {
      throw new ERPError(ErrorType.VALIDATION, '유효한 거래 ID가 필요합니다.');
    }

    // Korean character handling: use request.text() + JSON.parse()
    const text = await request.text();
    const body = JSON.parse(text);

    // Normalize input
    const transactionDate = normalizeDate(body.transaction_date);
    const supplierId = normalizeInteger(body.supplier_id);
    const itemId = normalizeInteger(body.item_id);
    const quantity = normalizeNumber(body.quantity);
    const unitPrice = normalizeNumber(body.unit_price);
    const totalAmount = normalizeNumber(body.total_amount);
    const paidAmount = normalizeNumber(body.paid_amount);
    const paymentStatus = normalizeString(body.payment_status);
    const notes = normalizeString(body.notes);

    // Check if at least one field is being updated
    if (
      transactionDate === null &&
      supplierId === null &&
      itemId === null &&
      quantity === null &&
      unitPrice === null &&
      totalAmount === null &&
      paidAmount === null &&
      paymentStatus === null &&
      notes === null
    ) {
      throw new ERPError(ErrorType.VALIDATION, '수정할 값이 없습니다.');
    }

    // Business rule validation for provided values
    if (quantity !== null && quantity <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '수량은 0보다 커야 합니다.');
    }

    if (unitPrice !== null && unitPrice <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '단가는 0보다 커야 합니다.');
    }

    if (totalAmount !== null && totalAmount <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '합계금액은 0보다 커야 합니다.');
    }

    if (paidAmount !== null && paidAmount < 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '지급액은 0 이상이어야 합니다.');
    }

    const supabase = getSupabaseClient();

    // Get current transaction to validate paid_amount against total_amount
    const { data: currentTxn, error: fetchError } = await supabase
      .from('purchase_transactions')
      .select('total_amount, paid_amount')
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .single();

    if (fetchError || !currentTxn) {
      throw new ERPError(ErrorType.NOT_FOUND, '수정할 매입 거래를 찾을 수 없습니다.');
    }

    // Validate paid_amount doesn't exceed total_amount
    const finalTotalAmount = totalAmount ?? currentTxn.total_amount;
    const finalPaidAmount = paidAmount ?? (currentTxn.paid_amount ?? 0);

    if (finalPaidAmount > finalTotalAmount) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '지급액은 합계금액을 초과할 수 없습니다.');
    }

    const now = new Date().toISOString();

    // Build update payload
    const payload: PurchaseTransactionUpdate = {
      transaction_date: transactionDate ?? undefined,
      supplier_id: supplierId ?? undefined,
      item_id: itemId ?? undefined,
      quantity: quantity ?? undefined,
      unit_price: unitPrice ?? undefined,
      total_amount: totalAmount ?? undefined,
      paid_amount: paidAmount ?? undefined,
      payment_status: paymentStatus as 'PENDING' | 'PARTIAL' | 'COMPLETE' | undefined,
      notes: notes ?? undefined,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('purchase_transactions')
      .update(payload)
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .select(`
        *,
        supplier:companies!supplier_id(company_id, company_name, company_code),
        item:items(item_id, item_code, item_name, spec, unit)
      `)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '수정 대상 매입 거래를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      data,
      message: '매입 거래 정보가 수정되었습니다.',
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'purchase_transactions', action: 'update' });
  }
}

/**
 * DELETE /api/purchases/[id]
 * Soft delete purchase transaction
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const transactionId = normalizeInteger(id);

    if (!transactionId) {
      throw new ERPError(ErrorType.VALIDATION, '유효한 거래 ID가 필요합니다.');
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('purchase_transactions')
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .select('transaction_id, transaction_no')
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '삭제 대상 매입 거래를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      message: '매입 거래가 삭제되었습니다.',
      data: {
        transaction_id: data.transaction_id,
        transaction_no: data.transaction_no,
      },
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'purchase_transactions', action: 'delete' });
  }
}

