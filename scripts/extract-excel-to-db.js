const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 엑셀 파일 경로
const excelDir = path.join(process.cwd(), '.example');

// 엑셀 파일 분석 결과 저장
const results = {
  items: [],
  companies: [],
  bom: [],
  inventory_transactions: [],
  price_history: []
};

console.log('=== 엑셀 파일에서 데이터 추출 시작 ===\n');

// 1. 태창금속 BOM.xlsx - 품목 및 거래처 정보
try {
  const bomFile = path.join(excelDir, '태창금속 BOM.xlsx');
  const bomWorkbook = XLSX.readFile(bomFile, { cellFormulas: true });
  
  // "최신단가" 시트에서 품목 및 거래처 정보 추출
  const priceSheet = bomWorkbook.Sheets['최신단가'];
  if (priceSheet) {
    const priceData = XLSX.utils.sheet_to_json(priceSheet, { defval: null });
    console.log(`\n[태창금속 BOM.xlsx - 최신단가] ${priceData.length}개 레코드`);
    
    priceData.forEach((row, idx) => {
      // 엑셀 컬럼 구조 파악 필요 - 샘플 확인
      if (idx < 5) {
        console.log(`  샘플 ${idx + 1}:`, Object.keys(row).slice(0, 10));
      }
      
      // 품목 정보 추출 (컬럼명 확인 필요)
      const itemCode = row['50010562C'] || row['P/NO'] || row['품번'] || row['품목코드'];
      const itemName = row['  785.00 '] || row['품명'] || row['Part Name'] || row['품목명'];
      const supplierName = row['태영금속'] || row['업체'] || row['거래처'] || row['공급사명'];
      const unitPrice = row['4월기준'] || row['단가'] || row['unit_price'];
      
      if (itemCode || itemName) {
        results.items.push({
          item_code: String(itemCode || '').trim(),
          item_name: String(itemName || '').trim(),
          supplier_name: String(supplierName || '').trim(),
          unit_price: unitPrice ? parseFloat(String(unitPrice).replace(/,/g, '')) : null,
          source: '태창금속 BOM.xlsx - 최신단가',
          row_index: idx + 1
        });
      }
    });
  }
  
  // BOM 구조 시트들 확인
  const bomSheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];
  bomSheets.forEach(sheetName => {
    const sheet = bomWorkbook.Sheets[sheetName];
    if (sheet) {
      const bomData = XLSX.utils.sheet_to_json(sheet, { defval: null, header: 1 });
      console.log(`  [${sheetName}] ${bomData.length}개 행`);
    }
  });
  
} catch (error) {
  console.error('태창금속 BOM.xlsx 처리 오류:', error.message);
}

// 2. 2025년 9월 종합관리 SHEET.xlsx - 품목 및 재고 정보
try {
  const managementFile = path.join(excelDir, '2025년 9월 종합관리 SHEET.xlsx');
  const mgmtWorkbook = XLSX.readFile(managementFile, { cellFormulas: true });
  
  // 종합재고 시트
  const stockSheet = mgmtWorkbook.Sheets['종합재고'];
  if (stockSheet) {
    const stockData = XLSX.utils.sheet_to_json(stockSheet, { defval: null });
    console.log(`\n[종합관리 SHEET.xlsx - 종합재고] ${stockData.length}개 레코드`);
    
    stockData.forEach((row, idx) => {
      if (idx < 5) {
        console.log(`  샘플 ${idx + 1}:`, Object.keys(row).slice(0, 10));
      }
    });
  }
  
} catch (error) {
  console.error('종합관리 SHEET.xlsx 처리 오류:', error.message);
}

// 3. 09월 원자재 수불관리.xlsx - 재고 거래 정보
try {
  const inventoryFile = path.join(excelDir, '09월 원자재 수불관리.xlsx');
  const invWorkbook = XLSX.readFile(inventoryFile, { cellFormulas: true });
  
  // 주요 시트 확인
  const mainSheets = ['MV1 , SV (재고관리)', 'TAM,KA4,인알파', 'DL3 GL3 (재고관리)'];
  mainSheets.forEach(sheetName => {
    const sheet = invWorkbook.Sheets[sheetName];
    if (sheet) {
      const invData = XLSX.utils.sheet_to_json(sheet, { defval: null });
      console.log(`\n[09월 원자재 수불관리.xlsx - ${sheetName}] ${invData.length}개 레코드`);
      
      if (invData.length > 0) {
        console.log(`  헤더:`, Object.keys(invData[0]).slice(0, 10));
      }
    }
  });
  
} catch (error) {
  console.error('09월 원자재 수불관리.xlsx 처리 오류:', error.message);
}

// 4. 2025년 9월 매입매출 보고현황.xlsx - 매입/매출 정보
try {
  const salesFile = path.join(excelDir, '2025년 9월 매입매출 보고현황.xlsx');
  const salesWorkbook = XLSX.readFile(salesFile, { cellFormulas: true });
  
  // 주요 시트 확인
  const salesSheets = ['매입부자재(구매)', '납품수량(영업)'];
  salesSheets.forEach(sheetName => {
    const sheet = salesWorkbook.Sheets[sheetName];
    if (sheet) {
      const salesData = XLSX.utils.sheet_to_json(sheet, { defval: null });
      console.log(`\n[매입매출 보고현황.xlsx - ${sheetName}] ${salesData.length}개 레코드`);
      
      if (salesData.length > 0) {
        console.log(`  헤더:`, Object.keys(salesData[0]).slice(0, 10));
      }
    }
  });
  
} catch (error) {
  console.error('매입매출 보고현황.xlsx 처리 오류:', error.message);
}

// 결과 저장
const outputDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outputDir, 'extracted-excel-data.json'),
  JSON.stringify(results, null, 2),
  'utf8'
);

console.log('\n=== 추출 결과 요약 ===');
console.log(`품목: ${results.items.length}개`);
console.log(`거래처: ${results.companies.length}개`);
console.log(`BOM: ${results.bom.length}개`);
console.log(`재고 거래: ${results.inventory_transactions.length}개`);
console.log(`\n결과가 data/extracted-excel-data.json에 저장되었습니다.`);

