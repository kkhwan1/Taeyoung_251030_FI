const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelDir = path.join(process.cwd(), '.example');

// 추출된 데이터
const extractedData = {
  items: new Map(), // item_code를 키로
  companies: new Map(), // company_name을 키로
  bom: [],
  inventory_transactions: [],
  price_history: []
};

console.log('=== 엑셀 데이터 추출 및 DB 매핑 준비 ===\n');

// 1. 태창금속 BOM.xlsx - 최신단가 시트 (품목 및 거래처)
try {
  const bomFile = path.join(excelDir, '태창금속 BOM.xlsx');
  const bomWorkbook = XLSX.readFile(bomFile);
  const priceSheet = bomWorkbook.Sheets['최신단가'];
  
  if (priceSheet) {
    const rawData = XLSX.utils.sheet_to_json(priceSheet, { header: 1, defval: null });
    
    rawData.forEach((row, idx) => {
      // 컬럼 구조: [품번, 단가, 거래처명, 기준일]
      const itemCode = row[0] ? String(row[0]).trim() : null;
      const unitPrice = row[1] ? String(row[1]).replace(/,/g, '').trim() : null;
      const supplierName = row[2] ? String(row[2]).trim() : null;
      const priceDate = row[3] ? String(row[3]).trim() : null;
      
      if (itemCode) {
        // 품목 정보 추가
        if (!extractedData.items.has(itemCode)) {
          extractedData.items.set(itemCode, {
            item_code: itemCode,
            item_name: null, // 품명은 다른 시트에서 확인
            unit: 'PCS',
            category: '원자재',
            is_active: true,
            source: '태창금속 BOM.xlsx - 최신단가'
          });
        }
        
        // 거래처 정보 추가
        if (supplierName && !extractedData.companies.has(supplierName)) {
          extractedData.companies.set(supplierName, {
            company_name: supplierName,
            company_type: 'SUPPLIER',
            is_active: true,
            source: '태창금속 BOM.xlsx - 최신단가'
          });
        }
        
        // 단가 이력 추가
        if (unitPrice && !isNaN(parseFloat(unitPrice))) {
          extractedData.price_history.push({
            item_code: itemCode,
            supplier_name: supplierName,
            unit_price: parseFloat(unitPrice),
            price_date: priceDate,
            source: '태창금속 BOM.xlsx - 최신단가'
          });
        }
      }
    });
    
    console.log(`[태창금속 BOM.xlsx - 최신단가]`);
    console.log(`  - 품목: ${extractedData.items.size}개`);
    console.log(`  - 거래처: ${extractedData.companies.size}개`);
    console.log(`  - 단가 이력: ${extractedData.price_history.length}개\n`);
  }
} catch (error) {
  console.error('태창금속 BOM.xlsx 처리 오류:', error.message);
}

// 2. 2025년 9월 종합관리 SHEET.xlsx - 종합재고 (품목 정보 보완)
try {
  const mgmtFile = path.join(excelDir, '2025년 9월 종합관리 SHEET.xlsx');
  const mgmtWorkbook = XLSX.readFile(mgmtFile);
  const stockSheet = mgmtWorkbook.Sheets['종합재고'];
  
  if (stockSheet) {
    const rawData = XLSX.utils.sheet_to_json(stockSheet, { header: 1, defval: null });
    
    // 헤더는 행 3 (인덱스 2), 데이터는 행 5부터 (인덱스 4)
    rawData.slice(4).forEach((row) => {
      const companyName = row[0] ? String(row[0]).trim() : null;
      const vehicleModel = row[1] ? String(row[1]).trim() : null;
      const finishedItemCode = row[2] ? String(row[2]).trim() : null;
      const itemCode = row[3] ? String(row[3]).trim() : null;
      const itemName = row[4] ? String(row[4]).trim() : null;
      const material = row[5] ? String(row[5]).trim() : null;
      const spec = row[6] ? String(row[6]).trim() : null;
      const thickness = row[7] ? parseFloat(String(row[7])) : null;
      const width = row[8] ? parseFloat(String(row[8])) : null;
      const height = row[9] ? parseFloat(String(row[9])) : null;
      
      if (itemCode) {
        // 품목 정보 업데이트
        if (extractedData.items.has(itemCode)) {
          const item = extractedData.items.get(itemCode);
          if (!item.item_name && itemName) {
            item.item_name = itemName;
          }
          if (spec) item.spec = spec;
          if (material) item.material = material;
          if (thickness) item.thickness = thickness;
          if (width) item.width = width;
          if (height) item.height = height;
        } else {
          extractedData.items.set(itemCode, {
            item_code: itemCode,
            item_name: itemName,
            spec: spec,
            material: material,
            thickness: thickness,
            width: width,
            height: height,
            unit: 'PCS',
            category: '원자재',
            is_active: true,
            source: '종합관리 SHEET.xlsx - 종합재고'
          });
        }
      }
      
      // 거래처 정보 추가
      if (companyName && !extractedData.companies.has(companyName)) {
        extractedData.companies.set(companyName, {
          company_name: companyName,
          company_type: 'SUPPLIER',
          is_active: true,
          source: '종합관리 SHEET.xlsx - 종합재고'
        });
      }
    });
    
    console.log(`[종합관리 SHEET.xlsx - 종합재고]`);
    console.log(`  - 추가 품목: ${Array.from(extractedData.items.values()).filter(i => i.source.includes('종합관리')).length}개\n`);
  }
} catch (error) {
  console.error('종합관리 SHEET.xlsx 처리 오류:', error.message);
}

