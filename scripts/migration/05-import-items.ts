/**
 * Phase 4: 품목(Items) 마스터 임포트
 *
 * BOM 및 종합관리 SHEET에서 품목 데이터를 추출하여 임포트합니다.
 * - parsed-bom.json → 품목 기본 정보 (품번, 품명, 규격, 단위, 단위중량)
 * - parsed-comprehensive.json → 재고 정보 (현재재고, 안전재고)
 * - company-code-map.json → supplier_id FK 매핑
 *
 * 실행: npm run migrate:items
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, batchInsert } from './utils/supabase-client';
import { createLogger } from './utils/logger';
import {
  ParseResult,
  BomExcelRow,
  ComprehensiveExcelRow,
  ParsedItem,
  CompanyCodeMap,
  ItemCodeMap
} from './types/excel-data';

const DATA_DIR = path.resolve(process.cwd(), 'scripts/migration/data');
const COMPANY_MAP_FILE = path.join(DATA_DIR, 'company-code-map.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'item-code-map.json');

/**
 * 품목 카테고리 추론
 */
function inferItemCategory(itemName: string, spec: string): string {
  const lower = (itemName + spec).toLowerCase();

  // 원자재 키워드
  if (lower.includes('철') || lower.includes('강') || lower.includes('steel') ||
      lower.includes('코일') || lower.includes('coil') || lower.includes('원자재')) {
    return '원자재';
  }

  // 완제품 키워드
  if (lower.includes('완제품') || lower.includes('제품') || lower.includes('assy') ||
      lower.includes('assembly')) {
    return '완제품';
  }

  // 부품 키워드
  if (lower.includes('부품') || lower.includes('part') || lower.includes('component')) {
    return '부품';
  }

  // 반제품 키워드
  if (lower.includes('반제품') || lower.includes('wip') || lower.includes('semi')) {
    return '반제품';
  }

  // 기본값
  return '부품';
}

/**
 * BOM에서 품목 추출
 */
function extractItemsFromBom(
  data: BomExcelRow[]
): Map<string, Partial<ParsedItem>> {
  const itemsMap = new Map<string, Partial<ParsedItem>>();

  data.forEach(row => {
    const code = row.품번.trim();

    if (!itemsMap.has(code)) {
      const category = inferItemCategory(row.품명, row.규격);

      itemsMap.set(code, {
        item_code: code,
        item_name: row.품명.trim(),
        spec: row.규격 ? row.규격.trim() : null,
        unit: row.단위 || 'EA',
        unit_weight: row['단위중량(KG)'] || 0,
        category,
        is_active: true,
        current_stock: 0,
        safety_stock: 0
      });
    }
  });

  return itemsMap;
}

/**
 * 종합관리에서 품목 정보 병합
 */
function mergeItemsFromComprehensive(
  itemsMap: Map<string, Partial<ParsedItem>>,
  data: ComprehensiveExcelRow[],
  companyCodeMap: CompanyCodeMap,
  logger: ReturnType<typeof createLogger>
): void {
  let mergedCount = 0;
  let newCount = 0;

  data.forEach(row => {
    const code = row.품목코드.trim();

    if (itemsMap.has(code)) {
      // 기존 품목 업데이트
      const existing = itemsMap.get(code)!;

      if (row.현재재고 !== undefined) {
        existing.current_stock = row.현재재고;
      }

      if (row.안전재고 !== undefined) {
        existing.safety_stock = row.안전재고;
      }

      // 거래처 코드가 있으면 supplier_id 매핑
      if (row.거래처코드 && companyCodeMap.has(row.거래처코드)) {
        existing.supplier_id = companyCodeMap.get(row.거래처코드)!;
      }

      mergedCount++;
    } else {
      // 새로운 품목 추가
      const category = inferItemCategory(row.품목명, row.규격);

      itemsMap.set(code, {
        item_code: code,
        item_name: row.품목명.trim(),
        spec: row.규격 ? row.규격.trim() : null,
        unit: row.단위 || 'EA',
        category,
        is_active: true,
        current_stock: row.현재재고 || 0,
        safety_stock: row.안전재고 || 0,
        supplier_id: row.거래처코드 && companyCodeMap.has(row.거래처코드)
          ? companyCodeMap.get(row.거래처코드)!
          : undefined
      });

      newCount++;
    }
  });

  logger.log(`종합관리: ${mergedCount}개 품목 병합, ${newCount}개 품목 추가`, 'info');
}

/**
 * 품목 데이터 변환
 */
function transformItems(
  itemsMap: Map<string, Partial<ParsedItem>>,
  logger: ReturnType<typeof createLogger>
): ParsedItem[] {
  const items: ParsedItem[] = [];

  itemsMap.forEach((item, code) => {
    // 필수 필드 검증
    if (!item.item_code || !item.item_name) {
      logger.log(`⚠️  품목 스킵: 필수 필드 누락 - ${code}`, 'warn');
      return;
    }

    items.push({
      item_code: item.item_code,
      item_name: item.item_name,
      spec: item.spec || null,
      unit: item.unit || 'EA',
      unit_price: item.unit_price || 0,
      unit_weight: item.unit_weight || 0,
      category: item.category || '부품',
      supplier_id: item.supplier_id,
      current_stock: item.current_stock || 0,
      safety_stock: item.safety_stock || 0,
      is_active: item.is_active ?? true,
      description: item.description
    });
  });

  return items;
}

