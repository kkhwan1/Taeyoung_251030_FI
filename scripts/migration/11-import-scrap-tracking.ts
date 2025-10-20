/**
 * Phase 5: 스크랩 추적(Scrap Tracking) 임포트
 *
 * 종합관리 SHEET 또는 BOM에서 스크랩/불량품 데이터를 추출하여 임포트합니다.
 * - parsed-comprehensive.json 또는 parsed-bom.json → 스크랩 추적
 * - item-code-map.json → item_id FK 매핑
 * - 스크랩 유형 분류 (불량품/폐기물/트리밍/기타)
 * - 수량 검증 및 통계 생성
 *
 * ⚡ 병렬 실행 가능: items import 완료 후 inventory/coil/purchase_sales/price_master와 동시 실행 가능
 *
 * 실행: npm run migrate:scrap
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import {
  ParseResult,
  ComprehensiveExcelRow,
  ParsedScrapTracking,
  ItemCodeMap
} from './types/excel-data';

const DATA_DIR = path.resolve(process.cwd(), 'scripts/migration/data');
const ITEM_MAP_FILE = path.join(DATA_DIR, 'item-code-map.json');

/**
 * 스크랩 유형 정규화
 *
 * Excel에서 사용하는 다양한 표현을 표준 타입으로 변환
 */
function normalizeScrapType(type: string): 'DEFECT' | 'WASTE' | 'TRIM' | 'OTHER' {
  const normalized = type.trim().toLowerCase();

  // 불량품 패턴
  if (normalized.includes('불량') || normalized.includes('defect') || normalized.includes('ng')) {
    return 'DEFECT';
  }

  // 폐기물 패턴
  if (normalized.includes('폐기') || normalized.includes('waste') || normalized.includes('scrap')) {
    return 'WASTE';
  }

  // 트리밍 패턴
  if (normalized.includes('트림') || normalized.includes('trim') || normalized.includes('절단')) {
    return 'TRIM';
  }

  // 기타
  return 'OTHER';
}

/**
 * 스크랩 추적 데이터 추출 및 변환
 *
 * Excel 구조:
 * - 품목코드: 품목 식별자
 * - 품목명: 품목 이름
 * - 스크랩 수량: 스크랩/불량 수량 (있는 경우)
 * - 스크랩 유형: 불량품/폐기물/트리밍 등
 * - 발생 날짜: 스크랩 발생 날짜
 * - 사유: 스크랩 발생 사유
 * - 처리 방법: 폐기/재활용 등
 *
 * Note: Excel에 스크랩 데이터가 명시적으로 없을 수 있음
 * 그 경우 스크랩 관련 컬럼 유무를 체크하고, 없으면 빈 배열 반환
 */
