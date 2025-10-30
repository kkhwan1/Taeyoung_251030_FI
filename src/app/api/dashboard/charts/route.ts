/**
 * Dashboard Charts API Route
 * Provides chart data for visualizations
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type ItemRow = Database['public']['Tables']['items']['Row'];
type InventoryTransactionRow = Database['public']['Tables']['inventory_transactions']['Row'];
type TransactionType = Database['public']['Enums']['transaction_type'];

type StockChartDatum = {
  name: string;
  현재고: number;
  안전재고: number;
  code: string;
};

type DailyAggregate = {
  date: string;
  입고: number;
  출고: number;
  조정: number;
};

type MonthlyAggregate = {
  month: string;
  입고: number;
  출고: number;
  조정: number;
};

const DAILY_RELEVANT_TYPES: ReadonlyArray<TransactionType> = ['입고', '출고', '생산입고', '생산출고'];
const MONTHLY_RELEVANT_TYPES: ReadonlyArray<TransactionType> = DAILY_RELEVANT_TYPES;

function formatKoreanDate(date: string | Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatKoreanMonth(date: string | Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return `${year}년 ${month}월`;
}

function isRelevantTransaction(type: TransactionType): boolean {
  return DAILY_RELEVANT_TYPES.includes(type);
}

function applyTransaction(quantity: number, type: TransactionType, target: DailyAggregate | MonthlyAggregate) {
  switch (type) {
    case '입고':
      target.입고 += quantity;
      break;
    case '출고':
      target.출고 += quantity;
      break;
    case '생산입고':
    case '생산출고':
      target.조정 += quantity;
      break;
    default:
      break;
  }
}

export async function GET() {
  try {
    const { data: stockItems, error: stockError } = await supabaseAdmin
      .from('items')
      .select('item_id, item_code, item_name, current_stock, safety_stock')
      .eq('is_active', true)
      .order('current_stock', { ascending: true });

    if (stockError) {
      throw new Error(`Failed to fetch stock data: ${stockError.message}`);
    }

    const safeStockItems = (stockItems ?? []) as ItemRow[];

    const filteredStockItems = safeStockItems
      .filter((item) => {
        const safetyStock = item.safety_stock ?? 0;
        const currentStock = item.current_stock ?? 0;
        return currentStock < safetyStock * 2 || safetyStock > 0;
      })
      .map((item) => {
        const safetyStock = item.safety_stock ?? 0;
        const currentStock = item.current_stock ?? 0;
        const ratio = safetyStock > 0 ? currentStock / safetyStock : Number.POSITIVE_INFINITY;
        return { ...item, ratio };
      })
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 20);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const { data: dailyTransactionsData, error: dailyError } = await supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_date, transaction_type, quantity')
      .gte('transaction_date', thirtyDaysAgoISO)
      .order('transaction_date', { ascending: false });

    if (dailyError) {
      throw new Error(`Failed to fetch daily transactions: ${dailyError.message}`);
    }

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoISO = twelveMonthsAgo.toISOString();

    const { data: monthlyTransactionsData, error: monthlyError } = await supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_date, transaction_type, quantity, item_id, company_id')
      .gte('transaction_date', twelveMonthsAgoISO)
      .order('transaction_date', { ascending: false });

    if (monthlyError) {
      throw new Error(`Failed to fetch monthly transactions: ${monthlyError.message}`);
    }

    const dailyTransactions = (dailyTransactionsData ?? []) as InventoryTransactionRow[];
    const monthlyTransactions = (monthlyTransactionsData ?? []) as InventoryTransactionRow[];

    const stocks: StockChartDatum[] = filteredStockItems.map((item) => ({
      name: item.item_name ?? item.item_code ?? '미상',
      현재고: item.current_stock ?? 0,
      안전재고: item.safety_stock ?? 0,
      code: item.item_code ?? ''
    }));

    const transactionsByDate = dailyTransactions.reduce<Record<string, DailyAggregate>>((acc, transaction) => {
      const { transaction_type: type, quantity } = transaction;
      if (!type || !isRelevantTransaction(type)) {
        return acc;
      }

      const transactionDate = transaction.transaction_date ?? new Date().toISOString();
      const dateStr = formatKoreanDate(transactionDate);
      const safeQuantity = Number(quantity ?? 0);

      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, 입고: 0, 출고: 0, 조정: 0 };
      }

      applyTransaction(safeQuantity, type, acc[dateStr]);
      return acc;
    }, {});

    const transactions = Object.values(transactionsByDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14);

    const monthlyByMonth = monthlyTransactions.reduce<Record<string, MonthlyAggregate>>((acc, transaction) => {
      const { transaction_type: type, quantity } = transaction;
      if (!type || !MONTHLY_RELEVANT_TYPES.includes(type)) {
        return acc;
      }

      const transactionDate = transaction.transaction_date ?? new Date().toISOString();
      const monthKey = formatKoreanMonth(transactionDate);
      const safeQuantity = Number(quantity ?? 0);

      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, 입고: 0, 출고: 0, 조정: 0 };
      }

      applyTransaction(safeQuantity, type, acc[monthKey]);
      return acc;
    }, {});

    const monthPattern = /(\d{4})년\s+(\d{1,2})월/;

    // Transform monthlyTrends to include all required fields
    const monthlyTrendsRaw = Object.values(monthlyByMonth)
      .sort((a, b) => {
        const aMatch = monthPattern.exec(a.month);
        const bMatch = monthPattern.exec(b.month);
        if (!aMatch || !bMatch) {
          return 0;
        }

        const aYear = Number(aMatch[1]);
        const aMonth = Number(aMatch[2]);
        const bYear = Number(bMatch[1]);
        const bMonth = Number(bMatch[2]);

        if (aYear !== bYear) {
          return aYear - bYear;
        }

        return aMonth - bMonth;
      })
      .slice(-12);

    // Fetch stock items with prices for calculating total stock value and quantity
    const { data: allStockItems } = await supabaseAdmin
      .from('items')
      .select('item_id, current_stock, price, unit_price')
      .eq('is_active', true);

    // Calculate 월별 총재고량, 재고가치, 회전율
    const monthlyTrends = monthlyTrendsRaw.map((trend, index) => {
      const monthMatch = monthPattern.exec(trend.month);
      const year = monthMatch ? Number(monthMatch[1]) : new Date().getFullYear();
      const month = monthMatch ? Number(monthMatch[2]) : new Date().getMonth() + 1;
      const date = new Date(year, month - 1, 1);

      // 총재고량 계산 (현재는 간단히 입고-출고 누적)
      const previousTotal = index > 0 
        ? monthlyTrendsRaw.slice(0, index).reduce((sum, t) => sum + t.입고 - t.출고, 0)
        : 0;
      const 총재고량 = previousTotal + trend.입고 - trend.출고;

      // 재고가치 계산 (현재고 × 평균 단가)
      const totalStockValue = (allStockItems || []).reduce((sum, item) => {
        const stock = item.current_stock || 0;
        const price = item.price || item.unit_price || 0;
        return sum + (stock * price);
      }, 0);

      // 회전율 계산 (출고량 / 평균재고량)
      const avgStock = 총재고량 > 0 ? 총재고량 : 1;
      const 회전율 = trend.출고 / avgStock;

      return {
        month: trend.month,
        date: date,
        총재고량: Math.max(0, 총재고량),
        입고: trend.입고,
        출고: trend.출고,
        생산: trend.조정, // 조정을 생산으로 매핑
        재고가치: totalStockValue,
        회전율: isNaN(회전율) ? 0 : 회전율
      };
    });

    // Calculate category stocks
    const { data: categoryItems } = await supabaseAdmin
      .from('items')
      .select('item_id, category, current_stock, safety_stock, min_stock_level, max_stock_level, price, unit_price')
      .eq('is_active', true);

    const categoryMap = new Map<string, {
      현재고: number;
      최소재고: number;
      안전재고: number;
      최대재고: number;
      품목수: number;
      재고가치: number;
      부족품목수: number;
      과재고품목수: number;
      거래량: number[];
    }>();

    (categoryItems || []).forEach((item: any) => {
      const category = item.category || '기타';
      const existing = categoryMap.get(category) || {
        현재고: 0,
        최소재고: 0,
        안전재고: 0,
        최대재고: 0,
        품목수: 0,
        재고가치: 0,
        부족품목수: 0,
        과재고품목수: 0,
        거래량: []
      };

      const stock = item.current_stock || 0;
      const price = item.price || item.unit_price || 0;
      const safety = item.safety_stock || 0;
      const min = item.min_stock_level || 0;
      const max = item.max_stock_level || 0;

      existing.현재고 += stock;
      existing.최소재고 += min;
      existing.안전재고 += safety;
      existing.최대재고 += max;
      existing.품목수 += 1;
      existing.재고가치 += stock * price;
      if (stock < safety) existing.부족품목수 += 1;
      if (stock > (max || safety * 2)) existing.과재고품목수 += 1;

      categoryMap.set(category, existing);
    });

    const categoryStocks = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      현재고: data.현재고,
      최소재고: data.최소재고,
      안전재고: data.안전재고,
      최대재고: data.최대재고,
      품목수: data.품목수,
      재고가치: data.재고가치,
      회전율: data.현재고 > 0 ? data.현재고 / (data.안전재고 || 1) : 0,
      부족품목수: data.부족품목수,
      과재고품목수: data.과재고품목수
    }));

    // Calculate transaction distribution
    const transactionTypes = monthlyTransactions.reduce<Record<string, {
      count: number;
      volume: number;
      value: number;
    }>>((acc, tx) => {
      const type = tx.transaction_type || '기타';
      if (!acc[type]) {
        acc[type] = { count: 0, volume: 0, value: 0 };
      }
      const qty = Number(tx.quantity || 0);
      acc[type].count += 1;
      acc[type].volume += qty;
      // value는 단가 정보가 없어서 0으로 설정
      acc[type].value += 0;
      return acc;
    }, {});

    const totalTransactions = Object.values(transactionTypes).reduce((sum, t) => sum + t.count, 0);
    const totalVolume = Object.values(transactionTypes).reduce((sum, t) => sum + t.volume, 0);
    const totalValue = Object.values(transactionTypes).reduce((sum, t) => sum + t.value, 0);

    const transactionDistribution = Object.entries(transactionTypes).map(([type, data]) => {
      // Get unique companies and items for this transaction type
      const typeTransactions = monthlyTransactions.filter(tx => tx.transaction_type === type);
      const uniqueCompanies = new Set();
      const uniqueItems = new Set();
      
      typeTransactions.forEach(tx => {
        if ((tx as any).company_id) uniqueCompanies.add((tx as any).company_id);
        if (tx.item_id) uniqueItems.add(tx.item_id);
      });

      return {
        type,
        count: data.count,
        volume: data.volume,
        value: data.value,
        percentage: totalTransactions > 0 ? (data.count / totalTransactions) * 100 : 0,
        items: uniqueItems.size,
        avgPerTransaction: data.count > 0 ? data.volume / data.count : 0,
        companies: uniqueCompanies.size
      };
    });

    const chartData = {
      stocks,
      transactions,
      monthlyTrends,
      categoryStocks,
      transactionDistribution
    };

    return NextResponse.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    console.error('Dashboard charts API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch chart data',
      },
      { status: 500 }
    );
  }
}
