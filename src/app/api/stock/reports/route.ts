import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const reportDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const supabase = getSupabaseClient();

    // Get items with stock information
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .eq('is_active', true);

    if (itemsError) throw itemsError;

    // Calculate stock data for each item
    const stockData = (itemsData || []).map((item: any) => {
      const currentStock = item.current_stock || 0;
      const safetyStock = item.safety_stock || 0;
      const stockValue = (item.price || 0) * currentStock;
      const isLowStock = currentStock <= safetyStock;

      return {
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        spec: item.spec,
        category: item.category,
        unit: item.unit,
        current_stock: currentStock,
        safety_stock: safetyStock,
        stock_value: stockValue,
        is_low_stock: isLowStock,
        price: item.price || 0
      };
    });

    // Calculate summary statistics
    const totalItems = stockData.length;
    const totalStockValue = stockData.reduce((sum, item) => sum + item.stock_value, 0);
    const lowStockItems = stockData.filter(item => item.is_low_stock).length;
    const outOfStockItems = stockData.filter(item => item.current_stock === 0).length;
    
    // Calculate excess stock items (stock > 2x safety stock)
    const excessStockItems = stockData.filter(item => 
      item.current_stock > (item.safety_stock * 2)
    ).length;

    // Category breakdown
    const categoryMap = new Map<string, { count: number; value: number }>();
    stockData.forEach(item => {
      const category = item.category || '기타';
      const existing = categoryMap.get(category) || { count: 0, value: 0 };
      categoryMap.set(category, {
        count: existing.count + 1,
        value: existing.value + item.stock_value
      });
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      item_type: category,
      item_count: data.count,
      stock_value: data.value,
      percentage: totalStockValue > 0 ? (data.value / totalStockValue) * 100 : 0
    }));

    // Top items by value
    const topValueItems = [...stockData]
      .sort((a, b) => b.stock_value - a.stock_value)
      .slice(0, 10)
      .map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        stock_value: item.stock_value,
        current_stock: item.current_stock,
        safety_stock: item.safety_stock
      }));

    // Low stock items
    const lowStockItemsList = stockData
      .filter(item => item.is_low_stock)
      .map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        stock_value: item.stock_value,
        current_stock: item.current_stock,
        safety_stock: item.safety_stock
      }));

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const { data: transactionData, error: transactionError } = await (supabase as any)
      .from('inventory_transactions')
      .select('*')
      .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0]);

    if (transactionError) {
      console.error('Error fetching transactions:', transactionError);
    }

    // Group transactions by month
    const monthlyMap = new Map<string, {
      stock_value: number;
      transaction_count: number;
      in_quantity: number;
      out_quantity: number;
    }>();

    (transactionData || []).forEach((tx: any) => {
      const month = tx.transaction_date?.substring(0, 7) || '';
      if (!month) return;

      const existing = monthlyMap.get(month) || {
        stock_value: 0,
        transaction_count: 0,
        in_quantity: 0,
        out_quantity: 0
      };

      monthlyMap.set(month, {
        stock_value: existing.stock_value + (tx.total_amount || 0),
        transaction_count: existing.transaction_count + 1,
        in_quantity: existing.in_quantity + (tx.transaction_type === '입고' ? tx.quantity : 0),
        out_quantity: existing.out_quantity + (tx.transaction_type === '출고' ? tx.quantity : 0)
      });
    });

    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        ...data
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_items: totalItems,
          total_stock_value: totalStockValue,
          low_stock_items: lowStockItems,
          excess_stock_items: excessStockItems,
          out_of_stock_items: outOfStockItems
        },
        categoryBreakdown,
        monthlyTrend,
        topValueItems,
        lowStockItems: lowStockItemsList,
        report_date: reportDate,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating stock report:', error);
    return NextResponse.json(
      {
        success: false,
        error: '재고 보고서 생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
