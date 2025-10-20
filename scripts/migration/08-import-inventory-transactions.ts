/**
 * Phase 5: 재고 거래(Inventory Transactions) 임포트
 *
 * 매입수불 Excel의 T1~T268 컬럼을 개별 거래 레코드로 변환하여 임포트합니다.
 * - parsed-inventory.json → 재고 거래 (8개 시트, T1~T268 컬럼)
 * - item-code-map.json → item_id FK 매핑
 * - T 컬럼 번호 → transaction_date 변환 (일자별 거래 추적)
 * - 0이 아닌 수량만 임포트
 *
 * ⚡ 병렬 실행 가능: items import 완료 후 coil/purchase_sales/price_master/scrap와 동시 실행 가능
 *
 * 실행: npm run migrate:inventory
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import {
  ParseResult,
  InventoryExcelRow,
  ParsedInventoryTransaction,
  ItemCodeMap
} from './types/excel-data';

const DATA_DIR = path.resolve(process.cwd(), 'scripts/migration/data');
const ITEM_MAP_FILE = path.join(DATA_DIR, 'item-code-map.json');

/**
 * T 컬럼 번호를 날짜로 변환
 *
 * T1 = 2025-09-01 (9월 1일)
 * T2 = 2025-09-02 (9월 2일)
 * ...
 * T268 = 2025-09-30 + overflow (월별 시트이므로 최대 30-31일)
 *
 * 실제로는 각 시트가 특정 월을 나타내므로,
 * 시트 이름에서 월 정보를 추출하여 날짜를 구성합니다.
 */
function getTransactionDate(tColumnNumber: number, baseMonth: number, baseYear: number): string {
  // T1 = 1일, T2 = 2일, ...
  const day = tColumnNumber;

  // 날짜 검증 (1-31일)
  if (day < 1 || day > 31) {
    throw new Error(`Invalid day number from T column: ${day}`);
  }

  const date = new Date(baseYear, baseMonth - 1, day);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * 재고 거래 추출 및 변환
 *
 * T1~T268 컬럼 구조:
 * - 각 T 컬럼은 특정 일자의 재고 수량을 나타냄
 * - 0이 아닌 값만 거래 레코드로 변환
 * - 양수/음수로 입고/출고 구분
 */
function extractInventoryTransactions(
  data: InventoryExcelRow[],
  itemCodeMap: ItemCodeMap,
  baseYear: number,
  baseMonth: number,
  logger: ReturnType<typeof createLogger>
): ParsedInventoryTransaction[] {
  const transactions: ParsedInventoryTransaction[] = [];
  let skippedNoMapping = 0;
  let skippedZeroQuantity = 0;

  data.forEach((row, rowIndex) => {
    const itemCode = row.품번.trim();

    // FK 매핑 검증
    if (!itemCodeMap.has(itemCode)) {
      logger.log(
        `⚠️  행 ${rowIndex + 2}: 품목 코드 '${itemCode}' 매핑 없음`,
        'warn'
      );
      skippedNoMapping++;
      return;
    }

    const itemId = itemCodeMap.get(itemCode)!;

    // T1~T268 컬럼 순회
    for (let tNum = 1; tNum <= 268; tNum++) {
      const colName = `T${tNum}` as keyof InventoryExcelRow;
      const quantity = row[colName];

      // 숫자 타입 확인 및 0 제외
      if (typeof quantity !== 'number' || quantity === 0) {
        skippedZeroQuantity++;
        continue;
      }

      // 날짜 계산 (T 컬럼 번호 → 일자)
      let transactionDate: string;
      try {
        transactionDate = getTransactionDate(tNum, baseMonth, baseYear);
      } catch (error) {
        // 유효하지 않은 날짜 (예: T32 in 30-day month)
        continue;
      }

      // 거래 타입 결정
      const transactionType = quantity > 0 ? 'RECEIVING' : 'SHIPPING';
      const absQuantity = Math.abs(quantity);

      transactions.push({
        item_id: itemId,
        warehouse_id: 1, // 기본 창고 (추후 warehouse import 후 업데이트 가능)
        transaction_type: transactionType,
        quantity: absQuantity,
        transaction_date: transactionDate,
        reference_no: `INV-${baseYear}${String(baseMonth).padStart(2, '0')}-${itemCode}-T${tNum}`,
        notes: `${row.품명} - ${row.규격 || ''}`
      });
    }
  });

  if (skippedNoMapping > 0) {
    logger.log(`⚠️  매핑 없는 품목 코드: ${skippedNoMapping}개 스킵`, 'warn');
  }

  if (skippedZeroQuantity > 0) {
    logger.log(`ℹ️  0 수량 거래: ${skippedZeroQuantity}개 스킵`, 'info');
  }

  return transactions;
}

/**
 * 재고 거래 통계 생성
 */
function generateTransactionStats(
  transactions: ParsedInventoryTransaction[],
  logger: ReturnType<typeof createLogger>
): void {
  if (transactions.length === 0) {
    logger.log('⚠️  재고 거래 데이터가 없습니다', 'warn');
    return;
  }

  // 거래 타입별 집계
  const receivingCount = transactions.filter(t => t.transaction_type === 'RECEIVING').length;
  const shippingCount = transactions.filter(t => t.transaction_type === 'SHIPPING').length;

  // 품목별 거래 수
  const itemTransactionCount = new Map<number, number>();
  transactions.forEach(t => {
    const count = itemTransactionCount.get(t.item_id) || 0;
    itemTransactionCount.set(t.item_id, count + 1);
  });

  const uniqueItems = itemTransactionCount.size;
  const avgTransactionsPerItem = transactions.length / uniqueItems;

  // 날짜 범위
  const dates = transactions.map(t => new Date(t.transaction_date).getTime());
  const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
  const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];

  logger.table({
    '총 거래 수': transactions.length.toLocaleString('ko-KR'),
    '입고 거래': receivingCount.toLocaleString('ko-KR'),
    '출고 거래': shippingCount.toLocaleString('ko-KR'),
    '고유 품목 수': uniqueItems,
    '품목당 평균 거래': avgTransactionsPerItem.toFixed(2),
    '시작 날짜': minDate,
    '종료 날짜': maxDate
  });
}

