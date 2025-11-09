import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/bom/full-tree
 *
 * Returns the complete BOM tree hierarchy using recursive CTE.
 *
 * Query Parameters:
 * - parent_item_id (optional): Filter by specific parent item
 * - max_depth (optional): Maximum recursion depth (default: 10)
 *
 * Response:
 * {
 *   success: true,
 *   data: [{
 *     bom_id: number,
 *     parent_item_id: number,
 *     parent_item_code: string,
 *     parent_item_name: string,
 *     child_item_id: number,
 *     child_item_code: string,
 *     child_item_name: string,
 *     child_spec: string,
 *     child_item_type: string,
 *     child_current_stock: number,
 *     child_unit_price: string,
 *     quantity_required: string,
 *     level_no: number,
 *     labor_cost: string,
 *     notes: string,
 *     level: number,
 *     depth: number,
 *     name_path: string[]
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);

    const parentItemId = searchParams.get('parent_item_id');
    const maxDepth = parseInt(searchParams.get('max_depth') || '10', 10);

    // Build WHERE clause for base case
    let whereClause = 'b.is_active = true AND ci.is_active = true';
    if (parentItemId) {
      whereClause += ` AND b.parent_item_id = ${parentItemId}`;
    }

    // Use direct SQL query through Supabase's FROM clause with RPC
    // Build the query using Supabase's query builder for recursive CTE
    let query = supabase
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        labor_cost,
        notes,
        parent:items!parent_item_id(item_code, item_name),
        child:items!child_item_id(item_code, item_name, spec, item_type, current_stock, price)
      `)
      .eq('is_active', true);

    if (parentItemId) {
      query = query.eq('parent_item_id', parentItemId);
    }

    const { data: bomData, error } = await query.order('parent_item_id');

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Build hierarchical structure manually
    const buildHierarchy = (items: any[], parentId: number | null = null, level: number = 1): any[] => {
      if (level > maxDepth) return [];

      const children = items.filter(item =>
        parentId === null ? true : item.parent_item_id === parentId
      );

      return children.flatMap(item => {
        const node = {
          bom_id: item.bom_id,
          parent_item_id: item.parent_item_id,
          parent_item_code: item.parent?.item_code || '',
          parent_item_name: item.parent?.item_name || '',
          child_item_id: item.child_item_id,
          child_item_code: item.child?.item_code || '',
          child_item_name: item.child?.item_name || '',
          child_spec: item.child?.spec || '',
          child_item_type: item.child?.item_type || '',
          child_current_stock: item.child?.current_stock || 0,
          child_unit_price: item.child?.price || '0',
          quantity_required: item.quantity_required,
          level_no: item.level_no,
          labor_cost: item.labor_cost || '0',
          notes: item.notes || '',
          level,
          depth: level,
          name_path: [item.child?.item_name || '']
        };

        return [node, ...buildHierarchy(items, item.child_item_id, level + 1)];
      });
    };

    const hierarchicalData = buildHierarchy(bomData || []);

    return NextResponse.json({
      success: true,
      data: hierarchicalData,
      count: hierarchicalData.length
    });

  } catch (error) {
    console.error('BOM full-tree API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
