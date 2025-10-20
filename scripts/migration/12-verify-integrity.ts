/**
 * Phase 6: 데이터 무결성 검증 (Foreign Key Integrity Verification)
 *
 * 모든 임포트 완료 후 FK 관계가 올바르게 설정되었는지 검증합니다.
 * - 고아 레코드 (orphaned records) 탐지
 * - FK 매칭률 계산
 * - 테이블별 레코드 수 집계
 * - 무결성 위반 사항 상세 리포트
 *
 * ⚡ 병렬 실행 가능: 13-verify-calculations.ts와 동시 실행 가능
 *
 * 실행: npm run migrate:verify-integrity
 */

import { createAdminClient } from './utils/supabase-client';
import { createLogger } from './utils/logger';

interface IntegrityCheck {
  table: string;
  fk_column: string;
  referenced_table: string;
  referenced_column: string;
}

interface IntegrityResult {
  check: IntegrityCheck;
  total_records: number;
  valid_fk_count: number;
  orphaned_count: number;
  match_rate: number;
  orphaned_ids?: number[];
}

interface TableStats {
  table: string;
  total_records: number;
  has_data: boolean;
}

/**
 * FK 무결성 검사 목록
 *
 * 모든 FK 관계를 정의합니다.
 */
const INTEGRITY_CHECKS: IntegrityCheck[] = [
  // items 테이블
  {
    table: 'items',
    fk_column: 'category_id',
    referenced_table: 'categories',
    referenced_column: 'category_id'
  },
  {
    table: 'items',
    fk_column: 'supplier_id',
    referenced_table: 'companies',
    referenced_column: 'company_id'
  },

  // bom 테이블
  {
    table: 'bom',
    fk_column: 'parent_item_id',
    referenced_table: 'items',
    referenced_column: 'item_id'
  },
  {
    table: 'bom',
    fk_column: 'child_item_id',
    referenced_table: 'items',
    referenced_column: 'item_id'
  },

  // coil_specs 테이블
  {
    table: 'coil_specs',
    fk_column: 'item_id',
    referenced_table: 'items',
    referenced_column: 'item_id'
  },

  // inventory_transactions 테이블
  {
    table: 'inventory_transactions',
    fk_column: 'item_id',
    referenced_table: 'items',
    referenced_column: 'item_id'
  },
  {
    table: 'inventory_transactions',
    fk_column: 'warehouse_id',
    referenced_table: 'warehouses',
    referenced_column: 'warehouse_id'
  },

  // purchase_sales_transactions 테이블
  {
    table: 'purchase_sales_transactions',
    fk_column: 'company_id',
    referenced_table: 'companies',
    referenced_column: 'company_id'
  },
  {
    table: 'purchase_sales_transactions',
    fk_column: 'item_id',
    referenced_table: 'items',
    referenced_column: 'item_id'
  },

  // price_master 테이블
  {
    table: 'price_master',
    fk_column: 'item_id',
    referenced_table: 'items',
    referenced_column: 'item_id'
  },

  // scrap_tracking 테이블
  {
    table: 'scrap_tracking',
    fk_column: 'item_id',
    referenced_table: 'items',
    referenced_column: 'item_id'
  }
];

/**
 * FK 무결성 검증
 *
 * 특정 FK 관계에 대해 고아 레코드를 찾고 매칭률을 계산합니다.
 */
