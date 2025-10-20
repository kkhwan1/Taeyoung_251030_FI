/**
 * Dashboard Alerts API Route
 * Provides alert notifications and recent activity
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type ItemRow = Database['public']['Tables']['items']['Row'];
type TransactionRow = Database['public']['Tables']['inventory_transactions']['Row'];
type TransactionWithItem = TransactionRow & {
  items: { item_name: string | null };
};

type LowStockStatus = '위험' | '경고' | '정상';

type RecentTransaction = {
  transaction_id: number;
  transaction_type: Database['public']['Enums']['transaction_type'] | null;
  quantity: number | null;
  transaction_date: string;
  item_name: string | null;
  status: '처리중' | '완료';
};

function calculateLowStockStatus(current: number, safety: number): LowStockStatus {
  if (safety <= 0) {
    return '정상';
  }

  const ratio = safety > 0 ? current / safety : Number.POSITIVE_INFINITY;

  if (ratio < 0.5) {
    return '위험';
  }

  if (ratio < 1) {
    return '경고';
  }

  return '정상';
}

export async function GET() {
  try {
    const { data: allItems, error: itemsError } = await supabaseAdmin
      .from('items')
      .select('item_id, item_code, item_name, current_stock, safety_stock')
      .eq('is_active', true)
      .gt('safety_stock', 0)
      .order('current_stock', { ascending: true });

    if (itemsError) {
      throw itemsError;
    }

    const safeItems = (allItems ?? []) as ItemRow[];

    const lowStockCandidates = safeItems
      .filter((item) => {
        const current = item.current_stock ?? 0;
        const safety = item.safety_stock ?? 0;
        return safety > 0 && current < safety;
      })
      .slice(0, 50)
      .map((item) => {
        const current = item.current_stock ?? 0;
        const safety = item.safety_stock ?? 0;
        const coverage = safety > 0 ? current / safety : Number.POSITIVE_INFINITY;
        const status = calculateLowStockStatus(current, safety);

        return {
          item_id: item.item_id,
          item_code: item.item_code ?? null,
          item_name: item.item_name ?? null,
          current_stock: current,
          minimum_stock: safety,
          status,
          coverage,
        };
      });

    const sortedLowStock = lowStockCandidates
      .sort((a, b) => {
        if (a.coverage !== b.coverage) {
          return a.coverage - b.coverage;
        }
        return a.current_stock - b.current_stock;
      })
      .map((candidate) => {
        const { coverage, ...rest } = candidate;
        void coverage;
        return rest;
      })
      .filter((item) => item.status === '위험' || item.status === '경고');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const { data: transactionsData, error: transactionsError } = await supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_id, transaction_type, quantity, transaction_date, item_id, items!inner(item_name)')
      .gte('transaction_date', sevenDaysAgoISO)
      .order('transaction_date', { ascending: false })
      .limit(20);

    if (transactionsError) {
      throw transactionsError;
    }

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentTransactions = (transactionsData ?? [])
      .map((transaction) => transaction as TransactionWithItem)
      .map<RecentTransaction>((transaction) => {
        const transactionDate = transaction.transaction_date ?? new Date().toISOString();
        const status = new Date(transactionDate) >= oneHourAgo ? '처리중' : '완료';

        return {
          transaction_id: transaction.transaction_id,
          transaction_type: transaction.transaction_type,
          quantity: transaction.quantity,
          transaction_date: transactionDate,
          item_name: transaction.items?.item_name ?? null,
          status,
        };
      });

    const alertData = {
      lowStockItems: sortedLowStock,
      recentTransactions,
    };

    return NextResponse.json({
      success: true,
      data: alertData,
    });
  } catch (error) {
    console.error('Dashboard alerts API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alert data',
      },
      { status: 500 }
    );
  }
}
