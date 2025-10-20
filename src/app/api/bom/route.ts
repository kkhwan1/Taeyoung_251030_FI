import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import type { Database } from '@/types/supabase';

/**
 * GET /api/bom
 * List BOM entries with filters
 * Query parameters:
 * - parent_item_id: Filter by parent item
 * - child_item_id: Filter by child item
 * - level_no: Filter by BOM level
 * - limit: Number of records to return (default: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parentItemId = searchParams.get('parent_item_id');
    const childItemId = searchParams.get('child_item_id');
    const levelNo = searchParams.get('level_no');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    // Build query using v_bom_details view for cost calculations
    let query = supabase
      .from('v_bom_details')
      .select('*')
      .order('bom_id', { ascending: true }) as any;

    // Apply filters
    if (parentItemId) {
      query = query.eq('parent_item_id', parentItemId);
    }

    if (childItemId) {
      query = query.eq('child_item_id', childItemId);
    }

    if (levelNo) {
      query = query.eq('level_no', parseInt(levelNo));
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: bomEntries, error } = await query;

    if (error) {
      console.error('BOM query failed:', error);
      return NextResponse.json({
        success: false,
        error: 'BOM 조회에 실패했습니다.'
      }, { status: 500 });
    }

    // ✅ CRITICAL FIX: Add is_active field (v_bom_details view doesn't include it)
    // Transform data to include is_active field, defaulting to true if undefined
    const transformedEntries = bomEntries?.map((item: any) => ({
      ...item,
      is_active: item.is_active !== undefined ? item.is_active : true
    })) || [];

    // Calculate cost summary totals
    const costSummary = {
      total_component_cost: transformedEntries.reduce((sum: number, item: any) => sum + (item.component_cost || 0), 0),
      total_scrap_revenue: transformedEntries.reduce((sum: number, item: any) => sum + (item.scrap_revenue_per_piece || 0), 0),
      total_net_cost: transformedEntries.reduce((sum: number, item: any) => sum + (item.net_cost || 0), 0),
      coil_count: transformedEntries.filter((item: any) => item.weight_per_piece).length,
      purchased_count: transformedEntries.filter((item: any) => item.purchase_unit_price).length
    };

    // Get total count for pagination
    let countQuery = supabase
      .from('v_bom_details')
      .select('*', { count: 'exact', head: true }) as any;

    // Apply same filters for count
    if (parentItemId) {
      countQuery = countQuery.eq('parent_item_id', parentItemId);
    }

    if (childItemId) {
      countQuery = countQuery.eq('child_item_id', childItemId);
    }

    if (levelNo) {
      countQuery = countQuery.eq('level_no', parseInt(levelNo));
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error('Count query failed:', countError);
    }

    return NextResponse.json({
      success: true,
      data: {
        bom_entries: transformedEntries,
        cost_summary: costSummary,
        pagination: {
          total: totalCount || 0,
          limit,
          offset,
          has_more: offset + limit < (totalCount || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching BOM:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'BOM 조회 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bom
 * Create new BOM entry
 * Body: {
 *   parent_item_id: number,
 *   child_item_id: number,
 *   quantity_required: number,
 *   level_no?: number (default: 1)
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ✅ CRITICAL: Use request.text() + JSON.parse() for proper Korean encoding
    const text = await request.text();
    const body = JSON.parse(text);

    const {
      parent_item_id,
      child_item_id,
      quantity_required,
      level_no = 1
    } = body;

    const supabase = getSupabaseClient();

    // Validation
    if (!parent_item_id || !child_item_id || !quantity_required) {
      return NextResponse.json({
        success: false,
        error: '부모 품목, 자식 품목, 소요수량은 필수입니다.'
      }, { status: 400 });
    }

    if (quantity_required <= 0) {
      return NextResponse.json({
        success: false,
        error: '소요수량은 0보다 커야 합니다.'
      }, { status: 400 });
    }

    if (parent_item_id === child_item_id) {
      return NextResponse.json({
        success: false,
        error: '부모 품목과 자식 품목이 같을 수 없습니다.'
      }, { status: 400 });
    }

    // Check if parent and child items exist
    const { data: parentItem, error: parentError } = await supabase
      .from('items')
      .select('item_id, item_name, is_active')
      .eq('item_id', parent_item_id)
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
        error: '비활성화된 부모 품목입니다.'
      }, { status: 400 });
    }

    const { data: childItem, error: childError } = await supabase
      .from('items')
      .select('item_id, item_name, is_active')
      .eq('item_id', child_item_id)
      .single() as any;

    if (childError || !childItem) {
      return NextResponse.json({
        success: false,
        error: '자식 품목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    if (!childItem.is_active) {
      return NextResponse.json({
        success: false,
        error: '비활성화된 자식 품목입니다.'
      }, { status: 400 });
    }

    // Check for duplicate BOM entry
    const { data: existingBom } = await supabase
      .from('bom')
      .select('bom_id')
      .eq('parent_item_id', parent_item_id)
      .eq('child_item_id', child_item_id)
      .eq('is_active', true)
      .maybeSingle();

    if (existingBom) {
      return NextResponse.json({
        success: false,
        error: '이미 존재하는 BOM 항목입니다.'
      }, { status: 400 });
    }

    // Create BOM entry
    const { data: bomEntry, error } = (await supabase
      .from('bom')
      .insert({
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        is_active: true
      } as any)
      .select(`
        *,
        parent_item:items!bom_parent_item_id_fkey(item_code, item_name, spec, unit),
        child_item:items!bom_child_item_id_fkey(item_code, item_name, spec, unit)
      `)
      .single()) as any;

    if (error) {
      console.error('BOM insert failed:', error);
      return NextResponse.json({
        success: false,
        error: 'BOM 등록에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'BOM 항목이 성공적으로 등록되었습니다.',
      data: bomEntry
    });
  } catch (error) {
    console.error('Error creating BOM entry:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'BOM 등록 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bom
 * Update existing BOM entry
 * Body: {
 *   bom_id: number,
 *   quantity_required?: number,
 *   level_no?: number,
 *   is_active?: boolean
 * }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // ✅ CRITICAL: Use request.text() + JSON.parse() for proper Korean encoding
    const text = await request.text();
    const body = JSON.parse(text);

    const { bom_id, ...updateData } = body;

    const supabase = getSupabaseClient();

    if (!bom_id) {
      return NextResponse.json({
        success: false,
        error: 'BOM ID가 필요합니다.'
      }, { status: 400 });
    }

    // Validate quantity_required if being updated
    if (updateData.quantity_required !== undefined && updateData.quantity_required <= 0) {
      return NextResponse.json({
        success: false,
        error: '소요수량은 0보다 커야 합니다.'
      }, { status: 400 });
    }

    // Check if BOM entry exists
    const { data: existingBom, error: checkError } = await supabase
      .from('bom')
      .select('bom_id, parent_item_id, child_item_id')
      .eq('bom_id', bom_id)
      .single() as any;

    if (checkError || !existingBom) {
      return NextResponse.json({
        success: false,
        error: 'BOM 항목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // Update BOM entry
    type BOMRow = Database['public']['Tables']['bom']['Row'];
    const { data: bomEntry, error } = await supabase
      .from('bom')
      .update(updateData as Database['public']['Tables']['bom']['Update'])
      .eq('bom_id', bom_id)
      .select(`
        *,
        parent_item:items!bom_parent_item_id_fkey(item_code, item_name, spec, unit),
        child_item:items!bom_child_item_id_fkey(item_code, item_name, spec, unit)
      `)
      .single() as { data: BOMRow | null; error: any };

    if (error) {
      console.error('BOM update failed:', error);
      return NextResponse.json({
        success: false,
        error: 'BOM 업데이트에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'BOM 항목이 성공적으로 업데이트되었습니다.',
      data: bomEntry
    });
  } catch (error) {
    console.error('Error updating BOM entry:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'BOM 업데이트 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bom
 * Delete BOM entry (soft delete)
 * Query parameter: id - BOM ID to delete
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    const supabase = getSupabaseClient();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'BOM ID가 필요합니다.'
      }, { status: 400 });
    }

    // Check if BOM entry exists
    const bomId = parseInt(id);
    const { data: existingBom, error: checkError } = await supabase
      .from('bom')
      .select('bom_id')
      .eq('bom_id', bomId)
      .single() as any;

    if (checkError || !existingBom) {
      return NextResponse.json({
        success: false,
        error: 'BOM 항목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('bom')
      .update({ is_active: false } as Database['public']['Tables']['bom']['Update'])
      .eq('bom_id', bomId);

    if (error) {
      console.error('BOM delete failed:', error);
      return NextResponse.json({
        success: false,
        error: 'BOM 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'BOM 항목이 성공적으로 삭제되었습니다.',
      data: { deleted_id: bomId }
    });
  } catch (error) {
    console.error('Error deleting BOM entry:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'BOM 삭제 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
