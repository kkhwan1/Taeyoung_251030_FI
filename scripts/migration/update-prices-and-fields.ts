/**
 * 단가 및 빈 필드 업데이트 스크립트
 *
 * 태창금속 BOM.xlsx의 최신단가 시트에서 단가 정보를 추출하여:
 * 1. items 테이블의 price 필드 업데이트
 * 2. inventory_transactions 테이블의 금액 필드 계산 및 업데이트
 * 3. 빈 필드 채우기
 *
 * 실행: npx tsx scripts/migration/update-prices-and-fields.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';
import { Database } from '@/types/supabase';

const EXCEL_FILE_NAME = '태창금속 BOM.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const FILE_PATH = path.join(EXCEL_DIR, EXCEL_FILE_NAME);

/**
 * 최신단가 시트에서 품번-단가 매핑 추출
 */
function parsePriceSheet(): Map<string, number> {
  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`Excel 파일을 찾을 수 없습니다: ${FILE_PATH}`);
  }

  const workbook = XLSX.readFile(FILE_PATH, {
    type: 'file',
    cellDates: true,
    cellNF: false,
    cellText: false
  });

  // 최신단가 시트 찾기
  const targetSheet = workbook.SheetNames.find(name => 
    name.includes('최신단가') || name.includes('단가') || name.toLowerCase().includes('price')
  );

  if (!targetSheet) {
    throw new Error(`최신단가 시트를 찾을 수 없습니다. 시트 목록: ${workbook.SheetNames.join(', ')}`);
  }

  const worksheet = workbook.Sheets[targetSheet];
  
  // 첫 행부터 데이터 시작 (헤더 없음)
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    blankrows: false
  }) as any[][];

  const priceMap = new Map<string, number>();

  for (const row of rows) {
    // 컬럼 0: 품번, 컬럼 1: 단가
    const itemCode = String(row[0] || '').trim();
    const priceStr = String(row[1] || '').trim();
    
    if (!itemCode) continue;

    // 단가 파싱
    let price = 0;
    if (typeof row[1] === 'number') {
      price = row[1];
    } else if (priceStr !== '') {
      const parsed = Number(priceStr.replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        price = parsed;
      }
    }

    if (price > 0) {
      priceMap.set(itemCode, price);
    }
  }

  return priceMap;
}

/**
 * Items 테이블의 price 필드 업데이트
 */
async function updateItemsPrices(
  supabase: ReturnType<typeof createAdminClient>,
  priceMap: Map<string, number>,
  logger: ReturnType<typeof createLogger>
): Promise<{ updated: number; notFound: string[] }> {
  const notFound: string[] = [];
  let updated = 0;

  // 배치 업데이트 (100개씩)
  const batchSize = 100;
  const items = Array.from(priceMap.entries());
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    for (const [itemCode, price] of batch) {
      const { data, error } = await supabase
        .from('items')
        .update({ price })
        .eq('item_code', itemCode)
        .select('item_id');

      if (error) {
        logger.log(`  ⚠️  ${itemCode}: ${error.message}`, 'warn');
        notFound.push(itemCode);
      } else if (data && data.length > 0) {
        updated++;
      } else {
        notFound.push(itemCode);
      }
    }

    if ((i + batchSize) % 500 === 0 || i + batchSize >= items.length) {
      logger.progress(Math.min(i + batchSize, items.length), items.length, 'items 업데이트');
    }
  }

  return { updated, notFound };
}

/**
 * Inventory Transactions 테이블의 금액 필드 계산 및 업데이트
 */
async function updateTransactionPrices(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<{ updated: number }> {
  // 1. 모든 거래 조회 (item_id 포함)
  const { data: transactions, error: fetchError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id, item_id, quantity, items!inner(item_id, price)')
    .order('transaction_id', { ascending: true });

  if (fetchError) {
    throw new Error(`거래 조회 실패: ${fetchError.message}`);
  }

  if (!transactions || transactions.length === 0) {
    logger.log('업데이트할 거래가 없습니다', 'info');
    return { updated: 0 };
  }

  logger.log(`${transactions.length}개 거래 처리 시작`, 'info');

  // 2. 금액 계산 및 업데이트
  let updated = 0;
  const batchSize = 100;

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);

    for (const txn of batch) {
      const item = Array.isArray(txn.items) ? txn.items[0] : txn.items;
      const unitPrice = (item?.price as number) || 0;
      
      if (unitPrice > 0) {
        const quantity = txn.quantity || 0;
        const totalAmount = Math.round(unitPrice * quantity);
        const taxAmount = Math.round(totalAmount * 0.1); // 부가세 10%
        const grandTotal = totalAmount + taxAmount;

        const { error } = await supabase
          .from('inventory_transactions')
          .update({
            unit_price: unitPrice,
            total_amount: totalAmount,
            tax_amount: taxAmount,
            grand_total: grandTotal
          })
          .eq('transaction_id', txn.transaction_id);

        if (error) {
          logger.log(`  ⚠️  거래 ${txn.transaction_id}: ${error.message}`, 'warn');
        } else {
          updated++;
        }
      }
    }

    if ((i + batchSize) % 500 === 0 || i + batchSize >= transactions.length) {
      logger.progress(Math.min(i + batchSize, transactions.length), transactions.length, 'transactions 업데이트');
    }
  }

  return { updated };
}

