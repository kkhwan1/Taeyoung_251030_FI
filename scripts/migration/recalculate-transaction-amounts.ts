/**
 * 거래 금액 재계산 스크립트
 *
 * unit_price와 quantity가 있는 모든 거래에 대해
 * total_amount, tax_amount, grand_total 재계산
 *
 * 실행: npx tsx scripts/migration/recalculate-transaction-amounts.tsbergen
 */

import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

async function main() {
  const logger = createLogger('거래 금액 재계산');
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

  // Step 2: 단가와 수량이 있는 거래 조회
  logger.startPhase('금액 재계산 대상 거래 조회');
  
  const { data: transactions, error: fetchError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id, quantity, unit_price, total_amount, tax_amount, grand_total')
    .not('unit_price', 'is', null)
    .not('quantity', 'is', null)
    .gt('unit_price', 0)
    .limit(5000);

  if (fetchError) {
    throw new Error(`거래 조회 실패: ${fetchError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    logger.log('재계산할 거래가 없습니다', 'info');
    logger.endMigration(true);
    return;
  }

  logger.log(`${transactions.length}개 거래 재계산 시작`, 'info');
  logger.endPhase();

  // Step 3: 금액 재계산 및 업데이트
  logger.startPhase('거래 금액 재계산');
  
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];

    if (txn.quantity && txn.unit_price) {
      const totalAmount = Math.round(txn.unit_price * txn.quantity);
      const taxAmount = Math.round(totalAmount * 0.1);
      const grandTotal = totalAmount + taxAmount;

      // 기존 값과 다를 때만 업데이트
      const needsUpdate = 
        txn.total_amount !== totalAmount ||
        txn.tax_amount !== taxAmount ||
        txn.grand_total !== grandTotal;

      if (needsUpdate) {
        const { error } = await supabase
          .from('inventory_transactions')
          .update({
            total_amount: totalAmount,
            tax_amount: taxAmount,
            grand_total: grandTotal
          })
          .eq('transaction_id', txn.transaction_id);

        if (error) {
          if (skipped < 10) {
            logger.log(`  ⚠️  거래 ${txn.transaction_id}: ${error.message}`, 'warn');
          }
          skipped++;
        } else {
          updated++;
        }
      } else {
        skipped++;
      }
    }

    if ((i + 1) % 500 === 0 || i + 1 === transactions.length) {
      logger.progress(i + 1, transactions.length, '금액 재계산');
    }
  }

  logger.log(`✅ 업데이트: ${updated}개, 변경 없음: ${skipped}개`, 'success');
  logger.endPhase();

  // Step 4: 최종 확인
  logger.startPhase('최종 상태 확인');
  
  const { count: totalCount } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true });

  const { count: withAmounts } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .not('total_amount', 'is', null)
    .not('tax_amount', 'is', null)
    .not('grand_total', 'is', null);

  logger.log(`전체 거래: ${totalCount || 0}개`, 'info');
  logger.log(`금액 계산된 거래: ${withAmounts || 0}개`, 'info');
  logger.log(`금액 계산률: ${totalCount ? Math.round((withAmounts || 0) / totalCount * 100) : 0}%`, 'info');
  logger.endPhase();

  // Step 5: 결과 요약
  logger.divider('=');
  logger.log('\n📊 거래 금액 재계산 결과\n', 'info');
  
  logger.table({
    '전체 거래': totalCount || 0,
    '재계산 대상': transactions.length,
    '업데이트': updated,
    '변경 없음': skipped,
    '금액 계산된 거래': withAmounts || 0,
    '금액 계산률': `${totalCount ? Math.round((withAmounts || 0) / totalCount * 100) : 0}%`
  });

  logger.endMigration(true);
}

main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

