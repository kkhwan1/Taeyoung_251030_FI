import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import {
  PurchaseTransactionCreateSchema,
  PurchaseTransactionQuerySchema
} from '@/lib/validation';
import {
  createValidatedRoute,
  createSuccessResponse,
  createErrorResponse,
  getValidatedData
} from '@/lib/validationMiddleware';

// Type definitions for purchase transaction
type PurchaseTransactionRow = {
  transaction_id: number;
  transaction_no: string;
  transaction_date: string;
  supplier_id: number;
  supplier_name: string | null;
  item_id: number;
  item_name: string | null;
  spec: string | null;
  vehicle_model: string | null;
  material_type: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  receiving_date: string | null;
  warehouse_location: string | null;
  tax_invoice_id: number | null;
  tax_invoice_received: boolean;
  payment_status: string;
  paid_amount: number;
  payment_due_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
};

/**
 * GET /api/purchase-transactions
 * List purchase transactions with filtering and pagination
 */
export const GET = createValidatedRoute(
  async (request) => {
    const { query } = getValidatedData(request);

    const supabase = getSupabaseClient();

    const {
      page = 1,
      limit = 20,
      supplier_id,
      item_id,
      vehicle_model,
      payment_status,
      start_date,
      end_date,
      search
    } = query || {};

    const offset = (page - 1) * limit;

    // Build query with joins for supplier and item details
    let queryBuilder = supabase
      .from('purchase_transactions')
      .select(`
        *,
        supplier:companies!supplier_id(company_name),
        item:items!item_id(item_name, spec)
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('transaction_date', { ascending: false })
      .order('transaction_no', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (supplier_id) {
      queryBuilder = queryBuilder.eq('supplier_id', supplier_id);
    }

    if (item_id) {
      queryBuilder = queryBuilder.eq('item_id', item_id);
    }

    if (vehicle_model) {
      queryBuilder = queryBuilder.ilike('vehicle_model', `%${vehicle_model}%`);
    }

    if (payment_status) {
      queryBuilder = queryBuilder.eq('payment_status', payment_status);
    }

    if (start_date) {
      queryBuilder = queryBuilder.gte('transaction_date', start_date);
    }

    if (end_date) {
      queryBuilder = queryBuilder.lte('transaction_date', end_date);
    }

    if (search) {
      queryBuilder = queryBuilder.or(
        `transaction_no.ilike.%${search}%,supplier_name.ilike.%${search}%,item_name.ilike.%${search}%,spec.ilike.%${search}%`
      );
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error('[purchase-transactions] Query error:', error);
      return createErrorResponse('매입 거래 정보를 조회하지 못했습니다.', 500, error.message);
    }

    return createSuccessResponse({
      transactions: data || [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
        hasMore: count ? offset + (data?.length || 0) < count : false,
      }
    });
  },
  {
    querySchema: PurchaseTransactionQuerySchema,
    requireAuth: false
  }
);

/**
 * POST /api/purchase-transactions
 * Create a new purchase transaction
 */
export const POST = createValidatedRoute(
  async (request) => {
    // Use request.text() + JSON.parse() for proper Korean character handling
    const text = await request.text();
    const data = JSON.parse(text);

    const supabase = getSupabaseClient();

    // Validate data against schema
    const validation = PurchaseTransactionCreateSchema.safeParse(data);
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

    // Fetch supplier_name from companies table
    const { data: supplier, error: supplierError } = await supabase
      .from('companies')
      .select('company_name')
      .eq('company_id', validData.supplier_id)
      .single();

    if (supplierError || !supplier) {
      return createErrorResponse('공급사 정보를 찾을 수 없습니다.', 404);
    }

    // Fetch item details from items table
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_name, spec')
      .eq('item_id', validData.item_id)
      .single();

    if (itemError || !item) {
      return createErrorResponse('품목 정보를 찾을 수 없습니다.', 404);
    }

    // Generate transaction_no using database function
    const { data: transactionNoData, error: transactionNoError } = await supabase
      .rpc('generate_purchase_transaction_no');

    if (transactionNoError || !transactionNoData) {
      console.error('[purchase-transactions] Failed to generate transaction_no:', transactionNoError);
      return createErrorResponse('거래번호 생성에 실패했습니다.', 500);
    }

    const now = new Date().toISOString();

    // Insert purchase transaction with cached denormalized data
    const insertData = {
      transaction_no: transactionNoData,
      transaction_date: validData.transaction_date,
      supplier_id: validData.supplier_id,
      supplier_name: supplier.company_name,
      item_id: validData.item_id,
      item_name: item.item_name,
      spec: item.spec,
      vehicle_model: validData.vehicle_model || null,
      material_type: validData.material_type || null,
      quantity: validData.quantity,
      unit: validData.unit,
      unit_price: validData.unit_price,
      supply_amount: validData.supply_amount,
      tax_amount: validData.tax_amount,
      total_amount: validData.total_amount,
      receiving_date: validData.receiving_date || null,
      warehouse_location: validData.warehouse_location || null,
      tax_invoice_id: validData.tax_invoice_id || null,
      tax_invoice_received: validData.tax_invoice_received,
      payment_status: validData.payment_status,
      paid_amount: validData.paid_amount,
      payment_due_date: validData.payment_due_date || null,
      notes: validData.notes || null,
      is_active: true,
      created_at: now,
      updated_at: now
    };

    const { data: insertedTransaction, error: insertError } = await supabase
      .from('purchase_transactions')
      .insert(insertData)
      .select()
      .single();

    if (insertError || !insertedTransaction) {
      console.error('[purchase-transactions] Insert error:', insertError);
      return createErrorResponse('매입 거래를 등록하지 못했습니다.', 500, insertError?.message);
    }

    return createSuccessResponse(
      insertedTransaction,
      '매입 거래가 등록되었습니다.',
      201
    );
  },
  {
    requireAuth: false
  }
);
