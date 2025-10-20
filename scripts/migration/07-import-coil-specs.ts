/**
 * Phase 5: COIL 사양(Coil Specifications) 임포트
 *
 * BOM 데이터에서 COIL 관련 사양 정보를 추출하여 임포트합니다.
 * - parsed-bom.json → COIL 사양 (비중, 길이, 폭, 두께, SEP계수, KG단가)
 * - item-code-map.json → item_id FK 매핑
 * - COIL 품목만 필터링 (원자재 또는 'COIL' 키워드 포함)
 *
 * ⚡ 병렬 실행 가능: items import 완료 후 coil/inventory/purchase_sales와 동시 실행 가능
 *
 * 실행: npm run migrate:coil
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import {
  ParseResult,
  BomExcelRow,
  ParsedCoilSpec,
  ItemCodeMap
} from './types/excel-data';

const DATA_DIR = path.resolve(process.cwd(), 'scripts/migration/data');
const ITEM_MAP_FILE = path.join(DATA_DIR, 'item-code-map.json');

/**
 * COIL 품목 판별
 */
function isCoilItem(row: BomExcelRow): boolean {
  const itemName = row.품명.toLowerCase();
  const spec = (row.규격 || '').toLowerCase();
  const combined = itemName + spec;

  // COIL 키워드 확인
  const hasCoilKeyword = combined.includes('코일') ||
                        combined.includes('coil') ||
                        combined.includes('철') ||
                        combined.includes('강재');

  // COIL 관련 사양 데이터가 있는지 확인
  const hasCoilData = row['L(종)'] > 0 ||
                     row['W(횡)'] > 0 ||
                     row['단위중량(KG)'] > 0;

  return hasCoilKeyword && hasCoilData;
}

/**
 * COIL 사양 데이터 추출
 */
function extractCoilSpecs(
  data: BomExcelRow[],
  itemCodeMap: ItemCodeMap,
  logger: ReturnType<typeof createLogger>
): ParsedCoilSpec[] {
  const coilSpecs: ParsedCoilSpec[] = [];
  const processedItems = new Set<number>();
  let skippedNoMapping = 0;
  let skippedNotCoil = 0;
  let skippedDuplicate = 0;

  data.forEach((row, index) => {
    // COIL 품목 필터링
    if (!isCoilItem(row)) {
      skippedNotCoil++;
      return;
    }

    const itemCode = row.품번.trim();

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

    // COIL 사양 생성
    // 비중 계산: 단위중량(KG) / (L(종) * W(횡) * 0.001)
    // 실제 비중은 Excel에 직접 없으므로 표준 철강 비중 7.85 사용
    const density = 7.85; // 표준 철강 비중

    // SEP계수: 자재비 / (L * W * 단위중량) - Excel에 없으면 계산
    const sepCoefficient = row['자재비'] > 0 && row['L(종)'] > 0 && row['W(횡)'] > 0 && row['단위중량(KG)'] > 0
      ? row['자재비'] / (row['L(종)'] * row['W(횡)'] * row['단위중량(KG)'])
      : 1.0;

    // KG단가: 자재비 / 단위중량
    const kgPrice = row['단위중량(KG)'] > 0
      ? row['자재비'] / row['단위중량(KG)']
      : 0;

    coilSpecs.push({
      item_id: itemId,
      density,
      length: row['L(종)'],
      width: row['W(횡)'],
      thickness: row['B(Board)'], // 두께
      sep_coefficient: sepCoefficient,
      kg_price: kgPrice
    });
  });

  if (skippedNotCoil > 0) {
    logger.log(`ℹ️  COIL이 아닌 품목: ${skippedNotCoil}개 스킵`, 'info');
  }

  if (skippedNoMapping > 0) {
    logger.log(`⚠️  매핑 없는 품목 코드: ${skippedNoMapping}개 스킵`, 'warn');
  }

  if (skippedDuplicate > 0) {
    logger.log(`🔄 중복 품목: ${skippedDuplicate}개 스킵`, 'info');
  }

  return coilSpecs;
}

/**
 * COIL 사양 통계 생성
 */
