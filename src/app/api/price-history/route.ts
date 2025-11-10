import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { APIError, handleAPIError } from '@/lib/api-utils';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

export const dynamic = 'force-dynamic';


/**
 * GET /api/price-history?month=YYYY-MM&page=1&limit=30
 * 월별 단가 이력 조회 (서버 사이드 페이지네이션 지원)
 *
 * 활성 품목에 대해 해당 월의 단가 이력을 조회합니다.
 * 이미 저장된 단가가 있으면 그것을 반환하고, 없으면 기본값(현재 단가)을 반환합니다.
 *
 * Query Parameters:
 * - month: YYYY-MM (필수)
 * - page: 페이지 번호 (기본: 1)
 * - limit: 페이지당 항목 수 (기본: 30)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/price-history';

  try {
    // 권한 체크 (관대하게 처리 - 인증만 확인)
    const user = await getCurrentUser(request).catch(() => null);

    // 인증되지 않았어도 일단 진행 (권한 체크는 선택적)
    logger.info('Price history GET request', { endpoint });
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');

    // 페이지네이션 파라미터
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    if (!month) {
      throw new APIError('month 파라미터가 필요합니다.', 400);
    }

    // 페이지네이션 검증
    if (page < 1 || limit < 1 || limit > 1000) {
      throw new APIError('page는 1 이상, limit는 1-1000 범위여야 합니다.', 400);
    }

    // YYYY-MM 형식 검증 및 DATE 형식으로 변환 (YYYY-MM-01)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new APIError('month는 YYYY-MM 형식이어야 합니다.', 400);
    }

    // DATE 형식으로 변환 (YYYY-MM-01)
    const priceMonthDate = `${month}-01`;

    // 1. 활성 품목 총 개수 조회
    const { count: totalCount, error: countError } = await supabase
      .from('items')
      .select('item_id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (countError) {
      throw new APIError('품목 총 개수를 조회하지 못했습니다.', 500, countError.message);
    }

    // 2. 페이지네이션된 품목 조회
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, spec, current_stock, price, unit, category, vehicle_model')
      .eq('is_active', true)
      .order('item_code', { ascending: true })
      .range(from, to);

    if (itemsError) {
      throw new APIError('품목 정보를 조회하지 못했습니다.', 500, itemsError.message);
    }

    // 3. 조회된 품목들의 ID 목록 생성
    const itemIds = (items || []).map(item => item.item_id);

    // 4. 해당 품목들의 단가 이력만 조회 (필터링으로 불필요한 데이터 제거)
    const { data: priceHistory, error: priceError } = await supabase
      .from('item_price_history')
      .select('price_history_id, item_id, price_month, unit_price, note, created_at, updated_at')
      .eq('price_month', priceMonthDate)
      .in('item_id', itemIds.length > 0 ? itemIds : [-1]); // 빈 배열 방지

    if (priceError) {
      throw new APIError('단가 이력을 조회하지 못했습니다.', 500, priceError.message);
    }

    // 5. 품목별로 단가 이력 매핑
    const priceMap = new Map(
      (priceHistory || []).map(ph => [ph.item_id, ph])
    );

    // 6. 페이지네이션된 품목에 대해 단가 이력 생성
    const result = (items || []).map(item => {
      const history = priceMap.get(item.item_id);

      return {
        price_history_id: history?.price_history_id || null,
        item_id: item.item_id,
        price_month: month,
        unit_price: history?.unit_price ?? item.price ?? 0,
        note: history?.note || null,
        created_at: history?.created_at || null,
        updated_at: history?.updated_at || null,
        is_saved: history !== undefined,
        item: {
          item_id: item.item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          spec: item.spec,
          current_stock: item.current_stock ?? 0,
          price: item.price ?? 0,
          unit: item.unit,
          category: item.category,
          vehicle_model: item.vehicle_model,
        },
      };
    });

    const duration = Date.now() - startTime;
    const totalPages = Math.ceil((totalCount || 0) / limit);

    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Price history GET success', {
      endpoint,
      duration,
      itemCount: result.length,
      month,
      page,
      limit,
      totalCount,
      totalPages
    });

    return NextResponse.json({
      success: true,
      data: result,
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        totalPages,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Price history GET error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

/**
 * POST /api/price-history
 * 단가 이력 저장 (단일 또는 업데이트)
 * 
 * Request body:
 * {
 *   price_history_id?: number,  // 있으면 업데이트, 없으면 생성
 *   item_id: number,
 *   price_month: string,
 *   unit_price: number,
 *   note?: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/price-history';

  try {
    // 권한 체크 (관대하게 처리)
    const user = await getCurrentUser(request).catch(() => null);
    
    logger.info('Price history POST request', { endpoint });
    const supabase = getSupabaseClient();
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);

    const { price_history_id, item_id, price_month, unit_price, note } = body;

    // 필수 필드 검증
    if (!item_id || !price_month || unit_price === undefined) {
      throw new APIError('item_id, price_month, unit_price는 필수입니다.', 400);
    }

    // YYYY-MM 형식으로 변환
    let normalizedMonth = price_month;
    if (price_month.length > 7) {
      normalizedMonth = price_month.substring(0, 7);
    }

    // month 형식 검증
    if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) {
      throw new APIError('price_month는 YYYY-MM 또는 YYYY-MM-DD 형식이어야 합니다.', 400);
    }

    // DATE 형식으로 변환 (YYYY-MM-01)
    const priceMonthDate = `${normalizedMonth}-01`;

    // unit_price 검증
    if (typeof unit_price !== 'number' || unit_price < 0) {
      throw new APIError('unit_price는 0 이상의 숫자여야 합니다.', 400);
    }

    let result;

    if (price_history_id) {
      // 업데이트
      const { data, error } = await supabase
        .from('item_price_history')
        .update({
          unit_price,
          note: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('price_history_id', price_history_id)
        .select()
        .single();

      if (error) {
        throw new APIError('단가 이력을 업데이트하지 못했습니다.', 500, error.message);
      }

      result = data;
    } else {
      // 생성 (중복 체크)
      const { data: existing } = await supabase
        .from('item_price_history')
        .select('price_history_id')
        .eq('item_id', item_id)
        .eq('price_month', priceMonthDate)
        .single();

      if (existing) {
        // 이미 존재하면 업데이트
        const { data, error } = await supabase
          .from('item_price_history')
          .update({
            unit_price,
            note: note || null,
            updated_at: new Date().toISOString(),
          })
          .eq('price_history_id', existing.price_history_id)
          .select()
          .single();

        if (error) {
          throw new APIError('단가 이력을 업데이트하지 못했습니다.', 500, error.message);
        }

        result = data;
      } else {
        // 새로 생성
        const { data, error } = await supabase
          .from('item_price_history')
          .insert({
            item_id,
            price_month: priceMonthDate,
            unit_price,
            note: note || null,
            created_by: user?.email || null,
          })
          .select()
          .single();

        if (error) {
          throw new APIError('단가 이력을 저장하지 못했습니다.', 500, error.message);
        }

        result = data;
      }
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Price history POST success', { endpoint, duration });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Price history POST error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

