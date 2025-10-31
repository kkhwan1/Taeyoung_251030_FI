const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelDir = path.join(process.cwd(), '.example');

console.log('=== 미분석 엑셀 파일 구조 분석 ===\n');

// 1. 2025년 9월 매입매출 보고현황.xlsx 분석
console.log('📄 2025년 9월 매입매출 보고현황.xlsx\n');
try {
  const filePath = path.join(excelDir, '2025년 9월 매입매출 보고현황.xlsx');
  const workbook = XLSX.readFile(filePath, { sheetStubs: true });
  
  console.log(`  시트 수: ${workbook.SheetNames.length}\n`);
  
  workbook.SheetNames.forEach((sheetName, idx) => {
    console.log(`  ${idx + 1}. ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    console.log(`     행 수: ${rawData.length}`);
    
    // 처음 3행 확인
    if (rawData.length > 0) {
      console.log(`     처음 3행 샘플:`);
      rawData.slice(0, 3).forEach((row, i) => {
        const rowStr = row.slice(0, 10).map(cell => String(cell || '').trim()).filter(c => c).join(' | ');
        if (rowStr) {
          console.log(`       [${i + 1}]: ${rowStr.substring(0, 100)}...`);
        }
      });
    }
    console.log('');
  });
} catch (error) {
  console.error(`  오류: ${error.message}\n`);
}

// 2. 2025년 9월 종합관리 SHEET.xlsx (미분석 시트만)
console.log('📄 2025년 9월 종합관리 SHEET.xlsx (미분석 시트)\n');
try {
  const filePath = path.join(excelDir, '2025년 9월 종합관리 SHEET.xlsx');
  const workbook = XLSX.readFile(filePath, { sheetStubs: true });
  
  const unprocessedSheets = ['COIL 입고현황', 'SHEET 입고현황', '생산실적', 'Sheet1'];
  
  unprocessedSheets.forEach(sheetName => {
    if (!workbook.SheetNames.includes(sheetName)) {
      console.log(`  ${sheetName}: 시트 없음\n`);
      return;
    }
    
    console.log(`  ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    console.log(`     행 수: ${rawData.length}`);
    
    // 처음 5행 확인
    if (rawData.length > 0) {
      console.log(`     처음 5행 샘플:`);
      rawData.slice(0, 5).forEach((row, i) => {
        const rowStr = row.slice(0, 15).map(cell => String(cell || '').trim()).filter(c => c).join(' | ');
        if (rowStr) {
          console.log(`       [${i + 1}]: ${rowStr.substring(0, 120)}...`);
        }
      });
    }
    console.log('');
  });
} catch (error) {
  console.error(`  오류: ${error.message}\n`);
}

// 3. 09월 원자재 수불관리.xlsx (미분석 시트만)
console.log('📄 09월 원자재 수불관리.xlsx (미분석 시트)\n');
try {
  const filePath = path.join(excelDir, '09월 원자재 수불관리.xlsx');
  const workbook = XLSX.readFile(filePath, { sheetStubs: true });
  
  const processedSheet = 'MV1 , SV (재고관리)';
  const unprocessedSheets = workbook.SheetNames.filter(name => name !== processedSheet);
  
  console.log(`  분석 완료: ${processedSheet}`);
  console.log(`  미분석 시트: ${unprocessedSheets.length}개\n`);
  
  // 처음 10개 시트만 상세 분석
  unprocessedSheets.slice(0, 10).forEach(sheetName => {
    console.log(`  ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    console.log(`     행 수: ${rawData.length}`);
    
    // 처음 3행 확인
    if (rawData.length > 0) {
      console.log(`     처음 3행 샘플:`);
      rawData.slice(0, 3).forEach((row, i) => {
        const rowStr = row.slice(0, 10).map(cell => String(cell || '').trim()).filter(c => c).join(' | ');
        if (rowStr) {
          console.log(`       [${i + 1}]: ${rowStr.substring(0, 100)}...`);
        }
      });
    }
    console.log('');
  });
  
  if (unprocessedSheets.length > 10) {
    console.log(`  ... 외 ${unprocessedSheets.length - 10}개 시트\n`);
  }
} catch (error) {
  console.error(`  오류: ${error.message}\n`);
}

console.log('=== 구조 분석 완료 ===');
