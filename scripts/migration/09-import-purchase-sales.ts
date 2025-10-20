/**
 * Phase 5: 매입/매출 거래(Purchase/Sales Transactions) 임포트
 *
 * 매입매출 보고현황 Excel에서 거래 데이터를 추출하여 임포트합니다.
 * - parsed-purchase-sales.json → 매입/매출 거래
 * - company-code-map.json → company_id FK 매핑
 * - item-code-map.json → item_id FK 매핑
 * - 거래구분 필드로 PURCHASE(매입)/SALES(매출) 구분
 * - 금액 + 부가세 = 합계 계산
 *
 * ⚡ 병렬 실행 가능: items + companies import 완료 후 inventory/coil/price_master/scrap와 동시 실행 가능
 *
 * 실행: npm run migrate:purchase-sales
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import {
  ParseResult,
  PurchaseSalesExcelRow,
  ParsedPurchaseSalesTransaction,
  CompanyCodeMap,
  ItemCodeMap
} from './types/excel-data';

const DATA_DIR = path.resolve(process.cwd(), 'scripts/migration/data');
const COMPANY_MAP_FILE = path.join(DATA_DIR, 'company-code-map.json');
const ITEM_MAP_FILE = path.join(DATA_DIR, 'item-code-map.json');

/**
 * 거래구분 정규화
 *
 * Excel에서 사용하는 다양한 표현을 표준 타입으로 변환
 */
function normalizeTransactionType(type: string): 'PURCHASE' | 'SALES' {
  const normalized = type.trim().toUpperCase();

  // 매입 패턴
  if (normalized.includes('매입') || normalized.includes('PURCHASE') || normalized.includes('BUY')) {
    return 'PURCHASE';
  }

  // 매출 패턴
  if (normalized.includes('매출') || normalized.includes('SALES') || normalized.includes('SELL')) {
    return 'SALES';
  }

  // 기본값: 매출
  return 'SALES';
}

/**
 * 매입/매출 거래 추출 및 변환
 *
 * Excel 구조:
 * - 거래구분: 매입/매출
 * - 거래처명: 거래처 이름
 * - 품목명: 품목 이름
 * - 수량: 거래 수량
 * - 단가: 품목 단가
 * - 금액: 기본 금액
 * - 부가세: 세금
 * - 합계: 금액 + 부가세
 * - 거래일자: 거래 날짜
 */
function extractPurchaseSalesTransactions(
  data: PurchaseSalesExcelRow[],
  companyCodeMap: CompanyCodeMap,
  itemCodeMap: ItemCodeMap,
  logger: ReturnType<typeof createLogger>
): ParsedPurchaseSalesTransaction[] {
  const transactions: ParsedPurchaseSalesTransaction[] = [];
  let skippedNoCompanyMapping = 0;
  let skippedNoItemMapping = 0;
  let skippedInvalidData = 0;

  data.forEach((row, rowIndex) => {
    // 필수 필드 검증
    if (!row.거래처명 || !row.품목명 || !row.거래구분) {
      logger.log(
        `⚠️  행 ${rowIndex + 2}: 필수 필드 누락 (거래처명/품목명/거래구분)`,
        'warn'
      );
      skippedInvalidData++;
      return;
    }

    // 거래처 코드 찾기
    const companyName = row.거래처명.trim();
    const companyEntry = Array.from(companyCodeMap.entries()).find(
      ([_, id]) => _ === companyName
    );

    if (!companyEntry) {
      logger.log(
        `⚠️  행 ${rowIndex + 2}: 거래처 '${companyName}' 매핑 없음`,
        'warn'
      );
      skippedNoCompanyMapping++;
      return;
    }

    const companyId = companyEntry[1];

    // 품목 코드 찾기 (품목명으로 역조회)
    // Note: Excel에는 품목명만 있고 품목코드가 없을 수 있음
    // 품목명으로 items 테이블을 조회해야 하지만, 여기서는 매핑 파일 사용
    // 실제로는 품목명 → 품목코드 매핑이 필요할 수 있음
    const itemName = row.품목명.trim();

    // 품목명으로 품목코드를 찾기 위한 역조회 로직
    // 임시: itemCodeMap에서 품목코드 추론 (나중에 개선 필요)
    let itemId: number | undefined;

    // 품목코드가 있으면 직접 매핑
    if (row.품목코드 && itemCodeMap.has(row.품목코드)) {
      itemId = itemCodeMap.get(row.품목코드);
    }

    if (!itemId) {
      logger.log(
        `⚠️  행 ${rowIndex + 2}: 품목 '${itemName}' 매핑 없음`,
        'warn'
      );
      skippedNoItemMapping++;
      return;
    }

    // 거래 타입 정규화
    const transactionType = normalizeTransactionType(row.거래구분);

    // 금액 계산
    const quantity = row.수량 || 0;
    const unitPrice = row.단가 || 0;
    const amount = row.금액 || (quantity * unitPrice);
    const tax = row.부가세 || 0;
    const totalAmount = row.합계 || (amount + tax);

    // 거래 날짜 (없으면 현재 날짜)
    const transactionDate = row.거래일자
      ? new Date(row.거래일자).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    transactions.push({
      company_id: companyId,
      item_id: itemId,
      transaction_type: transactionType,
      quantity,
      unit_price: unitPrice,
      amount,
      tax,
      total_amount: totalAmount,
      transaction_date: transactionDate,
      notes: row.비고 || `${itemName} ${transactionType === 'PURCHASE' ? '매입' : '매출'}`
    });
  });

  if (skippedNoCompanyMapping > 0) {
    logger.log(`⚠️  거래처 매핑 없음: ${skippedNoCompanyMapping}개 스킵`, 'warn');
  }

  if (skippedNoItemMapping > 0) {
    logger.log(`⚠️  품목 매핑 없음: ${skippedNoItemMapping}개 스킵`, 'warn');
  }

  if (skippedInvalidData > 0) {
    logger.log(`⚠️  잘못된 데이터: ${skippedInvalidData}개 스킵`, 'warn');
  }

  return transactions;
}

