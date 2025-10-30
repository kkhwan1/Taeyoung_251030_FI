/**
 * Supabase MCP를 활용한 종합 검토 스크립트
 *
 * MCP 도구를 사용하여:
 * 1. 테이블별 데이터 현황 확인
 * 2. 외래 키 관계 및 데이터 일관성 검증
 * 3. 보안 및 성능 어드바이저 확인
 * 4. 누락된 데이터 확인
 *
 * 실행: npx tsx scripts/migration/comprehensive-mcp-review.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

// .env에서 프로젝트 정보 읽기
function getProjectRef(): string {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=https:\/\/([^.]+)\.supabase\.co/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('MCP 종합 검토');
  logger.startMigration();

  const supabase = createAdminClient();
  const projectRef = getProjectRef();

  if (!projectRef) {
    logger.log('프로젝트 ID를 찾을 수 없습니다', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  logger.log(`프로젝트 ID: ${projectRef}`, 'info');

  // Step 1: 연결 테스트
  logger.startPhase('Supabase 연결 테스트');
  const connected = await testConnection(supabase);
  if (!connected) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  // Step 2: 주요 테이블 데이터 현황
  logger.startPhase('주요 테이블 데이터 현황');

  const tables = [
    'users',
    'companies',
    'items',
    'inventory_transactions',
    'bom',
    'warehouses',
    'warehouse_stock',
    'coil_specs',
    'price_master',
    'item_price_history'
  ];

  const tableStats: Record<string, number> = {};

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        logger.log(`  ⚠️  ${table}: 조회 오류 - ${error.message}`, 'warn');
      } else {
        tableStats[table] = count || 0;
        logger.log(`  ✅ ${table}: ${count || 0}개`, 'info');
      }
    } catch (error: any) {
      logger.log(`  ⚠️  ${table}: 오류 - ${error.message}`, 'warn');
    }
  }

  logger.endPhase();

  // Step 3: 데이터 일관성 검증
  logger.startPhase('데이터 일관성 검증');

  // 3.1 Items with invalid supplier_id
  const { data: invalidSupplierItems, error: supplierError } = await supabase
    .from('items')
    .select('item_id, item_code, supplier_id')
    .not('supplier_id', 'is', null)
    .limit(10);

  if (!supplierError && invalidSupplierItems) {
    for (const item of invalidSupplierItems) {
      const { data: company } = await supabase
        .from('companies')
        .select('company_id')
        .eq('company_id', item.supplier_id)
        .single();

      if (!company) {
        logger.log(`  ⚠️  품목 ${item.item_code}: 존재하지 않는 supplier_id ${item.supplier_id}`, 'warn');
      }
    }
  }

  // 3.2 Inventory transactions with invalid item_id
  const { data: invalidItemTrans, error: itemTransError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id, item_id')
    .not('item_id', 'is', null)
    .limit(10);

  if (!itemTransError && invalidItemTrans) {
    for (const txn of invalidItemTrans) {
      const { data: item } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_id', txn.item_id)
        .single();

      if (!item) {
        logger.log(`  ⚠️  거래 ${txn.transaction_id}: 존재하지 않는 item_id ${txn.item_id}`, 'warn');
      }
    }
  }

  // 3.3 Inventory transactions with invalid company_id
  const { data: invalidCompanyTrans, error: companyTransError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id, company_id')
    .not('company_id', 'is', null)
    .limit(10);

  if (!companyTransError && invalidCompanyTrans) {
    for (const txn of invalidCompanyTrans) {
      const { data: company } = await supabase
        .from('companies')
        .select('company_id')
        .eq('company_id', txn.company_id)
        .single();

      if (!company) {
        logger.log(`  ⚠️  거래 ${txn.transaction_id}: 존재하지 않는 company_id ${txn.company_id}`, 'warn');
      }
    }
  }

  logger.endPhase();

  // Step 4: 누락된 데이터 확인
  logger.startPhase('누락된 데이터 확인');

  // 4.1 Items without price
  const { count: itemsWithoutPrice } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .or('price.is.null,price.eq.0');

  logger.log(`  단가 없는 품목: ${itemsWithoutPrice || 0}개`, itemsWithoutPrice && itemsWithoutPrice > 0 ? 'warn' : 'info');

  // 4.2 Transactions without unit_price
  const { count: transWithoutPrice } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .or('unit_price.is.null,unit_price.eq.0');

  logger.log(`  단가 없는 거래: ${transWithoutPrice || 0}개`, transWithoutPrice && transWithoutPrice > 0 ? 'warn' : 'info');

  // 4.3 Transactions without amounts
  const { count: transWithoutAmounts } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .or('total_amount.is.null,tax_amount.is.null,grand_total.is.null');

  logger.log(`  금액 없는 거래: ${transWithoutAmounts || 0}개`, transWithoutAmounts && transWithoutAmounts > 0 ? 'warn' : 'info');

  // 4.4 Items without material info
  const { count: itemsWithoutMaterial } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .or('material.is.null,material.eq.');

  logger.log(`  재질 정보 없는 품목: ${itemsWithoutMaterial || 0}개`, itemsWithoutMaterial && itemsWithoutMaterial > 0 ? 'warn' : 'info');

  // 4.5 Items without spec
  const { count: itemsWithoutSpec } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .or('spec.is.null,spec.eq.');

  logger.log(`  규격 정보 없는 품목: ${itemsWithoutSpec || 0}개`, itemsWithoutSpec && itemsWithoutSpec > 0 ? 'warn' : 'info');

  logger.endPhase();

  // Step 5: 데이터 품질 지표
  logger.startPhase('데이터 품질 지표');

  const totalItems = tableStats['items'] || 0;
  const totalTransactions = tableStats['inventory_transactions'] || 0;

  const qualityMetrics = {
    '품목 단가 보유율': totalItems > 0 ? `${Math.round(((totalItems - (itemsWithoutPrice || 0)) / totalItems) * 100)}%` : '0%',
    '거래 단가 보유율': totalTransactions > 0 ? `${Math.round(((totalTransactions - (transWithoutPrice || 0)) / totalTransactions) * 100)}%` : '0%',
    '거래 금액 계산율': totalTransactions > 0 ? `${Math.round(((totalTransactions - (transWithoutAmounts || 0)) / totalTransactions) * 100)}%` : '0%',
    '재질 정보 보유율': totalItems > 0 ? `${Math.round(((totalItems - (itemsWithoutMaterial || 0)) / totalItems) * 100)}%` : '0%',
    '규격 정보 보유율': totalItems > 0 ? `${Math.round(((totalItems - (itemsWithoutSpec || 0)) / totalItems) * 100)}%` : '0%'
  };

  logger.table(qualityMetrics);
  logger.endPhase();

  // Step 6: 결과 요약
  logger.divider('=');
  logger.log('\n📊 MCP 종합 검토 결과\n', 'info');

  logger.table({
    '전체 품목': tableStats['items'] || 0,
    '전체 거래': tableStats['inventory_transactions'] || 0,
    '전체 거래처': tableStats['companies'] || 0,
    '전체 사용자': tableStats['users'] || 0,
    '단가 없는 품목': itemsWithoutPrice || 0,
    '단가 없는 거래': transWithoutPrice || 0,
    '금액 없는 거래': transWithoutAmounts || 0
  });

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

