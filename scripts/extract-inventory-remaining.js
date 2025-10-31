const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelDir = path.join(process.cwd(), '.example');
const outputDir = path.join(process.cwd(), 'data');

// 기존 추출된 데이터 읽기
const existingPath = path.join(outputDir, 'extracted-excel-data-updated.json');
let existingData = {
  items: [],
  companies: [],
  bom: [],
  inventory_transactions: [],
  price_history: []
};

if (fs.existsSync(existingPath)) {
  existingData = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
} else {
  const originalPath = path.join(outputDir, 'extracted-excel-data.json');
  if (fs.existsSync(originalPath)) {
    existingData = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
  }
}

// 새로운 데이터 저장소
const newData = {
  items: new Map(existingData.items.map(i => [i.item_code, i])),
  companies: new Map(existingData.companies.map(c => [c.company_name, c])),
  bom: [...existingData.bom],
  inventory_transactions: [...existingData.inventory_transactions],
  price_history: [...existingData.price_history]
};

console.log('=== 09월 원자재 수불관리.xlsx 나머지 시트 분석 ===\n');

try {
  const filePath = path.join(excelDir, '09월 원자재 수불관리.xlsx');
  const workbook = XLSX.readFile(filePath, { sheetStubs: true });

  const processedSheet = 'MV1 , SV (재고관리)';
  const unprocessedSheets = workbook.SheetNames.filter(name => name !== processedSheet);

  console.log(`분석할 시트: ${unprocessedSheets.length}개\n`);

  unprocessedSheets.forEach(sheetName => {
    try {
      console.log(`  [${sheetName}] 시트 분석 중...`);
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

      // 각 시트 구조가 다를 수 있으므로 여러 패턴 시도
      let headerRow = -1;
      
      // 헤더 행 찾기 (품번, 품명, 수량 등의 키워드 포함)
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        const rowStr = row.map(cell => String(cell || '').trim()).join('|').toLowerCase();
        if (rowStr.includes('품번') || rowStr.includes('품명') || rowStr.includes('part') || rowStr.includes('입고') || rowStr.includes('출고')) {
          headerRow = i;
          break;
        }
      }

      if (headerRow === -1) {
        console.log(`    ⚠️  헤더 행을 찾을 수 없습니다. 건너뜁니다.\n`);
        return;
      }

      // 헤더에서 컬럼 인덱스 찾기
      const headers = rawData[headerRow] || [];
      let itemCodeCol = -1;
      let itemNameCol = -1;
      let receivingQtyCol = -1;
      let productionQtyCol = -1;
      let openingStockCol = -1;
      let companyNameCol = -1;

      headers.forEach((header, idx) => {
        const h = String(header || '').trim().toLowerCase();
        if (h.includes('품번') || h.includes('part no') || h.includes('partno')) {
          itemCodeCol = idx;
        } else if (h.includes('품명') || h.includes('part name')) {
          itemNameCol = idx;
        } else if (h.includes('입고') || h.includes('입고수량')) {
          receivingQtyCol = idx;
        } else if (h.includes('생산') || h.includes('생산실적')) {
          productionQtyCol = idx;
        } else if (h.includes('기초') || h.includes('기초재고')) {
          openingStockCol = idx;
        } else if (h.includes('업체') || h.includes('거래처') || h.includes('협력사')) {
          companyNameCol = idx;
        }
      });

      // 시트 이름이 거래처 이름일 수 있음 (예: "풍기서산(사급)" -> "풍기서산")
      let sheetCompanyName = sheetName.replace(/\s*\([^)]*\)\s*/g, '').trim();

      let extractedCount = 0;

      // 데이터 행 처리
      rawData.slice(headerRow + 1).forEach((row) => {
        const itemCode = itemCodeCol !== -1 && row[itemCodeCol] ? String(row[itemCodeCol]).trim() : null;
        const itemName = itemNameCol !== -1 && row[itemNameCol] ? String(row[itemNameCol]).trim() : null;
        const receivingQty = receivingQtyCol !== -1 && row[receivingQtyCol] ? parseFloat(String(row[receivingQtyCol]).replace(/,/g, '')) : 0;
        const productionQty = productionQtyCol !== -1 && row[productionQtyCol] ? parseFloat(String(row[productionQtyCol]).replace(/,/g, '')) : 0;
        const openingStock = openingStockCol !== -1 && row[openingStockCol] ? parseFloat(String(row[openingStockCol]).replace(/,/g, '')) : 0;
        const companyName = companyNameCol !== -1 && row[companyNameCol] ? String(row[companyNameCol]).trim() : sheetCompanyName;

        if (itemCode) {
          // 품목 정보 추가
          if (!newData.items.has(itemCode)) {
            newData.items.set(itemCode, {
              item_code: itemCode,
              item_name: itemName,
              unit: 'PCS',
              category: '원자재',
              is_active: true,
              source: `09월 원자재 수불관리.xlsx - ${sheetName}`
            });
          }

          // 거래처 정보 추가
          if (companyName && !newData.companies.has(companyName)) {
            newData.companies.set(companyName, {
              company_name: companyName,
              company_type: '공급사',
              is_active: true,
              source: `09월 원자재 수불관리.xlsx - ${sheetName}`
            });
          }

          // 재고 거래 추가 (입고)
          if (receivingQty > 0) {
            newData.inventory_transactions.push({
              transaction_date: '2025-09-01',
              transaction_type: '입고',
              item_code: itemCode,
              company_name: companyName,
              quantity: receivingQty,
              reference_number: `${sheetName}-입고-${itemCode}`,
              source: `09월 원자재 수불관리.xlsx - ${sheetName}`
            });
            extractedCount++;
          }

          // 재고 거래 추가 (생산출고)
          if (productionQty > 0) {
            newData.inventory_transactions.push({
              transaction_date: '2025-09-01',
              transaction_type: '생산출고',
              item_code: itemCode,
              company_name: companyName,
              quantity: productionQty,
              reference_number: `${sheetName}-생산출고-${itemCode}`,
              source: `09월 원자재 수불관리.xlsx - ${sheetName}`
            });
            extractedCount++;
          }
        }
      });

      console.log(`    ✅ 재고 거래 ${extractedCount}개 추출 완료\n`);
    } catch (error) {
      console.error(`    ❌ 오류: ${error.message}\n`);
    }
  });

  // 결과 저장
  const result = {
    items: Array.from(newData.items.values()),
    companies: Array.from(newData.companies.values()),
    bom: newData.bom,
    inventory_transactions: newData.inventory_transactions,
    price_history: newData.price_history
  };

  fs.writeFileSync(
    path.join(outputDir, 'extracted-excel-data-final.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  );

  console.log('=== 모든 시트 분석 완료 ===');
  console.log(`\n최종 통계:`);
  console.log(`  - 품목: ${result.items.length}개`);
  console.log(`  - 거래처: ${result.companies.length}개`);
  console.log(`  - 재고 거래: ${result.inventory_transactions.length}개`);
  console.log(`  - 단가 이력: ${result.price_history.length}개`);
  console.log(`\n저장 위치: data/extracted-excel-data-final.json`);

} catch (error) {
  console.error('전체 오류:', error.message);
  process.exit(1);
}