/**
 * 매입/매출 거래 통계 생성
 */
function generateTransactionStats(
  transactions: ParsedPurchaseSalesTransaction[],
  logger: ReturnType<typeof createLogger>
): void {
  if (transactions.length === 0) {
    logger.log('⚠️  매입/매출 거래 데이터가 없습니다', 'warn');
    return;
  }

  // 거래 타입별 집계
  const purchaseTransactions = transactions.filter(t => t.transaction_type === 'PURCHASE');
  const salesTransactions = transactions.filter(t => t.transaction_type === 'SALES');

  // 금액 집계
  const totalPurchaseAmount = purchaseTransactions.reduce((sum, t) => sum + t.total_amount, 0);
  const totalSalesAmount = salesTransactions.reduce((sum, t) => sum + t.total_amount, 0);

  // 거래처 및 품목 수
  const uniqueCompanies = new Set(transactions.map(t => t.company_id)).size;
  const uniqueItems = new Set(transactions.map(t => t.item_id)).size;

  // 날짜 범위
  const dates = transactions.map(t => new Date(t.transaction_date).getTime());
  const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
  const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];

  logger.table({
    '총 거래 수': transactions.length.toLocaleString('ko-KR'),
    '매입 거래': purchaseTransactions.length.toLocaleString('ko-KR'),
    '매출 거래': salesTransactions.length.toLocaleString('ko-KR'),
    '매입 총액': `₩${totalPurchaseAmount.toLocaleString('ko-KR')}`,
    '매출 총액': `₩${totalSalesAmount.toLocaleString('ko-KR')}`,
    '고유 거래처 수': uniqueCompanies,
    '고유 품목 수': uniqueItems,
    '시작 날짜': minDate,
    '종료 날짜': maxDate
  });
}

async function main() {
  const logger = createLogger('매입/매출 거래 임포트');
  logger.startMigration();

  // Step 1: 파싱된 데이터 및 매핑 로드
  logger.startPhase('파싱된 데이터 로드');

  const purchaseSalesPath = path.join(DATA_DIR, 'parsed-purchase-sales.json');

  if (!fs.existsSync(purchaseSalesPath)) {
    logger.log('❌ parsed-purchase-sales.json 파일이 없습니다. 먼저 02-parse-excel-files.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  if (!fs.existsSync(COMPANY_MAP_FILE)) {
    logger.log('❌ company-code-map.json 파일이 없습니다. 먼저 04-import-companies.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  if (!fs.existsSync(ITEM_MAP_FILE)) {
    logger.log('❌ item-code-map.json 파일이 없습니다. 먼저 05-import-items.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  const purchaseSalesResult: ParseResult<PurchaseSalesExcelRow> = JSON.parse(
    fs.readFileSync(purchaseSalesPath, 'utf-8')
  );
  const companyCodeMap: CompanyCodeMap = new Map(
    Object.entries(JSON.parse(fs.readFileSync(COMPANY_MAP_FILE, 'utf-8')))
  );
  const itemCodeMap: ItemCodeMap = new Map(
    Object.entries(JSON.parse(fs.readFileSync(ITEM_MAP_FILE, 'utf-8')))
  );

  logger.log(`매입매출: ${purchaseSalesResult.data.length} 레코드`, 'info');
  logger.log(`거래처 매핑: ${companyCodeMap.size} 레코드`, 'info');
  logger.log(`품목 매핑: ${itemCodeMap.size} 레코드`, 'info');
  logger.endPhase();

  // Step 2: 매입/매출 거래 추출
  logger.startPhase('매입/매출 거래 추출');

  const transactions = extractPurchaseSalesTransactions(
    purchaseSalesResult.data,
    companyCodeMap,
    itemCodeMap,
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
    'purchase_sales_transactions',
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
  logger.log('\n📊 매입/매출 거래 임포트 결과\n', 'info');

  logger.table({
    '임포트 성공': result.success,
    '임포트 실패': result.failed,
    '매입 거래': transactions.filter(t => t.transaction_type === 'PURCHASE').length,
    '매출 거래': transactions.filter(t => t.transaction_type === 'SALES').length
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
