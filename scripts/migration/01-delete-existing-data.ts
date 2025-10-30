/**
 * Phase 1: 기존 데이터 삭제
 *
 * FK 제약조건 순서를 고려하여 12개 테이블의 데이터를 안전하게 삭제합니다.
 *
 * 실행: npm run migrate:delete
 */

import { createAdminClient, testConnection, getTableCount, deleteAllRecords } from './utils/supabase-client';
import { createLogger } from './utils/logger';

// FK 제약조건 순서대로 삭제 (자식 → 부모)
// ⚠️ users 테이블은 완전히 제외 (운영 계정 유지)
// warehouses는 빈 테이블이므로 제외
const DELETION_ORDER = [
  // 계약 관련 (FK를 가진 자식) - 테스트 데이터 삭제
  'contract_documents',           // FK: contracts
  'contracts',                    // FK: companies
  
  // 거래 데이터 (FK를 가진 자식)
  'collections',                  // FK: sales_transactions
  'payments',                     // FK: purchase_transactions
  'bom_deduction_log',            // FK: inventory_transactions, bom
  'inventory_transactions',       // FK: items, companies, warehouses
  'purchase_transactions',        // FK: companies, items
  'sales_transactions',           // FK: companies, items
  'scrap_tracking',               // FK: items
  'price_master',                 // FK: items
  'item_price_history',           // FK: items
  'coil_specs',                   // FK: items
  'warehouse_stock',              // FK: items, warehouses

  // 관계 데이터
  'bom',                          // FK: items (parent, child)

  // 마스터 데이터 (FK를 주는 부모)
  'items',                        // FK: companies (supplier_id)
  'companies'                     // No FK
  // 'users' 제외 (운영 계정 유지)
  // 'warehouses' 제외 (빈 테이블)
];

async function main() {
  const logger = createLogger('데이터 삭제');
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

  // Step 2: 삭제 전 카운트 조회
  logger.startPhase('삭제 전 레코드 카운트 조회');
  const countsBefore: Record<string, number> = {};

  for (const table of DELETION_ORDER) {
    const count = await getTableCount(supabase, table);
    countsBefore[table] = count;
    logger.log(`${table}: ${count.toLocaleString('ko-KR')} 레코드`, 'info');
  }

  const totalBefore = Object.values(countsBefore).reduce((a, b) => a + b, 0);
  logger.log(`\n총 ${totalBefore.toLocaleString('ko-KR')} 레코드 삭제 예정`, 'warn');
  logger.endPhase();

  // Step 3: 데이터 삭제 (FK 순서대로)
  logger.startPhase('데이터 삭제 실행');
  const deletionResults: Array<{ table: string; count: number; success: boolean; error?: string }> = [];

  for (let i = 0; i < DELETION_ORDER.length; i++) {
    const table = DELETION_ORDER[i];

    logger.progress(i + 1, DELETION_ORDER.length, table);

    const result = await deleteAllRecords(supabase, table);

    deletionResults.push({
      table,
      count: result.count,
      success: result.success,
      error: result.error
    });

    if (result.success) {
      logger.log(`✅ ${table}: ${result.count.toLocaleString('ko-KR')} 레코드 삭제 완료`, 'success');
    } else {
      logger.log(`❌ ${table}: 삭제 실패 - ${result.error}`, 'error');
    }
  }
  logger.endPhase();

  // Step 4: 삭제 후 검증
  logger.startPhase('삭제 결과 검증');
  const countsAfter: Record<string, number> = {};
  let verificationFailed = false;

  for (const table of DELETION_ORDER) {
    const count = await getTableCount(supabase, table);
    countsAfter[table] = count;

    if (count > 0) {
      logger.log(`⚠️  ${table}: ${count} 레코드 남음 (완전 삭제 실패)`, 'warn');
      verificationFailed = true;
    } else {
      logger.log(`✅ ${table}: 0 레코드 (완전 삭제 성공)`, 'success');
    }
  }
  logger.endPhase();

  // Step 5: 결과 요약
  logger.divider('=');
  logger.log('\n📊 삭제 결과 요약\n', 'info');

  const totalDeleted = deletionResults.reduce((sum, r) => sum + r.count, 0);
  const successCount = deletionResults.filter(r => r.success).length;
  const failedCount = deletionResults.filter(r => !r.success).length;

  logger.table({
    '총 테이블 수': DELETION_ORDER.length,
    '삭제 성공': successCount,
    '삭제 실패': failedCount,
    '삭제된 레코드': totalDeleted.toLocaleString('ko-KR'),
    '삭제 전 레코드': totalBefore.toLocaleString('ko-KR')
  });

  if (failedCount > 0) {
    logger.log('\n❌ 일부 테이블 삭제 실패:', 'error');
    deletionResults
      .filter(r => !r.success)
      .forEach(r => {
        logger.log(`  - ${r.table}: ${r.error}`, 'error');
      });
  }

  if (verificationFailed) {
    logger.log('\n⚠️  일부 테이블에 레코드가 남아있습니다', 'warn');
    logger.endMigration(false);
    process.exit(1);
  }

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
