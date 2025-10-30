/**
 * 거래처 및 제외된 데이터 확인 스크립트
 *
 * 엑셀 파일과 데이터베이스를 비교하여:
 * 1. 엑셀에 있지만 DB에 없는 거래처
 * 2. 엑셀에 있지만 DB에 없는 품목
 * 3. 매칭되지 않은 품번
 * 4. company_id가 여전히 NULL인 거래
 * 5. supplier_id가 NULL인 품목
 *
 * 실행: npx tsx scripts/migration/check-missing-data.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';
import { Database } from '@/types/supabase';

const INVENTORY_EXCEL = '09월 원자재 수불관리.xlsx';
const BOM_EXCEL = '태창금속 BOM.xlsx';
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
 * 엑셀에서 모든 거래처 이름 추출
 */
function extractAllCompaniesFromExcel(): Set<string> {
  const companies = new Set<string>();

  try {
    // 09월 원자재 수불관리.xlsx에서 거래처 추출
    const inventoryWorkbook = readExcelFile(INVENTORY_EXCEL);
    
    // 재고관리 시트에서 거래처 추출
    const inventorySheets = ['MV1 , SV (재고관리)', 'TAM,KA4,인알파', 'DL3 GL3 (재고관리)'];
    
    for (const sheetName of inventorySheets) {
      if (!inventoryWorkbook.SheetNames.includes(sheetName)) continue;

      const worksheet = inventoryWorkbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 1
      }) as any[][];

      const VENDOR_COL = 4;

      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const vendorName = String(row[VENDOR_COL] || '').trim();
        if (vendorName && vendorName !== '' && vendorName !== '태창금속') {
          companies.add(vendorName);
        }
      }
    }

    // 입고현황 시트에서 거래처 추출
    const receivingSheets = ['대우사급 입고현황', '호원사급 입고현황', '협력업체 입고현황'];
    
    for (const sheetName of receivingSheets) {
      if (!inventoryWorkbook.SheetNames.includes(sheetName)) continue;

      const worksheet = inventoryWorkbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        range: 0
      }) as any[][];

      const VENDOR_COL = 1; // 양산처

      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const vendorName = String(row[VENDOR_COL] || '').trim();
        if (vendorName && vendorName !== '') {
          companies.add(vendorName);
        }
      }
    }

    // 일반 공급사 시트명에서 거래처 추출
    const vendorSheets = [
      '풍기서산(사급)', '세원테크(사급)', '대우포승(사급)', '호원오토(사급)',
      '웅지테크', '태영금속', 'JS테크', '에이오에스', '창경테크', '신성테크', '광성산업'
    ];

    for (const sheetName of vendorSheets) {
      // 시트명에서 (사급) 제거하고 거래처명 추출
      let companyName = sheetName.replace(/\(사급\)/g, '').trim();
      
      // 특수 케이스 처리
      if (sheetName.includes('풍기서산')) companyName = '풍기서산';
      if (sheetName.includes('세원테크')) companyName = '세원테크';
      if (sheetName.includes('대우포승')) companyName = '대우포승';
      if (sheetName.includes('호원오토')) companyName = '호원오토';
      
      if (companyName) {
        companies.add(companyName);
      }
    }

    // 태창금속 BOM.xlsx의 최신단가 시트에서 거래처 추출
    try {
      const bomWorkbook = readExcelFile(BOM_EXCEL);
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

        const VENDOR_COL = 2; // 거래처명

        for (const row of rows) {
          const vendorName = String(row[VENDOR_COL] || '').trim();
          if (vendorName && vendorName !== '' && vendorName !== '태창금속') {
            companies.add(vendorName);
          }
        }
      }
    } catch (error) {
      // BOM 파일 없어도 계속 진행
    }
  } catch (error: any) {
    console.error(`거래처 추출 오류: ${error.message}`);
  }

  return companies;
}

/**
 * 엑셀에서 모든 품번 추출
 */
