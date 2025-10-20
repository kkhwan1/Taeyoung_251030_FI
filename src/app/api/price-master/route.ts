import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

/**
 * GET /api/price-master
 * List price history with filters and joins
 *
 * Query parameters:
 * - item_id: Filter by item (required for price history)
 * - is_current: Filter current prices only (optional, boolean)
 * - limit: Number of records (default: 20)
 * - offset: Pagination offset (default: 0)
 *
 * Returns price history joined with item information
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const item_id = searchParams.get('item_id');
    const is_current = searchParams.get('is_current');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    // Build query with item join
    let query = supabase
      .from('price_master')
      .select(`
        price_id,
        item_id,
        unit_price,
        effective_date,
        is_current,
        price_type,
        notes,
        created_at,
        updated_at,
        items!inner (
          item_id,
          item_code,
          item_name,
          spec,
          unit
        )
      `)
      .order('effective_date', { ascending: false });

    // Apply filters
    if (item_id) {
      query = query.eq('item_id', parseInt(item_id));
    }

    if (is_current !== null && is_current !== undefined) {
      const isCurrent = is_current === 'true' || is_current === '1';
      query = query.eq('is_current', isCurrent);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: prices, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Get total count
    let countQuery = supabase
      .from('price_master')
      .select('*', { count: 'exact', head: true });

    if (item_id) {
      countQuery = countQuery.eq('item_id', parseInt(item_id));
    }

    if (is_current !== null && is_current !== undefined) {
      const isCurrent = is_current === 'true' || is_current === '1';
      countQuery = countQuery.eq('is_current', isCurrent);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        data: prices || [],
        meta: {
          limit,
          totalCount: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasNext: offset + limit < (totalCount || 0),
          hasPrev: offset > 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching price master:', error);
    return NextResponse.json(
      {
        success: false,
        error: '가격 이력 조회에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/price-master
 * Create price master entry
 * Body: {
 *   item_id: number,
 *   unit_price: number,
 *   effective_date?: string (default: today),
 *   price_type?: string ('purchase', 'production', 'manual'),
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const data = JSON.parse(text);

    const {
      item_id,
      unit_price,
      effective_date,
      price_type,
      notes
    } = data;

    const supabase = getSupabaseClient();

    // Validation
    if (!item_id || unit_price === undefined) {
      return NextResponse.json({
        success: false,
        error: '필수 필드: item_id, unit_price'
      }, { status: 400 });
    }

    if (unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: '단가는 0 이상이어야 합니다.'
      }, { status: 400 });
    }

    // Validate effective_date not in future
    if (effective_date) {
      const inputDate = new Date(effective_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (inputDate > today) {
        return NextResponse.json({
          success: false,
          error: '유효일은 미래일 수 없습니다.'
        }, { status: 400 });
      }
    }

    // Validate price_type if provided
    if (price_type && !['purchase', 'production', 'manual'].includes(price_type)) {
      return NextResponse.json({
        success: false,
        error: '가격 유형은 purchase, production, manual 중 하나여야 합니다.'
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

    // Create price master entry
    // Trigger automatically sets previous prices' is_current = false
    const { data: priceEntry, error } = await supabase
      .from('price_master')
      .insert({
        item_id,
        unit_price,
        effective_date: effective_date || new Date().toISOString().split('T')[0],
        is_current: true,
        price_type: price_type || null,
        notes: notes || null
      })
      .select(`
        *,
        items!inner (
          item_id,
          item_code,
          item_name,
          spec,
          unit
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create price master: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '가격 마스터가 성공적으로 등록되었습니다.',
      data: priceEntry
    });
  } catch (error) {
    console.error('Error creating price master:', error);
    return NextResponse.json({
      success: false,
      error: '가격 마스터 등록에 실패했습니다.'
    }, { status: 500 });
  }
}

/**
 * PUT /api/price-master
 * Update price master entry
 * Body: {
 *   price_id: number,
 *   unit_price?: number,
 *   effective_date?: string,
 *   price_type?: string,
 *   notes?: string
 * }
 * Note: Cannot change item_id
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const text = await request.text();
    const data = JSON.parse(text);
    const { price_id, item_id, ...updateData } = data;

    if (!price_id) {
      return NextResponse.json({
        success: false,
        error: 'price_id is required'
      }, { status: 400 });
    }

    // Prevent item_id change
    if (item_id !== undefined) {
      return NextResponse.json({
        success: false,
        error: 'item_id는 변경할 수 없습니다.'
      }, { status: 400 });
    }

    // Validate unit_price if provided
    if (updateData.unit_price !== undefined && updateData.unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: '단가는 0 이상이어야 합니다.'
      }, { status: 400 });
    }

    // Validate effective_date not in future
    if (updateData.effective_date) {
      const inputDate = new Date(updateData.effective_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (inputDate > today) {
        return NextResponse.json({
          success: false,
          error: '유효일은 미래일 수 없습니다.'
        }, { status: 400 });
      }
    }

    // Validate price_type if provided
    if (updateData.price_type && !['purchase', 'production', 'manual'].includes(updateData.price_type)) {
      return NextResponse.json({
        success: false,
        error: '가격 유형은 purchase, production, manual 중 하나여야 합니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Trigger handles is_current updates automatically
    const { data: priceEntry, error } = await supabase
      .from('price_master')
      .update(updateData)
      .eq('price_id', price_id)
      .select(`
        *,
        items!inner (
          item_id,
          item_code,
          item_name,
          spec,
          unit
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update price master: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '가격 마스터가 성공적으로 업데이트되었습니다.',
      data: priceEntry
    });
  } catch (error) {
    console.error('Error updating price master:', error);
    return NextResponse.json({
      success: false,
      error: '가격 마스터 업데이트에 실패했습니다.'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/price-master
 * Delete price master entry
 * Query parameter: id - Price master ID
 * Note: Hard delete since schema has no is_active column
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const priceId = searchParams.get('id');

    if (!priceId) {
      return NextResponse.json({
        success: false,
        error: 'price_id is required'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Delete the price master entry
    const { error } = await supabase
      .from('price_master')
      .delete()
      .eq('price_id', parseInt(priceId));

    if (error) {
      throw new Error(`Failed to delete price master: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '가격 마스터가 성공적으로 삭제되었습니다.',
      data: { deleted_id: priceId }
    });
  } catch (error) {
    console.error('Error deleting price master:', error);
    return NextResponse.json({
      success: false,
      error: '가격 마스터 삭제에 실패했습니다.'
    }, { status: 500 });
  }
}