/**
 * 빈 필드 채우기
 */
async function fillEmptyFields(
  supabase: ReturnType<typeof createAdminClient>,
  logger: ReturnType<typeof createLogger>
): Promise<{ unitUpdated: number; categoryUpdated: number }> {
  // unit이 NULL인 경우 'EA' 설정
  const { count: unitCount, error: unitError } = await supabase
    .from('items')
    .update({ unit: 'EA' })
    .is('unit', null)
    .select('item_id', { count: 'exact', head: true });

  if (unitError) {
    logger.log(`  ⚠️  unit 업데이트 오류: ${unitError.message}`, 'warn');
  }

  // category가 NULL인 경우 '원자재' 설정
  const { count: categoryCount, error: categoryError } = await supabase
    .from('items')
    .update({ category: '원자재' as const })
    .is('category', null)
    .select('item_id', { count: 'exact', head: true });

  if (categoryError) {
    logger.log(`  ⚠️  category 업데이트 오류: ${categoryError.message}`, 'warn');
  }

  return {
    unitUpdated: unitCount || 0,
    categoryUpdated: categoryCount || 0
  };
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('가격 및 필드 업데이트');
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

  // Step 2: 최신단가 시트 파싱
  logger.startPhase('최신단가 시트 파싱');
  let priceMap: Map<string, number>;
  try {
    priceMap = parsePriceSheet();
    logger.log(`✅ ${priceMap.size}개 품목의 단가 추출 완료`, 'success');
  } catch (error: any) {
    logger.log(`❌ 파싱 실패: ${error.message}`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  // Step 3: Items 테이블 가격 업데이트
  logger.startPhase('Items 테이블 가격 업데이트');
  const { updated: itemsUpdated, notFound } = await updateItemsPrices(supabase, priceMap, logger);
  logger.log(`✅ ${itemsUpdated}개 품목 가격 업데이트 완료`, 'success');
  if (notFound.length > 0) {
    logger.log(`⚠️  매칭되지 않은 품번: ${notFound.length}개`, 'warn');
    if (notFound.length <= 10) {
      notFound.forEach(code => logger.log(`  - ${code}`, 'warn'));
    } else {
      notFound.slice(0, 10).forEach(code => logger.log(`  - ${code}`, 'warn'));
      logger.log(`  ... 외 ${notFound.length - 10}개`, 'warn');
    }
  }
  logger.endPhase();

  // Step 4: 거래 금액 계산 및 업데이트
  logger.startPhase('거래 금액 계산 및 업데이트');
  const { updated: transactionsUpdated } = await updateTransactionPrices(supabase, logger);
  logger.log(`✅ ${transactionsUpdated}개 거래 금액 업데이트 완료`, 'success');
  logger.endPhase();

  // Step 5: 빈 필드 채우기
  logger.startPhase('빈 필드 채우기');
  const { unitUpdated, categoryUpdated } = await fillEmptyFields(supabase, logger);
  logger.log(`✅ unit: ${unitUpdated}개, category: ${categoryUpdated}개 업데이트`, 'success');
  logger.endPhase();

  // Step 6: 결과 요약
  logger.divider('=');
  logger.log('\n📊 업데이트 결과 요약\n', 'info');
  
  logger.table({
    '파싱된 단가': priceMap.size,
    '품목 가격 업데이트': itemsUpdated,
    '매칭되지 않은 품번': notFound.length,
    '거래 금액 업데이트': transactionsUpdated,
    'unit 필드 채움': unitUpdated,
    'category 필드 채움': categoryUpdated
  });

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

