import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import type {
  BOMCalculationRequest,
  BOMCalculationResponse,
  BOMItem
} from '@/types/api/price-master';

/**
 * POST /api/price-master/calculate-from-bom
 * Calculate item price from BOM structure (recursive)
 *
 * Body: {
 *   item_id: string,
 *   effective_date?: string (default: today),
 *   include_labor?: boolean (default: false),
 *   include_overhead?: boolean (default: false)
 * }
 *
 * Returns:
 * - Total material/labor/overhead costs
 * - Calculated price
 * - BOM tree structure with prices
 * - Items with missing prices
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const requestData: BOMCalculationRequest = JSON.parse(text);

    const {
      item_id,
      effective_date = new Date().toISOString().split('T')[0],
      include_labor = false,
      include_overhead = false
    } = requestData;

    // Validation
    if (!item_id) {
      return NextResponse.json({
        success: false,
        error: 'item_id는 필수입니다.'
      }, { status: 400 });
    }

    // Validate effective_date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(effective_date)) {
      return NextResponse.json({
        success: false,
        error: '유효일 형식이 올바르지 않습니다. (YYYY-MM-DD)'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Get parent item info
    const { data: parentItem, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, unit')
      .eq('item_id', parseInt(item_id))
      .single();

    if (itemError || !parentItem) {
      return NextResponse.json({
        success: false,
        error: '품목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // Get BOM structure
    const { data: bomData, error: bomError } = await supabase
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        items!bom_child_item_id_fkey (
          item_id,
          item_code,
          item_name,
          unit
        )
      `)
      .eq('parent_item_id', parseInt(item_id))
      .eq('is_active', true);

    if (bomError) {
      throw new Error(`BOM 조회 실패: ${bomError.message}`);
    }

    // Recursive function to build BOM tree with prices
    const missing_prices: Array<{ item_code: string; item_name: string; level: number }> = [];

    async function buildBOMTree(
      item_id: number,
      quantity: number = 1,
      level: number = 0
    ): Promise<BOMItem & { unit_price?: number; subtotal_cost?: number }> {
      // Get item info
      const { data: item, error: itemErr } = await supabase
        .from('items')
        .select('item_id, item_code, item_name, unit')
        .eq('item_id', item_id)
        .single();

      if (itemErr) {
        throw new Error(`품목 조회 실패: ${itemErr.message}`);
      }

      // Get current price at effective_date
      const { data: priceData, error: priceErr } = await supabase
        .from('price_master')
        .select('unit_price')
        .eq('item_id', item_id)
        .lte('effective_date', effective_date)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();

      const unit_price = priceData?.unit_price || null;

      if (!unit_price && level > 0) {
        // Missing price for component (not parent)
        missing_prices.push({
          item_code: item.item_code,
          item_name: item.item_name,
          level
        });
      }

      // Get child components
      const { data: children, error: childErr } = await supabase
        .from('bom')
        .select(`
          child_item_id,
          quantity_required
        `)
        .eq('parent_item_id', item_id)
        .eq('is_active', true);

      if (childErr && childErr.code !== 'PGRST116') {
        // PGRST116 = no rows returned (OK for leaf nodes)
        throw new Error(`BOM 하위 조회 실패: ${childErr.message}`);
      }

      let childrenData: BOMItem[] = [];
      let subtotal_cost = 0;

      if (children && children.length > 0) {
        // Has children - recursive
        childrenData = await Promise.all(
          children.map(async (child) => {
            const childTree = await buildBOMTree(
              child.child_item_id,
              child.quantity_required * quantity,
              level + 1
            );
            subtotal_cost += childTree.subtotal_cost || 0;
            return childTree;
          })
        );
      } else {
        // Leaf node - use unit price
        if (unit_price) {
          subtotal_cost = unit_price * quantity;
        }
      }

      return {
        item_id: item.item_id.toString(),
        item_code: item.item_code,
        item_name: item.item_name,
        quantity,
        unit_price,
        level,
        children: childrenData.length > 0 ? childrenData : undefined,
        subtotal_cost
      };
    }

    // Build BOM tree
    const bomTree = await buildBOMTree(parseInt(item_id), 1, 0);

    // Calculate costs
    const total_material_cost = bomTree.subtotal_cost || 0;

    // Labor cost (placeholder - would come from manufacturing routes)
    const total_labor_cost = include_labor ? total_material_cost * 0.1 : 0;

    // Overhead cost (placeholder - would come from cost accounting)
    const total_overhead_cost = include_overhead ? total_material_cost * 0.05 : 0;

    // Final calculated price
    const calculated_price = total_material_cost + total_labor_cost + total_overhead_cost;

    const response: BOMCalculationResponse = {
      success: true,
      data: {
        item_id: parentItem.item_id.toString(),
        item_code: parentItem.item_code,
        item_name: parentItem.item_name,
        total_material_cost,
        total_labor_cost,
        total_overhead_cost,
        calculated_price,
        bom_tree: bomTree,
        calculation_date: new Date().toISOString(),
        missing_prices
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error calculating BOM price:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'BOM 가격 계산에 실패했습니다.'
    }, { status: 500 });
  }
}
