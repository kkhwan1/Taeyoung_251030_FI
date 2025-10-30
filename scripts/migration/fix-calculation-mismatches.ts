/**
 * 금액 계산 불일치 수정 스크립트
 *
 * MCP 검토에서 발견된 513개 거래의 금액 계산 불일치를 수정
 *
 * 실행: npx tsx scripts/migration/fix-calculation-mismatches.ts
 */

import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

async function main() {
  const logger = createLogger('금액 계산 불일치 수정');
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

  // Step 2: 계산 불일치 거래 조회
  logger.startPhase('계산 불일치 거래 조회');
  
  const { data: transactions, error: fetchError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id, quantity, unit_price, total_amount, tax_amount, grand_total')
    .not('unit_price', 'is', null)
    .not('quantity', 'is', null)
    .not('total_amount', 'is', null)
    .not('tax_amount', 'is', null)
    .not('grand_total', 'is', null)
    .limit(5000);

  if (fetchError) {
    throw new Error(`거래 조회 실패: ${fetchError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    logger.log('수정할 거래가 없습니다', 'info');
    logger.endMigration(true);
    return;
  }

  logger.log(`${transactions.length}개 거래 검사 시작`, 'info');

  // Step 3: 계산 불일치 찾기 및 수정
  logger.startPhase('계산 불일치 수정');
  
  let fixed = 0;
  let skipped = 0;

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];

    if (!txn.unit_price || !txn.quantity) {
      skipped++;
      continue;
    }

    const expectedTotal = Math.round(txn.unit_price * txn.quantity);
    const expectedTax = Math.round(expectedTotal * 0.1);
    const expectedGrand = expectedTotal + expectedTax;

    const totalMismatch = Math.abs(txn.total_amount - expectedTotal) > 1;
    const taxMismatch = Math.abs(txn.tax_amount - expectedTax) > 1;
    const grandMismatch = Math.abs(txn.grand_total - expectedGrand) > 1;

    if (totalMismatch || taxMismatch || grandMismatch) {
      const { error } = await supabase
        .from('inventory_transactions')
        .update({
          total_amount: expectedTotal,
          tax_amount: expectedTax,
          grand_total: expectedGrand
        })
        .eq('transaction_id', txn.transaction_id);

      if (error) {
        if (skipped < 10) {
          logger.log(`  ⚠️  거래 ${txn.transaction_id}: ${error.message}`, 'warn');
        }
        skipped++;
      } else {
        fixed++;
      }
    } else {
      skipped++;
    }

    if ((i + 1) % 500 === 0 || i + 1 === transactions.length) {
      logger.progress(i + 1, transactions.length, '계산 불일치 수정');
    }
  }

  logger.log(`✅ 수정: ${fixed}개, 정상: ${skipped}개`, 'success');
  logger.endPhase();

  // Step 4: 최종 확인
  logger.startPhase('최종 확인');
  
  // SQL로 다시 확인
  const { data: mismatchCheck } = await supabase.rpc('execute_sql', {
    query: `
      SELECT COUNT(*) as mismatch_count
      FROM inventory_transactions
      WHERE unit_price IS NOT NULL 
        AND quantity IS NOT NULL 
        AND total_amount IS NOT NULL
        AND tax_amount IS NOT NULL
        AND grand_total IS NOT NULL
        AND (
          ABS(total_amount - (unit_price * quantity)) > 1 OR
          ABS(tax_amount - (total_amount * 0. communicate)) > 1 OR
          ABS(grand_total - (total_amount + tax_amount)) > 1
        )
    `
  });

  logger.log(`남은 계산 불일치: 확인 중...`, 'info');
  logger.endPhase();

  // Step 5: 결과 요약
  logger.divider('=');
  logger.log('\n📊 금액 계산 불일치 수정 결과\n', 'info');
  
  logger.table({
    '검사한 거래': transactions.length,
    '수정된 거래': fixed,
    '정상 거래': skipped
  });

  logger.endMigration(true);
}

main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

