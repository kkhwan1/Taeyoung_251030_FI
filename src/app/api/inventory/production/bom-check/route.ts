import { NextRequest, NextResponse } from 'next/server';
// Removed unused imports: db, SupabaseQueryBuilder, handleSupabaseError, createSuccessResponse, getSupabaseClient
import { createClient } from '@supabase/supabase-js';
import { mcp__supabase__execute_sql } from '@/lib/supabase-mcp';

/**
 * GET /api/inventory/production/bom-check
 * Check BOM availability for production
 * Query parameters:
 * - product_item_id: ID of the product to produce
 * - quantity: Quantity to produce
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productItemId = searchParams.get('product_item_id');
    const quantity = parseFloat(searchParams.get('quantity') || '1');

    if (!productItemId) {
      return NextResponse.json({
        success: false,
        error: 'product_item_id is required'
      }, { status: 400 });
    }

    if (quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'quantity must be greater than 0'
      }, { status: 400 });
    }

    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get product information using safe Supabase client
    const { data: productInfo, error: productError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, category, unit')
      .eq('item_id', parseInt(productItemId))
      .eq('is_active', true)
      .single();

    if (productError || !productInfo) {
      return NextResponse.json({
        success: false,
        error: 'Product not found or not active'
      }, { status: 404 });
    }

    // Get BOM items using safe Supabase client
    const { data: bomItems, error: bomError } = (await supabase
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        child_item:items!child_item_id(item_code, item_name, category, spec, price, current_stock, safety_stock)
      `)
      .eq('parent_item_id', parseInt(productItemId))
      .eq('is_active', true)) as any;

    if (bomError) {
      throw new Error(`BOM query failed: ${bomError.message}`);
    }

    const bomCheckResults = [];
    let totalRequiredValue = 0;
    let totalAvailableValue = 0;
    let canProduce = true;
    let totalShortage = 0;
    let maxProducibleQuantity = Infinity;
    let bottleneckItem = null;

    for (const bomItem of bomItems || []) {
      const bomQuantityPerUnit = bomItem.quantity_required;
      const requiredQuantity = bomQuantityPerUnit * quantity;
      const availableStock = bomItem.child_item?.current_stock || 0;
      const shortage = Math.max(0, requiredQuantity - availableStock);
      const sufficient = availableStock >= requiredQuantity;

      // Calculate how many products can be produced with this material's stock
      const maxProducibleByThisItem = Math.floor(availableStock / bomQuantityPerUnit);

      if (!sufficient) {
        canProduce = false;
        totalShortage += shortage;
      }

      // Track the bottleneck item (the one with the smallest max producible quantity)
      if (maxProducibleByThisItem < maxProducibleQuantity) {
        maxProducibleQuantity = maxProducibleByThisItem;
        bottleneckItem = {
          bom_id: bomItem.bom_id,
          item_code: bomItem.child_item?.item_code || '',
          item_name: bomItem.child_item?.item_name || '',
          max_producible: maxProducibleByThisItem,
          required_for_requested: requiredQuantity,
          available_stock: availableStock
        };
      }

      const requiredValue = requiredQuantity * (bomItem.child_item?.price || 0);
      const availableValue = Math.min(requiredQuantity, availableStock) * (bomItem.child_item?.price || 0);

      totalRequiredValue += requiredValue;
      totalAvailableValue += availableValue;

      bomCheckResults.push({
        bom_id: bomItem.bom_id,
        child_item_id: bomItem.child_item_id,
        item_code: bomItem.child_item?.item_code,
        item_name: bomItem.child_item?.item_name,
        category: bomItem.child_item?.category,
        spec: bomItem.child_item?.spec,
        unit: bomItem.child_item?.category === '제품' ? 'EA' : 'EA',
        unit_price: bomItem.child_item?.price || 0,
        required_quantity: requiredQuantity,
        available_stock: availableStock,
        shortage: shortage,
        sufficient: sufficient,
        safety_stock: bomItem.child_item?.safety_stock || 0,
        required_value: requiredValue,
        available_value: availableValue,
        max_producible_by_this_item: maxProducibleByThisItem,
        bom_quantity_per_unit: bomQuantityPerUnit
      });
    }

    // Calculate production feasibility
    const fulfillmentRate = totalRequiredValue > 0 ? 
      Math.round((totalAvailableValue / totalRequiredValue) * 10000) / 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        product_info: {
          item_id: productInfo.item_id,
          item_code: productInfo.item_code,
          item_name: productInfo.item_name,
          category: productInfo.category,
          unit: productInfo.unit
        },
        production_quantity: quantity,
        can_produce: canProduce,
        bom_items: bomCheckResults,
        summary: {
          total_bom_items: bomItems.length,
          sufficient_items: bomCheckResults.filter(item => item.sufficient).length,
          insufficient_items: bomCheckResults.filter(item => !item.sufficient).length,
          total_required_value: Math.round(totalRequiredValue * 100) / 100,
          total_available_value: Math.round(totalAvailableValue * 100) / 100,
          total_shortage: totalShortage,
          fulfillment_rate: fulfillmentRate,
          max_producible_quantity: maxProducibleQuantity === Infinity ? quantity : maxProducibleQuantity,
          shortage_quantity: Math.max(0, quantity - (maxProducibleQuantity === Infinity ? quantity : maxProducibleQuantity)),
          bottleneck_item: bottleneckItem
        }
      }
    });

  } catch (error) {
    console.error('Error checking BOM availability:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check BOM availability'
    }, { status: 500 });
  }
}

/**
 * POST /api/inventory/production/bom-check
 * Check BOM availability for production (alternative method using POST body)
 * Body: {
 *   product_item_id: number,
 *   quantity: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);
    const { product_item_id, quantity } = body;

    if (!product_item_id || !quantity) {
      return NextResponse.json({
        success: false,
        error: 'product_item_id and quantity are required'
      }, { status: 400 });
    }

    if (quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'quantity must be greater than 0'
      }, { status: 400 });
    }

    const projectId = process.env.SUPABASE_PROJECT_ID || '';

    // Get product information using correct schema
    const productResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: `SELECT item_id, item_code, item_name, category, unit 
              FROM items 
              WHERE item_id = ${product_item_id} 
              AND is_active = true`
    });

    if (!productResult.rows || productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Product not found or not active'
      }, { status: 404 });
    }

    const productInfo = productResult.rows[0];

    // Get BOM items using correct schema
    const bomResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: `
        SELECT 
          b.bom_id,
          b.parent_item_id,
          b.child_item_id,
          b.quantity,
          b.unit,
          i.item_code,
          i.item_name,
          i.category,
          i.spec,
          i.price,
          i.current_stock,
          i.safety_stock
        FROM bom b
        INNER JOIN items i ON b.child_item_id = i.item_id
        WHERE b.parent_item_id = ${product_item_id}
        AND b.is_active = true
        AND i.is_active = true
      `
    });

    // Type assertion for BOM items from SQL query
    type BOMItemRow = {
      bom_id: number;
      parent_item_id: number;
      child_item_id: number;
      quantity: number;
      unit: string;
      item_code: string;
      item_name: string;
      category: string | null;
      spec: string | null;
      price: number;
      current_stock: number;
      safety_stock: number;
    };

    const bomItems = (bomResult.rows || []) as BOMItemRow[];
    const bomCheckResults = [];

    let totalRequiredValue = 0;
    let totalAvailableValue = 0;
    let canProduce = true;
    let totalShortage = 0;
    let maxProducibleQuantity = Infinity;
    let bottleneckItem = null;

    for (const bomItem of bomItems) {
      const bomQuantityPerUnit = bomItem.quantity as number;
      const requiredQuantity = bomQuantityPerUnit * quantity;
      const availableStock = (bomItem.current_stock as number) || 0;
      const shortage = Math.max(0, requiredQuantity - availableStock);
      const sufficient = availableStock >= requiredQuantity;
      
      // Calculate how many products can be produced with this material's stock
      const maxProducibleByThisItem = Math.floor(availableStock / bomQuantityPerUnit);

      if (!sufficient) {
        canProduce = false;
        totalShortage += shortage;
      }

      // Track the bottleneck item (the one with the smallest max producible quantity)
      if (maxProducibleByThisItem < maxProducibleQuantity) {
        maxProducibleQuantity = maxProducibleByThisItem;
        bottleneckItem = {
          bom_id: bomItem.bom_id,
          item_code: bomItem.item_code,
          item_name: bomItem.item_name,
          max_producible: maxProducibleByThisItem,
          required_for_requested: requiredQuantity,
          available_stock: availableStock
        };
      }

      const requiredValue = requiredQuantity * (bomItem.price || 0);
      const availableValue = Math.min(requiredQuantity, availableStock) * (bomItem.price || 0);
      
      totalRequiredValue += requiredValue;
      totalAvailableValue += availableValue;

      bomCheckResults.push({
        bom_id: bomItem.bom_id,
        child_item_id: bomItem.child_item_id,
        item_code: bomItem.item_code,
        item_name: bomItem.item_name,
        category: bomItem.category,
        spec: bomItem.spec,
        unit: bomItem.unit,
        unit_price: bomItem.price || 0,
        required_quantity: requiredQuantity,
        available_stock: availableStock,
        shortage: shortage,
        sufficient: sufficient,
        safety_stock: bomItem.safety_stock || 0,
        required_value: requiredValue,
        available_value: availableValue,
        max_producible_by_this_item: maxProducibleByThisItem,
        bom_quantity_per_unit: bomQuantityPerUnit
      });
    }

    // Calculate production feasibility
    const fulfillmentRate = totalRequiredValue > 0 ? 
      Math.round((totalAvailableValue / totalRequiredValue) * 10000) / 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        product_info: {
          item_id: productInfo.item_id,
          item_code: productInfo.item_code,
          item_name: productInfo.item_name,
          category: productInfo.category,
          unit: productInfo.unit
        },
        production_quantity: quantity,
        can_produce: canProduce,
        bom_items: bomCheckResults,
        summary: {
          total_bom_items: bomItems.length,
          sufficient_items: bomCheckResults.filter(item => item.sufficient).length,
          insufficient_items: bomCheckResults.filter(item => !item.sufficient).length,
          total_required_value: Math.round(totalRequiredValue * 100) / 100,
          total_available_value: Math.round(totalAvailableValue * 100) / 100,
          total_shortage: totalShortage,
          fulfillment_rate: fulfillmentRate,
          max_producible_quantity: maxProducibleQuantity === Infinity ? quantity : maxProducibleQuantity,
          shortage_quantity: Math.max(0, quantity - (maxProducibleQuantity === Infinity ? quantity : maxProducibleQuantity)),
          bottleneck_item: bottleneckItem
        }
      }
    });

  } catch (error) {
    console.error('Error checking BOM availability:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check BOM availability'
    }, { status: 500 });
  }
}