// 3. 09월 원자재 수불관리.xlsx - 재고 거래 정보
try {
  const invFile = path.join(excelDir, '09월 원자재 수불관리.xlsx');
  const invWorkbook = XLSX.readFile(invFile);
  
  // MV1 , SV (재고관리) 시트
  const mvSheet = invWorkbook.Sheets['MV1 , SV (재고관리)'];
  if (mvSheet) {
    const rawData = XLSX.utils.sheet_to_json(mvSheet, { header: 1, defval: null });
    
    // 헤더는 행 2 (인덱스 1), 데이터는 행 3부터 (인덱스 2)
    rawData.slice(2).forEach((row, idx) => {
      const vehicleModel = row[0] ? String(row[0]).trim() : null;
      const finishedItemCode = row[1] ? String(row[1]).trim() : null;
      const finishedItemName = row[2] ? String(row[2]).trim() : null;
      const itemCode = row[5] ? String(row[5]).trim() : null; // Part NO
      const itemName = row[6] ? String(row[6]).trim() : null; // Part Name
      const companyName = row[4] ? String(row[4]).trim() : null; // 업체
      const receivingQty = row[8] ? parseFloat(String(row[8])) : 0; // 입고수량
      const productionQty = row[9] ? parseFloat(String(row[9])) : 0; // 생산실적
      const coDeliveryQty = row[10] ? parseFloat(String(row[10])) : 0; // C/O 납품수량
      const openingStock = row[11] ? parseFloat(String(row[11])) : 0; // 기초재고
      
      if (itemCode) {
        // 품목 정보 추가
        if (!extractedData.items.has(itemCode)) {
          extractedData.items.set(itemCode, {
            item_code: itemCode,
            item_name: itemName,
            unit: 'PCS',
            category: '원자재',
            is_active: true,
            source: '09월 원자재 수불관리.xlsx'
          });
        }
        
        // 거래처 정보 추가
        if (companyName && !extractedData.companies.has(companyName)) {
          extractedData.companies.set(companyName, {
            company_name: companyName,
            company_type: 'SUPPLIER',
            is_active: true,
            source: '09월 원자재 수불관리.xlsx'
          });
        }
        
        // 재고 거래 정보 (입고)
        if (receivingQty > 0) {
          extractedData.inventory_transactions.push({
            transaction_date: '2025-09-01', // 기본값
            transaction_type: '입고',
            item_code: itemCode,
            quantity: receivingQty,
            unit: 'PCS',
            company_name: companyName,
            reference_number: `09월입고-${idx + 1}`,
            source: '09월 원자재 수불관리.xlsx - MV1 , SV (재고관리)'
          });
        }
      }
    });
    
    console.log(`[09월 원자재 수불관리.xlsx - MV1 , SV (재고관리)]`);
    console.log(`  - 추가 품목: ${Array.from(extractedData.items.values()).filter(i => i.source.includes('09월')).length}개`);
    console.log(`  - 재고 거래: ${extractedData.inventory_transactions.length}개\n`);
  }
  
} catch (error) {
  console.error('09월 원자재 수불관리.xlsx 처리 오류:', error.message);
}

// 결과 저장
const outputDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const output = {
  items: Array.from(extractedData.items.values()),
  companies: Array.from(extractedData.companies.values()),
  bom: extractedData.bom,
  inventory_transactions: extractedData.inventory_transactions,
  price_history: extractedData.price_history
};

fs.writeFileSync(
  path.join(outputDir, 'extracted-excel-data.json'),
  JSON.stringify(output, null, 2),
  'utf8'
);

console.log('\n=== 추출 결과 요약 ===');
console.log(`품목: ${output.items.length}개`);
console.log(`거래처: ${output.companies.length}개`);
console.log(`BOM: ${output.bom.length}개`);
console.log(`재고 거래: ${output.inventory_transactions.length}개`);
console.log(`단가 이력: ${output.price_history.length}개`);
console.log(`\n결과가 data/extracted-excel-data.json에 저장되었습니다.`);