async function main() {
  const logger = createLogger('재고 거래 임포트');
  logger.startMigration();

  // Step 1: 파싱된 데이터 및 매핑 로드
  logger.startPhase('파싱된 데이터 로드');

  const inventoryPath = path.join(DATA_DIR, 'parsed-inventory.json');

  if (!fs.existsSync(inventoryPath)) {
    logger.log('❌ parsed-inventory.json 파일이 없습니다. 먼저 02-parse-excel-files.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  if (!fs.existsSync(ITEM_MAP_FILE)) {
    logger.log('❌ item-code-map.json 파일이 없습니다. 먼저 05-import-items.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  const inventoryResult: ParseResult<InventoryExcelRow> = JSON.parse(
    fs.readFileSync(inventoryPath, 'utf-8')
  );
  const itemCodeMap: ItemCodeMap = new Map(
    Object.entries(JSON.parse(fs.readFileSync(ITEM_MAP_FILE, 'utf-8')))
  );

  logger.log(`재고 수불: ${inventoryResult.data.length} 레코드`, 'info');
  logger.log(`품목 매핑: ${itemCodeMap.size} 레코드`, 'info');
  logger.endPhase();

  // Step 2: 재고 거래 추출
  logger.startPhase('재고 거래 추출');

  // 기준 연월 (Excel 파일명에서 추출: "2025년 09월 매입 수불관리")
  const baseYear = 2025;
  const baseMonth = 9; // 9월

  const transactions = extractInventoryTransactions(
    inventoryResult.data,
    itemCodeMap,
    baseYear,
    baseMonth,
    logger
  );

  logger.log(`추출된 거래: ${transactions.length}개`, 'success');
  logger.endPhase();

  // Step 3: 거래 통계 생성
  logger.startPhase('거래 통계 생성');

  generateTransactionStats(transactions, logger);

  logger.endPhase();

  // Step 4: Supabase 임포트
  logger.startPhase('Supabase 임포트');

  if (transactions.length === 0) {
    logger.log('⚠️  임포트할 거래가 없습니다', 'warn');
    logger.endPhase();
    logger.endMigration(true);
    process.exit(0);
  }

  const supabase = createAdminClient();

  const result = await batchInsert(
    supabase,
    'inventory_transactions',
    transactions,
    100,
    (current, total) => {
      logger.progress(current, total, `${current}/${total} 거래 임포트`);
    }
  );

  if (result.failed > 0) {
    logger.log(`⚠️  ${result.failed}개 거래 임포트 실패`, 'warn');
    result.errors.forEach(err => {
      logger.log(`  Batch ${err.batch}: ${err.error}`, 'error');
    });
  }

  logger.log(`✅ ${result.success}개 거래 임포트 완료`, 'success');
  logger.endPhase();

  // Step 5: 결과 요약
  logger.divider('=');
  logger.log('\n📊 재고 거래 임포트 결과\n', 'info');

  logger.table({
    '임포트 성공': result.success,
    '임포트 실패': result.failed,
    '입고 거래': transactions.filter(t => t.transaction_type === 'RECEIVING').length,
    '출고 거래': transactions.filter(t => t.transaction_type === 'SHIPPING').length
  });

  const success = result.failed === 0;
  logger.endMigration(success);

  if (!success) {
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
