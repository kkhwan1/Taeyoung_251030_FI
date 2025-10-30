/**
 * 엑셀 파일의 모든 시트 분석
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_FILE_NAME = '09월 원자재 수불관리.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const FILE_PATH = path.join(EXCEL_DIR, EXCEL_FILE_NAME);

if (!fs.existsSync(FILE_PATH)) {
  console.error(`파일을 찾을 수 없습니다: ${FILE_PATH}`);
  process.exit(1);
}

console.log('엑셀 파일 읽기 중...\n');
const workbook = XLSX.readFile(FILE_PATH, {
  type: 'file',
  cellDates: true
});

console.log(`전체 시트 수: ${workbook.SheetNames.length}\n`);
console.log('=== 시트 목록 ===\n');

workbook.SheetNames.forEach((sheetName, index) => {
  const worksheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const rowCount = range.e.r + 1;
  const colCount = range.e.c + 1;
  
  // 첫 몇 행 샘플 읽기
  const sampleData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    range: { s: { r: 0, c: 0 }, e: { r: Math.min(5, rowCount - 1), c: Math.min(10, colCount - 1) } }
  }) as any[][];
  
  console.log(`${index + 1}. ${sheetName}`);
  console.log(`   크기: ${rowCount}행 × ${colCount}열`);
  console.log(`   샘플 헤더 (처음 5행, 10컬럼):`);
  
  sampleData.slice(0, 5).forEach((row, rowIdx) => {
    const rowPreview = row.slice(0, 10).map(cell => {
      const cellStr = String(cell || '').trim();
      return cellStr.length > 15 ? cellStr.substring(0, 15) + '...' : cellStr;
    }).join(' | ');
    console.log(`      행 ${rowIdx + 1}: ${rowPreview}`);
  });
  
  console.log('');
});

console.log('\n=== 시트 분석 완료 ===');

