import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


export async function GET(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. inventory_transactions 조회 (단가 정보 포함)
    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select(`
        *,
        created_at,
        items (
          item_name,
          item_code,
          price,
          unit
        ),
        companies!left (
          company_name
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

    // 2.5. 월별 단가 조회 (생산관리와 동일한 로직)
    const priceKeys = (transactions || []).map((tx: any) => {
      const transactionDate = tx.transaction_date || tx.created_at;
      const priceMonth = transactionDate
        ? new Date(transactionDate).toISOString().substring(0, 7) + '-01'
        : null;
      return {
        item_id: tx.item_id,
        price_month: priceMonth
      };
    }).filter(k => k.price_month);

    const uniqueItemIds = [...new Set(priceKeys.map(k => k.item_id))];
    const uniqueMonths = [...new Set(priceKeys.map(k => k.price_month))];

    const { data: monthlyPrices } = await supabase
      .from('item_price_history')
      .select('item_id, price_month, unit_price')
      .in('item_id', uniqueItemIds)
      .in('price_month', uniqueMonths);

    const priceMap = new Map(
      (monthlyPrices || []).map(p => [`${p.item_id}_${p.price_month}`, p.unit_price])
    );

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

      // 월별 단가 조회
      const transactionDate = transaction.transaction_date || transaction.created_at;
      const priceMonth = transactionDate
        ? new Date(transactionDate).toISOString().substring(0, 7) + '-01'
        : null;

      const monthlyPrice = priceMonth ? priceMap.get(`${transaction.item_id}_${priceMonth}`) : null;
      const unit_price = (transaction.unit_price && transaction.unit_price > 0)
        ? transaction.unit_price
        : (monthlyPrice || transaction.items?.price || 0);

      const total_amount = Math.abs(quantityChange) * unit_price;

      return {
        transaction_id: transaction.transaction_id,
        transaction_date: transaction.transaction_date,
        created_at: transaction.created_at, // 시간 정보 포함
        transaction_type: transaction.transaction_type,
        item_code: transaction.items?.item_code || transaction.item_code || 'N/A',
        item_name: transaction.items?.item_name || transaction.item_name || 'N/A',
        unit: transaction.items?.unit || 'EA',
        quantity: quantityChange,
        quantity_change: quantityChange,
        stock_balance: runningBalance,
        unit_price,
        total_amount,
        company_name: transaction.companies?.company_name || transaction.company_name || 'N/A',
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
      .sort((a, b) => {
        const dateA = a?.transaction_date ? new Date(a.transaction_date).getTime() : 0;
        const dateB = b?.transaction_date ? new Date(b.transaction_date).getTime() : 0;
        return dateB - dateA;
      });

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