const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelDir = path.join(process.cwd(), '.example');
const outputDir = path.join(process.cwd(), 'data');

// 기존 추출된 데이터 읽기
let existingData = {
  items: [],
  companies: [],
  bom: [],
  inventory_transactions: [],
  price_history: []
};

const existingPath = path.join(outputDir, 'extracted-excel-data.json');
if (fs.existsSync(existingPath)) {
  existingData = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
}

// 새로운 데이터 저장소
const newData = {
  items: new Map(existingData.items.map(i => [i.item_code, i])),
  companies: new Map(existingData.companies.map(c => [c.company_name, c])),
  bom: [...existingData.bom],
  inventory_transactions: [...existingData.inventory_transactions],
  price_history: [...existingData.price_history],
  purchase_sales: []
};

console.log('=== 미분석 엑셀 파일 데이터 추출 시작 ===\n');

// 1. 2025년 9월 매입매출 보고현황.xlsx 분석
console.log('📄 2025년 9월 매입매출 보고현황.xlsx 분석 중...\n');

try {
  const filePath = path.join(excelDir, '2025년 9월 매입매출 보고현황.xlsx');
  const workbook = XLSX.readFile(filePath, { sheetStubs: true });

  // 1.1 태창금속 시트 - 품목 정보
  const taechangSheet = workbook.Sheets['태창금속'];
  if (taechangSheet) {
    console.log('  [태창금속] 시트 분석 중...');
    const rawData = XLSX.utils.sheet_to_json(taechangSheet, { header: 1, defval: null });
    
    // 헤더는 행 3 (인덱스 2), 데이터는 행 4부터 (인덱스 3)
    rawData.slice(3).forEach((row) => {
      const companyName = row[0] ? String(row[0]).trim() : null;
      const vehicleModel = row[1] ? String(row[1]).trim() : null;
      const finishedItemCode = row[2] ? String(row[2]).trim() : null;
      const itemCode = row[3] ? String(row[3]).trim() : null;
      const itemName = row[4] ? String(row[4]).trim() : null;
      const material = row[5] ? String(row[5]).trim() : null;
      const spec = row[6] ? String(row[6]).trim() : null;
      
      if (itemCode) {
        if (!newData.items.has(itemCode)) {
          newData.items.set(itemCode, {
            item_code: itemCode,
            item_name: itemName,
            spec: spec,
            unit: 'PCS',
            category: '원자재',
            material: material,
            is_active: true,
            source: '2025년 9월 매입매출 보고현황.xlsx - 태창금속'
          });
        }
      }
      
      if (companyName) {
        if (!newData.companies.has(companyName)) {
          newData.companies.set(companyName, {
            company_name: companyName,
            company_type: '공급사',
            is_active: true,
            source: '2025년 9월 매입매출 보고현황.xlsx - 태창금속'
          });
        }
      }
    });
    console.log(`    품목 추가: ${Array.from(newData.items.values()).filter(i => i.source && i.source.includes('태창금속')).length}개`);
  }

  // 1.2 협력사 시트 - 품목 정보
  const supplierSheet = workbook.Sheets['협력사'];
  if (supplierSheet) {
    console.log('  [협력사] 시트 분석 중...');
    const rawData = XLSX.utils.sheet_to_json(supplierSheet, { header: 1, defval: null });
    
    rawData.slice(3).forEach((row) => {
      const companyName = row[0] ? String(row[0]).trim() : null;
      const vehicleModel = row[1] ? String(row[1]).trim() : null;
      const finishedItemCode = row[2] ? String(row[2]).trim() : null;
      const itemCode = row[3] ? String(row[3]).trim() : null;
      const itemName = row[4] ? String(row[4]).trim() : null;
      const material = row[5] ? String(row[5]).trim() : null;
      const spec = row[6] ? String(row[6]).trim() : null;
      
      if (itemCode) {
        if (!newData.items.has(itemCode)) {
          newData.items.set(itemCode, {
            item_code: itemCode,
            item_name: itemName,
            spec: spec,
            unit: 'PCS',
            category: '원자재',
            material: material,
            is_active: true,
            source: '2025년 9월 매입매출 보고현황.xlsx - 협력사'
          });
        }
      }
      
      if (companyName) {
        if (!newData.companies.has(companyName)) {
          newData.companies.set(companyName, {
            company_name: companyName,
            company_type: '공급사',
            is_active: true,
            source: '2025년 9월 매입매출 보고현황.xlsx - 협력사'
          });
        }
      }
    });
    console.log(`    품목 추가: ${Array.from(newData.items.values()).filter(i => i.source && i.source.includes('협력사')).length}개`);
  }

  // 1.3 매입부자재(구매) 시트 - 매입 정보
  const purchaseSheet = workbook.Sheets['매입부자재(구매)'];
  if (purchaseSheet) {
    console.log('  [매입부자재(구매)] 시트 분석 중...');
    const rawData = XLSX.utils.sheet_to_json(purchaseSheet, { header: 1, defval: null });
    
    // 헤더는 행 2 (인덱스 1), 데이터는 행 3부터 (인덱스 2)
    rawData.slice(2).forEach((row) => {
      const supplierName = row[0] ? String(row[0]).trim() : null;
      const vehicleModel = row[3] ? String(row[3]).trim() : null;
      const itemCode = row[6] ? String(row[6]).trim() : null;
      const itemName = row[7] ? String(row[7]).trim() : null;
      const unitPrice = row[8] ? parseFloat(String(row[8]).replace(/,/g, '')) : null;
      
      if (itemCode) {
        if (!newData.items.has(itemCode)) {
          newData.items.set(itemCode, {
            item_code: itemCode,
            item_name: itemName,
            unit: 'PCS',
            category: '부자재',
            is_active: true,
            source: '2025년 9월 매입매출 보고현황.xlsx - 매입부자재(구매)'
          });
        }
        
        // 단가 이력 추가
        if (unitPrice && !isNaN(unitPrice) && supplierName) {
          newData.price_history.push({
            item_code: itemCode,
            supplier_name: supplierName,
            unit_price: unitPrice,
            price_date: '2025-09-01',
            source: '2025년 9월 매입매출 보고현황.xlsx - 매입부자재(구매)'
          });
        }
      }
      
      if (supplierName) {
        if (!newData.companies.has(supplierName)) {
          newData.companies.set(supplierName, {
            company_name: supplierName,
            company_type: '공급사',
            is_active: true,
            source: '2025년 9월 매입매출 보고현황.xlsx - 매입부자재(구매)'
          });
        }
      }
    });
    console.log(`    품목 추가: ${Array.from(newData.items.values()).filter(i => i.source && i.source.includes('매입부자재')).length}개`);
  }

  // 1.4 납품수량(영업) 시트 - 매출 정보
  const salesSheet = workbook.Sheets['납품수량(영업)'];
  if (salesSheet) {
    console.log('  [납품수량(영업)] 시트 분석 중...');
    const rawData = XLSX.utils.sheet_to_json(salesSheet, { header: 1, defval: null });
    
    // 헤더는 행 2 (인덱스 1), 데이터는 행 3부터 (인덱스 2)
    rawData.slice(2).forEach((row) => {
      const customerName = row[0] ? String(row[0]).trim() : null;
      const itemCode = row[2] ? String(row[2]).trim() : null;
      const itemName = row[3] ? String(row[3]).trim() : null;
      const vehicleModel = row[4] ? String(row[4]).trim() : null;
      const unitPrice = row[5] ? parseFloat(String(row[5]).replace(/,/g, '')) : null;
      
      if (itemCode) {
        if (!newData.items.has(itemCode)) {
          newData.items.set(itemCode, {
            item_code: itemCode,
            item_name: itemName,
            unit: 'PCS',
            category: '제품',
            is_active: true,
            source: '2025년 9월 매입매출 보고현황.xlsx - 납품수량(영업)'
          });
        }
      }
      
      if (customerName) {
        if (!newData.companies.has(customerName)) {
          newData.companies.set(customerName, {
            company_name: customerName,
            company_type: '고객사',
            is_active: true,
            source: '2025년 9월 매입매출 보고현황.xlsx - 납품수량(영업)'
          });
        }
      }
    });
    console.log(`    품목 추가: ${Array.from(newData.items.values()).filter(i => i.source && i.source.includes('납품수량')).length}개`);
  }

  console.log('  ✅ 매입매출 보고현황 분석 완료\n');
} catch (error) {
  console.error('  ❌ 매입매출 보고현황 분석 오류:', error.message);
}