async function verifyForeignKey(
  supabase: ReturnType<typeof createAdminClient>,
  check: IntegrityCheck,
  logger: ReturnType<typeof createLogger>
): Promise<IntegrityResult> {
  logger.log(
    `🔍 검증 중: ${check.table}.${check.fk_column} → ${check.referenced_table}.${check.referenced_column}`,
    'info'
  );

  // Step 1: 테이블 전체 레코드 수
  const { count: totalCount, error: countError } = await supabase
    .from(check.table)
    .select('*', { count: 'exact', head: true });

  if (countError) {
    logger.log(`❌ ${check.table} 레코드 카운트 실패: ${countError.message}`, 'error');
    throw countError;
  }

  const totalRecords = totalCount || 0;

  if (totalRecords === 0) {
    logger.log(`ℹ️  ${check.table} 테이블이 비어있음`, 'info');
    return {
      check,
      total_records: 0,
      valid_fk_count: 0,
      orphaned_count: 0,
      match_rate: 100,
      orphaned_ids: []
    };
  }

  // Step 2: 유효한 FK를 가진 레코드 수 (NULL 제외)
  const { data: validData, error: validError } = await supabase
    .from(check.table)
    .select(check.fk_column)
    .not(check.fk_column, 'is', null);

  if (validError) {
    logger.log(`❌ ${check.table} FK 검증 실패: ${validError.message}`, 'error');
    throw validError;
  }

  const nonNullCount = validData?.length || 0;

  // Step 3: 고아 레코드 탐지 (FK가 참조하는 레코드가 존재하지 않음)
  // SQL: SELECT t.* FROM table t LEFT JOIN referenced_table r ON t.fk = r.id WHERE t.fk IS NOT NULL AND r.id IS NULL
  const { data: orphanedData, error: orphanedError } = await supabase.rpc(
    'find_orphaned_records',
    {
      p_table: check.table,
      p_fk_column: check.fk_column,
      p_referenced_table: check.referenced_table,
      p_referenced_column: check.referenced_column
    }
  );

  // RPC 함수가 없으면 수동으로 검증
  let orphanedIds: number[] = [];
  let orphanedCount = 0;

  if (orphanedError && orphanedError.message.includes('function')) {
    // RPC 함수 없음 - 수동 검증
    logger.log('ℹ️  RPC 함수 없음, 수동 검증 수행', 'info');

    // 모든 FK 값 가져오기
    const { data: fkValues, error: fkError } = await supabase
      .from(check.table)
      .select(`${check.fk_column}, ${check.table === 'items' ? 'item_id' : check.table === 'bom' ? 'bom_id' : check.table === 'coil_specs' ? 'spec_id' : check.table === 'inventory_transactions' ? 'transaction_id' : check.table === 'purchase_sales_transactions' ? 'transaction_id' : check.table === 'price_master' ? 'price_id' : 'scrap_id'}`)
      .not(check.fk_column, 'is', null);

    if (fkError) {
      logger.log(`❌ FK 값 가져오기 실패: ${fkError.message}`, 'error');
      throw fkError;
    }

    if (fkValues && fkValues.length > 0) {
      // 참조 테이블에서 존재하는 ID 확인
      const fkSet = new Set(fkValues.map(row => row[check.fk_column]));
      const { data: referencedIds, error: refError } = await supabase
        .from(check.referenced_table)
        .select(check.referenced_column)
        .in(check.referenced_column, Array.from(fkSet));

      if (refError) {
        logger.log(`❌ 참조 테이블 조회 실패: ${refError.message}`, 'error');
        throw refError;
      }

      const validIdSet = new Set(referencedIds?.map(row => row[check.referenced_column]) || []);

      // 고아 레코드 찾기
      orphanedIds = fkValues
        .filter(row => !validIdSet.has(row[check.fk_column]))
        .map(row => row[check.table === 'items' ? 'item_id' : check.table === 'bom' ? 'bom_id' : check.table === 'coil_specs' ? 'spec_id' : check.table === 'inventory_transactions' ? 'transaction_id' : check.table === 'purchase_sales_transactions' ? 'transaction_id' : check.table === 'price_master' ? 'price_id' : 'scrap_id']);

      orphanedCount = orphanedIds.length;
    }
  } else if (orphanedError) {
    logger.log(`❌ 고아 레코드 검증 실패: ${orphanedError.message}`, 'error');
    throw orphanedError;
  } else {
    orphanedIds = orphanedData?.map((row: any) => row.id) || [];
    orphanedCount = orphanedIds.length;
  }

  // Step 4: 매칭률 계산
  const validFkCount = nonNullCount - orphanedCount;
  const matchRate = nonNullCount > 0 ? (validFkCount / nonNullCount) * 100 : 100;

  if (orphanedCount > 0) {
    logger.log(
      `⚠️  고아 레코드 발견: ${orphanedCount}개 (${(100 - matchRate).toFixed(2)}%)`,
      'warn'
    );
    logger.log(`   고아 레코드 ID: ${orphanedIds.slice(0, 10).join(', ')}${orphanedIds.length > 10 ? '...' : ''}`, 'warn');
  } else {
    logger.log(`✅ 모든 FK 관계 정상 (100% 매칭)`, 'success');
  }

  return {
    check,
    total_records: totalRecords,
    valid_fk_count: validFkCount,
    orphaned_count: orphanedCount,
    match_rate: matchRate,
    orphaned_ids: orphanedIds.slice(0, 20) // 최대 20개만 저장
  };
}

/**
 * 테이블 통계 수집
 */
