import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


/**
 * BOM Where-Used API - Recursive Upward Traversal
 *
 * GET /api/bom/where-used/[child_item_id]
 *
 * Finds all parent items that use this child (reverse BOM lookup)
 * Recursively finds grandparents, great-grandparents, etc.
 * Returns multi-level hierarchy showing where the item is used
 *
 * @param child_item_id - URL parameter (dynamic route)
 *
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     child_item: { item_id, item_name, item_code },
 *     where_used: [
 *       {
 *         parent_item_id, parent_item_name, parent_item_code,
 *         quantity_required: 2.0,
 *         level_no: 1,
 *         usage_path: "완제품A > 중간조립품B > 이 부품"
 *       }
 *     ],
 *     summary: {
 *       direct_parents: 3,
 *       total_ancestors: 8,
 *       max_level: 4
 *     }
 *   }
 * }
 */

interface WhereUsedItem {
  parent_item_id: number;
  parent_item_name: string;
  parent_item_code: string;
  parent_item_type?: string;
  quantity_required: number;
  unit?: string;
  level_no: number;
  usage_path: string;
  bom_id: number;
}

interface ChildItem {
  item_id: number;
  item_name: string;
  item_code: string;
  item_type?: string;
  spec?: string;
  unit?: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ child_item_id: string }> }
): Promise<NextResponse> {
  try {
    // Await params to access child_item_id
    const params = await context.params;
    const childItemId = parseInt(params.child_item_id);

    if (isNaN(childItemId)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 품목 ID입니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. Verify child item exists
    const { data: childItem, error: childError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, item_type, spec, unit')
      .eq('item_id', childItemId)
      .eq('is_active', true)
      .single() as any;

    if (childError || !childItem) {
      return NextResponse.json({
        success: false,
        error: '품목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 2. Find all usages recursively
    const whereUsedItems: WhereUsedItem[] = [];
    const visitedItems = new Set<number>(); // Prevent circular references

    /**
     * Recursive function to find all ancestors
     * @param currentItemId - Current item to find parents for
     * @param currentLevel - Current level in hierarchy (1 = direct parent)
     * @param pathPrefix - Accumulated path for display
     * @param quantityMultiplier - Accumulated quantity from child to root
     */
    const findAncestors = async (
      currentItemId: number,
      currentLevel: number,
      pathPrefix: string,
      quantityMultiplier: number
    ): Promise<void> => {
      // Prevent circular references
      if (visitedItems.has(currentItemId)) {
        console.warn(`Circular reference detected for item_id: ${currentItemId}`);
        return;
      }
      visitedItems.add(currentItemId);

      // Query v_bom_details to find direct parents
      const { data: parents, error } = await supabase
        .from('v_bom_details')
        .select(`
          bom_id,
          parent_item_id,
          parent_code,
          parent_name,
          parent_item_type,
          child_item_id,
          quantity_required,
          child_unit
        `)
        .eq('child_item_id', currentItemId) as any;

      if (error) {
        console.error(`Error finding parents for item ${currentItemId}:`, error);
        return;
      }

      if (!parents || parents.length === 0) {
        return; // No more parents, end of recursion
      }

      // Process each parent
      for (const parent of parents) {
        const cumulativeQuantity = quantityMultiplier * (parent.quantity_required || 1);
        const usagePath = pathPrefix
          ? `${parent.parent_name} > ${pathPrefix}`
          : parent.parent_name;

        // Add to results
        whereUsedItems.push({
          parent_item_id: parent.parent_item_id,
          parent_item_name: parent.parent_name,
          parent_item_code: parent.parent_code,
          parent_item_type: parent.parent_item_type,
          quantity_required: cumulativeQuantity,
          unit: parent.child_unit,
          level_no: currentLevel,
          usage_path: usagePath,
          bom_id: parent.bom_id
        });

        // Recursively find grandparents
        await findAncestors(
          parent.parent_item_id,
          currentLevel + 1,
          usagePath,
          cumulativeQuantity
        );
      }

      // Remove from visited after processing to allow alternative paths
      visitedItems.delete(currentItemId);
    };

    // Start recursive search from child item
    await findAncestors(
      childItemId,
      1, // Level 1 = direct parent
      childItem.item_name,
      1 // Initial quantity multiplier
    );

    // 3. Calculate summary statistics
    const directParents = new Set(
      whereUsedItems.filter(item => item.level_no === 1).map(item => item.parent_item_id)
    ).size;

    const totalAncestors = new Set(
      whereUsedItems.map(item => item.parent_item_id)
    ).size;

    const maxLevel = whereUsedItems.length > 0
      ? Math.max(...whereUsedItems.map(item => item.level_no))
      : 0;

    // 4. Sort by level and then by parent name
    whereUsedItems.sort((a, b) => {
      if (a.level_no !== b.level_no) {
        return a.level_no - b.level_no;
      }
      return a.parent_item_name.localeCompare(b.parent_item_name, 'ko-KR');
    });

    // 5. Return response
    if (whereUsedItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          child_item: childItem as ChildItem,
          where_used: [],
          summary: {
            direct_parents: 0,
            total_ancestors: 0,
            max_level: 0,
            message: '이 품목은 현재 어떤 상위 품목에도 사용되지 않습니다.'
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        child_item: childItem as ChildItem,
        where_used: whereUsedItems,
        summary: {
          direct_parents: directParents,
          total_ancestors: totalAncestors,
          max_level: maxLevel
        }
      }
    });

  } catch (error) {
    console.error('Error in BOM where-used recursive lookup:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Where-used 조회에 실패했습니다.'
    }, { status: 500 });
  }
}
