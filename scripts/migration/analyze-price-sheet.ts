/**
 * 태창금속 BOM.xlsx의 최신단가 시트 구조 분석
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_FILE_NAME = '태창금속 BOM.xlsx';
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

// 최신단가 시트 찾기
const targetSheet = workbook.SheetNames.find(name => 
  name.includes('최신단가') || name.includes('단가') || name.includes('price')
);

if (!targetSheet) {
  console.log('시트 목록:');
  workbook.SheetNames.forEach((name, i) => console.log(`${i+1}. ${name}`));
  console.log('\n최신단가 시트를 찾을 수 없습니다.');
  process.exit(1);
}

console.log(`\n분석 대상 시트: "${targetSheet}"\n`);
const worksheet = workbook.Sheets[targetSheet];
const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
const rowCount = range.e.r + 1;
const colCount = range.e.c + 1;

console.log(`크기: ${rowCount}행 × ${colCount}열\n`);

// 처음 10행, 처음 15컬럼 샘플
const sampleData = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  defval: '',
  range: { s: { r: 0, c: 0 }, e: { r: Math.min(10, rowCount - 1), c: Math.min(15, colCount - 1) } }
}) as any[][];

console.log('=== 시트 구조 샘플 (처음 10행, 15컬럼) ===\n');

sampleData.forEach((row, rowIdx) => {
  const rowPreview = row.map((cell, colIdx) => {
    const cellStr = String(cell || '').trim();
    if (cellStr.length > 20) {
      return `${cellStr.substring(0, 20)}...`;
    }
    return cellStr || '(빈칸)';
  });
  console.log(`행 ${rowIdx + 1} [컬럼 0-14]:`);
  rowPreview.forEach((cell, idx) => {
    console.log(`  [${idx}]: "${cell}"`);
  });
  console.log('');
});

// 헤더 행 찾기
console.log('\n=== 헤더 분석 ===\n');
for (let i = 0; i < Math.min(5, rowCount); i++) {
  const row = sampleData[i];
  const hasKorean = row.some(cell => /[가-힣]/.test(String(cell)));
  const hasNumber = row.some((cell, idx) => idx > 0 && !isNaN(Number(cell)));
  
  if (hasKorean || hasNumber) {
    const rowStr = row.map((cell, idx) => `[${idx}]: "${String(cell || '').trim()}"`).join(', ');
    console.log(`행 ${i + 1} (헤더 후보): ${rowStr}`);
  }
}

// 단가 관련 컬럼 찾기
console.log('\n=== 단가 관련 컬럼 찾기 ===\n');
for (let i = 0; i < Math.min(5, rowCount); i++) {
  const row = sampleData[i];
  row.forEach((cell, colIdx) => {
    const cellStr = String(cell || '').toLowerCase().trim();
    if (cellStr.includes('단가') || cellStr.includes('가격') || cellStr.includes('price') || 
        cellStr.includes('kg') || cellStr.includes('ea')) {
      console.log(`행 ${i+1}, 컬럼 ${colIdx}: "${String(cell)}"`);
    }
  });
}

console.log('\n=== 분석 완료 ===');

