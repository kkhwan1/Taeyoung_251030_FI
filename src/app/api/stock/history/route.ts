import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Calculate running balance for each transaction
    let runningBalance = 0;
    const historyWithBalance = (transactions || []).map((transaction: any) => {
      let quantityChange = 0;
      
      switch (transaction.transaction_type) {
        case '입고':
          quantityChange = transaction.quantity;
          break;
        case '출고':
          quantityChange = -transaction.quantity;
          break;
        case '조정':
          quantityChange = transaction.quantity;
          break;
        default:
          quantityChange = 0;
      }

      runningBalance += quantityChange;

      return {
        transaction_id: transaction.transaction_id,
        transaction_date: transaction.transaction_date,
        transaction_type: transaction.transaction_type,
        item_code: transaction.item_code || 'N/A',
        item_name: transaction.item_name || 'N/A',
        quantity_change: quantityChange,
        stock_balance: runningBalance,
        company_name: transaction.company_name || 'N/A',
        reference_number: transaction.reference_number,
        notes: transaction.notes
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        history: historyWithBalance,
        pagination: {
          limit: 100,
          total: historyWithBalance.length,
          hasMore: false
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stock history' }, { status: 500 });
  }
}