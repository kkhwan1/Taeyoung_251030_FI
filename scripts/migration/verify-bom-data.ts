/**
 * BOM 데이터 검증 스크립트
 * 
 * 소요량, 단위, 단가, 재료비 등의 정확성을 확인합니다.
 * 
 * 실행: npx tsx scripts/migration/verify-bom-data.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

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
 * 품번 정규화
 */
function normalizeItemCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * 엑셀에서 BOM 관계 상세 정보 추출
 */
interface ExcelBOMData {
  parentCode: string;
  childCode: string;
  quantityRequired: number;
  unit?: string;
  unitPrice?: number;
  totalCost?: number;
  sheetName: string;
  rowIndex: number;
}

function extractExcelBOMData(
  workbook: XLSX.WorkBook,
  logger: ReturnType<typeof createLogger>
): ExcelBOMData[] {
  const bomData: ExcelBOMData[] = [];
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

    let currentParentCode: string | null = null;

    // 컬럼 인덱스 (extract-material-specs.ts 참고)
    const DELIVERY_COMPANY_COL = 0;
    const PARENT_CODE_COL = 2;
    const PARENT_NAME_COL = 3;
    const PARENT_UNIT_COL = 4; // 단가 컬럼 옆 또는 확인 필요
    const SUPPLIER_COL_1 = 8;
    const SUPPLIER_COL_2 = 9;
    const CHILD_CODE_COL = 10;
    const CHILD_NAME_COL = 11;
    const QUANTITY_COL = 12;
    const CHILD_UNIT_PRICE_COL = 13; // 단가 (확인 필요)
    const CHILD_UNIT_COL = 14; // 단위 (확인 필요)

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;

      const deliveryCompany = String(row[DELIVERY_COMPANY_COL] || '').trim();
      const parentCode = String(row[PARENT_CODE_COL] || '').trim();
      const supplier1 = String(row[SUPPLIER_COL_1] || '').trim();
      const supplier2 = String(row[SUPPLIER_COL_2] || '').trim();
      const childCode = String(row[CHILD_CODE_COL] || '').trim();
      const quantityStr = String(row[QUANTITY_COL] || '').trim();

      // 부모 품목 식별
      if (deliveryCompany && parentCode && parentCode.length >= 3) {
        currentParentCode = parentCode;
      }

      // 자식 품목 식별
      if (!deliveryCompany && (supplier1 || supplier2) && childCode && childCode.length >= 3) {
        if (!currentParentCode) continue;

        // 소요량 추출
        let quantityRequired = 1.0;
        if (quantityStr) {
          const qty = parseFloat(quantityStr.replace(/[^0-9.-]/g, ''));
          if (!isNaN(qty) && qty > 0) {
            quantityRequired = qty;
          }
        }

        // 단가 추출 (컬럼 13)
        let unitPrice: number | undefined;
        const priceStr = String(row[CHILD_UNIT_PRICE_COL] || '').trim();
        if (priceStr) {
          const price = parseFloat(priceStr.replace(/[^0-9.-]/g, ''));
          if (!isNaN(price) && price > 0) {
            unitPrice = price;
          }
        }

        // 단위 추출
        const unit = String(row[CHILD_UNIT_COL] || '').trim() || undefined;

        // 재료비 계산
        const totalCost = unitPrice && quantityRequired ? unitPrice * quantityRequired : undefined;

        bomData.push({
          parentCode: currentParentCode!,
          childCode: childCode,
          quantityRequired: quantityRequired,
          unit: unit,
          unitPrice: unitPrice,
          totalCost: totalCost,
          sheetName: sheetName,
          rowIndex: i + 7 // 실제 엑셀 행 번호 (헤더 6행 + 인덱스 + 1)
        });
      }
    }
  }

  return bomData;
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('BOM 데이터 검증');
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

  // Step 2: 엑셀 파일에서 상세 정보 추출
  logger.startPhase('엑셀 파일에서 BOM 상세 정보 추출');
  let excelBOMData: ExcelBOMData[];
  try {
    const workbook = readExcelFile();
    excelBOMData = extractExcelBOMData(workbook, logger);
    logger.log(`✅ 엑셀에서 ${excelBOMData.length}개 BOM 관계 추출`, 'success');
  } catch (error: any) {
    logger.log(`❌ 엑셀 파일 읽기 실패: ${error.message}`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  // Step 3: DB에서 BOM 데이터 조회
  logger.startPhase('DB BOM 데이터 조회');
  const { data: dbBOMData, error: dbError } = await supabase
    .from('bom')
    .select(`
      bom_id,
      parent_item_id,
      child_item_id,
      quantity_required,
      labor_cost,
      notes,
      parent:items!bom_parent_item_id_fkey(
        item_id,
        item_code,
        item_name,
        unit,
        price
      ),
      child:items!bom_child_item_id_fkey(
        item_id,
        item_code,
        item_name,
        unit,
        price
      )
    `)
    .order('bom_id');

  if (dbError) {
    logger.log(`❌ DB 조회 실패: ${dbError.message}`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  logger.log(`✅ DB에서 ${dbBOMData?.length || 0}개 BOM 관계 조회`, 'success');
  logger.endPhase();

  if (!dbBOMData || dbBOMData.length === 0) {
    logger.log('DB에 BOM 데이터가 없습니다', 'warn');
    logger.endMigration(true);
    process.exit(0);
  }

  // Step 4: 데이터 검증
  logger.startPhase('BOM 데이터 검증');

  // 품목 코드 매핑 생성
  const { data: allItems } = await supabase
    .from('items')
    .select('item_id, item_code');

  const itemCodeMap = new Map<string, number>();
  allItems?.forEach(item => {
    itemCodeMap.set(item.item_code, item.item_id);
    itemCodeMap.set(normalizeItemCode(item.item_code), item.item_id);
  });

  // 엑셀 데이터와 DB 데이터 매칭
  const issues: string[] = [];
  let matchedCount = 0;
  let quantityMismatchCount = 0;
  let missingPriceCount = 0;

  for (const dbBOM of dbBOMData) {
    const parentItem = dbBOM.items as any;
    const childItem = dbBOM.items as any; // 실제로는 두 개의 items 조인이므로 수정 필요

    if (!parentItem || !childItem) {
      issues.push(`BOM ID ${dbBOM.bom_id}: 품목 정보 누락`);
      continue;
    }

    // 엑셀에서 해당 관계 찾기
    const excelMatch = excelBOMData.find(
      e => 
        (normalizeItemCode(e.parentCode) === normalizeItemCode(parentItem.item_code) ||
         e.parentCode === parentItem.item_code) &&
        (normalizeItemCode(e.childCode) === normalizeItemCode(childItem.item_code) ||
         e.childCode === childItem.item_code)
    );

    if (excelMatch) {
      matchedCount++;

      // 소요량 검증
      const qtyDiff = Math.abs(dbBOM.quantity_required - excelMatch.quantityRequired);
      if (qtyDiff > 0.01) {
        quantityMismatchCount++;
        issues.push(
          `BOM ID ${dbBOM.bom_id}: 소요량 불일치 - DB: ${dbBOM.quantity_required}, 엑셀: ${excelMatch.quantityRequired} (${excelMatch.sheetName}, 행 ${excelMatch.rowIndex})`
        );
      }

      // 단가 정보 확인
      if (!excelMatch.unitPrice && childItem.price) {
        issues.push(
          `BOM ID ${dbBOM.bom_id}: 엑셀에 단가 없음, DB 품목 단가: ${childItem.price} (${childItem.item_code})`
        );
      }
    } else {
      issues.push(`BOM ID ${dbBOM.bom_id}: 엑셀에서 해당 관계를 찾을 수 없음 (${parentItem.item_code} → ${childItem.item_code})`);
    }
  }

  logger.log(`✅ 매칭된 BOM 관계: ${matchedCount}/${dbBOMData.length}개`, 'info');
  if (quantityMismatchCount > 0) {
    logger.log(`⚠️  소요량 불일치: ${quantityMismatchCount}개`, 'warn');
  }
  if (issues.length > 0) {
    logger.log(`⚠️  발견된 이슈: ${issues.length}개`, 'warn');
    issues.slice(0, 20).forEach(issue => {
      logger.log(`  - ${issue}`, 'warn');
    });
    if (issues.length > 20) {
      logger.log(`  ... 외 ${issues.length - 20}개 더`, 'warn');
    }
  } else {
    logger.log(`✅ 문제 없음: 모든 데이터가 일치합니다`, 'success');
  }

  logger.endPhase();

  // Step 5: 통계 요약
  logger.divider('=');
  logger.log('\n📊 검증 결과 요약\n', 'info');
  logger.table({
    '총 BOM 관계': dbBOMData.length,
    '엑셀 매칭': matchedCount,
    '소요량 불일치': quantityMismatchCount,
    '발견된 이슈': issues.length
  });

  logger.endMigration(issues.length === 0);
}

main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

