/**
 * 엑셀 파일 전체 데이터 마이그레이션
 *
 * 09월 원자재 수불관리.xlsx의 모든 시트를 분석하여
 * 각 시트 구조에 맞게 데이터를 추출하고 데이터베이스에 삽입합니다.
 *
 * 실행: npx tsx scripts/migration/import-all-excel-data.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/logger';
import { createAdminClient, testConnection, batchInsert } from './utils/supabase-client';
import { Database } from '@/types/supabase';

type Item = Database['public']['Tables']['items']['Insert'];
type InventoryTransaction = Database['public']['Tables']['inventory_transactions']['Insert'];
type Company = Database['public']['Tables']['companies']['Insert'];
type BOM = Database['public']['Tables']['bom']['Insert'];

const EXCEL_FILE_NAME = '09월 원자재 수불관리.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const FILE_PATH = path.join(EXCEL_DIR, EXCEL_FILE_NAME);

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
 * 시트 1-11: 일반 공급사 시트 파싱 (기존 로직)
 */
function parseVendorSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  logger: ReturnType<typeof createLogger>
): { items: Map<string, Item>; transactions: InventoryTransaction[] } {
  const items = new Map<string, Item>();
  const transactions: InventoryTransaction[] = [];

  try {
    // A6부터 데이터 시작 (range: 5 = 인덱스 5)
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      range: 5
    }) as any[][];

    if (rawData.length === 0) return { items, transactions };

    let dataStartRow = 0;
    let itemCodeCol = 3;  // 품번
    let itemNameCol = 4;  // 품명
    let specCol = 6;      // 규격
    let t1Col = 7;        // T1 시작 위치

    // 첫 행 확인
    if (rawData.length > 0) {
      const firstRow = rawData[0];
      const firstCell = String(firstRow[0] || '').toLowerCase().trim();
      
      if (firstCell && isNaN(Number(firstCell)) && 
          (firstCell.includes('품번') || firstCell.includes('품명'))) {
        dataStartRow = 1;
      }
    }

    // 데이터 파싱
    for (let i = dataStartRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || (!row[itemCodeCol] && !row[itemNameCol])) continue;

      const itemCode = String(row[itemCodeCol] || '').trim();
      const itemName = String(row[itemNameCol] || '').trim();
      if (!itemCode || !itemName) continue;

      // 품목 정보
      if (!items.has(itemCode)) {
        items.set(itemCode, {
          item_code: itemCode,
          item_name: itemName,
          spec: specCol < row.length ? String(row[specCol] || '').trim() || null : null,
          unit: 'EA',
          category: '원자재' as const,
          current_stock: 0,
          price: 0,
          is_active: true
        });
      }

      // T1~T268 일별 데이터
      const baseDate = new Date('2025-09-01');
      for (let day = 1; day <= 268; day++) {
        const colIndex = t1Col + day - 1;
        if (colIndex >= row.length) break;

        const value = row[colIndex];
        let quantity = 0;
        if (typeof value === 'number') {
          quantity = value;
        } else if (typeof value === 'string' && value.trim() !== '') {
          const num = Number(value.trim());
          if (!isNaN(num)) quantity = num;
        }

        if (quantity !== 0) {
          const transactionDate = new Date(baseDate);
          transactionDate.setDate(baseDate.getDate() + day - 1);

          transactions.push({
            transaction_date: transactionDate.toISOString().split('T')[0],
            transaction_type: quantity > 0 ? '입고' : '출고',
            item_id: itemCode as any,
            quantity: Math.abs(Math.round(quantity)),
            unit_price: 0,
            total_amount: 0,
            tax_amount: 0,
            grand_total: 0,
            status: '완료' as const,
            reference_number: `AUTO-${sheetName.replace(/[^a-zA-Z0-9가-힣]/g, '-')}-T${day}`,
            description: `${sheetName}에서 자동 생성 (일차: ${day})`
          });
        }
      }
    }

    logger.log(`  ✅ ${sheetName}: ${items.size}개 품목, ${transactions.length}개 거래`, 'success');
  } catch (error: any) {
    logger.log(`  ❌ ${sheetName} 파싱 실패: ${error.message}`, 'error');
  }

  return { items, transactions };
}

