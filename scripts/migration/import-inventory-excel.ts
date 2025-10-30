/**
 * 원자재 수불관리 엑셀 파일 마이그레이션
 *
 * XLSX 라이브러리를 사용하여 엑셀 파일을 읽고 Supabase에 데이터를 삽입합니다.
 * - 09월 원자재 수불관리.xlsx
 * - 품목 정보 추출 및 items 테이블에 삽입
 * - T1~T268 일별 데이터를 inventory_transactions로 변환
 *
 * 실행: npx tsx scripts/migration/import-inventory-excel.ts
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

const EXCEL_FILE_NAME = '09월 원자재 수불관리.xlsx';
const PROJECT_ID = 'pybjnkbmtlyaftuiieyq';

/**
 * CSV 문자열을 2D 배열로 파싱
 */
function parseCsvToArray(csv: string): any[][] {
  if (!csv || csv.trim() === '') return [];
  
  const lines = csv.trim().split('\n');
  return lines.map(line => {
    const values = line.split(',');
    return values.map(v => {
      const trimmed = v.trim();
      // 숫자 변환 시도
      if (trimmed && !isNaN(Number(trimmed)) && trimmed !== '') {
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      }
      return trimmed || '';
    });
  });
}

/**
 * 엑셀 시트 목록 (기존 코드에서 확인된 시트)
 */
function getSheetNames(): string[] {
  // 기존 파싱 코드에서 확인된 시트 목록
  return [
    '풍기서산(사급)', '세원테크(사급)', '대우포승(사급)', '호원오토(사급)',
    '웅지테크', '태영금속', 'JS테크', '에이오에스', '창경테크', '신성테크',
    '광성산업', 'MV1', 'SV', 'TAM', 'KA4', '인알파', 'DL3', 'GL3',
    '대우사급 입고현황', '호원사급 입고현황', '협력업체 입고현황'
  ];
}

/**
 * XLSX 라이브러리를 사용하여 엑셀 파일 읽기
 */
