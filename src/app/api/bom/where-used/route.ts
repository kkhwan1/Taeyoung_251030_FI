import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/bom/where-used
 * Where-used analysis - Find all parent items that use a specific component
 * Query parameters:
 * - child_item_id: Child item ID (required)
 * - include_costs: Include cost calculations (default: true)
 */

// Define proper interface for summary object
interface UsageSummary {
  used_in_count: number;
  total_usage_count: number;
  total_material_cost?: number;
  total_scrap_revenue?: number;
  total_net_cost?: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const childItemId = searchParams.get('child_item_id');
    const includeCosts = searchParams.get('include_costs') !== 'false';

    if (!childItemId) {
      return NextResponse.json({
        success: false,
        error: 'child_item_id is required'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all BOMs where this item is a child
    const { data: whereUsed, error } = await supabase
      .from('v_bom_details')
      .select('*')
      .eq('child_item_id', childItemId)
      .order('parent_item_code');

    if (error) {
      throw new Error(`Failed to fetch where-used data: ${error.message}`);
    }

    // Get the child item details
    const { data: childItem, error: childError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, item_type, spec, unit')
      .eq('item_id', childItemId)
      .single() as any;

    if (childError) {
      throw new Error(`Failed to fetch child item: ${childError.message}`);
    }

    // Group by parent item
    const parentItems = whereUsed.reduce((acc, item) => {
      const parentKey = item.parent_item_id;
      if (!acc[parentKey]) {
        acc[parentKey] = {
          parent_item_id: item.parent_item_id,
          parent_item_code: item.parent_item_code,
          parent_item_name: item.parent_item_name,
          parent_item_type: item.parent_item_type,
          usage_details: []
        };
      }

      const usageDetail: any = {
        bom_id: item.bom_id,
        required_quantity: item.required_quantity,
        unit: item.child_unit
      };

      if (includeCosts) {
        usageDetail.material_cost = item.material_cost;
        usageDetail.scrap_revenue = item.item_scrap_revenue;
        usageDetail.net_cost = item.net_cost;
      }

      acc[parentKey].usage_details.push(usageDetail);
      return acc;
    }, {} as Record<number, any>);

    const summary: UsageSummary = {
      used_in_count: Object.keys(parentItems).length,
      total_usage_count: whereUsed.length
    };

    if (includeCosts) {
      summary.total_material_cost = whereUsed.reduce((sum, item) => sum + (item.material_cost || 0), 0);
      summary.total_scrap_revenue = whereUsed.reduce((sum, item) => sum + (item.item_scrap_revenue || 0), 0);
      summary.total_net_cost = whereUsed.reduce((sum, item) => sum + (item.net_cost || 0), 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        child_item: childItem,
        parent_items: Object.values(parentItems),
        summary
      }
    });
  } catch (error) {
    console.error('Error fetching where-used:', error);
    return NextResponse.json({
      success: false,
      error: 'Where-used 조회에 실패했습니다.'
    }, { status: 500 });
  }
}
