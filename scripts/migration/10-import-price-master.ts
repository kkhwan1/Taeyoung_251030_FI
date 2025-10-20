/**
 * Phase 5: 단가 마스터(Price Master) 임포트
 *
 * 종합관리 SHEET에서 품목별 단가 정보를 추출하여 임포트합니다.
 * - parsed-comprehensive.json → 단가 마스터 (품목코드, 단가, 적용일자)
 * - item-code-map.json → item_id FK 매핑
 * - 품목별 가격 이력 관리 (effective_from, effective_to)
 *
 * ⚡ 병렬 실행 가능: items import 완료 후 inventory/coil/purchase_sales/scrap와 동시 실행 가능
 *
 * 실행: npm run migrate:price-master
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import {
  ParseResult,
  ComprehensiveExcelRow,
  ParsedPriceMaster,
  ItemCodeMap
} from './types/excel-data';

const DATA_DIR = path.resolve(process.cwd(), 'scripts/migration/data');
const ITEM_MAP_FILE = path.join(DATA_DIR, 'item-code-map.json');

/**
 * 단가 마스터 추출 및 변환
 *
 * Excel 구조:
 * - 품목코드: 품목 식별자
 * - 단가: 품목 단가
 * - 공급단가: 공급 단가 (있는 경우)
 * - 판매단가: 판매 단가 (있는 경우)
 *
 * 단가 우선순위:
 * 1. 판매단가 (있으면 우선)
 * 2. 공급단가
 * 3. 단가 (기본)
 */
function extractPriceMaster(
  data: ComprehensiveExcelRow[],
  itemCodeMap: ItemCodeMap,
  logger: ReturnType<typeof createLogger>
): ParsedPriceMaster[] {
  const priceRecords: ParsedPriceMaster[] = [];
  const processedItems = new Set<number>();
  let skippedNoMapping = 0;
  let skippedNoPrice = 0;
  let skippedDuplicate = 0;
  let skippedInvalidPrice = 0;

  // 기준일: 현재 날짜 (Excel에 날짜 정보 없으면 현재 날짜 사용)
  const effectiveDate = new Date().toISOString().split('T')[0];

  data.forEach((row, index) => {
    // 품목코드 검증
    if (!row.품목코드) {
      return; // 품목코드 없으면 스킵 (조용히)
    }

    const itemCode = row.품목코드.trim();

    // FK 매핑 검증
    if (!itemCodeMap.has(itemCode)) {
      logger.log(
        `⚠️  행 ${index + 2}: 품목 코드 '${itemCode}' 매핑 없음`,
        'warn'
      );
      skippedNoMapping++;
      return;
    }

    const itemId = itemCodeMap.get(itemCode)!;

    // 중복 방지 (동일 품목이 여러 행에 나타날 수 있음)
    if (processedItems.has(itemId)) {
      skippedDuplicate++;
      return;
    }

    processedItems.add(itemId);

    // 단가 결정 (우선순위: 판매단가 > 공급단가 > 단가)
    let unitPrice = 0;
    let priceType = 'standard'; // standard, supply, sales

    if (row.판매단가 !== undefined && row.판매단가 > 0) {
      unitPrice = row.판매단가;
      priceType = 'sales';
    } else if (row.공급단가 !== undefined && row.공급단가 > 0) {
      unitPrice = row.공급단가;
      priceType = 'supply';
    } else if (row.단가 !== undefined && row.단가 > 0) {
      unitPrice = row.단가;
      priceType = 'standard';
    }

    // 단가가 0이거나 음수이면 스킵
    if (unitPrice <= 0) {
      skippedNoPrice++;
      return;
    }

    // 단가 유효성 검증 (비정상적으로 큰 값 체크)
    if (unitPrice > 1000000000) { // 10억 초과 시 의심
      logger.log(
        `⚠️  행 ${index + 2}: 비정상적으로 큰 단가 '${unitPrice}' - ${row.품목명}`,
        'warn'
      );
      skippedInvalidPrice++;
      return;
    }

    priceRecords.push({
      item_id: itemId,
      unit_price: unitPrice,
      effective_from: effectiveDate,
      effective_to: null, // 종료일 없음 (현재 유효)
      notes: `${priceType === 'sales' ? '판매단가' : priceType === 'supply' ? '공급단가' : '기본단가'} - ${row.품목명}`
    });
  });

  if (skippedNoMapping > 0) {
    logger.log(`⚠️  매핑 없는 품목 코드: ${skippedNoMapping}개 스킵`, 'warn');
  }

  if (skippedDuplicate > 0) {
    logger.log(`🔄 중복 품목: ${skippedDuplicate}개 스킵`, 'info');
  }

  if (skippedNoPrice > 0) {
    logger.log(`ℹ️  단가 없는 품목: ${skippedNoPrice}개 스킵`, 'info');
  }

  if (skippedInvalidPrice > 0) {
    logger.log(`⚠️  유효하지 않은 단가: ${skippedInvalidPrice}개 스킵`, 'warn');
  }

  return priceRecords;
}