function extractAllItemCodesFromExcel(): Set<string> {
  const itemCodes = new Set<string>();

  try {
    const workbook = readExcelFile(INVENTORY_EXCEL);

    // 모든 시트 처리
    for (const sheetName of workbook.SheetNames) {
      try {
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
          blankrows: false
        }) as any[][];

        // 각 시트 구조에 맞게 품번 추출 시도
        // 일반적인 구조: 컬럼 3 또는 5에 품번
        for (const row of rawData) {
          if (!row) continue;

          // 여러 컬럼에서 품번 패턴 찾기 (알파벳+숫자+하이픈 조합)
          for (let col = 0; col < Math.min(10, row.length); col++) {
            const cell = String(row[col] || '').trim();
            if (cell && /^[A-Z0-9-]+[A-Z0-9]$/i.test(cell) && cell.length >= 5 && cell.length <= 20) {
              // 품번 패턴과 비슷하면 추가
              itemCodes.add(cell);
            }
          }
        }
      } catch (error) {
        // 개별 시트 오류는 무시
        continue;
      }
    }

    // BOM 파일의 최신단가 시트에서도 품번 추출
    try {
      const bomWorkbook = readExcelFile(BOM_EXCEL);
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

        for (const row of rows) {
          const itemCode = String(row[ITEM_CODE_COL] || '').trim();
          if (itemCode && itemCode.length >= 3) {
            itemCodes.add(itemCode);
          }
        }
      }
    } catch (error) {
      // BOM 파일 없어도 계속 진행
    }
  } catch (error: any) {
    console.error(`품번 추출 오류: ${error.message}`);
  }

  return itemCodes;
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('누락 데이터 확인');
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

  // Step 2: 엑셀에서 거래처 추출
  logger.startPhase('엑셀에서 거래처 추출');
  const excelCompanies = extractAllCompaniesFromExcel();
  logger.log(`✅ ${excelCompanies.size}개 거래처 추출`, 'success');
  logger.endPhase();

  // Step 3: 데이터베이스의 거래처 조회
  logger.startPhase('데이터베이스 거래처 조회');
  const { data: dbCompanies, error: companyError } = await supabase
    .from('companies')
    .select('company_id, company_code, company_name');

  if (companyError) {
    throw new Error(`거래처 조회 실패: ${companyError.message}`);
  }

  const dbCompanyNames = new Set(dbCompanies?.map(c => c.company_name) || []);
  logger.log(`✅ ${dbCompanyNames.size}개 거래처 존재`, 'success');
  logger.endPhase();

  // Step 4: 누락된 거래처 확인
  logger.startPhase('누락된 거래처 확인');
  const missingCompanies = Array.from(excelCompanies).filter(name => !dbCompanyNames.has(name));
  logger.log(`⚠️  엑셀에 있지만 DB에 없는 거래처: ${missingCompanies.length}개`, 'warn');
  
  if (missingCompanies.length > 0) {
    logger.log('누락된 거래처 목록:', 'warn');
    missingCompanies.slice(0, 20).forEach(name => {
      logger.log(`  - ${name}`, 'warn');
    });
    if (missingCompanies.length > 20) {
      logger.log(`  ... 외 ${missingCompanies.length - 20}개`, 'warn');
    }
  }
  logger.endPhase();

  // Step 5: 엑셀에서 품번 추출
  logger.startPhase('엑셀에서 품번 추출');
  const excelItemCodes = extractAllItemCodesFromExcel();
  logger.log(`✅ ${excelItemCodes.size}개 품번 추출`, 'success');
  logger.endPhase();

  // Step 6: 데이터베이스의 품번 조회
  logger.startPhase('데이터베이스 품번 조회');
  const { data: dbItems, error: itemsError } = await supabase
    .from('items')
    .select('item_id, item_code');

  if (itemsError) {
    throw new Error(`품목 조회 실패: ${itemsError.message}`);
  }

  const dbItemCodes = new Set(dbItems?.map(i => i.item_code) || []);
  logger.log(`✅ ${dbItemCodes.size}개 품목 존재`, 'success');
  logger.endPhase();

  // Step 7: 누락된 품번 확인
  logger.startPhase('누락된 품번 확인');
  const missingItemCodes = Array.from(excelItemCodes).filter(code => !dbItemCodes.has(code));
  logger.log(`⚠️  엑셀에 있지만 DB에 없는 품번: ${missingItemCodes.length}개`, 'warn');
  
  if (missingItemCodes.length > 0) {
    logger.log('누락된 품번 샘플 (최대 20개):', 'warn');
    missingItemCodes.slice(0, 20).forEach(code => {
      logger.log(`  - ${code}`, 'warn');
    });
    if (missingItemCodes.length > 20) {
      logger.log(`  ... 외 ${missingItemCodes.length - 20}개`, 'warn');
    }
  }
  logger.endPhase();

  // Step 8: company_id가 NULL인 거래 확인
  logger.startPhase('company_id가 NULL인 거래 확인');
  const { count: nullCompanyCount, error: transError } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .is('company_id', null);

  if (transError) {
    logger.log(`⚠️  거래 조회 오류: ${transError.message}`, 'warn');
  } else {
    logger.log(`⚠️  company_id가 NULL인 거래: ${nullCompanyCount || 0}개`, 'warn');
    
    if (nullCompanyCount && nullCompanyCount > 0) {
      const { data: sampleTransactions } = await supabase
        .from('inventory_transactions')
        .select('transaction_id, reference_number, transaction_type, item_id')
        .is('company_id', null)
        .limit(10);

      if (sampleTransactions && sampleTransactions.length > 0) {
        logger.log('샘플 거래:', 'warn');
        sampleTransactions.forEach(txn => {
          logger.log(`  - 거래 ID ${txn.transaction_id}: ${txn.reference_number}`, 'warn');
        });
      }
    }
  }
  logger.endPhase();

  // Step 9: supplier_id가 NULL인 품목 확인
  logger.startPhase('supplier_id가 NULL인 품목 확인');
  const { count: nullSupplierCount, error: supplierError } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .is('supplier_id', null);

  if (supplierError) {
    logger.log(`⚠️  품목 조회 오류: ${supplierError.message}`, 'warn');
  } else {
    logger.log(`⚠️  supplier_id가 NULL인 품목: ${nullSupplierCount || 0}개`, 'warn');
  }
  logger.endPhase();

  // Step 10: 결과 요약
  logger.divider('=');
  logger.log('\n📊 누락 데이터 확인 결과\n', 'info');
  
  logger.table({
    '엑셀 거래처': excelCompanies.size,
    'DB 거래처': dbCompanyNames.size,
    '누락된 거래처': missingCompanies.length,
    '엑셀 품번': excelItemCodes.size,
    'DB 품목': dbItemCodes.size,
    '누락된 품번': missingItemCodes.length,
    'company_id NULL 거래': nullCompanyCount || 0,
    'supplier_id NULL 품목': nullSupplierCount || 0
  });

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

