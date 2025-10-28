import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { ERPError, ErrorType, handleError as handleErrorResponse } from '@/lib/errorHandler';
import type { Database } from '@/types/supabase';

type SalesTransactionRow = Database['public']['Tables']['sales_transactions']['Row'];
type SalesTransactionInsert = Database['public']['Tables']['sales_transactions']['Insert'];
type SalesTransactionUpdate = Database['public']['Tables']['sales_transactions']['Update'];

const DEFAULT_LIMIT = 20;

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
 * GET /api/sales-transactions
 * List sales transactions with filtering and pagination
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;

    // Extract query parameters
    const customerId = normalizeInteger(searchParams.get('customer_id'));
    const itemId = normalizeInteger(searchParams.get('item_id'));
    const paymentStatus = normalizeString(searchParams.get('payment_status'));
    const startDate = normalizeDate(searchParams.get('start_date'));
    const endDate = normalizeDate(searchParams.get('end_date'));
    const search = normalizeString(searchParams.get('search'));
    const limit = normalizeInteger(searchParams.get('limit')) ?? DEFAULT_LIMIT;
    const page = normalizeInteger(searchParams.get('page')) ?? 1;
    const offset = (page - 1) * limit;

    // Build query with joins
    let query = supabase
      .from('sales_transactions')
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code),
        item:items(item_id, item_code, item_name, spec, unit)
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('transaction_date', { ascending: false })
      .order('transaction_no', { ascending: false });

    // Apply filters
    if (customerId !== null) {
      query = query.eq('customer_id', customerId);
    }

    if (itemId !== null) {
      query = query.eq('item_id', itemId);
    }

    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus);
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    if (search) {
      query = query.or(
        `transaction_no.ilike.%${search}%,notes.ilike.%${search}%`
      );
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Calculate summary statistics
    const totalAmount = (data ?? []).reduce((sum, txn) => sum + (txn.total_amount ?? 0), 0);
    const totalPaid = (data ?? []).reduce((sum, txn) => sum + (txn.paid_amount ?? 0), 0);
    const totalUnpaid = totalAmount - totalPaid;

    const statusSummary = (data ?? []).reduce<Record<string, number>>((acc, txn) => {
      const key = txn.payment_status ?? 'UNKNOWN';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        transactions: data ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: count ? Math.ceil(count / limit) : 0,
          hasMore: count ? offset + (data?.length ?? 0) < count : false,
        },
        summary: {
          totalAmount,
          totalPaid,
          totalUnpaid,
          byPaymentStatus: statusSummary,
        },
      },
      filters: {
        customer_id: customerId,
        item_id: itemId,
        payment_status: paymentStatus,
        start_date: startDate,
        end_date: endDate,
        search,
      },
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'sales_transactions', action: 'read' });
  }
}

/**
 * POST /api/sales-transactions
 * Create new sales transaction
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Korean character handling: use request.text() + JSON.parse()
    const text = await request.text();
    const body = JSON.parse(text);

    // Normalize input
    const transactionDate = normalizeDate(body.transaction_date);
    const customerId = normalizeInteger(body.customer_id);
    const itemId = normalizeInteger(body.item_id);
    const quantity = normalizeNumber(body.quantity);
    const unitPrice = normalizeNumber(body.unit_price);
    const supplyAmount = normalizeNumber(body.supply_amount);
    const taxAmount = normalizeNumber(body.tax_amount);
    const totalAmount = normalizeNumber(body.total_amount);
    const paidAmount = normalizeNumber(body.paid_amount) ?? 0;
    const paymentStatus = normalizeString(body.payment_status) ?? 'PENDING';
    const notes = normalizeString(body.notes);

    // Validate required fields
    const missingFields = [];
    if (!transactionDate) missingFields.push('transaction_date');
    if (!customerId) missingFields.push('customer_id');
    if (!itemId) missingFields.push('item_id');
    if (quantity === null) missingFields.push('quantity');
    if (unitPrice === null) missingFields.push('unit_price');
    if (supplyAmount === null) missingFields.push('supply_amount');
    if (taxAmount === null) missingFields.push('tax_amount');
    if (totalAmount === null) missingFields.push('total_amount');

    if (missingFields.length > 0) {
      throw new ERPError(ErrorType.VALIDATION, `필수 입력값을 확인해주세요: ${missingFields.join(', ')}`);
    }

    // Business rule validation
    if (quantity! <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '수량은 0보다 커야 합니다.');
    }

    if (unitPrice! <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '단가는 0보다 커야 합니다.');
    }

    if (totalAmount! <= 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '합계금액은 0보다 커야 합니다.');
    }

    if (paidAmount < 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '지급액은 0 이상이어야 합니다.');
    }

    if (paidAmount > totalAmount!) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '지급액은 합계금액을 초과할 수 없습니다.');
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // Prepare insert payload
    // Note: transaction_no is auto-generated by database trigger
    const payload = {
      transaction_date: transactionDate!,
      customer_id: customerId!,
      item_id: itemId!,
      quantity: quantity!,
      unit_price: unitPrice!,
      supply_amount: supplyAmount!,
      tax_amount: taxAmount!,
      total_amount: totalAmount!,
      paid_amount: paidAmount,
      payment_status: paymentStatus as 'PENDING' | 'PARTIAL' | 'COMPLETE',
      notes,
      is_active: true,
      created_at: now,
      updated_at: now,
    } as SalesTransactionInsert;

    const { data, error } = await supabase
      .from('sales_transactions')
      .insert(payload)
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code),
        item:items(item_id, item_code, item_name, spec, unit)
      `)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '판매 거래를 등록하지 못했습니다.');
    }

    return NextResponse.json({
      success: true,
      data,
      message: '판매 거래가 등록되었습니다.',
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'sales_transactions', action: 'create' });
  }
}
