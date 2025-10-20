import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

/**
 * GET /api/scrap-tracking
 * List scrap tracking records with filters
 * Query parameters:
 * - start_date: Filter by production date (ISO format)
 * - end_date: Filter by production date (ISO format)
 * - item_id: Filter by specific item
 * - limit: Number of records to return (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const item_id = searchParams.get('item_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    // Build query with JOIN to items table for item details
    let query = supabase
      .from('scrap_tracking')
      .select(`
        scrap_id,
        tracking_date,
        item_id,
        production_quantity,
        scrap_weight,
        scrap_unit_price,
        scrap_revenue,
        notes,
        is_active,
        created_at,
        updated_at,
        items:item_id (
          item_id,
          item_code,
          item_name,
          spec,
          unit
        )
      `)
      .eq('is_active', true);

    // Apply filters
    if (start_date) {
      query = query.gte('tracking_date', start_date);
    }

    if (end_date) {
      query = query.lte('tracking_date', end_date);
    }

    if (item_id) {
      query = query.eq('item_id', parseInt(item_id));
    }

    // Apply ordering
    query = query.order('tracking_date', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: records, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // scrap_revenue is already calculated in the database
    const enrichedRecords = records || [];

    // Get total count for pagination
    let countQuery = supabase
      .from('scrap_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (start_date) {
      countQuery = countQuery.gte('tracking_date', start_date);
    }

    if (end_date) {
      countQuery = countQuery.lte('tracking_date', end_date);
    }

    if (item_id) {
      countQuery = countQuery.eq('item_id', parseInt(item_id));
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        data: enrichedRecords,
        pagination: {
          limit,
          offset,
          totalCount: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasNext: offset + limit < (totalCount || 0),
          hasPrev: offset > 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching scrap tracking records:', error);
    return NextResponse.json(
      {
        success: false,
        error: '스크랩 추적 기록 조회에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scrap-tracking
 * Create scrap tracking entry
 * Body: {
 *   tracking_date: string,
 *   item_id: number,
 *   production_quantity: number,
 *   scrap_weight: number,
 *   scrap_unit_price: number,
 *   scrap_revenue?: number,
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const data = JSON.parse(text);

    const {
      tracking_date,
      item_id,
      production_quantity,
      scrap_weight,
      scrap_unit_price,
      scrap_revenue,
      notes
    } = data;

    const supabase = getSupabaseClient();

    // Validation
    if (!tracking_date || !item_id || production_quantity === undefined || scrap_weight === undefined || scrap_unit_price === undefined) {
      return NextResponse.json({
        success: false,
        error: '필수 필드: tracking_date, item_id, production_quantity, scrap_weight, scrap_unit_price'
      }, { status: 400 });
    }

    // Validate tracking_date is not in future
    const trackingDate = new Date(tracking_date);
    const now = new Date();
    if (trackingDate > now) {
      return NextResponse.json({
        success: false,
        error: '추적 날짜는 미래일 수 없습니다.'
      }, { status: 400 });
    }

    // Validate production_quantity > 0
    if (production_quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: '생산 수량은 0보다 커야 합니다.'
      }, { status: 400 });
    }

    // Validate scrap_weight > 0
    if (scrap_weight <= 0) {
      return NextResponse.json({
        success: false,
        error: '스크랩 무게는 0보다 커야 합니다.'
      }, { status: 400 });
    }

    // Validate scrap_unit_price >= 0
    if (scrap_unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: '스크랩 단가는 0 이상이어야 합니다.'
      }, { status: 400 });
    }

    // Check if item exists
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_name')
      .eq('item_id', item_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({
        success: false,
        error: '품목을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // Create scrap tracking entry
    const { data: scrapEntry, error } = await supabase
      .from('scrap_tracking')
      .insert({
        tracking_date,
        item_id,
        production_quantity,
        scrap_weight,
        scrap_unit_price,
        scrap_revenue: scrap_revenue || null,
        notes: notes || null,
        is_active: true
      })
      .select(`
        scrap_id,
        tracking_date,
        item_id,
        production_quantity,
        scrap_weight,
        scrap_unit_price,
        scrap_revenue,
        notes,
        is_active,
        created_at,
        updated_at,
        items:item_id (
          item_id,
          item_code,
          item_name,
          spec,
          unit
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create scrap tracking: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '스크랩 추적이 성공적으로 등록되었습니다.',
      data: scrapEntry
    });
  } catch (error) {
    console.error('Error creating scrap tracking:', error);
    return NextResponse.json({
      success: false,
      error: '스크랩 추적 등록에 실패했습니다.'
    }, { status: 500 });
  }
}

/**
 * PUT /api/scrap-tracking
 * Update scrap tracking entry
 * Body: {
 *   scrap_id: number,
 *   tracking_date?: string,
 *   production_quantity?: number,
 *   scrap_weight?: number,
 *   scrap_unit_price?: number,
 *   scrap_revenue?: number,
 *   notes?: string
 * }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const data = JSON.parse(text);
    const { scrap_id, item_id, ...updateData } = data;

    if (!scrap_id) {
      return NextResponse.json({
        success: false,
        error: 'scrap_id is required'
      }, { status: 400 });
    }

    // Prevent changing item_id
    if (item_id !== undefined) {
      return NextResponse.json({
        success: false,
        error: 'item_id cannot be changed'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Validate tracking_date is not in future if provided
    if (updateData.tracking_date) {
      const trackingDate = new Date(updateData.tracking_date);
      const now = new Date();
      if (trackingDate > now) {
        return NextResponse.json({
          success: false,
          error: '추적 날짜는 미래일 수 없습니다.'
        }, { status: 400 });
      }
    }

    // Validate production_quantity > 0 if provided
    if (updateData.production_quantity !== undefined && updateData.production_quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: '생산 수량은 0보다 커야 합니다.'
      }, { status: 400 });
    }

    // Validate scrap_weight > 0 if provided
    if (updateData.scrap_weight !== undefined && updateData.scrap_weight <= 0) {
      return NextResponse.json({
        success: false,
        error: '스크랩 무게는 0보다 커야 합니다.'
      }, { status: 400 });
    }

    // Validate scrap_unit_price >= 0 if provided
    if (updateData.scrap_unit_price !== undefined && updateData.scrap_unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: '스크랩 단가는 0 이상이어야 합니다.'
      }, { status: 400 });
    }

    const { data: scrapEntry, error } = await supabase
      .from('scrap_tracking')
      .update(updateData)
      .eq('scrap_id', scrap_id)
      .select(`
        scrap_id,
        tracking_date,
        item_id,
        production_quantity,
        scrap_weight,
        scrap_unit_price,
        scrap_revenue,
        notes,
        is_active,
        created_at,
        updated_at,
        items:item_id (
          item_id,
          item_code,
          item_name,
          spec,
          unit
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update scrap tracking: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '스크랩 추적이 성공적으로 업데이트되었습니다.',
      data: scrapEntry
    });
  } catch (error) {
    console.error('Error updating scrap tracking:', error);
    return NextResponse.json({
      success: false,
      error: '스크랩 추적 업데이트에 실패했습니다.'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/scrap-tracking
 * Soft delete scrap tracking entry
 * Query parameter: id - Scrap tracking ID
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const scrapTrackingId = searchParams.get('id');

    if (!scrapTrackingId) {
      return NextResponse.json({
        success: false,
        error: 'scrap_tracking_id is required'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('scrap_tracking')
      .update({ is_active: false })
      .eq('scrap_tracking_id', scrapTrackingId);

    if (error) {
      throw new Error(`Failed to delete scrap tracking: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '스크랩 추적이 성공적으로 삭제되었습니다.',
      data: { deleted_id: scrapTrackingId }
    });
  } catch (error) {
    console.error('Error deleting scrap tracking:', error);
    return NextResponse.json({
      success: false,
      error: '스크랩 추적 삭제에 실패했습니다.'
    }, { status: 500 });
  }
}
