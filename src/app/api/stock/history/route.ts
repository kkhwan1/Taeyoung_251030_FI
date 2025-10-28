import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. inventory_transactions 조회
    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select(`
        *,
        created_at,
        items (
          item_name,
          item_code
        )
      `)
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 2. BOM 차감 로그 조회
    const { data: bomLogs, error: bomError } = await supabase
      .from('bom_deduction_log')
      .select(`
        log_id,
        transaction_id,
        child_item_id,
        quantity_required,
        deducted_quantity,
        stock_before,
        stock_after,
        created_at,
        inventory_transactions!transaction_id (
          transaction_date,
          transaction_type
        ),
        items!child_item_id (
          item_code,
          item_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (bomError) {
      console.error('BOM log query error:', bomError);
      // Continue without BOM logs
    }

    // Calculate running balance for each transaction
    let runningBalance = 0;
    const historyWithBalance = (transactions || []).map((transaction: any) => {
      let quantityChange = 0;
      
      switch (transaction.transaction_type) {
        case '입고':
        case '생산입고':
          quantityChange = transaction.quantity;
          break;
        case '출고':
        case '생산출고':
          quantityChange = -transaction.quantity;
          break;
        case '조정':
        case 'ADJUST':
          quantityChange = transaction.quantity;
          break;
        default:
          quantityChange = 0;
      }

      runningBalance += quantityChange;

      return {
        transaction_id: transaction.transaction_id,
        transaction_date: transaction.transaction_date,
        created_at: transaction.created_at, // 시간 정보 포함
        transaction_type: transaction.transaction_type,
        item_code: transaction.items?.item_code || transaction.item_code || 'N/A',
        item_name: transaction.items?.item_name || transaction.item_name || 'N/A',
        quantity: quantityChange, // Changed from quantity_change to quantity for frontend compatibility
        quantity_change: quantityChange,
        stock_balance: runningBalance,
        company_name: transaction.company_name || 'N/A',
        reference_number: transaction.reference_number,
        notes: transaction.notes
      };
    });

    // 3. BOM 로그를 거래 형식으로 변환
    const bomHistory = (bomLogs || []).map((log: any) => {
      const transaction = log.inventory_transactions;
      const item = log.items;
      
      if (!transaction || !item) {
        return null;
      }

      // 부족분 계산
      const required = parseFloat(String(log.quantity_required || 0));
      const deducted = parseFloat(String(log.deducted_quantity || 0));
      const shortage = Math.max(0, required - deducted);

      return {
        transaction_id: log.log_id,
        transaction_date: transaction.transaction_date,
        created_at: log.created_at, // BOM 차감 시간 정보
        transaction_type: 'BOM차감',
        item_code: item.item_code || 'N/A',
        item_name: item.item_name || 'N/A',
        quantity: -deducted, // 마이너스로 표시
        shortage: shortage, // 부족 수량 (새 필드)
        quantity_change: -deducted,
        stock_balance: parseFloat(String(log.stock_after || 0)),
        company_name: 'N/A',
        reference_number: null,
        notes: `생산입고(ID: ${log.transaction_id})로 인한 자동 차감`
      };
    }).filter((item: any) => item !== null);

    // 4. 두 데이터 병합 및 정렬
    const allHistory = [...historyWithBalance, ...bomHistory]
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

    return NextResponse.json({
      success: true,
      data: {
        history: allHistory,
        pagination: {
          limit: 100,
          total: allHistory.length,
          hasMore: false
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stock history' }, { status: 500 });
  }
}