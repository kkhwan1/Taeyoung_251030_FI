import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


/**
 * GET /api/bom/[id]
 * Get single BOM with cost summary and component details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const bomId = parseInt(id);

    if (isNaN(bomId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid BOM ID'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get BOM details with cost calculations from view
    const { data: bomDetails, error: bomError } = await supabase
      .from('v_bom_details')
      .select('*')
      .eq('bom_id', bomId)
      .single() as any;

    if (bomError) {
      throw new Error(`Failed to fetch BOM details: ${bomError.message}`);
    }

    if (!bomDetails) {
      return NextResponse.json({
        success: false,
        error: 'BOM not found'
      }, { status: 404 });
    }

    // Calculate cost summary
    const costSummary = {
      material_cost: bomDetails.material_cost || 0,
      scrap_revenue: bomDetails.item_scrap_revenue || 0,
      net_cost: bomDetails.net_cost || 0,
      has_coil_specs: !!bomDetails.material_grade,
      has_scrap_tracking: !!bomDetails.scrap_weight,
      has_purchase_price: !!bomDetails.purchase_unit_price
    };

    return NextResponse.json({
      success: true,
      data: {
        bom: bomDetails,
        cost_summary: costSummary
      }
    });
  } catch (error) {
    console.error('Error fetching BOM by ID:', error);
    return NextResponse.json({
      success: false,
      error: 'BOM 조회에 실패했습니다.'
    }, { status: 500 });
  }
}
