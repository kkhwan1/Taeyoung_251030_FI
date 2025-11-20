import { NextRequest, NextResponse } from 'next/server';
import { supabase, handleSupabaseError } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


/**
 * GET /api/inventory/stock
 * Get current stock levels for all items
 * Query parameters:
 * - item_id: Filter by specific item
 * - category: Filter by item category
 * - low_stock: Show only items below reorder level
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('item_id');
    const category = searchParams.get('category');
    const lowStock = searchParams.get('low_stock');

    // Build query using Supabase client
    let query = supabase
      .from('items')
      .select(`
        item_id,
        item_code,
        item_name,
        spec,
        unit,
        item_type,
        current_stock,
        safety_stock,
        price
      `)
      .eq('is_active', true);

    // Apply filters
    if (itemId) {
      query = query.eq('item_id', parseInt(itemId));
    }

    if (category) {
      query = query.eq('item_type', category);
    }

    if (lowStock === 'true') {
      // Filter for items where current_stock <= safety_stock
      // Note: We need to fetch all items and filter in memory since Supabase doesn't support column-to-column comparison in query builder
      // Alternative: Use raw SQL or filter after fetching
    }

    query = query.order('item_code', { ascending: true });

    const { data: stockData, error } = await query;

    if (error) {
      return NextResponse.json(
        handleSupabaseError('GET', 'items', error),
        { status: 500 }
      );
    }

    // Calculate stock status and summary statistics for each item
    let enrichedData = stockData.map((item: any) => {
      const stockStatus =
        item.current_stock <= (item.safety_stock || 0) ? 'LOW' :
        item.current_stock > (item.safety_stock || 0) * 2 ? 'HIGH' :
        'NORMAL';

      return {
        ...item,
        stock_status: stockStatus,
        calculated_stock: item.current_stock // Use current_stock as calculated value
      };
    });

    // Apply low_stock filter after enrichment if requested
    if (lowStock === 'true') {
      enrichedData = enrichedData.filter((item: any) => item.stock_status === 'LOW');
    }

    // Calculate summary statistics
    const summary = {
      total_items: enrichedData.length,
      low_stock_items: enrichedData.filter((item: any) => item.stock_status === 'LOW').length,
      total_value: enrichedData.reduce((sum: number, item: any) =>
        sum + (item.current_stock * (item.unit_price || 0)), 0
      )
    };

    return NextResponse.json({
      success: true,
      data: {
        items: enrichedData,
        summary
      }
    });
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch stock data'
      },
      { status: 500 }
    );
  }
}