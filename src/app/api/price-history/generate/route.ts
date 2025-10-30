import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/price-history/generate
 * 각 품목에 월별 단가 이력 생성 (테스트용)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(request).catch(() => null);
    
    logger.info('Price history generate request');
    const supabase = getSupabaseClient();

    // 1. 모든 활성 품목 조회
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, price')
      .eq('is_active', true)
      .order('item_code', { ascending: true });

    if (itemsError) {
      throw new Error(`품목 조회 실패: ${itemsError.message}`);
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        message: '활성 품목이 없습니다.',
        data: { inserted: 0, skipped: 0 }
      });
    }

    // 2. 생성할 월 목록 (최근 6개월) - DATE 형식 (YYYY-MM-01)
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      months.push(month);
    }

    let totalInserted = 0;
    let totalSkipped = 0;

    // 3. 각 월별로 단가 이력 생성
    for (const month of months) {
      // 기존 데이터 확인
      const { data: existing } = await supabase
        .from('item_price_history')
        .select('item_id')
        .eq('price_month', month)
        .in('item_id', items.map(i => i.item_id));

      const existingItemIds = new Set((existing || []).map((e: any) => e.item_id));

      // 새로 생성할 항목들
      const toInsert = items
        .filter(item => !existingItemIds.has(item.item_id))
        .map(item => {
          // 현재 단가를 기준으로 ±5~20% 변동 적용
          const basePrice = item.price || 1000;
          const variation = (Math.random() * 0.15 + 0.05) * (Math.random() < 0.5 ? 1 : -1);
          const adjustedPrice = Math.round(basePrice * (1 + variation));
          
          return {
            item_id: item.item_id,
            price_month: month, // 이미 YYYY-MM-01 형식
            unit_price: Math.max(100, adjustedPrice), // 최소 100원
            note: null,
            created_by: user?.email || 'system',
          };
        });

      if (toInsert.length > 0) {
        // 배치 삽입 (한 번에 최대 500개씩)
        const batchSize = 500;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from('item_price_history')
            .insert(batch);

          if (insertError) {
            logger.error('Price history insert error', insertError, { month, batchIndex: i });
            continue;
          }

          totalInserted += batch.length;
        }
      }

      totalSkipped += existingItemIds.size;
    }

    return NextResponse.json({
      success: true,
      message: `${months.length}개월치 월별 단가 이력 생성 완료`,
      data: {
        inserted: totalInserted,
        skipped: totalSkipped,
        months: months.length,
        items: items.length,
      },
    });
  } catch (error) {
    logger.error('Price history generate error', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '월별 단가 이력 생성 중 오류가 발생했습니다.',
    }, { status: 500 });
  }
}

