// Phase P3 - 월별 단가 이력 CRUD API
// src/app/api/price-history/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { validatePriceHistoryEntry } from '@/lib/businessRules';
import { ERROR_MESSAGES, formatErrorResponse } from '@/lib/errorMessages';

/**
 * GET /api/price-history
 * 전체 단가 이력 조회 (필터링 옵션)
 *
 * Query Parameters:
 * - item_id: 품목 ID 필터
 * - start_month: 시작 월 (YYYY-MM-DD)
 * - end_month: 종료 월 (YYYY-MM-DD)
 * - category: 품목 카테고리 필터
 * - supplier_id: 공급사 ID 필터
 * - min_price: 최소 단가
 * - max_price: 최대 단가
 * - search: 품목명/품목코드 검색
 * - sort_by: 정렬 기준 (price_month|unit_price|item_name)
 * - sort_order: 정렬 순서 (asc|desc)
 * - limit: 페이지당 항목 수 (기본값: 100)
 * - offset: 오프셋 (기본값: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 필터 파라미터
    const itemId = searchParams.get('item_id');
    const startMonth = searchParams.get('start_month');
    const endMonth = searchParams.get('end_month');
    const category = searchParams.get('category');
    const supplierId = searchParams.get('supplier_id');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') || 'price_month';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    // Base query with items join
    let query = supabase
      .from('item_price_history')
      .select(`
        *,
        item:items (
          item_id,
          item_code,
          item_name,
          category,
          unit,
          supplier_id
        )
      `, { count: 'exact' });

    // Apply filters
    if (itemId) {
      query = query.eq('item_id', parseInt(itemId));
    }

    if (startMonth) {
      query = query.gte('price_month', startMonth);
    }

    if (endMonth) {
      query = query.lte('price_month', endMonth);
    }

    if (minPrice) {
      query = query.gte('unit_price', parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.lte('unit_price', parseFloat(maxPrice));
    }

    // Search in item_name or item_code (using PostgreSQL ILIKE)
    if (search) {
      // Note: For nested searches, we need to filter after fetching
      // This is a limitation of Supabase's query builder
      query = query.or(`item.item_name.ilike.%${search}%,item.item_code.ilike.%${search}%`);
    }

    // Category filter (on joined items table)
    if (category) {
      query = query.eq('item.category', category);
    }

    // Supplier filter (on joined items table)
    if (supplierId) {
      query = query.eq('item.supplier_id', parseInt(supplierId));
    }

    // Apply sorting
    const validSortFields = ['price_month', 'unit_price', 'item_name'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'price_month';
    const ascending = sortOrder === 'asc';

    // For sorting by item fields, we need special handling
    if (sortField === 'item_name') {
      // Will sort in application layer after fetch
      query = query.order('price_month', { ascending: false });
    } else {
      query = query.order(sortField, { ascending });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // If sorting by item_name, sort in application layer
    let sortedData = data || [];
    if (sortField === 'item_name' && data) {
      sortedData = [...data].sort((a, b) => {
        const nameA = a.item?.item_name || '';
        const nameB = b.item?.item_name || '';
        return ascending
          ? nameA.localeCompare(nameB, 'ko')
          : nameB.localeCompare(nameA, 'ko');
      });
    }

    return NextResponse.json({
      success: true,
      data: sortedData,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: (offset + limit) < (count || 0),
        hasPrev: offset > 0
      },
      filters: {
        item_id: itemId,
        start_month: startMonth,
        end_month: endMonth,
        category,
        supplier_id: supplierId,
        min_price: minPrice,
        max_price: maxPrice,
        search,
        sort_by: sortField,
        sort_order: sortOrder
      }
    });

  } catch (error) {
    console.error('[price-history] GET error:', error);
    return NextResponse.json(
      formatErrorResponse(error, '단가 이력 조회'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/price-history
 * 새로운 단가 이력 생성
 */
export async function POST(request: NextRequest) {
  try {
    // UTF-8 한글 처리
    const text = await request.text();
    const body = JSON.parse(text);

    const { item_id, price_month, unit_price, price_per_kg, note, created_by } = body;

    // 필수 필드 검증
    if (!item_id || !price_month || unit_price === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.REQUIRED_FIELD('품목 ID, 가격 월, 단가')
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 종합 비즈니스 규칙 검증
    const validation = await validatePriceHistoryEntry(
      { item_id, price_month, unit_price },
      supabase,
      { checkDuplicate: true }
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          warning: validation.warning,
          details: validation.details
        },
        { status: validation.error === ERROR_MESSAGES.PRICE_DUPLICATE ? 409 : 400 }
      );
    }

    // price_per_kg 별도 검증
    if (price_per_kg !== null && price_per_kg !== undefined && price_per_kg < 0) {
      return NextResponse.json(
        { success: false, error: 'kg당 단가는 0 이상이어야 합니다' },
        { status: 400 }
      );
    }

    // 단가 이력 생성
    const { data, error } = await supabase
      .from('item_price_history')
      .insert({
        item_id,
        price_month,
        unit_price,
        price_per_kg: price_per_kg || null,
        note: note || null,
        created_by: created_by || null
      })
      .select(`
        *,
        item:items (
          item_id,
          item_code,
          item_name,
          category,
          unit
        )
      `)
      .single();

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '단가 이력이 성공적으로 생성되었습니다.',
      data
    }, { status: 201 });

  } catch (error) {
    console.error('[price-history] POST error:', error);
    return NextResponse.json(
      formatErrorResponse(error, '단가 이력 생성'),
      { status: 500 }
    );
  }
}