// 2. 2025년 9월 종합관리 SHEET.xlsx - COIL/SHEET 입고현황
console.log('📄 2025년 9월 종합관리 SHEET.xlsx 분석 중...\n');

try {
  const filePath = path.join(excelDir, '2025년 9월 종합관리 SHEET.xlsx');
  const workbook = XLSX.readFile(filePath, { sheetStubs: true });

  // 2.1 COIL 입고현황
  const coilSheet = workbook.Sheets['COIL 입고현황'];
  if (coilSheet) {
    console.log('  [COIL 입고현황] 시트 분석 중...');
    const rawData = XLSX.utils.sheet_to_json(coilSheet, { header: 1, defval: null });
    
    // 헤더는 행 3 (인덱스 2), 데이터는 행 5부터 (인덱스 4)
    rawData.slice(4).forEach((row) => {
      const companyName = row[0] ? String(row[0]).trim() : null;
      const vehicleModel = row[1] ? String(row[1]).trim() : null;
      const finishedItemCode = row[2] ? String(row[2]).trim() : null;
      const itemCode = row[3] ? String(row[3]).trim() : null;
      const itemName = row[4] ? String(row[4]).trim() : null;
      const material = row[5] ? String(row[5]).trim() : null;
      const thickness = row[6] ? parseFloat(String(row[6])) : null;
      const width = row[7] ? parseFloat(String(row[7])) : null;
      const height = row[8] ? parseFloat(String(row[8])) : null;
      const currentStock = row[14] ? parseFloat(String(row[14]).replace(/,/g, '')) : 0;
      
      if (itemCode) {
        const item = newData.items.get(itemCode) || {
          item_code: itemCode,
          item_name: itemName,
          unit: 'PCS',
          category: '원자재',
          is_active: true,
          source: '2025년 9월 종합관리 SHEET.xlsx - COIL 입고현황'
        };
        
        if (!item.item_name && itemName) item.item_name = itemName;
        if (!item.material && material) item.material = material;
        if (thickness) item.thickness = thickness;
        if (width) item.width = width;
        if (height) item.height = height;
        if (currentStock > 0) item.current_stock = currentStock;
        
        newData.items.set(itemCode, item);
      }
      
      if (companyName) {
        if (!newData.companies.has(companyName)) {
          newData.companies.set(companyName, {
            company_name: companyName,
            company_type: '공급사',
            is_active: true,
            source: '2025년 9월 종합관리 SHEET.xlsx - COIL 입고현황'
          });
        }
        
        // 재고 거래 추가 (기초재고 기준)
        if (itemCode && currentStock > 0) {
          newData.inventory_transactions.push({
            transaction_date: '2025-09-01',
            transaction_type: '입고',
            item_code: itemCode,
            company_name: companyName,
            quantity: currentStock,
            reference_number: `COIL-입고현황-${itemCode}`,
            source: '2025년 9월 종합관리 SHEET.xlsx - COIL 입고현황'
          });
        }
      }
    });
    console.log(`    품목 추가: ${Array.from(newData.items.values()).filter(i => i.source && i.source.includes('COIL')).length}개`);
  }

  // 2.2 SHEET 입고현황
  const sheetSheet = workbook.Sheets['SHEET 입고현황'];
  if (sheetSheet) {
    console.log('  [SHEET 입고현황] 시트 분석 중...');
    const rawData = XLSX.utils.sheet_to_json(sheetSheet, { header: 1, defval: null });
    
    rawData.slice(4).forEach((row) => {
      const companyName = row[0] ? String(row[0]).trim() : null;
      const vehicleModel = row[1] ? String(row[1]).trim() : null;
      const finishedItemCode = row[2] ? String(row[2]).trim() : null;
      const itemCode = row[3] ? String(row[3]).trim() : null;
      const itemName = row[4] ? String(row[4]).trim() : null;
      const material = row[5] ? String(row[5]).trim() : null;
      const thickness = row[6] ? parseFloat(String(row[6])) : null;
      const width = row[7] ? parseFloat(String(row[7])) : null;
      const height = row[8] ? parseFloat(String(row[8])) : null;
      const currentStock = row[14] ? parseFloat(String(row[14]).replace(/,/g, '')) : 0;
      
      if (itemCode) {
        const item = newData.items.get(itemCode) || {
          item_code: itemCode,
          item_name: itemName,
          unit: 'PCS',
          category: '원자재',
          is_active: true,
          source: '2025년 9월 종합관리 SHEET.xlsx - SHEET 입고현황'
        };
        
        if (!item.item_name && itemName) item.item_name = itemName;
        if (!item.material && material) item.material = material;
        if (thickness) item.thickness = thickness;
        if (width) item.width = width;
        if (height) item.height = height;
        if (currentStock > 0) item.current_stock = currentStock;
        
        newData.items.set(itemCode, item);
      }
      
      if (companyName) {
        if (!newData.companies.has(companyName)) {
          newData.companies.set(companyName, {
            company_name: companyName,
            company_type: '공급사',
            is_active: true,
            source: '2025년 9월 종합관리 SHEET.xlsx - SHEET 입고현황'
          });
        }
        
        if (itemCode && currentStock > 0) {
          newData.inventory_transactions.push({
            transaction_date: '2025-09-01',
            transaction_type: '입고',
            item_code: itemCode,
            company_name: companyName,
            quantity: currentStock,
            reference_number: `SHEET-입고현황-${itemCode}`,
            source: '2025년 9월 종합관리 SHEET.xlsx - SHEET 입고현황'
          });
        }
      }
    });
    console.log(`    품목 추가: ${Array.from(newData.items.values()).filter(i => i.source && i.source.includes('SHEET')).length}개`);
  }

  console.log('  ✅ 종합관리 SHEET 분석 완료\n');
} catch (error) {
  console.error('  ❌ 종합관리 SHEET 분석 오류:', error.message);
}

// 결과 저장
const result = {
  items: Array.from(newData.items.values()),
  companies: Array.from(newData.companies.values()),
  bom: newData.bom,
  inventory_transactions: newData.inventory_transactions,
  price_history: newData.price_history
};

fs.writeFileSync(
  path.join(outputDir, 'extracted-excel-data-updated.json'),
  JSON.stringify(result, null, 2),
  'utf8'
);

console.log('=== 데이터 추출 완료 ===');
console.log(`\n최종 통계:`);
console.log(`  - 품목: ${result.items.length}개 (기존: ${existingData.items.length}개)`);
console.log(`  - 거래처: ${result.companies.length}개 (기존: ${existingData.companies.length}개)`);
console.log(`  - 재고 거래: ${result.inventory_transactions.length}개 (기존: ${existingData.inventory_transactions.length}개)`);
console.log(`  - 단가 이력: ${result.price_history.length}개 (기존: ${existingData.price_history.length}개)`);
console.log(`\n저장 위치: data/extracted-excel-data-updated.json`);