/**
 * 재고관리 시트 파싱 (MV1 SV, TAM KA4, DL3 GL3)
 * 구조: 차종 | 완제품 품번 | 완제품 품명 | NO | 업체 | Part NO | Part Name | U/S | 입고수량 | 생산실적 | ...
 */
function parseInventoryManagementSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  logger: ReturnType<typeof createLogger>
): { items: Map<string, Item>; transactions: InventoryTransaction[]; companies: Map<string, Company>; bom: Map<string, BOM> } {
  const items = new Map<string, Item>();
  const transactions: InventoryTransaction[] = [];
  const companies = new Map<string, Company>();
  const bom = new Map<string, BOM>();

  try {
    // 헤더는 2행 (인덱스 1), 데이터는 3행부터
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      range: 1
    }) as any[][];

    if (rawData.length < 2) return { items, transactions, companies, bom };

    let currentVehicle = '';
    let parentItemCode = '';
    let parentItemName = '';

    // 컬럼 인덱스 (헤더 행 기준)
    // 차종=0, 완제품품번=1, 완제품품명=2, NO=3, 업체=4, PartNO=5, PartName=6, U/S=7, 입고수량=8, 생산실적=9
    const VEHICLE_COL = 0;
    const PARENT_CODE_COL = 1;
    const PARENT_NAME_COL = 2;
    const VENDOR_COL = 4;
    const CHILD_CODE_COL = 5;
    const CHILD_NAME_COL = 6;
    const QTY_COL = 7;
    const RECEIVING_COL = 8;
    const PRODUCTION_COL = 9;

    for (let i = 2; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      // 차종 확인 (새로운 완제품인지 확인)
      const vehicle = String(row[VEHICLE_COL] || '').trim();
      if (vehicle && vehicle !== '') {
        currentVehicle = vehicle;
        parentItemCode = String(row[PARENT_CODE_COL] || '').trim();
        parentItemName = String(row[PARENT_NAME_COL] || '').trim();
      }

      // 부품 정보 추출
      const vendorName = String(row[VENDOR_COL] || '').trim();
      const childItemCode = String(row[CHILD_CODE_COL] || '').trim();
      const childItemName = String(row[CHILD_NAME_COL] || '').trim();
      const quantityPer = Number(row[QTY_COL] || 0);
      const receivingQty = Number(row[RECEIVING_COL] || 0);
      const productionQty = Number(row[PRODUCTION_COL] || 0);

      if (!childItemCode || !childItemName) continue;

      // 거래처 추가
      if (vendorName && !companies.has(vendorName)) {
        // 시트명에서 거래처 타입 추론
        let companyType: '고객사' | '공급사' | '협력사' | '기타' = '협력사';
        if (vendorName.includes('사급')) companyType = '공급사';
        
        const companyCode = `COMP-${vendorName.replace(/[^a-zA-Z0-9가-힣]/g, '-').toUpperCase().substring(0, 20)}`;
        companies.set(vendorName, {
          company_code: companyCode,
          company_name: vendorName,
          company_type: companyType,
          is_active: true
        });
      }

      // 부품(자재) 품목 추가
      if (!items.has(childItemCode)) {
        items.set(childItemCode, {
          item_code: childItemCode,
          item_name: childItemName,
          category: '원자재' as const,
          unit: 'EA',
          current_stock: 0,
          price: 0,
          is_active: true
        });
      }

      // 완제품 품목 추가
      if (parentItemCode && !items.has(parentItemCode)) {
        items.set(parentItemCode, {
          item_code: parentItemCode,
          item_name: parentItemName,
          vehicle_model: currentVehicle,
          category: '제품' as const,
          unit: 'EA',
          current_stock: 0,
          price: 0,
          is_active: true
        });
      }

      // BOM 관계 추가
      if (parentItemCode && childItemCode && quantityPer > 0) {
        const bomKey = `${parentItemCode}-${childItemCode}`;
        // 나중에 item_id로 변환 필요
      }

      // 입고 거래 생성
      if (receivingQty > 0) {
        transactions.push({
          transaction_date: '2025-09-01', // 기본값, 실제 날짜는 일별 데이터에서
          transaction_type: '입고',
          item_id: childItemCode as any,
          quantity: Math.round(receivingQty),
          unit_price: 0,
          total_amount: 0,
          tax_amount: 0,
          grand_total: 0,
          status: '완료' as const,
          reference_number: `AUTO-${sheetName}-입고`,
          description: `${sheetName} 입고`
        });
      }

      // 생산출고 거래 생성 (완제품 생산 시 자재 출고)
      if (productionQty > 0 && parentItemCode && childItemCode) {
        const materialQty = Math.round(productionQty * quantityPer);
        transactions.push({
          transaction_date: '2025-09-01',
          transaction_type: '생산출고',
          item_id: childItemCode as any,
          quantity: materialQty,
          unit_price: 0,
          total_amount: 0,
          tax_amount: 0,
          grand_total: 0,
          status: '완료' as const,
          reference_number: `AUTO-${sheetName}-생산출고`,
          description: `${parentItemCode} 생산을 위한 ${childItemCode} 출고`
        });

        // 완제품 생산입고
        transactions.push({
          transaction_date: '2025-09-01',
          transaction_type: '생산입고',
          item_id: parentItemCode as any,
          quantity: Math.round(productionQty),
          unit_price: 0,
          total_amount: 0,
          tax_amount: 0,
          grand_total: 0,
          status: '완료' as const,
          reference_number: `AUTO-${sheetName}-생산입고`,
          description: `${sheetName} 생산입고`
        });
      }
    }

    logger.log(`  ✅ ${sheetName}: ${items.size}개 품목, ${companies.size}개 거래처, ${transactions.length}개 거래`, 'success');
  } catch (error: any) {
    logger.log(`  ❌ ${sheetName} 파싱 실패: ${error.message}`, 'error');
  }

  return { items, transactions, companies, bom };
}