function extractScrapTracking(
  data: ComprehensiveExcelRow[],
  itemCodeMap: ItemCodeMap,
  logger: ReturnType<typeof createLogger>
): ParsedScrapTracking[] {
  const scrapRecords: ParsedScrapTracking[] = [];
  let skippedNoMapping = 0;
  let skippedInvalidQuantity = 0;
  let skippedNoScrapData = 0;

  // 기준일: 현재 날짜 (Excel에 날짜 정보 없으면 현재 날짜 사용)
  const scrapDate = new Date().toISOString().split('T')[0];

  data.forEach((row, index) => {
    // 품목코드 검증
    if (!row.품목코드) {
      return; // 품목코드 없으면 조용히 스킵
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

    // 스크랩 수량 확인
    // Excel 구조에 따라 스크랩 관련 컬럼명이 다를 수 있음
    // 가능한 컬럼명: 스크랩수량, 불량수량, 폐기수량, 손실수량 등
    const scrapQuantity =
      (row as any)['스크랩수량'] ||
      (row as any)['불량수량'] ||
      (row as any)['폐기수량'] ||
      (row as any)['손실수량'] ||
      0;

    // 스크랩 수량이 0이면 스킵
    if (typeof scrapQuantity !== 'number' || scrapQuantity <= 0) {
      skippedNoScrapData++;
      return;
    }

    // 스크랩 수량 유효성 검증 (음수 체크)
    if (scrapQuantity < 0) {
      logger.log(
        `⚠️  행 ${index + 2}: 유효하지 않은 스크랩 수량 '${scrapQuantity}' - ${row.품목명}`,
        'warn'
      );
      skippedInvalidQuantity++;
      return;
    }

    // 스크랩 유형 결정
    const scrapTypeRaw =
      (row as any)['스크랩유형'] ||
      (row as any)['불량유형'] ||
      (row as any)['폐기유형'] ||
      '기타';
    const scrapType = normalizeScrapType(String(scrapTypeRaw));

    // 스크랩 사유
    const scrapReason =
      (row as any)['스크랩사유'] ||
      (row as any)['불량사유'] ||
      (row as any)['폐기사유'] ||
      `${row.품목명} 스크랩`;

    // 처리 방법
    const disposalMethod =
      (row as any)['처리방법'] ||
      (row as any)['폐기방법'] ||
      null;

    scrapRecords.push({
      item_id: itemId,
      scrap_quantity: scrapQuantity,
      scrap_date: scrapDate,
      scrap_type: scrapType,
      scrap_reason: String(scrapReason),
      disposal_method: disposalMethod ? String(disposalMethod) : null,
      notes: `${row.품목명} - ${row.규격 || ''}`
    });
  });

  if (skippedNoMapping > 0) {
    logger.log(`⚠️  매핑 없는 품목 코드: ${skippedNoMapping}개 스킵`, 'warn');
  }

  if (skippedInvalidQuantity > 0) {
    logger.log(`⚠️  유효하지 않은 수량: ${skippedInvalidQuantity}개 스킵`, 'warn');
  }

  if (skippedNoScrapData > 0) {
    logger.log(`ℹ️  스크랩 데이터 없음: ${skippedNoScrapData}개 스킵`, 'info');
  }

  return scrapRecords;
}

/**
 * 스크랩 추적 통계 생성
 */
function generateScrapStats(
  scraps: ParsedScrapTracking[],
  logger: ReturnType<typeof createLogger>
): void {
  if (scraps.length === 0) {
    logger.log('⚠️  스크랩 추적 데이터가 없습니다', 'warn');
    return;
  }

  // 스크랩 유형별 집계
  const scrapByType = {
    '불량품(DEFECT)': scraps.filter(s => s.scrap_type === 'DEFECT').length,
    '폐기물(WASTE)': scraps.filter(s => s.scrap_type === 'WASTE').length,
    '트리밍(TRIM)': scraps.filter(s => s.scrap_type === 'TRIM').length,
    '기타(OTHER)': scraps.filter(s => s.scrap_type === 'OTHER').length
  };

  // 총 스크랩 수량
  const totalScrapQuantity = scraps.reduce((sum, s) => sum + s.scrap_quantity, 0);

  // 유형별 수량 집계
  const quantityByType = {
    '불량품': scraps
      .filter(s => s.scrap_type === 'DEFECT')
      .reduce((sum, s) => sum + s.scrap_quantity, 0),
    '폐기물': scraps
      .filter(s => s.scrap_type === 'WASTE')
      .reduce((sum, s) => sum + s.scrap_quantity, 0),
    '트리밍': scraps
      .filter(s => s.scrap_type === 'TRIM')
      .reduce((sum, s) => sum + s.scrap_quantity, 0),
    '기타': scraps
      .filter(s => s.scrap_type === 'OTHER')
      .reduce((sum, s) => sum + s.scrap_quantity, 0)
  };

  // 고유 품목 수
  const uniqueItems = new Set(scraps.map(s => s.item_id)).size;

  // 평균 스크랩 수량
  const avgScrapQuantity = totalScrapQuantity / scraps.length;

  // 날짜 범위
  const dates = scraps.map(s => new Date(s.scrap_date).getTime());
  const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
  const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];

  logger.table({
    '총 스크랩 레코드': scraps.length.toLocaleString('ko-KR'),
    '총 스크랩 수량': totalScrapQuantity.toLocaleString('ko-KR'),
    '평균 스크랩 수량': avgScrapQuantity.toFixed(2),
    '고유 품목 수': uniqueItems,
    '시작 날짜': minDate,
    '종료 날짜': maxDate
  });

  logger.log('\n📊 스크랩 유형별 레코드 수:', 'info');
  logger.table(scrapByType);

  logger.log('\n📊 스크랩 유형별 수량:', 'info');
  logger.table(quantityByType);
}

async function main() {
  const logger = createLogger('스크랩 추적 임포트');
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

  // Step 2: 스크랩 추적 데이터 추출
  logger.startPhase('스크랩 추적 데이터 추출');

  const scraps = extractScrapTracking(
    comprehensiveResult.data,
    itemCodeMap,
    logger
  );

  logger.log(`추출된 스크랩: ${scraps.length}개`, 'success');
  logger.endPhase();

  // Step 3: 스크랩 통계 생성
  logger.startPhase('스크랩 통계 생성');

  generateScrapStats(scraps, logger);

  logger.endPhase();

  // Step 4: Supabase 임포트
  logger.startPhase('Supabase 임포트');

  if (scraps.length === 0) {
    logger.log('⚠️  임포트할 스크랩 데이터가 없습니다', 'warn');
    logger.endPhase();
    logger.endMigration(true);
    process.exit(0);
  }

  const supabase = createAdminClient();

  const result = await batchInsert(
    supabase,
    'scrap_tracking',
    scraps,
    100,
    (current, total) => {
      logger.progress(current, total, `${current}/${total} 스크랩 임포트`);
    }
  );

  if (result.failed > 0) {
    logger.log(`⚠️  ${result.failed}개 스크랩 임포트 실패`, 'warn');
    result.errors.forEach(err => {
      logger.log(`  Batch ${err.batch}: ${err.error}`, 'error');
    });
  }

  logger.log(`✅ ${result.success}개 스크랩 임포트 완료`, 'success');
  logger.endPhase();

  // Step 5: 결과 요약
  logger.divider('=');
  logger.log('\n📊 스크랩 추적 임포트 결과\n', 'info');

  logger.table({
    '임포트 성공': result.success,
    '임포트 실패': result.failed,
    '불량품': scraps.filter(s => s.scrap_type === 'DEFECT').length,
    '폐기물': scraps.filter(s => s.scrap_type === 'WASTE').length,
    '트리밍': scraps.filter(s => s.scrap_type === 'TRIM').length,
    '기타': scraps.filter(s => s.scrap_type === 'OTHER').length
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
