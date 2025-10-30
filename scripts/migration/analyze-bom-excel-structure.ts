/**
 * BOM 엑셀 파일 구조 분석
 * 
 * 단가, 단위, 재료비 등의 컬럼 위치를 확인합니다.
 * 
 * 실행: npx tsx scripts/migration/analyze-bom-excel-structure.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const BOM_EXCEL_FILE = '태창금속 BOM.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const FILE_PATH = path.join(EXCEL_DIR, BOM_EXCEL_FILE);

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

function analyzeSheet(workbook: XLSX.WorkBook, sheetName: string) {
  console.log(`\n=== 시트: ${sheetName} ===\n`);
  
  const worksheet = workbook.Sheets[sheetName];
  
  // A1부터 A20까지 헤더 행 확인
  console.log('헤더 행 (A1~T20):');
  for (let row = 1; row <= 20; row++) {
    const values: string[] = [];
    for (let col = 0; col < 20; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: row - 1, c: col });
      const cell = worksheet[cellAddr];
      values.push(cell ? (cell.v?.toString() || '') : '');
    }
    console.log(`행 ${row}: [${values.join(', ')}]`);
  }
  
  // A6부터 실제 데이터 샘플 확인 (10개 행)
  console.log('\n데이터 샘플 (A6부터 10개 행):');
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    blankrows: false,
    range: 5 // A6부터
  }) as any[][];

  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i];
    if (!row) continue;
    
    const values: string[] = [];
    for (let col = 0; col < 20; col++) {
      values.push(row[col]?.toString().substring(0, 15) || '');
    }
    console.log(`데이터 행 ${i + 6}: [${values.join(', ')}]`);
  }
}

function main() {
  try {
    const workbook = readExcelFile();
    const bomSheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
    
    for (const sheetName of bomSheets) {
      if (workbook.SheetNames.includes(sheetName)) {
        analyzeSheet(workbook, sheetName);
        break; // 첫 번째 시트만 분석
      }
    }
  } catch (error: any脑血管) {
    console.error('오류:', error.message);
    process.exit(1);
  }
}

main();

