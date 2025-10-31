const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelDir = path.join(process.cwd(), '.example');

console.log('=== 엑셀 파일 헤더 구조 분석 ===\n');

// 태창금속 BOM.xlsx의 "최신단가" 시트 상세 분석
const bomFile = path.join(excelDir, '태창금속 BOM.xlsx');
const bomWorkbook = XLSX.readFile(bomFile);

const priceSheet = bomWorkbook.Sheets['최신단가'];
if (priceSheet) {
  console.log('[태창금속 BOM.xlsx - 최신단가 시트]\n');
  
  // Raw 데이터로 확인 (header 없이)
  const rawData = XLSX.utils.sheet_to_json(priceSheet, { 
    header: 1, 
    defval: null,
    raw: false 
  });
  
  console.log(`총 ${rawData.length}개 행\n`);
  
  // 처음 10개 행 출력
  console.log('처음 10개 행:');
  rawData.slice(0, 10).forEach((row, idx) => {
    console.log(`\n행 ${idx + 1}:`);
    row.slice(0, 15).forEach((cell, colIdx) => {
      if (cell !== null && String(cell).trim() !== '') {
        console.log(`  [${colIdx}]: ${String(cell).substring(0, 50)}`);
      }
    });
  });
  
  // 헤더 행 찾기 (일반적으로 1-5행 중)
  console.log('\n\n헤더 후보 행 분석:');
  for (let headerRow = 0; headerRow < Math.min(10, rawData.length); headerRow++) {
    const row = rawData[headerRow];
    const nonEmptyCount = row.filter(cell => cell !== null && String(cell).trim() !== '').length;
    const hasKorean = row.some(cell => {
      if (cell === null) return false;
      const str = String(cell);
      return /[가-힣]/.test(str);
    });
    
    console.log(`\n행 ${headerRow + 1}: 비어있지 않은 셀 ${nonEmptyCount}개, 한글 포함: ${hasKorean}`);
    if (nonEmptyCount >= 5) {
      console.log('  샘플:', row.slice(0, 10).map(c => c !== null ? String(c).substring(0, 30) : '(null)').join(' | '));
    }
  }
}

// 다른 파일들도 확인
console.log('\n\n=== 2025년 9월 종합관리 SHEET.xlsx ===\n');
const mgmtFile = path.join(excelDir, '2025년 9월 종합관리 SHEET.xlsx');
const mgmtWorkbook = XLSX.readFile(mgmtFile);

const stockSheet = mgmtWorkbook.Sheets['종합재고'];
if (stockSheet) {
  const rawData = XLSX.utils.sheet_to_json(stockSheet, { header: 1, defval: null });
  console.log(`총 ${rawData.length}개 행\n`);
  console.log('처음 5개 행:');
  rawData.slice(0, 5).forEach((row, idx) => {
    console.log(`\n행 ${idx + 1}:`);
    row.slice(0, 10).forEach((cell, colIdx) => {
      if (cell !== null && String(cell).trim() !== '') {
        console.log(`  [${colIdx}]: ${String(cell).substring(0, 50)}`);
      }
    });
  });
}

console.log('\n\n=== 09월 원자재 수불관리.xlsx - MV1 , SV (재고관리) ===\n');
const invFile = path.join(excelDir, '09월 원자재 수불관리.xlsx');
const invWorkbook = XLSX.readFile(invFile);

const mvSheet = invWorkbook.Sheets['MV1 , SV (재고관리)'];
if (mvSheet) {
  const rawData = XLSX.utils.sheet_to_json(mvSheet, { header: 1, defval: null });
  console.log(`총 ${rawData.length}개 행\n`);
  console.log('처음 5개 행:');
  rawData.slice(0, 5).forEach((row, idx) => {
    console.log(`\n행 ${idx + 1}:`);
    row.slice(0, 12).forEach((cell, colIdx) => {
      if (cell !== null && String(cell).trim() !== '') {
        console.log(`  [${colIdx}]: ${String(cell).substring(0, 50)}`);
      }
    });
  });
}

