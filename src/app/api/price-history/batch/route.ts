import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { APIError, handleAPIError } from '@/lib/api-utils';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { metricsCollector } from '@/lib/metrics';

/**
 * POST /api/price-history/batch
 * 단가 이력 일괄 저장
 * 
 * Request body:
 * {
 *   items: [
 *     {
 *       price_history_id?: number,
 *       item_id: number,
 *       price_month: string,
 *       unit_price: number,
 *       note?: string
 *     },
 *     ...
 *   ]
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const endpoint = '/api/price-history/batch';

  try {
    // 권한 체크 (관대하게 처리)
    const user = await getCurrentUser(request).catch(() => null);
    
    logger.info('Price history batch POST request', { endpoint });
    const supabase = getSupabaseClient();
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);

    // 프론트엔드에서 'prices' 또는 'items' 배열로 보낼 수 있음
    const items = body.items || body.prices || [];
    const priceMonth = body.price_month;

    if (!Array.isArray(items) || items.length === 0) {
      throw new APIError('items 또는 prices 배열이 필요합니다.', 400);
    }

    if (!priceMonth) {
      throw new APIError('price_month가 필요합니다.', 400);
    }

    // YYYY-MM 형식으로 변환
    let month = priceMonth;
    if (priceMonth.length > 7) {
      month = priceMonth.substring(0, 7);
    }

    // month 형식 검증
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new APIError('price_month는 YYYY-MM 또는 YYYY-MM-DD 형식이어야 합니다.', 400);
    }

    // DATE 형식으로 변환 (YYYY-MM-01)
    const priceMonthDate = `${month}-01`;

    // 먼저 기존 데이터 조회하여 업데이트/삽입 분리
    const itemIds = items.map((item: any) => item.item_id);

    const { data: existing, error: fetchError } = await supabase
      .from('item_price_history')
      .select('price_history_id, item_id, price_month')
      .eq('price_month', priceMonthDate)
      .in('item_id', itemIds);

    if (fetchError) {
      throw new APIError('기존 단가 이력을 조회하지 못했습니다.', 500, fetchError.message);
    }

    const existingMap = new Map(
      (existing || []).map((e: any) => [e.item_id, e])
    );

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    items.forEach((item: any) => {
      if (!item.item_id || !item.price_month || item.unit_price === undefined) {
        return; // 필수 필드 누락 시 건너뛰기
      }

      if (typeof item.unit_price !== 'number' || item.unit_price < 0) {
        return; // 유효하지 않은 단가 건너뛰기
      }

      const key = `${item.item_id}_${item.price_month}`;
      const existingRecord = existingMap.get(key);

      if (existingRecord || item.price_history_id) {
        // 업데이트
        toUpdate.push({
          price_history_id: existingRecord?.price_history_id || item.price_history_id,
          unit_price: item.unit_price,
          note: item.note || null,
          updated_at: new Date().toISOString(),
        });
      } else {
        // 삽입 - DATE 형식으로 변환
        toInsert.push({
          item_id: item.item_id,
          price_month: priceMonthDate,
          unit_price: item.unit_price,
          note: item.note || null,
          created_by: user?.email || null,
        });
      }
    });

    const results: any[] = [];

    // 삽입
    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('item_price_history')
        .insert(toInsert)
        .select();

      if (insertError) {
        throw new APIError('단가 이력을 일괄 저장하지 못했습니다.', 500, insertError.message);
      }

      results.push(...(inserted || []));
    }

    // 업데이트 (개별 처리)
    if (toUpdate.length > 0) {
      for (const updateItem of toUpdate) {
        const { data: updated, error: updateError } = await supabase
          .from('item_price_history')
          .update({
            unit_price: updateItem.unit_price,
            note: updateItem.note,
            updated_at: updateItem.updated_at,
          })
          .eq('price_history_id', updateItem.price_history_id)
          .select()
          .single();

        if (updateError) {
          logger.warn('Failed to update price history', { price_history_id: updateItem.price_history_id, error: updateError.message });
          continue;
        }

        if (updated) {
          results.push(updated);
        }
      }
    }

    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, false);
    logger.info('Price history batch POST success', { endpoint, duration, inserted: toInsert.length, updated: toUpdate.length });

    return NextResponse.json({
      success: true,
      data: results,
      stats: {
        inserted: toInsert.length,
        updated: toUpdate.length,
        total: results.length,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.trackRequest(endpoint, duration, true);
    logger.error('Price history batch POST error', error as Error, { endpoint, duration });

    return handleAPIError(error);
  }
}

