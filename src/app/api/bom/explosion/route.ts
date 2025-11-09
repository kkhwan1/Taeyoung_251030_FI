import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


/**
 * GET /api/bom/explosion
 * BOM explosion - Material Requirements Planning (MRP)
 * Query parameters:
 * - parent_item_id: Parent item ID (required)
 * - quantity: Production quantity (default: 1)
 * - max_level: Maximum BOM levels to explode (default: 10)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parentItemId = searchParams.get('parent_item_id');
    const quantity = parseInt(searchParams.get('quantity') || '1');
    const maxLevel = parseInt(searchParams.get('max_level') || '10');

    if (!parentItemId) {
      return NextResponse.json({
        success: false,
        error: 'parent_item_id is required'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Recursive CTE to explode BOM
    const { data: explosion, error } = await supabase.rpc('explode_bom', {
      p_parent_item_id: parseInt(parentItemId),
      p_quantity: quantity,
      p_max_level: maxLevel
    });

    if (error) {
      // If stored procedure doesn't exist, fall back to iterative approach
      const { data: bomData, error: bomError } = await supabase
        .from('v_bom_details')
        .select('*')
        .eq('parent_item_id', parentItemId);

      if (bomError) {
        throw new Error(`Failed to fetch BOM: ${bomError.message}`);
      }

      // Calculate material requirements
      const materialRequirements = bomData.map(item => ({
        item_id: item.child_item_id,
        item_code: item.child_item_code,
        item_name: item.child_item_name,
        item_type: item.child_item_type,
        required_quantity: item.required_quantity * quantity,
        unit: item.child_unit,
        material_cost: (item.material_cost || 0) * quantity,
        scrap_revenue: (item.item_scrap_revenue || 0) * quantity,
        net_cost: (item.net_cost || 0) * quantity,
        level: 1
      }));

      // Calculate totals
      const totals = {
        total_components: materialRequirements.length,
        total_material_cost: materialRequirements.reduce((sum, item) => sum + (item.material_cost || 0), 0),
        total_scrap_revenue: materialRequirements.reduce((sum, item) => sum + (item.scrap_revenue || 0), 0),
        total_net_cost: materialRequirements.reduce((sum, item) => sum + (item.net_cost || 0), 0),
        coil_count: materialRequirements.filter(item => item.item_type === 'coil').length,
        purchased_count: materialRequirements.filter(item => item.item_type === 'purchased').length
      };

      return NextResponse.json({
        success: true,
        data: {
          parent_item_id: parseInt(parentItemId),
          production_quantity: quantity,
          max_level: maxLevel,
          material_requirements: materialRequirements,
          totals
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: explosion
    });
  } catch (error) {
    console.error('Error exploding BOM:', error);
    return NextResponse.json({
      success: false,
      error: 'BOM explosion에 실패했습니다.'
    }, { status: 500 });
  }
}
