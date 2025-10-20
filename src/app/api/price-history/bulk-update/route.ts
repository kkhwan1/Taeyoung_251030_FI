// Phase P3 - 월별 단가 이력 대량 업데이트 API
// src/app/api/price-history/bulk-update/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { PriceHistoryBulkUpdateSchema } from '@/lib/validation';
import {
  validatePositivePrice,
  validatePriceIncrease,
  checkDuplicatePriceMonth
} from '@/lib/businessRules';
import {
  ERROR_MESSAGES,
  formatErrorResponse,
  formatBulkOperationResult,
  formatValidationError
} from '@/lib/errorMessages';

interface UpdateItem {
  item_id: number;
  price_month: string;
  unit_price: number;
  price_per_kg?: number;
  note?: string;
}

interface FailedItem {
  item_id: number;
  price_month: string;
  error: string;
  warning?: string;
  details?: any;
}

interface BulkUpdateResult {
  total_requested: number;
  successful: number;
  failed: number;
  failed_items: FailedItem[];
  execution_time_ms: number;
}

/**
 * POST /api/price-history/bulk-update
 * 대량 단가 이력 업데이트
 *
 * Request Body:
 * {
 *   "updates": [
 *     {
 *       "item_id": 1,
 *       "price_month": "2025-11-01",
 *       "unit_price": 15000,
 *       "price_per_kg": 12000,
 *       "note": "11월 인상"
 *     },
 *     // ... 최대 100개
 *   ],
 *   "override_existing": false  // 기존 데이터 덮어쓰기 여부
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "total_requested": 100,
 *     "successful": 95,
 *     "failed": 5,
 *     "failed_items": [...],
 *     "execution_time_ms": 450
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // UTF-8 한글 처리
    const text = await request.text();
    const body = JSON.parse(text);

    // Zod 검증
    const validationResult = PriceHistoryBulkUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.VALIDATION_FAILED,
          details: formatValidationError(validationResult.error)
        },
        { status: 400 }
      );
    }

    const { updates, override_existing } = validationResult.data;
    const supabase = getSupabaseClient();

    // Step 1: 품목 ID 검증 (모든 품목이 존재하는지 확인)
    const uniqueItemIds = [...new Set(updates.map(u => u.item_id))];
    const { data: existingItems, error: itemsError } = await supabase
      .from('items')
      .select('item_id')
      .in('item_id', uniqueItemIds);

    if (itemsError) {
      throw new Error(`품목 조회 실패: ${itemsError.message}`);
    }

    const validItemIds = new Set(existingItems?.map(i => i.item_id) || []);
    const invalidItems = updates.filter(u => !validItemIds.has(u.item_id));

    const failedItems: FailedItem[] = invalidItems.map(item => ({
      item_id: item.item_id,
      price_month: item.price_month,
      error: ERROR_MESSAGES.ITEM_NOT_FOUND
    }));

    // Step 1.5: 각 항목에 대해 비즈니스 규칙 검증
    const validatedUpdates: UpdateItem[] = [];

    for (const item of updates.filter(u => validItemIds.has(u.item_id))) {
      // 양수 가격 검증
      const priceCheck = validatePositivePrice(item.unit_price);
      if (!priceCheck.valid) {
        failedItems.push({
          item_id: item.item_id,
          price_month: item.price_month,
          error: priceCheck.error!
        });
        continue;
      }

      // price_per_kg 검증
      if (item.price_per_kg !== undefined && item.price_per_kg !== null) {
        const kgPriceCheck = validatePositivePrice(item.price_per_kg);
        if (!kgPriceCheck.valid) {
          failedItems.push({
            item_id: item.item_id,
            price_month: item.price_month,
            error: 'kg당 단가: ' + kgPriceCheck.error!
          });
          continue;
        }
      }

      validatedUpdates.push(item);
    }

    const validUpdates = validatedUpdates;

    if (validUpdates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.BULK_EMPTY,
          data: {
            total_requested: updates.length,
            successful: 0,
            failed: updates.length,
            failed_items: failedItems,
            execution_time_ms: Date.now() - startTime
          }
        },
        { status: 400 }
      );
    }

    // Step 2: 중복 체크 및 인상률 경고 (override_existing=false인 경우)
    let finalUpdates = validUpdates;
    if (!override_existing) {
      // 기존 데이터 조회 (단가 포함)
      const priceMonthKeys = validUpdates.map(u => `${u.item_id}-${u.price_month}`);

      const { data: existingPrices, error: pricesError } = await supabase
        .from('item_price_history')
        .select('item_id, price_month, unit_price')
        .in('item_id', validUpdates.map(u => u.item_id));

      if (pricesError) {
        throw new Error(`기존 가격 이력 조회 실패: ${pricesError.message}`);
      }

      const existingMap = new Map(
        existingPrices?.map(p => [`${p.item_id}-${p.price_month}`, p.unit_price]) || []
      );

      // 중복 항목 필터링 및 인상률 경고
      for (const item of validUpdates) {
        const key = `${item.item_id}-${item.price_month}`;
        const existingPrice = existingMap.get(key);

        if (existingPrice !== undefined) {
          // 인상률 경고 체크
          const increaseCheck = validatePriceIncrease(existingPrice, item.unit_price);

          failedItems.push({
            item_id: item.item_id,
            price_month: item.price_month,
            error: ERROR_MESSAGES.PRICE_DUPLICATE,
            warning: increaseCheck.warning,
            details: {
              current_price: existingPrice,
              new_price: item.unit_price,
              increase_rate: ((item.unit_price - existingPrice) / existingPrice * 100).toFixed(1) + '%'
            }
          });
        }
      }

      const existingKeys = new Set(existingMap.keys());
      finalUpdates = validUpdates.filter(u =>
        !existingKeys.has(`${u.item_id}-${u.price_month}`)
      );
    }

    if (finalUpdates.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 업데이트가 중복되어 스킵되었습니다',
        data: {
          total_requested: updates.length,
          successful: 0,
          failed: failedItems.length,
          failed_items: failedItems,
          execution_time_ms: Date.now() - startTime
        }
      });
    }

    // Step 3: 트랜잭션 처리 (upsert 사용)
    const insertData = finalUpdates.map(u => ({
      item_id: u.item_id,
      price_month: u.price_month,
      unit_price: u.unit_price,
      price_per_kg: u.price_per_kg || null,
      note: u.note || null,
      created_at: new Date().toISOString()
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from('item_price_history')
      .upsert(insertData, {
        onConflict: 'item_id,price_month',
        ignoreDuplicates: false
      })
      .select();

    if (insertError) {
      throw new Error(`대량 업데이트 실패: ${insertError.message}`);
    }

    const successful = insertedData?.length || 0;

    // Step 4: 결과 집계
    const result: BulkUpdateResult = {
      total_requested: updates.length,
      successful,
      failed: failedItems.length,
      failed_items: failedItems,
      execution_time_ms: Date.now() - startTime
    };

    const formattedResult = formatBulkOperationResult(
      successful,
      failedItems.length,
      failedItems
    );

    return NextResponse.json({
      ...formattedResult,
      data: {
        ...formattedResult.data,
        execution_time_ms: result.execution_time_ms
      }
    });

  } catch (error) {
    console.error('[price-history/bulk-update] POST error:', error);
    return NextResponse.json(
      formatErrorResponse(error, '대량 업데이트'),
      { status: 500 }
    );
  }
}

/**
 * GET /api/price-history/bulk-update
 * 대량 업데이트 상태 및 가이드 반환
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Price History Bulk Update API',
    usage: {
      method: 'POST',
      endpoint: '/api/price-history/bulk-update',
      max_items: 100,
      parameters: {
        updates: 'Array<{item_id, price_month, unit_price, price_per_kg?, note?}>',
        override_existing: 'boolean (default: false)'
      }
    },
    example: {
      updates: [
        {
          item_id: 1,
          price_month: '2025-11-01',
          unit_price: 15000,
          price_per_kg: 12000,
          note: '11월 인상'
        }
      ],
      override_existing: false
    },
    performance: {
      target_100_items: '<1000ms',
      average_50_items: '<500ms'
    }
  });
}