/**
 * 입고현황 시트 파싱 (대우사급, 호원사급, 협력업체 입고현황)
 * 구조: NO | 양산처 | 차종 | P/NO | Part Name | 입고수량 | 이월수량 | 1일 | 2일 | 3일 | ...
 */
function parseReceivingSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  logger: ReturnType<typeof createLogger>
): { items: Map<string, Item>; transactions: InventoryTransaction[]; companies: Map<string, Company> } {
  const items = new Map<string, Item>();
  const transactions: InventoryTransaction[] = [];
  const companies = new Map<string, Company>();

  try {
    // 헤더는 1행 (인덱스 0), 데이터는 3행부터
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      range: 0
    }) as any[][];

    if (rawData.length < 3) return { items, transactions, companies };

    // 컬럼 인덱스
    const VENDOR_COL = 1;   // 양산처
    const VEHICLE_COL = 2;  // 차종
    const ITEM_CODE_COL = 3; // P/NO
    const ITEM_NAME_COL = 4; // Part Name
    const TOTAL_RECV_COL = 5; // 입고수량
    const CARRYOVER_COL = 6;  // 이월수량
    const DATE_START_COL = 7; // 1일 시작 위치

    // 데이터 행 시작 (헤더 2개 행 건너뛰기)
    for (let i = 2; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const vendorName = String(row[VENDOR_COL] || '').trim();
      const vehicleModel = String(row[VEHICLE_COL] || '').trim();
      const itemCode = String(row[ITEM_CODE_COL] || '').trim();
      const itemName = String(row[ITEM_NAME_COL] || '').trim();
      const totalReceiving = Number(row[TOTAL_RECV_COL] || 0);
      const carryover = Number(row[CARRYOVER_COL] || 0);

      if (!itemCode || !itemName) continue;

      // 거래처 추가
      if (vendorName && !companies.has(vendorName)) {
        const companyCode = `COMP-${vendorName.replace(/[^a-zA-Z0-9가-힣]/g, '-').toUpperCase().substring(0, 20)}`;
        companies.set(vendorName, {
          company_code: companyCode,
          company_name: vendorName,
          company_type: '공급사' as const,
          is_active: true
        });
      }

      // 품목 추가
      if (!items.has(itemCode)) {
        items.set(itemCode, {
          item_code: itemCode,
          item_name: itemName,
          vehicle_model: vehicleModel || null,
          category: '원자재' as const,
          unit: 'EA',
          current_stock: carryover || 0,
          price: 0,
          is_active: true
        });
      }

      // 일별 입고 데이터 처리
      const baseDate = new Date('2025-09-01');
      for (let day = 1; day <= 350; day++) {
        const colIndex = DATE_START_COL + day - 1;
        if (colIndex >= row.length) break;

        const value = row[colIndex];
        let quantity = 0;
        if (typeof value === 'number') {
          quantity = value;
        } else if (typeof value === 'string' && value.trim() !== '') {
          const num = Number(value.trim());
          if (!isNaN(num)) quantity = num;
        }

        if (quantity > 0) {
          const transactionDate = new Date(baseDate);
          transactionDate.setDate(baseDate.getDate() + day - 1);

          transactions.push({
            transaction_date: transactionDate.toISOString().split('T')[0],
            transaction_type: '입고',
            item_id: itemCode as any,
            company_id: vendorName ? (vendorName as any) : null, // 나중에 company_id로 변환
            quantity: Math.round(quantity),
            unit_price: 0,
            total_amount: 0,
            tax_amount: 0,
            grand_total: 0,
            status: '완료' as const,
            reference_number: `AUTO-${sheetName.replace(/[^a-zA-Z0-9가-힣]/g, '-')}-D${day}`,
            description: `${sheetName} 입고 (${day}일차)`
          });
        }
      }
    }

    logger.log(`  ✅ ${sheetName}: ${items.size}개 품목, ${companies.size}개 거래처, ${transactions.length}개 거래`, 'success');
  } catch (error: any) {
    logger.log(`  ❌ ${sheetName} 파싱 실패: ${error.message}`, 'error');
  }

  return { items, transactions, companies };
}

