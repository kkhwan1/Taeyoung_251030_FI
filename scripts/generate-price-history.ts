/**
 * 각 품목에 월별 단가 이력 생성 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/generate-price-history.ts
 */

import { getSupabaseClient } from '../src/lib/db-unified';

async function generatePriceHistory() {
  const supabase = getSupabaseClient();

  console.log('📊 월별 단가 이력 생성 시작...\n');

  try {
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
      console.log('⚠️  활성 품목이 없습니다.');
      return;
    }

    console.log(`✅ 총 ${items.length}개 품목 조회 완료\n`);

    // 2. 생성할 월 목록 (최근 6개월)
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push(month);
    }

    console.log(`📅 생성할 월: ${months.join(', ')}\n`);

    // 3. 각 월별로 단가 이력 생성
    let totalInserted = 0;
    let totalUpdated = 0;

    for (const month of months) {
      console.log(`\n🔹 ${month} 월별 단가 이력 처리 중...`);

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
            price_month: month,
            unit_price: Math.max(100, adjustedPrice), // 최소 100원
            note: null,
            created_by: 'system',
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
            console.error(`❌ 삽입 오류 (배치 ${Math.floor(i / batchSize) + 1}):`, insertError.message);
          } else {
            totalInserted += batch.length;
            console.log(`  ✅ ${batch.length}개 항목 삽입 완료`);
          }
        }
      }

      const skippedCount = existingItemIds.size;
      totalUpdated += skippedCount;
      
      if (skippedCount > 0) {
        console.log(`  ⏭️  ${skippedCount}개 항목은 이미 존재함 (건너뜀)`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 최종 결과');
    console.log('='.repeat(50));
    console.log(`✅ 새로 생성: ${totalInserted}개`);
    console.log(`⏭️  기존 항목: ${totalUpdated}개`);
    console.log(`📦 총 처리: ${totalInserted + totalUpdated}개\n`);
    console.log('✅ 월별 단가 이력 생성 완료!\n');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
generatePriceHistory();

