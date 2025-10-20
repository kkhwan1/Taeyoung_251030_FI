import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(): Promise<NextResponse> {
  try {
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
    });
  } catch (error) {
    console.error('Error fetching receiving transactions:', error);
    return NextResponse.json(
      {
        success: false,
        error: '입고 내역 조회에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}

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

    // Insert receiving transaction
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert([{
        item_id,
        company_id,
        transaction_type: '입고',
        quantity,
        unit_price,
        total_amount,
        reference_number,
        transaction_date,
        notes
      }])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({
        success: false,
        error: '입고 등록 중 오류가 발생했습니다.',
        details: error.message
      }, { status: 500 });
    }

    // Update item current_stock after successful transaction creation
    const { data: currentItem, error: getError } = await supabase
      .from('items')
      .select('current_stock')
      .eq('item_id', item_id)
      .single();

    if (getError || !currentItem) {
      // Rollback: Delete the transaction we just created
      await supabase
        .from('inventory_transactions')
        .delete()
        .eq('transaction_id', data[0].transaction_id);

      return NextResponse.json({
        success: false,
        error: '품목 조회에 실패했습니다. 거래가 롤백되었습니다.'
      }, { status: 500 });
    }

    const newStock = (currentItem.current_stock || 0) + quantity;
    const { data: updatedItem, error: stockError } = await supabase
      .from('items')
      .update({
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('item_id', item_id)
      .select('current_stock')
      .single();

    if (stockError || !updatedItem) {
      console.error('Stock update error:', stockError);
      // Rollback: Delete the transaction
      await supabase
        .from('inventory_transactions')
        .delete()
        .eq('transaction_id', data[0].transaction_id);

      return NextResponse.json({
        success: false,
        error: '재고 업데이트에 실패했습니다. 거래가 롤백되었습니다.'
      }, { status: 500 });
    }

    // Verify the stock was actually updated
    if (updatedItem.current_stock !== newStock) {
      console.error('Stock update verification failed:', {
        expected: newStock,
        actual: updatedItem.current_stock,
        item_id
      });

      // Rollback: Delete the transaction
      await supabase
        .from('inventory_transactions')
        .delete()
        .eq('transaction_id', data[0].transaction_id);

      return NextResponse.json({
        success: false,
        error: `재고 업데이트 검증 실패: 예상값 ${newStock}, 실제값 ${updatedItem.current_stock}`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '입고가 성공적으로 등록되었습니다.',
      data: data[0]
    });
  } catch (error) {
    console.error('Error creating receiving transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: '입고 등록 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}