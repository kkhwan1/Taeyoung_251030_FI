import { NextRequest, NextResponse } from 'next/server';
// Removed unused imports: db, SupabaseQueryBuilder, handleSupabaseError, createSuccessResponse, getSupabaseClient
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/inventory/shipping/stock-check
 * Check stock availability for shipping multiple items
 * Query parameters:
 * - items: JSON string of items to check [{"item_id": 1, "quantity": 5}, ...]
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemsParam = searchParams.get('items');

    if (!itemsParam) {
      return NextResponse.json({
        success: false,
        error: 'items parameter is required. Format: [{"item_id": 1, "quantity": 5}, ...]'
      }, { status: 400 });
    }

    let items;
    try {
      items = JSON.parse(itemsParam);
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'items parameter must be valid JSON'
      }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'items must be a non-empty array'
      }, { status: 400 });
    }

    // Validate each item in the array
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_id || !item.quantity) {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i} must have item_id and quantity`
        }, { status: 400 });
      }

      if (typeof item.item_id !== 'number' || typeof item.quantity !== 'number') {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i}: item_id and quantity must be numbers`
        }, { status: 400 });
      }

      if (item.quantity <= 0) {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i}: quantity must be greater than 0`
        }, { status: 400 });
      }
    }

    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check stock availability for each item
    const stockCheckResults = await Promise.all(
      items.map(async (item, index) => {
        try {
          // Get item information using safe Supabase client
          const { data: itemData, error: itemError } = await supabase
            .from('items')
            .select('item_id, item_code, item_name, unit, category, price, is_active, current_stock')
            .eq('item_id', item.item_id)
            .single();

          if (itemError || !itemData) {
            return {
              index,
              item_id: item.item_id,
              error: `Item with ID ${item.item_id} not found`,
              sufficient: false
            };
          }

          if (!itemData.is_active) {
            return {
              index,
              item_id: item.item_id,
              item_code: itemData.item_code,
              item_name: itemData.item_name,
              error: `Item ${itemData.item_name} is not active`,
              sufficient: false
            };
          }

          const currentStock = itemData.current_stock || 0;
          const requested = item.quantity;
          const shortage = Math.max(0, requested - currentStock);

          return {
            index,
            item_id: item.item_id,
            item_code: itemData.item_code,
            item_name: itemData.item_name,
            category: itemData.category,
            unit: itemData.unit,
            unit_price: itemData.price || 0,
            requested_quantity: requested,
            current_stock: currentStock,
            sufficient: currentStock >= requested,
            shortage: shortage,
            availability_percentage: currentStock > 0 ? Math.round((Math.min(requested, currentStock) / requested) * 10000) / 100 : 0,
            total_value: requested * (itemData.price || 0)
          };
        } catch (itemError) {
          console.error(`Error checking item ${item.item_id}:`, itemError);
          return {
            index,
            item_id: item.item_id,
            error: `Error checking item: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`,
            sufficient: false
          };
        }
      })
    );

    // Filter out items with errors for summary calculations
    const validResults = stockCheckResults.filter(result => !result.error);
    const errorResults = stockCheckResults.filter(result => result.error);

    const canShipAll = validResults.every(item => item.sufficient);
    const insufficientItems = validResults.filter(item => !item.sufficient);
    const sufficientItems = validResults.filter(item => item.sufficient);

    // Calculate totals
    const totalValue = validResults.reduce((sum, item) => sum + (item.total_value || 0), 0);
    const totalShortageValue = insufficientItems.reduce(
      (sum, item) => sum + ((item.shortage || 0) * (item.unit_price || 0)),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        can_ship_all: canShipAll && errorResults.length === 0,
        stock_check_results: stockCheckResults,
        valid_items: validResults,
        error_items: errorResults,
        sufficient_items: sufficientItems,
        insufficient_items: insufficientItems,
        summary: {
          total_items_requested: items.length,
          valid_items: validResults.length,
          error_items: errorResults.length,
          sufficient_items: sufficientItems.length,
          insufficient_items: insufficientItems.length,
          total_order_value: Math.round(totalValue * 100) / 100,
          total_shortage_value: Math.round(totalShortageValue * 100) / 100,
          fulfillment_rate: validResults.length > 0 ?
            Math.round((sufficientItems.length / validResults.length) * 10000) / 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('Error checking stock availability:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to check stock availability';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/shipping/stock-check
 * Check stock availability for shipping (alternative method using POST body)
 * Body: {
 *   items: Array<{
 *     item_id: number,
 *     quantity: number
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'items must be a non-empty array'
      }, { status: 400 });
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_id || !item.quantity) {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i} must have item_id and quantity`
        }, { status: 400 });
      }

      if (typeof item.item_id !== 'number' || typeof item.quantity !== 'number') {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i}: item_id and quantity must be numbers`
        }, { status: 400 });
      }

      if (item.quantity <= 0) {
        return NextResponse.json({
          success: false,
          error: `Item at index ${i}: quantity must be greater than 0`
        }, { status: 400 });
      }
    }

    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use the same logic as GET but with items from body
    const stockCheckResults = await Promise.all(
      items.map(async (item, index) => {
        try {
          // Get item information using safe Supabase client
          const { data: itemData, error: itemError } = await supabase
            .from('items')
            .select('item_id, item_code, item_name, unit, category, price, is_active, current_stock')
            .eq('item_id', item.item_id)
            .single();

          if (itemError || !itemData) {
            return {
              index,
              item_id: item.item_id,
              error: `Item with ID ${item.item_id} not found`,
              sufficient: false
            };
          }

          if (!itemData.is_active) {
            return {
              index,
              item_id: item.item_id,
              item_code: itemData.item_code,
              item_name: itemData.item_name,
              error: `Item ${itemData.item_name} is not active`,
              sufficient: false
            };
          }

          const currentStock = itemData.current_stock || 0;
          const requested = item.quantity;
          const shortage = Math.max(0, requested - currentStock);

          return {
            index,
            item_id: item.item_id,
            item_code: itemData.item_code,
            item_name: itemData.item_name,
            category: itemData.category,
            unit: itemData.unit,
            unit_price: itemData.price || 0,
            requested_quantity: requested,
            current_stock: currentStock,
            sufficient: currentStock >= requested,
            shortage: shortage,
            availability_percentage: currentStock > 0 ? Math.round((Math.min(requested, currentStock) / requested) * 10000) / 100 : 0,
            total_value: requested * (itemData.price || 0)
          };
        } catch (itemError) {
          console.error(`Error checking item ${item.item_id}:`, itemError);
          return {
            index,
            item_id: item.item_id,
            error: `Error checking item: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`,
            sufficient: false
          };
        }
      })
    );

    // Filter out items with errors for summary calculations
    const validResults = stockCheckResults.filter(result => !result.error);
    const errorResults = stockCheckResults.filter(result => result.error);

    const canShipAll = validResults.every(item => item.sufficient);
    const insufficientItems = validResults.filter(item => !item.sufficient);
    const sufficientItems = validResults.filter(item => item.sufficient);

    // Calculate totals
    const totalValue = validResults.reduce((sum, item) => sum + (item.total_value || 0), 0);
    const totalShortageValue = insufficientItems.reduce(
      (sum, item) => sum + ((item.shortage || 0) * (item.unit_price || 0)),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        can_ship_all: canShipAll && errorResults.length === 0,
        stock_check_results: stockCheckResults,
        valid_items: validResults,
        error_items: errorResults,
        sufficient_items: sufficientItems,
        insufficient_items: insufficientItems,
        summary: {
          total_items_requested: items.length,
          valid_items: validResults.length,
          error_items: errorResults.length,
          sufficient_items: sufficientItems.length,
          insufficient_items: insufficientItems.length,
          total_order_value: Math.round(totalValue * 100) / 100,
          total_shortage_value: Math.round(totalShortageValue * 100) / 100,
          fulfillment_rate: validResults.length > 0 ?
            Math.round((sufficientItems.length / validResults.length) * 10000) / 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('Error checking stock availability:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to check stock availability';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}