/**
 * 시트 구조 분석 - 정확한 헤더 위치 찾기
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_DIR = path.resolve(process.cwd(), '.example');
const EXCEL_FILE = '2025년 9월 종합관리 SHEET.xlsx';

async function main() {
  const filePath = path.join(EXCEL_DIR, EXCEL_FILE);
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets['종합재고'];
  
  if (!worksheet) {
    console.log('시트 없음');
    return;
  }
  
  // 처음 20개 행 출력
  const data = XLSX.utils.sheet_to_json(worksheet, { 
    header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
    range: 0 // 1행부터
  });
  
  console.log('\n📊 처음 20개 행:');
  data.slice(0, 20).forEach((row: any, idx) => {
    console.log(`\n행 ${idx + 1}:`);
    Object.entries(row).forEach(([key, value]) => {
      if (value) {
        console.log(`  ${key}: ${value}`);
      }
    });
  });
}

main();