/**
 * 단가 마스터 통계 생성
 */
function generatePriceStats(
  prices: ParsedPriceMaster[],
  logger: ReturnType<typeof createLogger>
): void {
  if (prices.length === 0) {
    logger.log('⚠️  단가 마스터 데이터가 없습니다', 'warn');
    return;
  }

  // 가격 범위
  const unitPrices = prices.map(p => p.unit_price);
  const minPrice = Math.min(...unitPrices);
  const maxPrice = Math.max(...unitPrices);
  const avgPrice = unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length;

  // 가격대별 분포
  const priceRanges = {
    '0-1K': 0,
    '1K-10K': 0,
    '10K-100K': 0,
    '100K-1M': 0,
    '1M+': 0
  };

  prices.forEach(p => {
    const price = p.unit_price;
    if (price < 1000) priceRanges['0-1K']++;
    else if (price < 10000) priceRanges['1K-10K']++;
    else if (price < 100000) priceRanges['10K-100K']++;
    else if (price < 1000000) priceRanges['100K-1M']++;
    else priceRanges['1M+']++;
  });

  // 단가 타입별 분포
  const salesPrices = prices.filter(p => p.notes?.includes('판매단가')).length;
  const supplyPrices = prices.filter(p => p.notes?.includes('공급단가')).length;
  const standardPrices = prices.filter(p => p.notes?.includes('기본단가')).length;

  logger.table({
    '총 단가 레코드': prices.length,
    '최저 단가': `₩${minPrice.toLocaleString('ko-KR')}`,
    '최고 단가': `₩${maxPrice.toLocaleString('ko-KR')}`,
    '평균 단가': `₩${avgPrice.toLocaleString('ko-KR')}`,
    '판매단가': salesPrices,
    '공급단가': supplyPrices,
    '기본단가': standardPrices
  });

  logger.log('\n📊 가격대별 분포:', 'info');
  logger.table(priceRanges);
}

async function main() {
  const logger = createLogger('단가 마스터 임포트');
  logger.startMigration();

  // Step 1: 파싱된 데이터 및 매핑 로드
  logger.startPhase('파싱된 데이터 로드');

  const comprehensivePath = path.join(DATA_DIR, 'parsed-comprehensive.json');

  if (!fs.existsSync(comprehensivePath)) {
    logger.log('❌ parsed-comprehensive.json 파일이 없습니다. 먼저 02-parse-excel-files.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  if (!fs.existsSync(ITEM_MAP_FILE)) {
    logger.log('❌ item-code-map.json 파일이 없습니다. 먼저 05-import-items.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  const comprehensiveResult: ParseResult<ComprehensiveExcelRow> = JSON.parse(
    fs.readFileSync(comprehensivePath, 'utf-8')
  );
  const itemCodeMap: ItemCodeMap = new Map(
    Object.entries(JSON.parse(fs.readFileSync(ITEM_MAP_FILE, 'utf-8')))
  );

  logger.log(`종합관리: ${comprehensiveResult.data.length} 레코드`, 'info');
  logger.log(`품목 매핑: ${itemCodeMap.size} 레코드`, 'info');
  logger.endPhase();

  // Step 2: 단가 마스터 추출
  logger.startPhase('단가 마스터 추출');

  const prices = extractPriceMaster(
    comprehensiveResult.data,
    itemCodeMap,
    logger
  );

  logger.log(`추출된 단가: ${prices.length}개`, 'success');
  logger.endPhase();

  // Step 3: 단가 통계 생성
  logger.startPhase('단가 통계 생성');

  generatePriceStats(prices, logger);

  logger.endPhase();

  // Step 4: Supabase 임포트
  logger.startPhase('Supabase 임포트');

  if (prices.length === 0) {
    logger.log('⚠️  임포트할 단가가 없습니다', 'warn');
    logger.endPhase();
    logger.endMigration(true);
    process.exit(0);
  }

  const supabase = createAdminClient();

  const result = await batchInsert(
    supabase,
    'price_master',
    prices,
    100,
    (current, total) => {
      logger.progress(current, total, `${current}/${total} 단가 임포트`);
    }
  );

  if (result.failed > 0) {
    logger.log(`⚠️  ${result.failed}개 단가 임포트 실패`, 'warn');
    result.errors.forEach(err => {
      logger.log(`  Batch ${err.batch}: ${err.error}`, 'error');
    });
  }

  logger.log(`✅ ${result.success}개 단가 임포트 완료`, 'success');
  logger.endPhase();

  // Step 5: 결과 요약
  logger.divider('=');
  logger.log('\n📊 단가 마스터 임포트 결과\n', 'info');

  logger.table({
    '임포트 성공': result.success,
    '임포트 실패': result.failed,
    '품목 수': prices.length
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
