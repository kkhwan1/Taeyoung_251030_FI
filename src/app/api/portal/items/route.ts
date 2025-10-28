/**
 * Portal Items API
 *
 * GET /api/portal/items
 * Returns items list for authenticated portal users
 * All roles can view items (as per RLS policy)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import {
  requirePortalAuth,
  logPortalApiAccess,
  createPortalResponse,
} from '@/lib/portal-middleware';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Require authentication (all roles allowed)
    const authResult = await requirePortalAuth();
    if (!('session' in authResult)) {
      // authResult is NextResponse (error response)
      return authResult;
    }
    const session = authResult.session;
    const supabase = getSupabaseClient();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category');

    // Build query
    let query = supabase
      .from('items')
      .select(`
        item_id,
        item_name,
        item_code,
        spec,
        unit,
        category,
        current_stock,
        min_stock_level,
        max_stock_level,
        unit_price,
        suppliers:companies!supplier_id(company_name),
        is_active
      `, { count: 'exact' })
      .eq('is_active', true);

    // Apply search filter
    if (search) {
      query = query.or(`item_name.ilike.%${search}%,item_code.ilike.%${search}%,spec.ilike.%${search}%`);
    }

    // Apply category filter
    if (category) {
      query = query.eq('category', category as any);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query
      .order('item_name', { ascending: true })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch items:', error);
      await logPortalApiAccess(request, session, 'GET_ITEMS', '/api/portal/items', false, error.message);
      return createPortalResponse(false, null, '품목 목록을 불러오는데 실패했습니다.', 500) as Response;
    }

    // Log successful access
    await logPortalApiAccess(request, session, 'GET_ITEMS', '/api/portal/items', true);

    // Return paginated response
    return createPortalResponse(
      true,
      {
        items: data || [],
        pagination: {
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
          totalCount: count || 0,
        },
        role: session.role,
        companyName: session.companyName,
      },
      undefined,
      200
    ) as Response;
  } catch (error) {
    console.error('Portal items error:', error);
    return createPortalResponse(
      false,
      null,
      '품목 목록을 불러오는데 실패했습니다.',
      500
    ) as Response;
  }
}
