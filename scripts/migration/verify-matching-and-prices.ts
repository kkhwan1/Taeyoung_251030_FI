/**
 * 매칭 및 단가/금액 반영 상태 확인 스크립트
 *
 * 1. 품번 매칭 상태 확인
 * 2. 단가 반영 상태 확인 (items.price)
 * 3. 거래 금액 반영 상태 확인 (inventory_transactions)
 *
 * 실행: npx tsx scripts/migration/verify-matching-and-prices.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

const BOM_EXCEL = '태창금속 BOM.xlsx';
const INVENTORY_EXCEL = '09월 원자재 수불관리.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');

/**
 * 엑셀 파일 읽기
 */
function readExcelFile(filename: string): XLSX.WorkBook {
  const filePath = path.join(EXCEL_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel 파일을 찾을 수 없습니다: ${filePath}`);
  }

  return XLSX.readFile(filePath, {
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
 * 엑셀에서 품번 목록 추출
 */
function extractItemCodesFromExcel(): {
  bomItemCodes: Set<string>;
  inventoryItemCodes: Set<string>;
  priceMap: Map<string, number>;
} {
  const bomItemCodes = new Set<string>();
  const inventoryItemCodes = new Set<string>();
  const priceMap = new Map<string, number>();

  // 태창금속 BOM.xlsx에서 품번 추출
  try {
    const bomWorkbook = readExcelFile(BOM_EXCEL);
    const bomSheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];

    for (const sheetName of bomSheets) {
      if (!bomWorkbook.SheetNames.includes(sheetName)) continue;

      const worksheet = bomWorkbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 5
      }) as any[][];

      const PARENT_CODE_COL = 2;
      const ITEM_CODE_COL = 10;

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const parentCode = String(row[PARENT_CODE_COL] || '').trim();
        const itemCode = String(row[ITEM_CODE_COL] || '').trim();

        if (parentCode && parentCode.length >= 3) {
          bomItemCodes.add(normalizeItemCode(parentCode));
        }
        if (itemCode && itemCode.length >= 3) {
          bomItemCodes.add(normalizeItemCode(itemCode));
        }
      }
    }

    // 최신단가 시트에서 단가 추출
    const priceSheet = bomWorkbook.SheetNames.find(name => 
      name.includes('최신단가') || name.includes('단가')
    );

    if (priceSheet) {
      const worksheet = bomWorkbook.Sheets[priceSheet];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false
      }) as any[][];

      const ITEM_CODE_COL = 0;
      const PRICE_COL = 1;

      for (const row of rows) {
        const itemCode = String(row[ITEM_CODE_COL] || '').trim();
        const price = parseFloat(String(row[PRICE_COL] || ''));

        if (itemCode && !isNaN(price) && price > 0) {
          const normalized = normalizeItemCode(itemCode);
          priceMap.set(normalized, price);
        }
      }
    }
  } catch (error: any) {
    console.error(`BOM 엑셀 분석 오류: ${error.message}`);
  }

  // 09월 원자재 수불관리.xlsx에서 품번 추출
  try {
    const inventoryWorkbook = readExcelFile(INVENTORY_EXCEL);
    const vendorSheets = [
      '풍기서산(사급)', '세원테크(사급)', '대우포승(사급)', '호원오토(사급)',
      '웅지테크', '태영금속', 'JS테크', '에이오에스', '창경테크', '신성테크', '광성 SAS',
      'MV1 , SV (재고관리)', 'TAM,KA4,인알파', 'DL3 GL3 (재고관리)'
    ];

    for (const sheetName of vendorSheets) {
      if (!inventoryWorkbook.SheetNames.includes(sheetName)) continue;

      const worksheet = inventoryWorkbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 0
      }) as any[][];

      // 시트 타입에 따라 품번 컬럼 다름
      let itemCodeCol = 3;
      if (sheetName.includes('MV1') || sheetName.includes('TAM') || sheetName.includes('DL3')) {
        itemCodeCol = 5; // 재고관리 시트
      } else {
        itemCodeCol = 3; // 일반 공급사 시트
      }

      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const itemCode = String(row[itemCodeCol] || '').trim();
        if (itemCode && itemCode.length >= 3) {
          inventoryItemCodes.add(normalizeItemCode(itemCode));
        }
      }
    }
  } catch (error: any) {
    console.error(`Inventory 엑셀 분석 오류: ${error.message}`);
  }

  return { bomItemCodes, inventoryItemCodes, priceMap };
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('매칭 및 단가 확인');
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

  // Step 2: 엑셀에서 품번 및 단가 추출
  logger.startPhase('엑셀에서 품번 및 단가 추출');
  const { bomItemCodes, inventoryItemCodes, priceMap } = extractItemCodesFromExcel();
  logger.log(`✅ BOM 엑셀 품번: ${bomItemCodes.size}개`, 'success');
  logger.log(`✅ Inventory 엑셀 품번: ${inventoryItemCodes.size}개`, 'success');
  logger.log(`단가 정보: ${priceMap.size}개`, 'success');
  logger.endPhase();

  // Step 3: DB 품목 조회
  logger.startPhase('DB 품목 조회');
  const { data: dbItems, error: itemsError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, price, material, thickness, width, height, specific_gravity, mm_weight, spec');

  if (itemsError) {
    throw new Error(`품목 조회 실패: ${itemsError.message}`);
  }

  const dbItemCodes = new Set(dbItems?.map(i => normalizeItemCode(i.item_code)) || []);
  logger.log(`✅ DB 품목: ${dbItems?.length || 0}개`, 'success');
  logger.endPhase();

  // Step 4: 매칭 상태 확인
  logger.startPhase('품번 매칭 상태 확인');
  
  let matchedBom = 0;
  let matchedInventory = 0;
  let unmatchedBom: string[] = [];
  let unmatchedInventory: string[] = [];

  for (const bomCode of bomItemCodes) {
    if (dbItemCodes.has(bomCode)) {
      matchedBom++;
    } else {
      if (unmatchedBom.length < 20) {
        unmatchedBom.push(bomCode);
      }
    }
  }

  for (const invCode of inventoryItemCodes) {
    if (dbItemCodes.has(invCode)) {
      matchedInventory++;
    } else {
      if (unmatchedInventory.length < 20) {
        unmatchedInventory.push(invCode);
      }
    }
  }

  logger.log(`✅ BOM 엑셀 매칭: ${matchedBom}/${bomItemCodes.size} (${Math.round(matchedBom/bomItemCodes.size*100)}%)`, 'success');
  logger.log(`✅ Inventory 엑셀 매칭: ${matchedInventory}/${inventoryItemCodes.size} (${Math.round(matchedInventory/inventoryItemCodes.size*100)}%)`, 'success');

  if (unmatchedBom.length > 0) {
    logger.log(`⚠️  BOM 엑셀 비매칭 샘플 (최대 20개):`, 'warn');
    unmatchedBom.forEach(code => logger.log(`  - ${code}`, 'warn'));
  }

  if (unmatchedInventory.length > 0) {
    logger.log(`⚠️  Inventory 엑셀 비매칭 샘플 (최대 20개):`, 'warn');
    unmatchedInventory.forEach(code => logger.log(`  - ${code}`, 'warn'));
  }
  logger.endPhase();

  // Step 5: 단가 반영 상태 확인
  logger.startPhase('단가 반영 상태 확인');
  
  let itemsWithPrice = 0;
  let itemsWithoutPrice = 0;
  let itemsWithExcelPrice = 0;
  let itemsPriceMismatch = 0;

  for (const item of dbItems || []) {
    const normalizedCode = normalizeItemCode(item.item_code);
    const excelPrice = priceMap.get(normalizedCode);

    if (item.price && item.price > 0) {
      itemsWithPrice++;
      
      if (excelPrice) {
        // 1원 단위 차이는 허용
        if (Math.abs(item.price - excelPrice) > 1) {
          itemsPriceMismatch++;
        }
      }
    } else {
      itemsWithoutPrice++;
    }

    if (excelPrice && (!item.price || item.price === 0)) {
      itemsWithExcelPrice++;
    }
  }

  logger.log(`단가 있는 품목: ${itemsWithPrice}개`, 'info');
  logger.log(`단가 없는 품목: ${itemsWithoutPrice}개`, 'warn');
  logger.log(`엑셀에 단가 있지만 DB에 없는 품목: ${itemsWithExcelPrice}개`, 'warn');
  logger.log(`단가 불일치 품목: ${itemsPriceMismatch}개`, itemsPriceMismatch > 0 ? 'warn' : 'info');
  logger.endPhase();

  // Step 6: 재질/치수 정보 반영 상태 확인
  logger.startPhase('재질/치수 정보 반영 상태 확인');
  
  let itemsWithMaterial = 0;
  let itemsWithThickness = 0;
  let itemsWithWidth = 0;
  let itemsWithHeight = 0;
  let itemsWithGravity = 0;
  let itemsWithWeight = 0;
  let itemsWithSpec = 0;

  for (const item of dbItems || []) {
    if (item.material && item.material.trim() !== '') itemsWithMaterial++;
    if (item.thickness && item.thickness > 0) itemsWithThickness++;
    if (item.width && item.width > 0) itemsWithWidth++;
    if (item.height && item.height > 0) itemsWithHeight++;
    if (item.specific_gravity && item.specific_gravity > 0) itemsWithGravity++;
    if (item.mm_weight && item.mm_weight > 0) itemsWithWeight++;
    if (item.spec && item.spec.trim() !== '') itemsWithSpec++;
  }

  logger.log(`재질: ${itemsWithMaterial}개`, 'info');
  logger.log(`두께: ${itemsWithThickness}개`, 'info');
  logger.log(`폭: ${itemsWithWidth}개`, 'info');
  logger.log(`길이: ${itemsWithHeight}개`, 'info');
  logger.log(`비중: ${itemsWithGravity}개`, 'info');
  logger.log(`단위중량: ${itemsWithWeight}개`, 'info');
  logger.log(`규격: ${itemsWithSpec}개`, 'info');
  logger.endPhase();

  // Step 7: 거래 금액 반영 상태 확인
  logger.startPhase('거래 금액 반영 상태 확인');
  
  const { data: transactions, error: transError } = await supabase
    .from('inventory_transactions')
    .select(`
      transaction_id,
      quantity,
      unit_price,
      total_amount,
      tax_amount,
      grand_total,
      items!inner(price)
    `)
    .limit(5000);

  if (transError) {
    logger.log(`거래 조회 오류: ${transError.message}`, 'error');
  } else {
    let transactionsWithUnitPrice = 0;
    let transactionsWithoutUnitPrice = 0;
    let transactionsWithAmounts = 0;
    let transactionsWithoutAmounts = 0;
    let transactionsAmountMismatch = 0;

    for (const txn of transactions || []) {
      if (txn.unit_price && txn.unit_price > 0) {
        transactionsWithUnitPrice++;
      } else {
        transactionsWithoutUnitPrice++;
      }

      if (txn.total_amount && txn.tax_amount && txn.grand_total) {
        transactionsWithAmounts++;

        // 금액 검증
        if (txn.quantity && txn.unit_price) {
          const expectedTotal = Math.round(txn.unit_price * txn.quantity);
          const expectedTax = Math.round(expectedTotal * 0.1);
          const expectedGrand = expectedTotal + expectedTax;

          if (Math.abs(txn.total_amount - expectedTotal) > 1 ||
              Math.abs(txn.tax_amount - expectedTax) > 1 ||
              Math.abs(txn.grand_total - expectedGrand) > 1) {
            transactionsAmountMismatch++;
          }
        }
      } else {
        transactionsWithoutAmounts++;
      }
    }

    logger.log(`총 거래 수: ${transactions?.length || 0}개`, 'info');
    logger.log(`단가 있는 거래: ${transactionsWithUnitPrice}개`, 'info');
    logger.log(`단가 없는 거래: ${transactionsWithoutUnitPrice}개`, transactionsWithoutUnitPrice > 0 ? 'warn' : 'info');
    logger.log(`금액 계산된 거래: ${transactionsWithAmounts}개`, 'info');
    logger.log(`금액 미계산 거래: ${transactionsWithoutAmounts}개`, transactionsWithoutAmounts > 0 ? 'warn' : 'info');
    logger.log(`금액 불일치 거래: ${transactionsAmountMismatch}개`, transactionsAmountMismatch > 0 ? 'warn' : 'info');
  }
  logger.endPhase();

  // Step 8: 결과 요약
  logger.divider('=');
  logger.log('\n📊 매칭 및 단가/금액 반영 상태 결과\n', 'info');
  
  logger.table({
    'BOM 엑셀 품번': bomItemCodes.size,
    'BOM 매칭률': `${matchedBom}/${bomItemCodes.size} (${Math.round(matchedBom/bomItemCodes.size*100)}%)`,
    'Inventory 엑셀 품번': inventoryItemCodes.size,
    'Inventory 매칭률': `${matchedInventory}/${inventoryItemCodes.size} (${Math.round(matchedInventory/inventoryItemCodes.size*100)}%)`,
    '엑셀 단가 정보': priceMap.size,
    'DB 단가 있는 품목': itemsWithPrice,
    'DB 단가 없는 품목': itemsWithoutPrice,
    '재질 정보': itemsWithMaterial,
    '단위중량 정보': itemsWithWeight,
    '규격 정보': itemsWithSpec
  });

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

