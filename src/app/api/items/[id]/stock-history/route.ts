import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = id;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 재고 변동 이력 조회
    const { data, error } = await supabaseAdmin
      .from('inventory_transactions')
      .select(`
        transaction_date,
        quantity,
        transaction_type,
        transaction_number
      `)
      .eq('item_id', Number(itemId))
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    // 재고 누적 계산
    let runningStock = 0;
    const history = data.map(tx => {
      if (tx.transaction_type === '입고' || tx.transaction_type === '생산입고') {
        runningStock += tx.quantity;
      } else if (tx.transaction_type === '출고' || tx.transaction_type === '생산출고' || tx.transaction_type === '조정') {
        runningStock -= tx.quantity;
      }

      return {
        date: tx.transaction_date,
        stock_level: runningStock,
        transaction_type: tx.transaction_type,
        transaction_no: tx.transaction_number
      };
    }).reverse();

    return NextResponse.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock history' },
      { status: 500 }
    );
  }
}
