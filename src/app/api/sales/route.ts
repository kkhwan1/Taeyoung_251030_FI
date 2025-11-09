import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { z } from 'zod';

export const dynamic = 'force-dynamic';


// 판매 거래 생성 스키마
const SalesTransactionCreateSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD'),
  customer_id: z.number().positive('고객사 ID는 양수여야 합니다'),
  item_id: z.number().positive('품목 ID는 양수여야 합니다'),
  item_name: z.string().min(1, '품목명은 필수입니다'),
  spec: z.string().optional(),
  quantity: z.number().positive('수량은 0보다 커야 합니다'),
  unit_price: z.number().min(0, '단가는 0 이상이어야 합니다'),
  supply_amount: z.number().min(0, '공급가는 0 이상이어야 합니다'),
  tax_amount: z.number().min(0, '세액은 0 이상이어야 합니다').optional(),
  total_amount: z.number().min(0, '총액은 0 이상이어야 합니다'),
  payment_status: z.enum(['PENDING', 'PARTIAL', 'COMPLETE']).optional(),
  payment_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  delivery_address: z.string().optional(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional()
});

// GET: 판매 거래 목록 조회
export const GET = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;

    const customer_id = searchParams.get('customer_id');
    const item_id = searchParams.get('item_id');
    const payment_status = searchParams.get('payment_status');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const search = searchParams.get('search');
    const orderBy = searchParams.get('orderBy') || 'transaction_date';
    const order = searchParams.get('order') || 'desc';

    const supabase = getSupabaseClient();

    // Build query
    let query = supabase
      .from('sales_transactions')
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code),
        item:items!item_id(item_id, item_name, item_code)
      `, { count: 'exact' })
      .eq('is_active', true);

    // Apply filters
    if (customer_id) {
      query = query.eq('customer_id', parseInt(customer_id, 10));
    }

    if (item_id) {
      query = query.eq('item_id', parseInt(item_id, 10));
    }

    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    if (start_date) {
      query = query.gte('transaction_date', start_date);
    }

    if (end_date) {
      query = query.lte('transaction_date', end_date);
    }

    if (search) {
      query = query.or(`transaction_no.ilike.%${search}%,item_name.ilike.%${search}%`);
    }

    // Apply ordering and pagination
    query = query
      .order(orderBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Sales list error:', error);
      return NextResponse.json(
        { success: false, error: error?.message || '판매 거래 조회 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Sales list error:', error);
    return NextResponse.json(
      { success: false, error: '판매 거래 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// POST: 판매 거래 생성
export const POST = async (request: NextRequest) => {
  try {
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate input
    const result = SalesTransactionCreateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: any) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Generate transaction number
    const { data: transactionNo, error: genError } = await supabase
      .rpc('generate_sales_no');

    if (genError) {
      console.error('Generate transaction no error:', genError);
      return NextResponse.json(
        { success: false, error: genError?.message || '거래번호 생성 실패' },
        { status: 500 }
      );
    }

    // Create transaction
    const { data, error } = await supabase
      .from('sales_transactions')
      .insert({
        ...result.data,
        transaction_no: transactionNo,
        payment_status: result.data.payment_status || 'PENDING',
        is_active: true
      })
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code),
        item:items!item_id(item_id, item_name, item_code)
      `)
      .single();

    if (error) {
      console.error('Sales create error:', error);
      return NextResponse.json(
        { success: false, error: error?.message || '판매 거래 생성 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: '판매 거래가 생성되었습니다'
    });
  } catch (error) {
    console.error('Sales create error:', error);
    const errorMessage = error instanceof Error ? error.message : '판매 거래 생성 중 오류가 발생했습니다';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
};

// PUT: 판매 거래 수정
export const PUT = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '거래 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const text = await request.text();
    const body = JSON.parse(text);

    // Validate update data (use partial schema for optional updates)
    const UpdateSchema = SalesTransactionCreateSchema.partial();
    const result = UpdateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: any) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('sales_transactions')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', parseInt(id, 10))
      .select(`
        *,
        customer:companies!customer_id(company_id, company_name, company_code),
        item:items!item_id(item_id, item_name, item_code)
      `)
      .single();

    if (error) {
      console.error('Sales update error:', error);
      return NextResponse.json(
        { success: false, error: error?.message || '판매 거래 수정 실패' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: '거래를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: '판매 거래가 수정되었습니다'
    });
  } catch (error) {
    console.error('Sales update error:', error);
    return NextResponse.json(
      { success: false, error: '판매 거래 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// DELETE: 판매 거래 삭제 (soft delete)
export const DELETE = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '거래 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('sales_transactions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', parseInt(id, 10))
      .select()
      .single();

    if (error) {
      console.error('Sales delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: '거래를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '판매 거래가 삭제되었습니다'
    });
  } catch (error) {
    console.error('Sales delete error:', error);
    return NextResponse.json(
      { success: false, error: '판매 거래 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};