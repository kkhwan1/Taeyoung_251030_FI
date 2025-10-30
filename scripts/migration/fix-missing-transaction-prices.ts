/**
 * 단가 없는 거래에 품목 단가 반영 스크립트
 *
 * unit_price가 없는 거래에 대해 items.price를 사용하여 업데이트
 *
 * 실행: npx tsx scripts/migration/fix-missing-transaction-prices.ts
 */

import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

async function main() {
  const logger = createLogger('거래 단가 업데이트');
  logger.startMigration();

  const supabase = createAdminClient();

  // Step 1: 연결 테스트
  logger.startPhase('Supabase 연결 테스트');
  const connected = await testConnection(supabase);
  if (!connected) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  // Step 2: 단가 없는 거래 조회
  logger.startPhase('단가 없는 거래 조회');
  
  const { data: transactionsWithoutPrice, error: fetchError } = await supabase
    .from('inventory_transactions')
    .select(`
      transaction_id,
      item_id,
      quantity,
      unit_price,
      items!inner(item_id, price)
    `)
    .or('unit_price.is.null,unit_price.eq.0')
    .limit(5000);

  if (fetchError) {
    throw new Error(`거래 조회 실패: ${fetchError.message}`);
  }

  if (!transactionsWithoutPrice || transactionsWithoutPrice.length === 0) {
    logger.log('업데이트할 거래가 없습니다', 'info');
    logger.endMigration(true);
    return;
  }

  logger.log(`${transactionsWithoutPrice.length}개 거래 처리 시작`, 'info');
  logger.endPhase();

  // Step 3: 단가 업데이트
  logger.startPhase('거래 단가 업데이트');
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < transactionsWithoutPrice.length; i++) {
    const txn = transactionsWithoutPrice[i];
    const item = txn.items as any;

    // 품목에 단가가 있으면 거래 단가 업데이트
    if (item?.price && item.price > 0) {
      const { error } = await supabase
        .from('inventory_transactions')
        .update({ unit_price: item.price })
        .eq('transaction_id', txn.transaction_id);

      if (error) {
        errors++;
        if (errors <= 10) {
          logger.log(`  ⚠️  거래 ${txn.transaction_id}: ${error.message}`, 'warn');
        }
      } else {
        updated++;
      }
    } else {
      skipped++;
    }

    if ((i + 1) % 100 === 0 || i + 1 === transactionsWithoutPrice.length) {
      logger.progress(i + 1, transactionsWithoutPrice.length, '거래 단가 업데이트');
    }
  }

  logger.log(`✅ 업데이트: ${updated}개, 스킵: ${skipped}개, 오류: ${errors}개`, 'success');
  logger.endPhase();

  // Step 4: 금액 재계산
  logger.startPhase('거래 금액 재계산');
  
  // 업데이트된 거래의 금액 재계산
  const { data: transactionsToRecalc, error: recalcFetchError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id, quantity, unit_price, total_amount, tax_amount, grand_total')
    .not('unit_price', 'is', null)
    .or('total_amount.is.null,tax_amount.is.null,grand_total.is.null')
    .limit(5000);

  if (recalcFetchError) {
    logger.log(`금액 재계산 거래 조회 오류: ${recalcFetchError.message}`, 'warn');
  } else if (transactionsToRecalc && transactionsToRecalc.length > 0) {
    let recalcUpdated = 0;

    for (const txn of transactionsToRecalc) {
      if (txn.quantity && txn.unit_price) {
        const totalAmount = Math.round(txn.unit_price * txn.quantity);
        const taxAmount = Math.round(totalAmount * 0.1);
        const grandTotal = totalAmount + taxAmount;

        const { error } = await supabase
          .from('inventory_transactions')
          .update({
            total_amount: totalAmount,
            tax_amount: taxAmount,
            grand_total: grandTotal
          })
          .eq('transaction_id', txn.transaction_id);

        if (!error) {
          recalcUpdated++;
        }
      }
    }

    logger.log(`✅ ${recalcUpdated}개 거래 금액 재계산 완료`, 'success');
  } else {
    logger.log('재계산할 거래가 없습니다', 'info');
  }
  logger.endPhase();

  // Step 5: 최종 확인
  logger.startPhase('최종 상태 확인');
  
  const { count: nullPriceCount } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .or('unit_price.is.null,unit_price.eq.0');

  const { count: nullAmountCount } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .or('total_amount.is.null,tax_amount.is.null,grand_total.is.null');

  logger.log(`남은 단가 없는 거래: ${nullPriceCount || 0}개`, 'info');
  logger.log(`남은 금액 없는 거래: ${nullAmountCount || 0}개`, 'info');
  logger.endPhase();

  // Step 6: 결과 요약
  logger.divider('=');
  logger.log('\n📊 거래 단가 업데이트 결과\n', 'info');
  
  logger.table({
    '처리한 거래': transactionsWithoutPrice.length,
    '단가 업데이트': updated,
    '품목 단가 없음': skipped,
    '오류': errors,
    '남은 단가 없는 거래': nullPriceCount || 0,
    '남은 금액 없는 거래': nullAmountCount || 0
  });

  logger.endMigration(true);
}

main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

