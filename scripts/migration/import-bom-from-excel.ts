/**
 * 태창금속 BOM.xlsx에서 BOM 관계 추출 및 추가
 *
 * 엑셀 파일에서 부모-자식 관계를 추출하여 bom 테이블에 추가합니다.
 *
 * 실행: npx tsx scripts/migration/import-bom-from-excel.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection, batchInsert } from './utils/supabase-client';
import { Database } from '@/types/supabase';

type BOM = Database['public']['Tables']['bom']['Insert'];

const BOM_EXCEL_FILE = '태창금속 BOM.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const FILE_PATH = path.join(EXCEL_DIR, BOM_EXCEL_FILE);

/**
 * 엑셀 파일 읽기
 */
function readExcelFile(): XLSX.WorkBook {
  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`Excel 파일을 찾을 수 없습니다: ${FILE_PATH}`);
  }

  return XLSX.readFile(FILE_PATH, {
    type: 'file',
    cellDates: true,
    cellNF: false,
    cellText: false
  });
}

/**
 * 품번 정규화 (공백 제거, 대문자 변환)
 */
function normalizeItemCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * 부모 품목(완제품) 추출
 */
interface ParentItem {
  item_code: string;
  item_name: string;
  sheetName: string;
}

/**
 * BOM 관계 추출
 */
interface BOMRelationship {
  parentCode: string;
  childCode: string;
  quantityRequired: number;
  sheetName: string;
}

/**
 * 부모 품목 추출
 */
function extractParentItems(
  workbook: XLSX.WorkBook,
  logger: ReturnType<typeof createLogger>
): Map<string, ParentItem> {
  const parentItems = new Map<string, ParentItem>();
  const bomSheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];

  for (const sheetName of bomSheets) {
    if (!workbook.SheetNames.includes(sheetName)) {
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      range: 5 // A6부터
    }) as any[][];

    const DELIVERY_COMPANY_COL = 0;
    const PARENT_CODE_COL = 2;
    const PARENT_NAME_COL = 3;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;

      const deliveryCompany = String(row[DELIVERY_COMPANY_COL] || '').trim();
      const parentCode = String(row[PARENT_CODE_COL] || '').trim();
      const parentName = String(row[PARENT_NAME_COL] || '').trim();

      // 부모 품목 식별: 납품처에 값이 있고 품번과 품명이 있으면 부모
      if (deliveryCompany && parentCode && parentCode.length >= 3 && parentName) {
        const normalizedCode = normalizeItemCode(parentCode);
        if (!parentItems.has(normalizedCode)) {
          parentItems.set(normalizedCode, {
            item_code: parentCode, // 원본 코드 유지
            item_name: parentName,
            sheetName: sheetName
          });
        }
      }
    }
  }

  return parentItems;
}

function extractBOMRelationships(
  workbook: XLSX.WorkBook,
  logger: ReturnType<typeof createLogger>
): BOMRelationship[] {
  const relationships: BOMRelationship[] = [];
  const bomSheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];

  for (const sheetName of bomSheets) {
    if (!workbook.SheetNames.includes(sheetName)) {
      logger.log(`  ⚠️  시트 없음: ${sheetName}`, 'warn');
      continue;
    }

    logger.log(`  📄 시트 처리: ${sheetName}`, 'info');
    const worksheet = workbook.Sheets[sheetName];

    // A6부터 데이터 읽기 (헤더 6행, 인덱스 5)
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      range: 5 // A6부터
    }) as any[][];

    let currentParentCode: string | null = null;
    let processedCount = 0;

    // 컬럼 인덱스
    const DELIVERY_COMPANY_COL = 0;  // 납품처 (부모 식별용)
    const PARENT_CODE_COL = 2;       // 완제품 품번 (부모)
    const SUPPLIER_COL_1 = 8;        // 구매처 컬럼 1
    const SUPPLIER_COL_2 = 9;        // 구매처 컬럼 2
    const CHILD_CODE_COL = 10;       // 구매품목 품번 (자식)
    const QUANTITY_COL = 12;         // 소요량

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;

      const deliveryCompany = String(row[DELIVERY_COMPANY_COL] || '').trim();
      const parentCode = String(row[PARENT_CODE_COL] || '').trim();
      const supplier1 = String(row[SUPPLIER_COL_1] || '').trim();
      const supplier2 = String(row[SUPPLIER_COL_2] || '').trim();
      const childCode = String(row[CHILD_CODE_COL] || '').trim();
      const quantityStr = String(row[QUANTITY_COL] || '').trim();

      // 부모 품목 식별: 납품처에 값이 있고 품번이 있으면 부모
      if (deliveryCompany && parentCode && parentCode.length >= 3) {
        currentParentCode = parentCode;
        logger.log(`    부모 품목: ${parentCode}`, 'info');
      }

      // 자식 품목 식별: 납품처가 비어있고 구매처에 값이 있으며 품번이 있으면 자식
      if (!deliveryCompany && (supplier1 || supplier2) && childCode && childCode.length >= 3) {
        if (!currentParentCode) {
          logger.log(`    ⚠️  자식 품목인데 부모가 없음: ${childCode} (행 ${i + 7})`, 'warn');
          continue;
        }

        // 소요량 추출
        let quantityRequired = 1.0;
        if (quantityStr) {
          const qty = parseFloat(quantityStr.replace(/[^0-9.-]/g, ''));
          if (!isNaN(qty) && qty > 0) {
            quantityRequired = qty;
          }
        }

        relationships.push({
          parentCode: currentParentCode!,
          childCode: childCode,
          quantityRequired: quantityRequired,
          sheetName: sheetName
        });
        processedCount++;
      }
    }

    logger.log(`    ✅ ${sheetName}: ${processedCount}개 관계 추출`, 'success');
  }

  return relationships;
}

