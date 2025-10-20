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
      .select('transaction_date, transaction_type, quantity')
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

    const monthlyTrends = Object.values(monthlyByMonth)
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

    const chartData = {
      stocks,
      transactions,
      monthlyTrends,
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