async function collectTableStats(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<TableStats[]> {
  const tables = [
    'categories',
    'companies',
    'warehouses',
    'items',
    'bom',
    'coil_specs',
    'inventory_transactions',
    'purchase_sales_transactions',
    'price_master',
    'scrap_tracking'
  ];

  const stats: TableStats[] = [];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      logger.log(`⚠️  ${table} 통계 수집 실패: ${error.message}`, 'warn');
      stats.push({ table, total_records: 0, has_data: false });
    } else {
      const totalRecords = count || 0;
      stats.push({ table, total_records: totalRecords, has_data: totalRecords > 0 });
    }
  }

  return stats;
}

/**
 * 무결성 검증 리포트 생성
 */
function generateIntegrityReport(
  results: IntegrityResult[],
  tableStats: TableStats[],
  logger: ReturnType<typeof createLogger>
): void {
  logger.divider('=');
  logger.log('\n📊 데이터 무결성 검증 리포트\n', 'info');

  // 1. 테이블별 레코드 수
  logger.log('📋 테이블별 레코드 수:', 'info');
  const statsTable: { [key: string]: string } = {};
  tableStats.forEach(stat => {
    statsTable[stat.table] = stat.total_records.toLocaleString('ko-KR') + (stat.has_data ? ' ✅' : ' ⚠️ 비어있음');
  });
  logger.table(statsTable);

  // 2. FK 무결성 검증 결과
  logger.log('\n🔗 FK 무결성 검증 결과:', 'info');
  const integrityTable: { [key: string]: string } = {};
  results.forEach(result => {
    const key = `${result.check.table}.${result.check.fk_column}`;
    const matchRate = result.match_rate.toFixed(2);
    const status = result.orphaned_count === 0 ? '✅' : '❌';
    integrityTable[key] = `${matchRate}% ${status} (${result.valid_fk_count}/${result.total_records})`;
  });
  logger.table(integrityTable);

  // 3. 무결성 위반 상세
  const violations = results.filter(r => r.orphaned_count > 0);
  if (violations.length > 0) {
    logger.log('\n⚠️  무결성 위반 상세:', 'warn');
    violations.forEach(v => {
      logger.log(`\n테이블: ${v.check.table}`, 'warn');
      logger.log(`  FK 컬럼: ${v.check.fk_column} → ${v.check.referenced_table}.${v.check.referenced_column}`, 'warn');
      logger.log(`  고아 레코드: ${v.orphaned_count}개`, 'warn');
      if (v.orphaned_ids && v.orphaned_ids.length > 0) {
        logger.log(`  고아 레코드 ID (샘플): ${v.orphaned_ids.join(', ')}`, 'warn');
      }
    });
  } else {
    logger.log('\n✅ 모든 FK 관계가 정상입니다', 'success');
  }

  // 4. 전체 무결성 점수
  const totalChecks = results.length;
  const passedChecks = results.filter(r => r.orphaned_count === 0).length;
  const integrityScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

  logger.log('\n📊 전체 무결성 점수:', 'info');
  logger.table({
    '총 검사 항목': totalChecks,
    '통과': passedChecks,
    '실패': totalChecks - passedChecks,
    '무결성 점수': `${integrityScore.toFixed(2)}%`
  });
}

async function main() {
  const logger = createLogger('데이터 무결성 검증');
  logger.startMigration();

  // Step 1: 테이블 통계 수집
  logger.startPhase('테이블 통계 수집');

  const supabase = createAdminClient();
  const tableStats = await collectTableStats(supabase, logger);

  logger.log(`테이블 통계 수집 완료: ${tableStats.length}개 테이블`, 'success');
  logger.endPhase();

  // Step 2: FK 무결성 검증
  logger.startPhase('FK 무결성 검증');

  const results: IntegrityResult[] = [];

  for (const check of INTEGRITY_CHECKS) {
    try {
      const result = await verifyForeignKey(supabase, check, logger);
      results.push(result);
    } catch (error) {
      logger.log(`❌ 검증 실패: ${check.table}.${check.fk_column}`, 'error');
      logger.log(`   에러: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  logger.log(`FK 무결성 검증 완료: ${results.length}개 관계`, 'success');
  logger.endPhase();

  // Step 3: 리포트 생성
  logger.startPhase('무결성 리포트 생성');

  generateIntegrityReport(results, tableStats, logger);

  logger.endPhase();

  // Step 4: 결과 판정
  const hasViolations = results.some(r => r.orphaned_count > 0);
  const success = !hasViolations;

  logger.endMigration(success);

  if (!success) {
    logger.log('\n⚠️  무결성 위반이 발견되었습니다. 위 리포트를 확인하세요.', 'warn');
    process.exit(1);
  }

  logger.log('\n✅ 모든 무결성 검증을 통과했습니다', 'success');
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
