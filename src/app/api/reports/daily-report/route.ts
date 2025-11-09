import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


type RequestParams = {
  year: number;
  month: number;
};

type DailyRow = {
  date: string;
  salesAmount: number;
  salesCount: number;
  purchaseAmount: number;
  purchaseCount: number;
  collectionAmount: number;
  collectionCount: number;
};

type SummaryTotals = {
  salesAmount: number;
  salesCount: number;
  purchaseAmount: number;
  purchaseCount: number;
  collectionAmount: number;
  collectionCount: number;
  netAmount: number;
};

function parseYearMonth(request: NextRequest): RequestParams {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get('year');
  const monthParam = url.searchParams.get('month');
  const today = new Date();

  const year = yearParam ? Number(yearParam) : today.getFullYear();
  const month = monthParam ? Number(monthParam) : today.getMonth() + 1;

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    throw new Error('year must be between 2000 and 2100');
  }

  if (!Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error('month must be between 1 and 12');
  }

  return { year, month };
}

function createDateRange(params: RequestParams) {
  const start = new Date(Date.UTC(params.year, params.month - 1, 1));
  const end = new Date(Date.UTC(params.year, params.month, 1));
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0]
  };
}

function ensureDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.split('T')[0];
}

function buildDailyRows(
  dates: Set<string>,
  salesMap: Map<string, { amount: number; count: number }>,
  purchaseMap: Map<string, { amount: number; count: number }>,
  collectionMap: Map<string, { amount: number; count: number }>
): DailyRow[] {
  return Array.from(dates)
    .sort()
    .map((date) => {
      const sales = salesMap.get(date) ?? { amount: 0, count: 0 };
      const purchase = purchaseMap.get(date) ?? { amount: 0, count: 0 };
      const collection = collectionMap.get(date) ?? { amount: 0, count: 0 };

      return {
        date,
        salesAmount: sales.amount,
        salesCount: sales.count,
        purchaseAmount: purchase.amount,
        purchaseCount: purchase.count,
        collectionAmount: collection.amount,
        collectionCount: collection.count
      };
    });
}

function computeTotals(rows: DailyRow[]): SummaryTotals {
  return rows.reduce<SummaryTotals>((acc, row) => ({
    salesAmount: acc.salesAmount + row.salesAmount,
    salesCount: acc.salesCount + row.salesCount,
    purchaseAmount: acc.purchaseAmount + row.purchaseAmount,
    purchaseCount: acc.purchaseCount + row.purchaseCount,
    collectionAmount: acc.collectionAmount + row.collectionAmount,
    collectionCount: acc.collectionCount + row.collectionCount,
    netAmount: acc.netAmount + row.salesAmount - row.purchaseAmount
  }), {
    salesAmount: 0,
    salesCount: 0,
    purchaseAmount: 0,
    purchaseCount: 0,
    collectionAmount: 0,
    collectionCount: 0,
    netAmount: 0
  });
}

export async function GET(request: NextRequest) {
  try {
    const params = parseYearMonth(request);
    const { from, to } = createDateRange(params);
    const supabase = getSupabaseClient();

    const [salesResult, purchaseResult, collectionResult] = await Promise.all([
      supabase
        .from('sales_transactions')
        .select('transaction_date, amount')
        .gte('transaction_date', from)
        .lt('transaction_date', to),
      supabase
        .from('purchase_transactions')
        .select('transaction_date, amount')
        .gte('transaction_date', from)
        .lt('transaction_date', to),
      supabase
        .from('collection_transactions')
        .select('transaction_date, amount')
        .gte('transaction_date', from)
        .lt('transaction_date', to)
    ]);

    if (salesResult.error) {
      throw new Error(`Failed to fetch sales transactions: ${salesResult.error.message}`);
    }
    if (purchaseResult.error) {
      throw new Error(`Failed to fetch purchase transactions: ${purchaseResult.error.message}`);
    }
    if (collectionResult.error) {
      throw new Error(`Failed to fetch collection transactions: ${collectionResult.error.message}`);
    }

    const dates = new Set<string>();
    const salesMap = new Map<string, { amount: number; count: number }>();
    const purchaseMap = new Map<string, { amount: number; count: number }>();
    const collectionMap = new Map<string, { amount: number; count: number }>();

    const aggregate = (
      map: Map<string, { amount: number; count: number }>,
      date: string | null,
      amount: unknown
    ) => {
      if (!date) return;
      const numericAmount = Number(amount ?? 0);
      if (Number.isNaN(numericAmount)) return;
      dates.add(date);
      const entry = map.get(date) ?? { amount: 0, count: 0 };
      entry.amount += numericAmount;
      entry.count += 1;
      map.set(date, entry);
    };

    salesResult.data?.forEach((row) => {
      aggregate(salesMap, ensureDate((row as any).transaction_date), (row as any).amount);
    });

    purchaseResult.data?.forEach((row) => {
      aggregate(purchaseMap, ensureDate((row as any).transaction_date), (row as any).amount);
    });

    collectionResult.data?.forEach((row) => {
      aggregate(collectionMap, ensureDate((row as any).transaction_date), (row as any).amount);
    });

    const dailyRows = buildDailyRows(dates, salesMap, purchaseMap, collectionMap);
    const totals = computeTotals(dailyRows);

    return NextResponse.json({
      success: true,
      data: {
        year: params.year,
        month: params.month,
        period: { from, to },
        totals,
        daily: dailyRows
      }
    });
  } catch (error) {
    console.error('[daily-report] Failed to generate report:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate daily report'
      },
      { status: 500 }
    );
  }
}