/**
 * 태창금속 (전착도장) 시트 파싱
 * 구조: 차종 | 업체 | 품번 | 품명 | 기초 재고 | 구분 | 당월누계 | 날짜별 컬럼 (781열!)
 */
function parseCoatingSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  logger: ReturnType<typeof createLogger>
): { items: Map<string, Item>; transactions: InventoryTransaction[]; companies: Map<string, Company> } {
  const items = new Map<string, Item>();
  const transactions: InventoryTransaction[] = [];
  const companies = new Map<string, Company>();

  try {
    // 헤더는 3행 (인덱스 2), 데이터는 5행부터
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      range: 2
    }) as any[][];

    if (rawData.length < 3) return { items, transactions, companies };

    // 컬럼 인덱스
    const VEHICLE_COL = 0;
    const VENDOR_COL = 1;
    const ITEM_CODE_COL = 2;
    const ITEM_NAME_COL = 3;
    const OPENING_STOCK_COL = 4;
    const DATE_START_COL = 6; // 당월누계 이후

    for (let i = 2; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const vehicleModel = String(row[VEHICLE_COL] || '').trim();
      const vendorName = String(row[VENDOR_COL] || '').trim();
      const itemCode = String(row[ITEM_CODE_COL] || '').trim();
      const itemName = String(row[ITEM_NAME_COL] || '').trim();
      const openingStock = Number(row[OPENING_STOCK_COL] || 0);

      if (!itemCode || !itemName) continue;

      // 거래처 추가
      if (vendorName && !companies.has(vendorName)) {
        const companyCode = `COMP-${vendorName.replace(/[^a-zA-Z0-9가-힣]/g, '-').toUpperCase().substring(0, 20)}`;
        companies.set(vendorName, {
          company_code: companyCode,
          company_name: vendorName,
          company_type: '협력사' as const,
          is_active: true
        });
      }

      // 품목 추가
      if (!items.has(itemCode)) {
        items.set(itemCode, {
          item_code: itemCode,
          item_name: itemName,
          vehicle_model: vehicleModel || null,
          category: '제품' as const,
          unit: 'EA',
          current_stock: openingStock || 0,
          price: 0,
          is_active: true
        });
      }

      // 날짜별 데이터 처리 (약 775일치)
      const baseDate = new Date('2025-08-31'); // 첫날이 8월 31일
      for (let day = 0; day < 775; day++) {
        const colIndex = DATE_START_COL + day;
        if (colIndex >= row.length) break;

        const value = row[colIndex];
        let quantity = 0;
        if (typeof value === 'number') {
          quantity = value;
        } else if (typeof value === 'string' && value.trim() !== '') {
          const num = Number(value.trim());
          if (!isNaN(num)) quantity = num;
        }

        if (quantity !== 0) {
          const transactionDate = new Date(baseDate);
          transactionDate.setDate(baseDate.getDate() + day);

          transactions.push({
            transaction_date: transactionDate.toISOString().split('T')[0],
            transaction_type: quantity > 0 ? '입고' : '출고',
            item_id: itemCode as any,
            company_id: vendorName ? (vendorName as any) : null,
            quantity: Math.abs(Math.round(quantity)),
            unit_price: 0,
            total_amount: 0,
            tax_amount: 0,
            grand_total: 0,
            status: '완료' as const,
            reference_number: `AUTO-${sheetName.replace(/[^a-zA-Z0-9가-힣]/g, '-')}-D${day + 1}`,
            description: `${sheetName} 거래 (${day + 1}일차)`
          });
        }
      }
    }

    logger.log(`  ✅ ${sheetName}: ${items.size}개 품목, ${companies.size}개 거래처, ${transactions.length}개 거래`, 'success');
  } catch (error: any) {
    logger.log(`  ❌ ${sheetName} 파싱 실패: ${error.message}`, 'error');
  }

  return { items, transactions, companies };
}

