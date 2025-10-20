import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query to get all active items
    const { data: items, error } = await supabase
      .from('items')
      .select(`
        item_id,
        item_code,
        item_name,
        spec,
        unit,
        current_stock,
        safety_stock,
        location,
        price,
        category,
        is_active
      `)
      .eq('is_active', true)
      .order('item_name', { ascending: true });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Calculate summary statistics
    const totalItems = items?.length || 0;
    const totalStockValue = items?.reduce((sum, item) => sum + ((item.current_stock || 0) * (item.price || 0)), 0) || 0;
    const lowStockItems = items?.filter(item => (item.current_stock || 0) < (item.safety_stock || 0)).length || 0;

    return NextResponse.json({
      success: true,
      data: {
        items: items || [],
        summary: {
          total_items: totalItems,
          total_stock_value: totalStockValue,
          low_stock_items: lowStockItems,
          avg_stock_level: totalItems > 0 ? items?.reduce((sum, item) => sum + (item.current_stock || 0), 0) / totalItems : 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching current stock:', error);
    return NextResponse.json(
      {
        success: false,
        error: '현재고 조회에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}