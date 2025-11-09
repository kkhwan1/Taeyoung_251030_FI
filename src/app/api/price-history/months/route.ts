import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { getCurrentUser } from '@/lib/auth';
import { APIError, handleAPIError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

export const dynamic = 'force-dynamic';


/**
 * GET /api/price-history/months?item_id=123&months=2025-10,2025-09,2025-08
 * 특정 품목의 여러 월별 단가 이력 조회
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/price-history/months';

  try {
    const user = await getCurrentUser(request).catch(() => null);
    
    logger.info('Price history months GET request', { endpoint });
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    
    const itemIdParam = searchParams.get('item_id');
    const monthsParam = searchParams.get('months');

    if (!itemIdParam) {
      throw new APIError('item_id 파라미터가 필요합니다.', 400);
    }

    if (!monthsParam) {
      throw new APIError('months 파라미터가 필요합니다.', 400);
    }

    const itemId = parseInt(itemIdParam, 10);
    if (isNaN(itemId)) {
      throw new APIError('유효한 item_id가 필요합니다.', 400);
    }

    // 콤마로 구분된 월 목록 파싱 (YYYY-MM 형식)
    const monthList = monthsParam.split(',')
      .map(m => m.trim())
      .filter(m => /^\d{4}-\d{2}$/.test(m))
      .map(m => `${m}-01`); // DATE 형식으로 변환

    if (monthList.length === 0) {
      throw new APIError('유효한 months 파라미터가 필요합니다. (예: 2025-10,2025-09)', 400);
    }

    // 해당 품목의 지정된 월들의 단가 이력 조회
    const { data: priceHistory, error: priceError } = await supabase
      .from('item_price_history')
      .select('price_history_id, price_month, unit_price, note, created_at, updated_at')
      .eq('item_id', itemId)
      .in('price_month', monthList)
      .order('price_month', { ascending: false });

    if (priceError) {
      throw new APIError('단가 이력을 조회하지 못했습니다.', 500, priceError.message);
    }

    // 품목 정보 조회
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, price')
      .eq('item_id', itemId)
      .single();

    if (itemError) {
      logger.warn('Item not found', { itemId, error: itemError.message });
    }

    // 결과 매핑 (요청한 모든 월에 대해 데이터 반환, 없으면 기본값 사용)
    const result = monthList.map(monthDate => {
      const existing = priceHistory?.find(ph => ph.price_month === monthDate);
      const monthStr = monthDate.substring(0, 7); // YYYY-MM 형식으로 변환

      return {
        item_id: itemId,
        price_month: monthStr,
        unit_price: existing?.unit_price ?? item?.price ?? 0,
        note: existing?.note || null,
        created_at: existing?.created_at || null,
        updated_at: existing?.updated_at || null,
        is_saved: !!existing,
      };
    });

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Price history months GET success', { endpoint, duration, itemId, monthCount: monthList.length });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Price history months GET error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

