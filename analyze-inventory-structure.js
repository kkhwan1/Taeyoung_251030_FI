const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'EXCEL_INVENTORY_EXTRACTED.json'), 'utf8'));

console.log('총 재고 항목:', data.totalItems);
console.log('헤더 행 인덱스:', data.headerRowIndex);
console.log('\n헤더 분석 (비어있지 않은 헤더만):');

const nonEmptyHeaders = data.headers
  .map((h, i) => ({ index: i, value: h }))
  .filter(h => h.value && h.value.trim());

nonEmptyHeaders.forEach(h => {
  console.log(`  컬럼 ${h.index}: "${h.value}"`);
});

console.log('\n\n처음 10개 데이터 항목 분석:');

data.inventory.slice(0, 10).forEach((item, i) => {
  console.log(`\n항목 ${i + 1}:`);

  // Get all non-empty keys
  const keys = Object.keys(item).filter(k => k && item[k] !== '' && item[k] !== null && item[k] !== undefined);

  if (keys.length === 0) {
    console.log('  (빈 행)');
  } else {
    keys.slice(0, 15).forEach(k => {
      const value = item[k];
      const displayValue = typeof value === 'number'
        ? value.toLocaleString('ko-KR')
        : String(value).substring(0, 50);
      console.log(`  "${k}" = ${displayValue}`);
    });

    if (keys.length > 15) {
      console.log(`  ... 외 ${keys.length - 15}개 컬럼 더`);
    }
  }
});

// Try to identify which columns contain item codes and stock quantities
console.log('\n\n📊 가능한 품목코드/재고 컬럼 패턴 분석:');

const possibleItemCodeColumns = [];
const possibleStockColumns = [];

data.inventory.slice(0, 20).forEach(item => {
  Object.entries(item).forEach(([key, value]) => {
    if (!key || !value) return;

    // Check if value looks like an item code (contains numbers and dashes)
    if (typeof value === 'string' && /\d+-\d+/.test(value)) {
      if (!possibleItemCodeColumns.includes(key)) {
        possibleItemCodeColumns.push(key);
      }
    }

    // Check if column name suggests stock/quantity
    if (typeof key === 'string') {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('재고') || lowerKey.includes('수량') || lowerKey.includes('stock') || lowerKey.includes('qty')) {
        if (!possibleStockColumns.includes(key)) {
          possibleStockColumns.push(key);
        }
      }
    }
  });
});

console.log('\n가능한 품목코드 컬럼:', possibleItemCodeColumns.length > 0 ? possibleItemCodeColumns : '(없음)');
console.log('가능한 재고 컬럼:', possibleStockColumns.length > 0 ? possibleStockColumns : '(없음)');

console.log('\n완료!');