/**
 * 실적 취합 시트 파싱
 * 구조: NO | 차종 | P/NO | Part Name | 생산실적 합계 | 1일 | 2일 | 3일 | ...
 */
function parseProductionSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  logger: ReturnType<typeof createLogger>
): { items: Map<string, Item>; transactions: InventoryTransaction[] } {
  const items = new Map<string, Item>();
  const transactions: InventoryTransaction[] = [];

  try {
    // 헤더는 2행 (인덱스 1), 데이터는 3행부터
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      range: 1
    }) as any[][];

    if (rawData.length < 2) return { items, transactions };

    const VEHICLE_COL = 1;
    const ITEM_CODE_COL = 2;
    const ITEM_NAME_COL = 3;
    const DATE_START_COL = 5; // 생산실적 합계 이후

    for (let i = 2; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const vehicleModel = String(row[VEHICLE_COL] || '').trim();
      const itemCode = String(row[ITEM_CODE_COL] || '').trim();
      const itemName = String(row[ITEM_NAME_COL] || '').trim();

      if (!itemCode || !itemName) continue;

      // 완제품 추가
      if (!items.has(itemCode)) {
        items.set(itemCode, {
          item_code: itemCode,
          item_name: itemName,
          vehicle_model: vehicleModel || null,
          category: '제품' as const,
          unit: 'EA',
          current_stock: 0,
          price: 0,
          is_active: true
        });
      }

      // 일별 생산실적 처리
      const baseDate = new Date('2025-09-01');
      for (let day = 1; day <= 300; day++) {
        const colIndex = DATE_START_COL + day - 1;
        if (colIndex >= row.length) break;

        const value = row[colIndex];
        let quantity = 0;
        if (typeof value === 'number') {
          quantity = value;
        } else if (typeof value === 'string' && value.trim() !== '') {
          const num = Number(value.trim());
          if (!isNaN(num)) quantity = num;
        }

        if (quantity > 0) {
          const transactionDate = new Date(baseDate);
          transactionDate.setDate(baseDate.getDate() + day - 1);

          transactions.push({
            transaction_date: transactionDate.toISOString().split('T')[0],
            transaction_type: '생산입고',
            item_id: itemCode as any,
            quantity: Math.round(quantity),
            unit_price: 0,
            total_amount: 0,
            tax_amount: 0,
            grand_total: 0,
            status: '완료' as const,
            reference_number: `AUTO-${sheetName.replace(/[^a-zA-Z0-9가-힣]/g, '-')}-D${day}`,
            description: `${sheetName} 생산실적 (${day}일차)`
          });
        }
      }
    }

    logger.log(`  ✅ ${sheetName}: ${items.size}개 품목, ${transactions.length}개 거래`, 'success');
  } catch (error: any) {
    logger.log(`  ❌ ${sheetName} 파싱 실패: ${error.message}`, 'error');
  }

  return { items, transactions };
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('전체 엑셀 마이그레이션');
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
  logger.startPhase('엑셀 파일 읽기');
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

  // Step 3: 각 시트별 파싱
  logger.startPhase('엑셀 데이터 파싱');
  const allItems = new Map<string, Item>();
  const allTransactions: InventoryTransaction[] = [];
  const allCompanies = new Map<string, Company>();

  // 시트별 파싱
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    
    // 시트 타입별 파싱
    if (sheetName.includes('MV1') || sheetName.includes('SV') || 
        sheetName.includes('TAM') || sheetName.includes('KA4') || 
        sheetName.includes('DL3') || sheetName.includes('GL3')) {
      // 재고관리 시트
      const { items, transactions, companies } = parseInventoryManagementSheet(worksheet, sheetName, logger);
      items.forEach((item, code) => allItems.set(code, item));
      allTransactions.push(...transactions);
      companies.forEach((company, name) => allCompanies.set(name, company));
    } else if (sheetName.includes('입고현황')) {
      // 입고현황 시트
      const { items, transactions, companies } = parseReceivingSheet(worksheet, sheetName, logger);
      items.forEach((item, code) => allItems.set(code, item));
      allTransactions.push(...transactions);
      companies.forEach((company, name) => allCompanies.set(name, company));
    } else if (sheetName.includes('전착도장')) {
      // 전착도장 시트
      const { items, transactions, companies } = parseCoatingSheet(worksheet, sheetName, logger);
      items.forEach((item, code) => allItems.set(code, item));
      allTransactions.push(...transactions);
      companies.forEach((company, name) => allCompanies.set(name, company));
    } else if (sheetName.includes('실적 취합')) {
      // 생산실적 시트
      const { items, transactions } = parseProductionSheet(worksheet, sheetName, logger);
      items.forEach((item, code) => allItems.set(code, item));
      allTransactions.push(...transactions);
    } else {
      // 일반 공급사 시트
      const { items, transactions } = parseVendorSheet(worksheet, sheetName, logger);
      items.forEach((item, code) => allItems.set(code, item));
      allTransactions.push(...transactions);
    }
  });

  logger.log(`\n총 ${allItems.size}개 품목, ${allCompanies.size}개 거래처, ${allTransactions.length}개 거래 추출`, 'success');
  logger.endPhase();

  // Step 4: 거래처 데이터 삽입
  logger.startPhase('거래처 데이터 삽입');
  const companiesArray = Array.from(allCompanies.values());
  
  if (companiesArray.length > 0) {
    const result = await batchInsert(supabase, 'companies', companiesArray, 100, (current, total) => {
      logger.progress(current, total, 'companies');
    });
    logger.log(`✅ 거래처 삽입 완료: ${result.success}개 성공, ${result.failed}개 실패`, 'success');
    if (result.errors.length > 0) {
      logger.log(`⚠️  오류: ${result.errors.length}개`, 'warn');
      result.errors.slice(0, 3).forEach(err => logger.log(`  - ${err.error}`, 'error'));
    }
  } else {
    logger.log('삽입할 거래처가 없습니다', 'info');
  }
  logger.endPhase();

  // Step 5: 품목 데이터 삽입
  logger.startPhase('품목 데이터 삽입');
  const itemsArray = Array.from(allItems.values());
  
  if (itemsArray.length > 0) {
    const result = await batchInsert(supabase, 'items', itemsArray, 100, (current, total) => {
      logger.progress(current, total, 'items');
    });
    logger.log(`✅ 품목 삽입 완료: ${result.success}개 성공, ${result.failed}개 실패`, 'success');
    if (result.errors.length > 0) {
      logger.log(`⚠️  오류: ${result.errors.length}개`, 'warn');
      result.errors.slice(0, 3).forEach(err => logger.log(`  - ${err.error}`, 'error'));
    }
  }
  logger.endPhase();

  // Step 6: 매핑 생성
  logger.startPhase('코드 → ID 매핑 생성');
  
  // 거래처 매핑
  const { data: insertedCompanies } = await supabase
    .from('companies')
    .select('company_id, company_code, company_name');
  
  const companyNameToIdMap = new Map<string, number>();
  insertedCompanies?.forEach(company => {
    companyNameToIdMap.set(company.company_name, company.company_id);
  });

  // 품목 매핑
  const { data: insertedItems } = await supabase
    .from('items')
    .select('item_id, item_code');

  const itemCodeToIdMap = new Map<string, number>();
  insertedItems?.forEach(item => {
    itemCodeToIdMap.set(item.item_code, item.item_id);
  });

  logger.log(`${companyNameToIdMap.size}개 거래처, ${itemCodeToIdMap.size}개 품목 매핑 생성 완료`, 'success');
  logger.endPhase();

  // Step 7: 거래 데이터 삽입
  logger.startPhase('재고 거래 데이터 삽입');
  
  const validTransactions = allTransactions
    .map(t => {
      // item_id 변환
      const itemId = typeof t.item_id === 'string' ? itemCodeToIdMap.get(t.item_id) : t.item_id;
      if (!itemId) return null;

      // company_id 변환
      let companyId: number | null = null;
      if (t.company_id && typeof t.company_id === 'string') {
        companyId = companyNameToIdMap.get(t.company_id) || null;
      } else {
        companyId = t.company_id as number | null;
      }

      return {
        ...t,
        item_id: itemId,
        company_id: companyId
      } as InventoryTransaction;
    })
    .filter((t): t is InventoryTransaction => t !== null);

  logger.log(`유효한 거래: ${validTransactions.length}개 (전체: ${allTransactions.length}개)`, 'info');

  if (validTransactions.length > 0) {
    const result = await batchInsert(
      supabase,
      'inventory_transactions',
      validTransactions,
      100,
      (current, total) => {
        logger.progress(current, total, 'inventory_transactions');
      }
    );
    logger.log(`✅ 거래 삽입 완료: ${result.success}개 성공, ${result.failed}개 실패`, 'success');
    if (result.errors.length > 0) {
      logger.log(`⚠️  오류: ${result.errors.length}개`, 'warn');
      result.errors.slice(0, 3).forEach(err => logger.log(`  - ${err.error}`, 'error'));
    }
  }
  logger.endPhase();

  // Step 8: 결과 요약
  logger.divider('=');
  logger.log('\n📊 마이그레이션 결과 요약\n', 'info');
  
  logger.table({
    '전체 시트 수': workbook.SheetNames.length,
    '추출된 품목': allItems.size,
    '추출된 거래처': allCompanies.size,
    '추출된 거래': allTransactions.length,
    '삽입된 품목': itemsArray.length,
    '삽입된 거래처': companiesArray.length,
    '삽입된 거래': validTransactions.length
  });

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