function readExcelFile(filename: string): XLSX.WorkBook {
  const excelDir = path.resolve(process.cwd(), '.example');
  const filePath = path.join(excelDir, filename);

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
 * 엑셀 시트에서 품목 정보 및 일별 데이터 파싱
 * 기존 코드 기준: 품번=컬럼3, 품명=컬럼4, 규격=컬럼6, 헤더=6행
 */
async function parseSheetData(
  sheetName: string,
  logger: ReturnType<typeof createLogger>
): Promise<{ items: Map<string, Item>; transactions: InventoryTransaction[] }> {
  const items = new Map<string, Item>();
  const transactions: InventoryTransaction[] = [];

  try {
    // XLSX 라이브러리로 엑셀 파일 읽기
    const workbook = readExcelFile(EXCEL_FILE_NAME);
    
    // 시트 존재 확인
    if (!workbook.SheetNames.includes(sheetName)) {
      logger.log(`  ⚠️  ${sheetName}: 시트를 찾을 수 없음`, 'warn');
      return { items, transactions };
    }

    const worksheet = workbook.Sheets[sheetName];
    
    // 엑셀 데이터를 JSON 배열로 변환 (A6 행부터 시작)
    // 헤더 행 스킵을 위해 range 옵션 사용
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // 배열 형태로 반환
      defval: null,
      blankrows: false,
      range: 5 // A6부터 읽기 (인덱스 5 = 6행)
    }) as any[][];

    const rows = rawData;
    
    if (rows.length === 0) {
      logger.log(`  ⚠️  ${sheetName}: 데이터 없음`, 'warn');
      return { items, transactions };
    }

    // 기존 코드 기준 컬럼 인덱스
    // 첫 번째 행이 헤더 또는 데이터 시작
    // 품번=컬럼3 (인덱스 3), 품명=컬럼4 (인덱스 4), 규격=컬럼6 (인덱스 6)
    // T1은 대략 컬럼 7 이후 (실제 위치 확인 필요)
    
    // 헤더 행 찾기 또는 첫 번째 행이 데이터인지 확인
    let dataStartRow = 0;
    let itemCodeCol = 3;  // 기본값
    let itemNameCol = 4;  // 기본값
    let specCol = 6;      // 기본값
    let t1Col = 7;        // T1 시작 컬럼 (추정)

    // 첫 행 확인하여 헤더인지 데이터인지 판단
    // range: 5로 설정했으므로 첫 번째 행(row[0])이 실제로는 A6 행
    if (rows.length > 0) {
      const firstRow = rows[0];
      const firstCell = String(firstRow[0] || '').toLowerCase().trim();
      
      // 헤더 패턴 감지 (품번, 품명 등의 텍스트)
      if (firstCell && isNaN(Number(firstCell)) && 
          (firstCell.includes('품번') || firstCell.includes('품명') || firstCell.includes('번호'))) {
        dataStartRow = 1; // 다음 행부터 데이터
      }

      // T 컬럼 찾기 (T1, T2, ...)
      // 첫 행이 헤더인 경우와 데이터인 경우 모두 확인
      const searchRow = dataStartRow > 0 ? rows[0] : rows[0];
      for (let j = 0; j < Math.min(300, searchRow.length); j++) {
        const cell = String(searchRow[j] || '').toUpperCase().trim();
        if (cell === 'T1' || cell === 'T 1' || /^T\s*\d+$/.test(cell)) {
          t1Col = j;
          break;
        }
      }
      
      // T1을 찾지 못했으면 기본값 사용 (컬럼 7부터)
      if (t1Col === 7) {
        logger.log(`  ℹ️  ${sheetName}: T1 컬럼을 찾지 못해 기본 위치(컬럼 7) 사용`, 'info');
      }
    }

    // 데이터 행 파싱
    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i];
      
      // 빈 행 스킵
      if (row.length === 0 || (!row[itemCodeCol] && !row[itemNameCol])) continue;

      const itemCode = String(row[itemCodeCol] || '').trim();
      const itemName = String(row[itemNameCol] || '').trim();

      // 필수 필드 확인
      if (!itemCode && !itemName) continue;
      if (!itemCode || !itemName) {
        continue; // 필수 필드 없으면 스킵
      }

      // 품목 정보 생성
      const item: Item = {
        item_code: itemCode,
        item_name: itemName,
        spec: specCol < row.length ? String(row[specCol] || '').trim() || null : null,
        unit: 'EA', // 기본값 (엑셀에 단위 컬럼이 있으면 추가)
        category: '원자재' as const,
        current_stock: 0,
        price: 0,
        is_active: true
      };

      // 중복 방지
      if (!items.has(itemCode)) {
        items.set(itemCode, item);
      }

      // T1~T268 일별 데이터 처리
      // 기준 날짜: 2025년 9월 1일 (09월 원자재 수불관리)
      const baseDate = new Date('2025-09-01');
      
      for (let day = 1; day <= 268; day++) {
        const colIndex = t1Col + day - 1;
        if (colIndex >= row.length) break;

        const value = row[colIndex];
        let quantity = 0;
        
        // 숫자 변환
        if (typeof value === 'number') {
          quantity = value;
        } else if (typeof value === 'string' && value.trim() !== '') {
          const num = Number(value.trim());
          if (!isNaN(num)) quantity = num;
        }

        // 값이 있으면 거래 생성
        if (quantity !== 0) {
          const transactionDate = new Date(baseDate);
          transactionDate.setDate(baseDate.getDate() + day - 1);
          
          // 날짜 문자열 형식 (YYYY-MM-DD)
          const dateStr = transactionDate.toISOString().split('T')[0];

          transactions.push({
            transaction_date: dateStr,
            transaction_type: quantity > 0 ? '입고' : '출고',
            item_id: itemCode as any, // 임시로 item_code 저장, 나중에 item_id로 변환
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

    logger.log(`  ✅ ${sheetName}: ${items.size}개 품목, ${transactions.length}개 거래 추출`, 'success');
  } catch (error: any) {
    logger.log(`  ❌ ${sheetName} 파싱 실패: ${error.message}`, 'error');
    logger.log(`     상세: ${error.stack}`, 'error');
  }

  return { items, transactions };
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('엑셀 마이그레이션');
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

  // Step 2: 엑셀 파일 구조 분석
  logger.startPhase('엑셀 파일 구조 분석');
  const sheetNames = getSheetNames();
  logger.log(`${sheetNames.length}개 시트 예정: ${sheetNames.slice(0, 5).join(', ')}...`, 'info');
  logger.endPhase();

  // Step 3: 엑셀 데이터 파싱
  logger.startPhase('엑셀 데이터 파싱');
  const allItems = new Map<string, Item>();
  const allTransactions: InventoryTransaction[] = [];

  for (const sheetName of sheetNames) {
    const { items, transactions } = await parseSheetData(sheetName, logger);
    
    // 품목 합치기 (중복 제거)
    items.forEach((item, code) => {
      if (!allItems.has(code)) {
        allItems.set(code, item);
      }
    });

    allTransactions.push(...transactions);
  }

  logger.log(`\n총 ${allItems.size}개 품목, ${allTransactions.length}개 거래 추출`, 'success');
  logger.endPhase();

  // Step 4: 품목 데이터 삽입
  logger.startPhase('품목 데이터 삽입');
  const itemsArray = Array.from(allItems.values());
  
  if (itemsArray.length > 0) {
    const result = await batchInsert(supabase, 'items', itemsArray, 100, (current, total) => {
      logger.progress(current, total, 'items');
    });

    logger.log(`✅ 품목 삽입 완료: ${result.success}개 성공, ${result.failed}개 실패`, 'success');
    
    if (result.errors.length > 0) {
      logger.log(`⚠️  오류 발생: ${result.errors.length}개`, 'warn');
      result.errors.slice(0, 5).forEach(err => {
        logger.log(`  - ${err.error}`, 'error');
      });
    }
  } else {
    logger.log('삽입할 품목이 없습니다', 'warn');
  }
  logger.endPhase();

  // Step 5: 품목 코드 → ID 매핑 생성
  logger.startPhase('품목 코드 → ID 매핑 생성');
  const { data: insertedItems, error: fetchError } = await supabase
    .from('items')
    .select('item_id, item_code');

  if (fetchError) {
    logger.log(`❌ 품목 조회 실패: ${fetchError.message}`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  const itemCodeToIdMap = new Map<string, number>();
  insertedItems?.forEach(item => {
    itemCodeToIdMap.set(item.item_code, item.item_id);
  });

  logger.log(`${itemCodeToIdMap.size}개 품목 매핑 생성 완료`, 'success');
  logger.endPhase();

  // Step 6: 거래 데이터 삽입 (item_code → item_id 변환)
  logger.startPhase('재고 거래 데이터 삽입');
  
  const validTransactions = allTransactions
    .map(t => {
      const itemId = itemCodeToIdMap.get(t.item_id as string);
      if (!itemId) {
        return null; // 매핑되지 않은 품목은 제외
      }
      return {
        ...t,
        item_id: itemId
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
      logger.log(`⚠️  오류 발생: ${result.errors.length}개`, 'warn');
      result.errors.slice(0, 5).forEach(err => {
        logger.log(`  - ${err.error}`, 'error');
      });
    }
  } else {
    logger.log('삽입할 거래가 없습니다', 'warn');
  }
  logger.endPhase();

  // Step 7: 결과 요약
  logger.divider('=');
  logger.log('\n📊 마이그레이션 결과 요약\n', 'info');
  
  logger.table({
    '파싱된 시트': sheetNames.length,
    '추출된 품목': allItems.size,
    '추출된 거래': allTransactions.length,
    '삽입된 품목': itemsArray.length,
    '삽입된 거래': validTransactions.length
  });

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