/**
 * item_code → item_id 매핑 생성
 */
async function createItemCodeMap(
  supabase: any,
  logger: ReturnType<typeof createLogger>
): Promise<ItemCodeMap> {
  logger.log('품목 코드 → ID 매핑 생성 중...', 'info');

  const { data, error } = await supabase
    .from('items')
    .select('item_id, item_code');

  if (error) {
    throw new Error(`품목 조회 실패: ${error.message}`);
  }

  const codeMap: ItemCodeMap = new Map();
  data.forEach((item: any) => {
    codeMap.set(item.item_code, item.item_id);
  });

  logger.log(`✅ ${codeMap.size}개 품목 매핑 생성 완료`, 'success');
  return codeMap;
}

/**
 * 매핑 데이터 JSON 저장
 */
function saveItemCodeMap(
  codeMap: ItemCodeMap,
  logger: ReturnType<typeof createLogger>
): void {
  const mapObject = Object.fromEntries(codeMap);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mapObject, null, 2), 'utf-8');
  logger.log(`💾 품목 매핑 저장: ${OUTPUT_FILE}`, 'success');
}

async function main() {
  const logger = createLogger('품목 임포트');
  logger.startMigration();

  // Step 1: 파싱된 데이터 및 매핑 로드
  logger.startPhase('파싱된 데이터 로드');

  const bomPath = path.join(DATA_DIR, 'parsed-bom.json');
  const comprehensivePath = path.join(DATA_DIR, 'parsed-comprehensive.json');

  if (!fs.existsSync(bomPath) || !fs.existsSync(comprehensivePath)) {
    logger.log('❌ 파싱된 데이터 파일이 없습니다. 먼저 02-parse-excel-files.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  if (!fs.existsSync(COMPANY_MAP_FILE)) {
    logger.log('❌ 거래처 매핑 파일이 없습니다. 먼저 04-import-companies.ts를 실행하세요', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  const bomResult: ParseResult<BomExcelRow> = JSON.parse(
    fs.readFileSync(bomPath, 'utf-8')
  );
  const comprehensiveResult: ParseResult<ComprehensiveExcelRow> = JSON.parse(
    fs.readFileSync(comprehensivePath, 'utf-8')
  );
  const companyCodeMap: CompanyCodeMap = new Map(
    Object.entries(JSON.parse(fs.readFileSync(COMPANY_MAP_FILE, 'utf-8')))
  );

  logger.log(`BOM: ${bomResult.data.length} 레코드`, 'info');
  logger.log(`종합관리: ${comprehensiveResult.data.length} 레코드`, 'info');
  logger.log(`거래처 매핑: ${companyCodeMap.size} 레코드`, 'info');
  logger.endPhase();

  // Step 2: 품목 데이터 추출 및 병합
  logger.startPhase('품목 데이터 추출');

  const itemsMap = extractItemsFromBom(bomResult.data);
  logger.log(`BOM에서 ${itemsMap.size}개 품목 추출`, 'info');

  mergeItemsFromComprehensive(itemsMap, comprehensiveResult.data, companyCodeMap, logger);
  logger.log(`총 ${itemsMap.size}개 고유 품목`, 'success');

  logger.endPhase();

  // Step 3: 품목 데이터 변환
  logger.startPhase('품목 데이터 변환');

  const items = transformItems(itemsMap, logger);

  logger.log(`변환 완료: ${items.length}개 품목`, 'success');

  // 카테고리별 통계
  const categoryStats: Record<string, number> = {};
  items.forEach(item => {
    categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
  });

  logger.table({
    '총 품목': items.length,
    ...categoryStats,
    'supplier_id 있음': items.filter(i => i.supplier_id).length
  });

  logger.endPhase();

  // Step 4: Supabase 임포트
  logger.startPhase('Supabase 임포트');

  const supabase = createAdminClient();

  const result = await batchInsert(
    supabase,
    'items',
    items,
    100,
    (current, total) => {
      logger.progress(current, total, `${current}/${total} 품목 임포트`);
    }
  );

  if (result.failed > 0) {
    logger.log(`⚠️  ${result.failed}개 품목 임포트 실패`, 'warn');
    result.errors.forEach(err => {
      logger.log(`  Batch ${err.batch}: ${err.error}`, 'error');
    });
  }

  logger.log(`✅ ${result.success}개 품목 임포트 완료`, 'success');
  logger.endPhase();

  // Step 5: 품목 코드 → ID 매핑 생성 및 저장
  logger.startPhase('품목 매핑 생성');

  const codeMap = await createItemCodeMap(supabase, logger);
  saveItemCodeMap(codeMap, logger);

  logger.endPhase();

  // Step 6: 결과 요약
  logger.divider('=');
  logger.log('\n📊 품목 임포트 결과\n', 'info');

  logger.table({
    '임포트 성공': result.success,
    '임포트 실패': result.failed,
    '매핑 생성': codeMap.size
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
