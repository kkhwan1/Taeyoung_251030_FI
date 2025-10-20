import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

/**
 * BOM Explosion Response Type
 */
interface BomExplosionItem {
  item_id: number;
  item_name: string;
  item_code: string;
  spec: string | null;
  unit: string;
  level_no: number;
  quantity_required: number;
  cumulative_quantity: number;
  component_cost: number;
  net_cost: number;
  path: string;
}

interface BomExplosionResponse {
  success: boolean;
  data?: {
    parent_item: {
      item_id: number;
      item_name: string;
      item_code: string;
    };
    explosion: BomExplosionItem[];
    summary: {
      total_items: number;
      max_level: number;
      total_cost: number;
    };
  };
  error?: string;
}

/**
 * GET /api/bom/explosion/[parent_item_id]
 * BOM Explosion - Recursive multi-level BOM traversal
 *
 * Path parameters:
 * - parent_item_id: Parent item ID to explode
 *
 * Query parameters:
 * - max_depth: Maximum recursion depth (default: 10)
 *
 * Returns flattened list with:
 * - Level indicators
 * - Cumulative quantities (parent × child × grandchild...)
 * - Cost calculations from v_bom_details view
 * - Breadcrumb paths for traceability
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ parent_item_id: string }> }
): Promise<NextResponse<BomExplosionResponse>> {
  try {
    // Await params to access parent_item_id
    const params = await context.params;
    const parentItemId = parseInt(params.parent_item_id);

    const searchParams = request.nextUrl.searchParams;
    const maxDepth = parseInt(searchParams.get('max_depth') || '10');

    // Validation
    if (isNaN(parentItemId) || parentItemId <= 0) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 부모 품목 ID입니다.'
      }, { status: 400 });
    }

    if (maxDepth < 1 || maxDepth > 20) {
      return NextResponse.json({
        success: false,
        error: '최대 깊이는 1-20 사이여야 합니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Step 1: Verify parent item exists
    const { data: parentItem, error: parentError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, is_active')
      .eq('item_id', parentItemId)
      .single() as any;

    if (parentError || !parentItem) {
      return NextResponse.json({
        success: false,
        error: '부모 품목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    if (!parentItem.is_active) {
      return NextResponse.json({
        success: false,
        error: '비활성화된 품목입니다.'
      }, { status: 400 });
    }

    // Step 2: Recursive BOM explosion
    const visitedItems = new Set<number>(); // Prevent circular references
    const explosionResults: BomExplosionItem[] = [];
    let maxLevel = 0;

    /**
     * Recursive function to traverse BOM tree
     * @param itemId - Current item ID to explode
     * @param parentPath - Breadcrumb path from root
     * @param level - Current BOM level
     * @param cumulativeQuantity - Accumulated quantity from root
     */
    async function explodeBom(
      itemId: number,
      parentPath: string,
      level: number,
      cumulativeQuantity: number
    ): Promise<void> {
      // Prevent infinite recursion
      if (level > maxDepth) {
        return;
      }

      // Circular reference detection
      if (visitedItems.has(itemId)) {
        console.warn(`Circular reference detected for item ${itemId}`);
        return;
      }

      visitedItems.add(itemId);

      // Query BOM table with enriched item data
      const bomQuery = await supabase
        .from('bom')
        .select(`
          bom_id,
          child_item_id,
          quantity_required,
          level_no,
          child_item:items!bom_child_item_id_fkey (
            item_id,
            item_code,
            item_name,
            spec,
            unit,
            unit_price
          )
        `)
        .eq('parent_item_id', itemId)
        .eq('is_active', true)
        .order('child_item_id', { ascending: true });

      const bomChildren: any[] | null = bomQuery.data;
      const bomError = bomQuery.error;

      if (bomError) {
        console.error('BOM query failed:', bomError);
        throw bomError;
      }

      if (!bomChildren || bomChildren.length === 0) {
        visitedItems.delete(itemId); // Remove from visited for other paths
        return;
      }

      // Update max level tracker
      maxLevel = Math.max(maxLevel, level);

      // Process each child
      for (const child of bomChildren) {
        // Validate child item exists in join result
        if (!child.child_item) {
          console.warn(`Child item data missing for BOM ID ${child.bom_id}`);
          continue;
        }

        const childItem = (child as any).child_item; // Type assertion for joined data

        // Calculate cumulative quantity
        const childCumulativeQuantity = cumulativeQuantity * (child.quantity_required || 1);

        // Calculate costs
        const unitPrice = childItem.unit_price || 0;
        const componentCost = unitPrice * (child.quantity_required || 1);
        const netCost = componentCost; // Simplified - scrap revenue can be added later

        // Build breadcrumb path
        const childPath = parentPath ? `${parentPath} > ${childItem.item_name}` : childItem.item_name;

        // Add to explosion results
        explosionResults.push({
          item_id: childItem.item_id,
          item_name: childItem.item_name,
          item_code: childItem.item_code,
          spec: childItem.spec,
          unit: childItem.unit,
          level_no: level,
          quantity_required: child.quantity_required || 1,
          cumulative_quantity: childCumulativeQuantity,
          component_cost: Math.round(componentCost),
          net_cost: Math.round(netCost),
          path: childPath
        });

        // Recursive call for grandchildren
        await explodeBom(
          child.child_item_id,
          childPath,
          level + 1,
          childCumulativeQuantity
        );
      }

      visitedItems.delete(itemId); // Remove from visited for other paths
    }

    // Start recursion from root
    await explodeBom(parentItemId, parentItem.item_name, 1, 1);

    // Step 3: Calculate summary
    const totalCost = explosionResults.reduce((sum, item) => sum + (item.net_cost * item.cumulative_quantity), 0);

    // Return explosion results
    return NextResponse.json({
      success: true,
      data: {
        parent_item: {
          item_id: parentItem.item_id,
          item_name: parentItem.item_name,
          item_code: parentItem.item_code
        },
        explosion: explosionResults,
        summary: {
          total_items: explosionResults.length,
          max_level: maxLevel,
          total_cost: Math.round(totalCost)
        }
      }
    });

  } catch (error) {
    console.error('Error exploding BOM:', error);

    // Check for circular reference error
    if (error instanceof Error && error.message.includes('circular')) {
      return NextResponse.json({
        success: false,
        error: 'BOM에 순환 참조가 감지되었습니다. BOM 구조를 확인하세요.'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'BOM 전개 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
