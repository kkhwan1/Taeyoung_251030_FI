const fs = require('fs');
const path = require('path');

console.log('=== 전체 데이터 검증 ===\n');

// 1. 추출된 데이터 확인
const extractedPath = path.join(process.cwd(), 'data', 'extracted-excel-data.json');
const bomPath = path.join(process.cwd(), 'data', 'bom-excel-correct.json');

let extractedData = { items: [], companies: [], bom: [], inventory_transactions: [], price_history: [] };
let bomData = [];

if (fs.existsSync(extractedPath)) {
  extractedData = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
  console.log('✅ 추출된 데이터 파일 확인');
  console.log(`  - 품목: ${extractedData.items.length}개`);
  console.log(`  - 거래처: ${extractedData.companies.length}개`);
  console.log(`  - 단가 이력: ${extractedData.price_history.length}개`);
  console.log(`  - 재고 거래: ${extractedData.inventory_transactions.length}개`);
} else {
  console.log('⚠️  extracted-excel-data.json 파일이 없습니다');
}

if (fs.existsSync(bomPath)) {
  bomData = JSON.parse(fs.readFileSync(bomPath, 'utf8'));
  console.log(`  - BOM: ${bomData.length}개`);
} else {
  console.log('⚠️  bom-excel-correct.json 파일이 없습니다');
}

console.log('\n=== 엑셀 파일별 데이터 추출 확인 ===\n');

const excelFiles = {
  '태창금속 BOM.xlsx': {
    expected_sheets: ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아', '최신단가'],
    extracted: {
      bom: bomData.filter(b => b.sheet && ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'].includes(b.sheet)).length,
      price: extractedData.price_history.length,
      items: extractedData.items.filter(i => i.source && i.source.includes('태창금속 BOM')).length,
      companies: extractedData.companies.filter(c => extractedData.price_history.some(p => p.supplier_name === c.company_name)).length
    }
  },
  '09월 원자재 수불관리.xlsx': {
    expected_sheets: 21,
    extracted: {
      inventory: extractedData.inventory_transactions.length
    }
  },
  '2025년 9월 매입매출 보고현황.xlsx': {
    expected_sheets: 18,
    extracted: {
      checked: false,
      note: '이 파일은 아직 분석되지 않았습니다'
    }
  },
  '2025년 9월 종합관리 SHEET.xlsx': {
    expected_sheets: 5,
    extracted: {
      checked: false,
      note: '이 파일은 아직 분석되지 않았습니다'
    }
  }
};

Object.entries(excelFiles).forEach(([file, info]) => {
  console.log(`📄 ${file}`);
  if (file === '태창금속 BOM.xlsx') {
    console.log(`  - BOM 데이터: ${info.extracted.bom}개`);
    console.log(`  - 단가 이력: ${info.extracted.price}개`);
    console.log(`  - 품목: ${info.extracted.items}개`);
    console.log(`  - 거래처: ${info.extracted.companies}개`);
  } else if (file === '09월 원자재 수불관리.xlsx') {
    console.log(`  - 재고 거래: ${info.extracted.inventory}개`);
    console.log(`  ⚠️  21개 시트 중 몇 개 시트에서 추출되었는지 확인 필요`);
  } else {
    console.log(`  ${info.extracted.note}`);
  }
  console.log('');
});

// 2. 누락 가능성 확인
console.log('=== 누락 가능성 체크 ===\n');

// BOM 데이터에서 부모 또는 자식 품목 코드가 DB에 없는 경우 확인
const allItemCodes = new Set(extractedData.items.map(i => i.item_code));
const bomWithMissingItems = bomData.filter(b => {
  const parentExists = allItemCodes.has(b.parent_item_code);
  const childExists = allItemCodes.has(b.child_item_code);
  return !parentExists || !childExists;
});

if (bomWithMissingItems.length > 0) {
  console.log(`⚠️  BOM 데이터 중 품목 코드가 없는 항목: ${bomWithMissingItems.length}개`);
  const missingParents = new Set(bomWithMissingItems.filter(b => !allItemCodes.has(b.parent_item_code)).map(b => b.parent_item_code));
  const missingChildren = new Set(bomWithMissingItems.filter(b => !allItemCodes.has(b.child_item_code)).map(b => b.child_item_code));
  if (missingParents.size > 0) {
    console.log(`  - 부모 품목 코드 없음: ${missingParents.size}개`);
    console.log(`    예시: ${Array.from(missingParents).slice(0, 5).join(', ')}`);
  }
  if (missingChildren.size > 0) {
    console.log(`  - 자식 품목 코드 없음: ${missingChildren.size}개`);
    console.log(`    예시: ${Array.from(missingChildren).slice(0, 5).join(', ')}`);
  }
} else {
  console.log('✅ 모든 BOM 데이터의 품목 코드가 존재합니다');
}

// 단가 이력에서 품목 코드가 없는 경우 확인
const priceWithMissingItems = extractedData.price_history.filter(p => !allItemCodes.has(p.item_code));
if (priceWithMissingItems.length > 0) {
  console.log(`\n⚠️  단가 이력 중 품목 코드가 없는 항목: ${priceWithMissingItems.length}개`);
  const missingCodes = new Set(priceWithMissingItems.map(p => p.item_code));
  console.log(`  - 품목 코드 없음: ${missingCodes.size}개`);
  console.log(`    예시: ${Array.from(missingCodes).slice(0, 10).join(', ')}`);
} else {
  console.log('\n✅ 모든 단가 이력의 품목 코드가 존재합니다');
}

// 재고 거래에서 품목 코드가 없는 경우 확인
const inventoryWithMissingItems = extractedData.inventory_transactions.filter(t => !allItemCodes.has(t.item_code));
if (inventoryWithMissingItems.length > 0) {
  console.log(`\n⚠️  재고 거래 중 품목 코드가 없는 항목: ${inventoryWithMissingItems.length}개`);
  const missingCodes = new Set(inventoryWithMissingItems.map(t => t.item_code));
  console.log(`  - 품목 코드 없음: ${missingCodes.size}개`);
  console.log(`    예시: ${Array.from(missingCodes).slice(0, 10).join(', ')}`);
} else {
  console.log('\n✅ 모든 재고 거래의 품목 코드가 존재합니다');
}

console.log('\n=== 검증 완료 ===');
