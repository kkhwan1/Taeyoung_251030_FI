// Phase P3 - 월별 단가 이력 CRUD API
// src/app/api/price-history/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { validatePriceHistoryEntry } from '@/lib/businessRules';
import { ERROR_MESSAGES, formatErrorResponse } from '@/lib/errorMessages';
import type { Database } from '@/types/supabase';

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
    const month = searchParams.get('month'); // 특정 월 조회 (YYYY-MM 형식)
    const startMonth = searchParams.get('start_month');
    const endMonth = searchParams.get('end_month');
    const category = searchParams.get('category');
    const supplierId = searchParams.get('supplier_id');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') || 'item_code';
    const sortOrder = searchParams.get('sort_order') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '1000'); // 기본값 증가
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    // 특정 월 조회인 경우 모든 활성 품목을 포함하여 반환
    if (month) {
      const targetMonth = month.endsWith('-01') ? month : `${month}-01`;
      
      // 1. 모든 활성 품목 조회
      let itemsQuery = supabase
        .from('items')
        .select('*')
        .eq('is_active', true)
        .order('item_code');

      // 카테고리 필터 적용
      if (category) {
        itemsQuery = itemsQuery.eq('category', category as NonNullable<Database['public']['Tables']['items']['Row']['category']>);
      }

      // 공급사 필터 적용
      if (supplierId) {
        itemsQuery = itemsQuery.eq('supplier_id', parseInt(supplierId));
      }

      const { data: allItems, error: itemsError } = await itemsQuery;

      if (itemsError) {
        throw new Error(`Items query failed: ${itemsError.message}`);
      }

      if (!allItems || allItems.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            limit,
            offset,
            has_more: false
          }
        });
      }

      // 2. 각 품목에 대해 해당 월의 price_history 조회
      const enrichedItems = await Promise.all(
        allItems.map(async (item) => {
          const { data: priceHistory } = await supabase
            .from('item_price_history')
            .select('*')
            .eq('item_id', item.item_id)
            .eq('price_month', targetMonth)
            .single();

          return {
            price_history_id: priceHistory?.price_history_id || null,
            item_id: item.item_id,
            price_month: targetMonth,
            unit_price: priceHistory?.unit_price ?? item.price ?? 0,
            note: priceHistory?.note || null,
            created_at: priceHistory?.created_at || null,
            updated_at: priceHistory?.updated_at || null,
            is_saved: !!priceHistory, // 저장 여부 표시
            item: {
              item_id: item.item_id,
              item_code: item.item_code,
              item_name: item.item_name,
              spec: item.spec,
              category: item.category,
              unit: item.unit,
              supplier_id: item.supplier_id,
              current_stock: item.current_stock,
              price: item.price,
              vehicle_model: item.vehicle_model
            }
          };
        })
      );

      // 3. 검색 필터 적용 (클라이언트 사이드)
      let filteredItems = enrichedItems;
      if (search) {
        filteredItems = enrichedItems.filter(item => 
          item.item.item_code.toLowerCase().includes(search.toLowerCase()) ||
          item.item.item_name.toLowerCase().includes(search.toLowerCase())
        );
      }

      // 4. 가격 필터 적용
      if (minPrice) {
        filteredItems = filteredItems.filter(item => item.unit_price >= parseFloat(minPrice));
      }
      if (maxPrice) {
        filteredItems = filteredItems.filter(item => item.unit_price <= parseFloat(maxPrice));
      }

      // 5. 정렬 적용
      filteredItems.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'item_code':
            aValue = a.item.item_code;
            bValue = b.item.item_code;
            break;
          case 'item_name':
            aValue = a.item.item_name;
            bValue = b.item.item_name;
            break;
          case 'unit_price':
            aValue = a.unit_price;
            bValue = b.unit_price;
            break;
          case 'category':
            aValue = a.item.category;
            bValue = b.item.category;
            break;
          default:
            aValue = a.item.item_code;
            bValue = b.item.item_code;
        }

        if (sortOrder === 'desc') {
          return aValue < bValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      // 6. 페이지네이션 적용
      const totalCount = filteredItems.length;
      const paginatedItems = filteredItems.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        data: paginatedItems,
        pagination: {
          total: totalCount,
          limit,
          offset,
          has_more: offset + limit < totalCount
        }
      });
    }

    // 기존 로직: 특정 월이 아닌 경우 기존 방식으로 조회
    let query = supabase
      .from('item_price_history')
      .select(`
        *,
        item:items (
          item_id,
          item_code,
          item_name,
          spec,
          category,
          unit,
          supplier_id,
          current_stock
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
    const validSortFields = ['price_month', 'unit_price', 'item_name', 'item_code'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'price_month';
    const ascending = sortOrder === 'asc';

    // For sorting by item fields, we need special handling
    if (sortField === 'item_name' || sortField === 'item_code') {
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

    // If sorting by item fields, sort in application layer
    let sortedData = data || [];
    if ((sortField === 'item_name' || sortField === 'item_code') && data) {
      sortedData = [...data].sort((a, b) => {
        let aValue, bValue;
        
        if (sortField === 'item_name') {
          aValue = a.item?.item_name || '';
          bValue = b.item?.item_name || '';
        } else {
          aValue = a.item?.item_code || '';
          bValue = b.item?.item_code || '';
        }
        
        return ascending
          ? aValue.localeCompare(bValue, 'ko')
          : bValue.localeCompare(aValue, 'ko');
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

    // 기존 레코드 확인
    const { data: existingRecord } = await supabase
      .from('item_price_history')
      .select('price_history_id')
      .eq('item_id', item_id)
      .eq('price_month', price_month)
      .single();

    let data, error;

    if (existingRecord) {
      // 기존 레코드 업데이트
      const result = await supabase
        .from('item_price_history')
        .update({
          unit_price,
          price_per_kg: price_per_kg || null,
          note: note || null,
          updated_at: new Date().toISOString()
        })
        .eq('price_history_id', existingRecord.price_history_id)
        .select(`
          *,
          item:items (
            item_id,
            item_code,
            item_name,
            spec,
            category,
            unit,
            current_stock
          )
        `)
        .single();

      data = result.data;
      error = result.error;
    } else {
      // 새 레코드 생성
      const result = await supabase
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
            spec,
            category,
            unit,
            current_stock
          )
        `)
        .single();

      data = result.data;
      error = result.error;
    }

    if (error) {
      throw new Error(`Database operation failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: existingRecord 
        ? '단가가 성공적으로 수정되었습니다.' 
        : '단가 이력이 성공적으로 생성되었습니다.',
      data
    }, { status: existingRecord ? 200 : 201 });

  } catch (error) {
    console.error('[price-history] POST error:', error);
    return NextResponse.json(
      formatErrorResponse(error, '단가 저장'),
      { status: 500 }
    );
  }
}
