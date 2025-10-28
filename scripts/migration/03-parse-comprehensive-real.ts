/**
 * 실제 Excel 데이터 파싱 (종합관리 SHEET)
 * 
 * "2025년 9월 종합관리 SHEET.xlsx" 파일에서
 * 시트: "종합재고"
 * 컬럼: 거래처, 차종, 완제품 품번, 부 번, 품 명, 재질, 규격, 두께, 가로, 세로, 비 중, 재고현황 등
 * 
 * 실행: npx tsx scripts/migration/03-parse-comprehensive-real.ts
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './utils/logger';

// Excel 파일 경로
const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const EXCEL_FILE = '2025년 9월 종합관리 SHEET.xlsx';
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/migration/data');

interface ParsedItem {
  company_name: string;      // 거래처
  vehicle_model: string;     // 차종
  item_code: string;         // 완제품 품번 또는 부 번
  item_name: string;         // 품 명
  material: string;          // 재질
  spec: string;              // 규격
  thickness?: number;        // 두께
  width?: number;           // 가로
  height?: number;          // 세로
  specific_gravity?: number; // 비 중
  current_stock?: number;   // 재고현황
}

/**
 * Excel 시트의 병합 셀 구조 파악 및 실제 헤더 찾기
 */
function findHeaderRow(worksheet: XLSX.WorkSheet, maxSearchRows: number = 10): number {
  // 첫 N개 행을 읽어서 헤더 패턴 찾기
  for (let row = 1; row <= maxSearchRows; row++) {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const testRange = XLSX.utils.encode_range({ ...range, e: { ...range.e, r: row } });
    
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      range: testRange,
      header: 1 
    });
    
    if (data.length > 0) {
      const firstRow = data[0] as any[];
      // "거래처", "차종", "품번", "품명" 등 키워드가 있는지 확인
      const hasKeywords = firstRow.some((cell: any) => {
        const str = String(cell).toLowerCase();
        return str.includes('거래처') || str.includes('차종') || str.includes('품번') || str.includes('품명');
      });
      
      if (hasKeywords) {
        return row;
      }
    }
  }
  
  return 1; // 기본값
}

/**
 * 데이터 행 추출 (병합 셀 처리)
 */
function parseDataRows(worksheet: XLSX.WorkSheet, headerRow: number): ParsedItem[] {
  const items: ParsedItem[] = [];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  // 헤더 추출
  const headerData = XLSX.utils.sheet_to_json(worksheet, { 
    range: { s: { r: headerRow - 1, c: 0 }, e: { r: headerRow - 1, c: range.e.c } },
    header: 1 
  });
  
  const headers = (headerData[0] as any[]).map((h: any) => String(h).trim());
  console.log('📋 발견된 컬럼:', headers);
  
  // 데이터 행 읽기 (헤더 다음 행부터)
  for (let row = headerRow; row <= range.e.r; row++) {
    const rowData: any = {};
    
    try {
      // 각 셀의 실제 값 읽기
      for (let col = 0; col <= range.e.c; col++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (cell) {
          const colName = headers[col] || '';
          rowData[colName] = cell.v;
        }
      }
      
      // 필수 필드 체크
      const companyName = String(rowData['거래처'] || '').trim();
      const itemCode = String(rowData['완제품 품번'] || rowData['부 번'] || '').trim();
      const itemName = String(rowData['품 명'] || '').trim();
      const vehicleModel = String(rowData['차 종'] || '').trim();
      
      // 빈 행 스킵
      if (!companyName && !itemCode && !itemName) continue;
      
      // 최소한의 필수 정보가 있는 행만 처리
      if (itemCode || itemName) {
        const item: ParsedItem = {
          company_name: companyName || undefined,
          vehicle_model: vehicleModel || undefined,
          item_code: itemCode || itemName, // 품번이 없으면 품명 사용
          item_name: itemName || itemCode,
          material: String(rowData['재질'] || '').trim() || undefined,
          spec: String(rowData['규격'] || '').trim() || undefined,
          thickness: parseFloat(rowData['두께']) || undefined,
          width: parseFloat(rowData['가로']) || undefined,
          height: parseFloat(rowData['세로']) || undefined,
          specific_gravity: parseFloat(rowData['비 중'] || rowData['비중']) || undefined,
          current_stock: parseFloat(rowData['재고현황'] || rowData['MM중량']) || undefined
        };
        
        items.push(item);
      }
    } catch (error) {
      // 개별 행 오류 무시하고 계속 진행
      continue;
    }
  }
  
  return items;
}

async function main() {
  const logger = createLogger('종합관리 실데이터 파싱');
  logger.startMigration();

  try {
    const filePath = path.join(EXCEL_DIR, EXCEL_FILE);
    
    if (!fs.existsSync(filePath)) {
      logger.log(`❌ 파일 없음: ${filePath}`, 'error');
      process.exit(1);
    }
    
    logger.log('📄 Excel 파일 읽기...', 'info');
    const workbook = XLSX.readFile(filePath, { 
      cellDates: true,
      cellFormula: true, // 수식 포함
      dense: false
    });
    
    logger.log(`시트: ${workbook.SheetNames.join(', ')}`, 'info');
    
    // 종합재고 시트 찾기
    const sheetName = '종합재고';
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      logger.log(`❌ 시트 없음: ${sheetName}`, 'error');
      process.exit(1);
    }
    
    logger.log(`\n📋 ${sheetName} 시트 파싱 중...`, 'info');
    
    // 헤더 행 찾기
    const headerRow = findHeaderRow(worksheet);
    logger.log(`헤더 행: ${headerRow}`, 'info');
    
    // 데이터 파싱
    const items = parseDataRows(worksheet, headerRow);
    
    logger.log(`✅ 파싱 완료: ${items.length}개 아이템`, 'success');
    
    // 결과 저장
    const outputData = {
      success: true,
      sheet: sheetName,
      headerRow,
      count: items.length,
      items
    };
    
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    const outputPath = path.join(OUTPUT_DIR, 'parsed-comprehensive-real.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    
    logger.log(`💾 저장 완료: ${outputPath}`, 'success');
    
    // 샘플 출력
    if (items.length > 0) {
      logger.log('\n📝 샘플 데이터 (처음 3개):', 'info');
      items.slice(0, 3).forEach((item, idx) => {
        logger.log(`  ${idx + 1}. ${item.item_name} (${item.item_code})`, 'info');
        logger.log(`     거래처: ${item.company_name}, 차종: ${item.vehicle_model}`, 'info');
      });
    }
    
    logger.endMigration(true);
  } catch (error: any) {
    logger.log(`❌ 오류: ${error.message}`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }
}

main();

