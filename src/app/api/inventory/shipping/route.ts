import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('transaction_type', '출고')
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { transactions: transactions || [] } });
  } catch (error) {
    console.error('Error fetching shipping history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch shipping history' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/shipping
 * Create new shipping transaction
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      transaction_date,
      item_id,
      quantity,
      unit_price,
      company_id,
      reference_number,
      lot_no,
      expiry_date,
      to_location,
      notes,
      created_by
    } = body;

    // 필수 필드 검증
    if (!transaction_date || !item_id || !quantity || unit_price === undefined || !created_by) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다. (거래일자, 품목, 수량, 단가, 작성자 필수)'
      }, { status: 400 });
    }

    if (quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: '수량은 0보다 커야 합니다.'
      }, { status: 400 });
    }

    if (unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: '단가는 0 이상이어야 합니다.'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if item exists and is active
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_name, unit, is_active')
      .eq('item_id', item_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({
        success: false,
        error: '존재하지 않는 품목입니다.'
      }, { status: 404 });
    }

    if (!item.is_active) {
      return NextResponse.json({
        success: false,
        error: '비활성화된 품목입니다.'
      }, { status: 400 });
    }

    // 거래처 존재 및 활성 상태 확인 (company_id가 있는 경우)
    if (company_id) {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('company_id, company_name, company_type, is_active')
        .eq('company_id', company_id)
        .single();

      if (companyError || !company) {
        return NextResponse.json({
          success: false,
          error: '존재하지 않는 거래처입니다.'
        }, { status: 404 });
      }

      if (!company.is_active) {
        return NextResponse.json({
          success: false,
          error: '비활성화된 거래처입니다.'
        }, { status: 400 });
      }
    }

    // Calculate total amount
    const total_amount = quantity * unit_price;

    // Insert shipping transaction
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert([{
        item_id,
        company_id,
        user_id: created_by,
        created_by,
        transaction_type: '출고',
        quantity,
        unit_price,
        total_amount,
        to_location,
        lot_no,
        expiry_date,
        reference_number,
        transaction_date,
        notes,
        document_status: 'DRAFT'
      }])
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit),
        companies(company_name),
        users!created_by(username)
      `);

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({
        success: false,
        error: '출고 등록 중 오류가 발생했습니다.',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '출고가 성공적으로 등록되었습니다.',
      data: data[0]
    });
  } catch (error) {
    console.error('Error creating shipping transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: '출고 등록 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/shipping
 * Update existing shipping transaction
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Transaction ID is required'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if transaction exists and is a shipping transaction
    const { data: existingTransaction, error: existingError } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('transaction_id', id)
      .eq('transaction_type', '출고')
      .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: 'Shipping transaction not found'
      }, { status: 404 });
    }

    // Validate fields if being updated
    if (updateData.quantity !== undefined && updateData.quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Quantity must be greater than 0'
      }, { status: 400 });
    }

    if (updateData.unit_price !== undefined && updateData.unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: 'Unit price cannot be negative'
      }, { status: 400 });
    }

    // Recalculate total amount if quantity or unit_price is updated
    if (updateData.quantity !== undefined || updateData.unit_price !== undefined) {
      const newQuantity = updateData.quantity ?? existingTransaction.quantity;
      const newUnitPrice = updateData.unit_price ?? existingTransaction.unit_price;
      updateData.total_amount = newQuantity * newUnitPrice;
    }

    // Update transaction
    const { data, error } = await supabase
      .from('inventory_transactions')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', id)
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit),
        companies(company_name),
        users!created_by(username)
      `);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update shipping transaction',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Shipping transaction updated successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error updating shipping transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update shipping transaction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/shipping
 * Delete shipping transaction
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Transaction ID is required'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if transaction exists and is a shipping transaction
    const { data: existingTransaction, error: existingError } = await supabase
      .from('inventory_transactions')
      .select('transaction_id')
      .eq('transaction_id', id)
      .eq('transaction_type', '출고')
      .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: 'Shipping transaction not found'
      }, { status: 404 });
    }

    // Delete transaction
    const { error } = await supabase
      .from('inventory_transactions')
      .delete()
      .eq('transaction_id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete shipping transaction',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Shipping transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting shipping transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete shipping transaction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}