function generateCoilStats(
  specs: ParsedCoilSpec[],
  logger: ReturnType<typeof createLogger>
): void {
  if (specs.length === 0) {
    logger.log('⚠️  COIL 사양 데이터가 없습니다', 'warn');
    return;
  }

  // 치수 범위
  const lengths = specs.map(s => s.length).filter(l => l > 0);
  const widths = specs.map(s => s.width).filter(w => w > 0);
  const thicknesses = specs.map(s => s.thickness).filter(t => t > 0);
  const kgPrices = specs.map(s => s.kg_price).filter(p => p > 0);

  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);
  const minWidth = Math.min(...widths);
  const maxWidth = Math.max(...widths);
  const minThickness = Math.min(...thicknesses);
  const maxThickness = Math.max(...thicknesses);
  const avgKgPrice = kgPrices.reduce((a, b) => a + b, 0) / kgPrices.length;

  logger.table({
    '총 COIL 사양': specs.length,
    '길이 범위(mm)': `${minLength.toFixed(1)} ~ ${maxLength.toFixed(1)}`,
    '폭 범위(mm)': `${minWidth.toFixed(1)} ~ ${maxWidth.toFixed(1)}`,
    '두께 범위(mm)': `${minThickness.toFixed(2)} ~ ${maxThickness.toFixed(2)}`,
    '평균 KG단가': avgKgPrice.toFixed(2)
  });
}

async function main() {
  const logger = createLogger('COIL 사양 임포트');
  logger.startMigration();

  // Step 1: 파싱된 데이터 및 매핑 로드
  logger.startPhase('파싱된 데이터 로드');

  const bomPath = path.join(DATA_DIR, 'parsed-bom.json');

  if (!fs.existsSync(bomPath)) {
    logger.log('❌ parsed-bom.json 파일이 없습니다. 먼저 02-parse-excel-files.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  if (!fs.existsSync(ITEM_MAP_FILE)) {
    logger.log('❌ item-code-map.json 파일이 없습니다. 먼저 05-import-items.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  const bomResult: ParseResult<BomExcelRow> = JSON.parse(
    fs.readFileSync(bomPath, 'utf-8')
  );
  const itemCodeMap: ItemCodeMap = new Map(
    Object.entries(JSON.parse(fs.readFileSync(ITEM_MAP_FILE, 'utf-8')))
  );

  logger.log(`BOM: ${bomResult.data.length} 레코드`, 'info');
  logger.log(`품목 매핑: ${itemCodeMap.size} 레코드`, 'info');
  logger.endPhase();

  // Step 2: COIL 사양 추출
  logger.startPhase('COIL 사양 추출');

  const coilSpecs = extractCoilSpecs(
    bomResult.data,
    itemCodeMap,
    logger
  );

  logger.log(`추출된 COIL 사양: ${coilSpecs.length}개`, 'success');
  logger.endPhase();

  // Step 3: COIL 통계 생성
  logger.startPhase('COIL 통계 생성');

  generateCoilStats(coilSpecs, logger);

  logger.endPhase();

  // Step 4: Supabase 임포트
  logger.startPhase('Supabase 임포트');

  if (coilSpecs.length === 0) {
    logger.log('⚠️  임포트할 COIL 사양이 없습니다', 'warn');
    logger.endPhase();
    logger.endMigration(true);
    process.exit(0);
  }

  const supabase = createAdminClient();

  const result = await batchInsert(
    supabase,
    'coil_specs',
    coilSpecs,
    100,
    (current, total) => {
      logger.progress(current, total, `${current}/${total} COIL 사양 임포트`);
    }
  );

  if (result.failed > 0) {
    logger.log(`⚠️  ${result.failed}개 COIL 사양 임포트 실패`, 'warn');
    result.errors.forEach(err => {
      logger.log(`  Batch ${err.batch}: ${err.error}`, 'error');
    });
  }

  logger.log(`✅ ${result.success}개 COIL 사양 임포트 완료`, 'success');
  logger.endPhase();

  // Step 5: 결과 요약
  logger.divider('=');
  logger.log('\n📊 COIL 사양 임포트 결과\n', 'info');

  logger.table({
    '임포트 성공': result.success,
    '임포트 실패': result.failed,
    'COIL 품목 수': coilSpecs.length
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