/**
 * 품목 코드 → item_id 매핑 생성
 */
async function createItemCodeMap(supabase: ReturnType<typeof createAdminClient>) {
  const { data: items, error } = await supabase
    .from('items')
    .select('item_id, item_code');

  if (error) {
    throw new Error(`품목 조회 실패: ${error.message}`);
  }

  const codeToIdMap = new Map<string, number>();

  items?.forEach(item => {
    // 원본 코드 매핑
    codeToIdMap.set(item.item_code, item.item_id);

    // 정규화된 코드 매핑도 추가
    const normalized = normalizeItemCode(item.item_code);
    if (normalized !== item.item_code) {
      if (!codeToIdMap.has(normalized)) {
        codeToIdMap.set(normalized, item.item_id);
      }
    }
  });

  return codeToIdMap;
}

/**
 * BOM 관계 검증 및 변환
 */
function validateAndTransformBOMs(
  relationships: BOMRelationship[],
  itemCodeMap: Map<string, number>,
  logger: ReturnType<typeof createLogger>
): BOM[] {
  const bomRecords: BOM[] = [];
  const seen = new Set<string>();
  let skippedNotFound = 0;
  let skippedDuplicate = 0;
  let skippedSelfReference = 0;

  for (const rel of relationships) {
    // 품번 정규화
    const normalizedParent = normalizeItemCode(rel.parentCode);
    const normalizedChild = normalizeItemCode(rel.childCode);

    // item_id 매핑 시도 (정규화된 코드 먼저, 없으면 원본)
    const parentId = itemCodeMap.get(normalizedParent) || itemCodeMap.get(rel.parentCode);
    const childId = itemCodeMap.get(normalizedChild) || itemCodeMap.get(rel.childCode);

    // 매핑 실패 확인
    if (!parentId) {
      logger.log(`  ⚠️  부모 품목 매핑 실패: ${rel.parentCode} (시트: ${rel.sheetName})`, 'warn');
      skippedNotFound++;
      continue;
    }

    if (!childId) {
      logger.log(`  ⚠️  자식 품목 매핑 실패: ${rel.childCode} (시트: ${rel.sheetName})`, 'warn');
      skippedNotFound++;
      continue;
    }

    // 자기 자신 참조 방지
    if (parentId === childId) {
      skippedSelfReference++;
      continue;
    }

    // 중복 확인
    const key = `${parentId}_${childId}`;
    if (seen.has(key)) {
      skippedDuplicate++;
      continue;
    }
    seen.add(key);

    // BOM 레코드 생성
    bomRecords.push({
      parent_item_id: parentId,
      child_item_id: childId,
      quantity_required: rel.quantityRequired,
      level_no: 1,
      is_active: true
    });
  }

  if (skippedNotFound > 0) {
    logger.log(`  ⚠️  매핑 실패: ${skippedNotFound}개`, 'warn');
  }
  if (skippedDuplicate > 0) {
    logger.log(`  ⚠️  중복 제거: ${skippedDuplicate}개`, 'info');
  }
  if (skippedSelfReference > 0) {
    logger.log(`  ⚠️  자기 참조 제외: ${skippedSelfReference}개`, 'info');
  }

  return bomRecords;
}

/**
 * 통계 생성
 */
function generateStats(bomRecords: BOM[], logger: ReturnType<typeof createLogger>) {
  const parentSet = new Set(bomRecords.map(b => b.parent_item_id));
  const childSet = new Set(bomRecords.map(b => b.child_item_id));

  const parentChildCount = new Map<number, number>();
  bomRecords.forEach(bom => {
    const count = parentChildCount.get(bom.parent_item_id) || 0;
    parentChildCount.set(bom.parent_item_id, count + 1);
  });

  const maxChildren = Math.max(...Array.from(parentChildCount.values()), 0);
  const avgChildren = parentSet.size > 0 ? bomRecords.length / parentSet.size : 0;

  logger.log('\n📊 BOM 통계', 'info');
  logger.table({
    '총 BOM 관계': bomRecords.length,
    '고유 부모 품목': parentSet.size,
    '고유 자식 품목': childSet.size,
    '최대 자식 수': maxChildren,
    '평균 자식 수': avgChildren.toFixed(2)
  });
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('BOM 데이터 추가');
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

  // Step 2: 엑셀 파일 읽기
  logger.startPhase('BOM 엑셀 파일 읽기');
  let workbook: XLSX.WorkBook;
  try {
    workbook = readExcelFile();
    logger.log(`✅ 엑셀 파일 읽기 완료: ${workbook.SheetNames.length}개 시트`, 'success');
  } catch (error: any) {
    logger.log(`❌ 엑셀 파일 읽기 실패: ${error.message}`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  // Step 3: 부모 품목 추출 및 추가
  logger.startPhase('부모 품목 추출 및 추가');
  const parentItems = extractParentItems(workbook, logger);
  logger.log(`✅ ${parentItems.size}개 부모 품목 추출 완료`, 'success');

  if (parentItems.size > 0) {
    // DB에 부모 품목 추가
    const parentItemsArray = Array.from(parentItems.values()).map(item => ({
      item_code: item.item_code,
      item_name: item.item_name,
      category: '제품' as const,
      unit: 'EA',
      current_stock: 0,
      price: 0,
      is_active: true
    }));

    // upsert 사용 (중복 시 업데이트하지 않고 스킵)
    let parentInserted = 0;
    let parentSkipped = 0;

    for (let i = 0; i < parentItemsArray.length; i += 100) {
      const batch = parentItemsArray.slice(i, i + 100);
      
      try {
        const { data, error } = await supabase
          .from('items')
          .upsert(batch, { onConflict: 'item_code' })
          .select();

        if (error) {
          // 중복 오류는 무시 (이미 존재하는 항목)
          if (error.code === '23505') { // unique_violation
            parentSkipped += batch.length;
          } else {
            logger.log(`  ⚠️  배치 ${Math.floor(i / 100) + 1} 오류: ${error.message}`, 'warn');
            parentSkipped += batch.length;
          }
        } else {
          parentInserted += data?.length || 0;
          if (data && data.length < batch.length) {
            parentSkipped += (batch.length - data.length);
          }
        }
      } catch (error: any) {
        logger.log(`  ⚠️  배치 ${Math.floor(i / 100) + 1} 예외: ${error.message}`, 'warn');
        parentSkipped += batch.length;
      }

      logger.progress(Math.min(i + 100, parentItemsArray.length), parentItemsArray.length, '부모 품목 삽입');
    }

    const parentResult = { success: parentInserted, failed: parentSkipped };

    logger.log(`✅ 부모 품목 삽입: ${parentResult.success}개 성공, ${parentResult.failed}개 실패`, parentResult.failed > 0 ? 'warn' : 'success');
  }
  logger.endPhase();

  // Step 4: BOM 관계 추출
  logger.startPhase('BOM 관계 추출');
  const relationships = extractBOMRelationships(workbook, logger);
  logger.log(`✅ 총 ${relationships.length}개 BOM 관계 추출 완료`, 'success');
  logger.endPhase();

  if (relationships.length === 0) {
    logger.log('추출된 BOM 관계가 없습니다', 'warn');
    logger.endMigration(true);
    process.exit(0);
  }

  // Step 5: 품목 코드 매핑 (부모 품목 추가 후 다시 생성)
  logger.startPhase('품목 코드 매핑 생성');
  const itemCodeMap = await createItemCodeMap(supabase);
  logger.log(`✅ ${itemCodeMap.size}개 품목 매핑 생성 완료`, 'success');
  logger.endPhase();

  // Step 6: BOM 관계 검증 및 변환
  logger.startPhase('BOM 관계 검증 및 변환');
  const bomRecords = validateAndTransformBOMs(relationships, itemCodeMap, logger);
  logger.log(`✅ ${bomRecords.length}개 유효한 BOM 관계 생성 완료`, 'success');
  logger.endPhase();

  if (bomRecords.length === 0) {
    logger.log('삽입할 BOM 관계가 없습니다', 'warn');
    logger.endMigration(true);
    process.exit(0);
  }

  // Step 7: 통계 생성
  generateStats(bomRecords, logger);

  // Step 8: BOM 데이터 삽입
  logger.startPhase('BOM 데이터 삽입');
  const result = await batchInsert(
    supabase,
    'bom',
    bomRecords,
    100,
    (current, total) => {
      logger.progress(current, total, 'BOM 관계 삽입');
    }
  );

  if (result.failed > 0) {
    logger.log(`⚠️  ${result.failed}개 BOM 관계 삽입 실패`, 'warn');
    result.errors.forEach(err => {
      logger.log(`  Batch ${err.batch}: ${err.error}`, 'error');
    });
  }

  logger.log(`✅ ${result.success}개 BOM 관계 삽입 완료`, 'success');
  logger.endPhase();

  // Step 9: 최종 결과
  logger.divider('=');
  logger.log('\n📊 BOM 데이터 추가 결과\n', 'info');
  logger.table({
    '추출된 관계': relationships.length,
    '유효한 관계': bomRecords.length,
    '삽입 성공': result.success,
    '삽입 실패': result.failed,
    '고유 부모 품목': new Set(bomRecords.map(b => b.parent_item_id)).size,
    '고유 자식 품목': new Set(bomRecords.map(b => b.child_item_id)).size
  });

  logger.endMigration(result.failed === 0);

  if (result.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

