const XLSX = require('xlsx');

console.log('=== Extracting 최신단가 from BOM ===\n');

const workbook = XLSX.readFile('.example/태창금속 BOM.xlsx');
const sheet = workbook.Sheets['최신단가'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// Data starts from row 0, columns are: [item_code, price, supplier, period_note]
const priceData = data
  .filter(row => row[0] && row[1]) // Has item_code and price
  .map(row => ({
    item_code: String(row[0]).trim(),
    price: Number(row[1]),
    supplier: String(row[2] || '').trim(),
    period_note: String(row[3] || '').trim()
  }));

console.log('Total price records:', priceData.length);
console.log('\nFirst 5 records:');
priceData.slice(0, 5).forEach(item => {
  console.log(`  ${item.item_code}: ₩${item.price} (${item.supplier}, ${item.period_note})`);
});

console.log('\nLast 5 records:');
priceData.slice(-5).forEach(item => {
  console.log(`  ${item.item_code}: ₩${item.price} (${item.supplier}, ${item.period_note})`);
});

// Group by supplier
const bySupplier = {};
priceData.forEach(item => {
  if (!bySupplier[item.supplier]) {
    bySupplier[item.supplier] = [];
  }
  bySupplier[item.supplier].push(item);
});

console.log('\n=== By Supplier ===');
Object.entries(bySupplier).forEach(([supplier, items]) => {
  console.log(`${supplier}: ${items.length} items`);
});

// Statistics
const prices = priceData.map(item => item.price).filter(p => p > 0);
console.log('\n=== Price Statistics ===');
console.log('Min price:', Math.min(...prices));
console.log('Max price:', Math.max(...prices));
console.log('Avg price:', Math.round(prices.reduce((a, b) => a + b, 0) / prices.length));

// Save to JSON for comparison
const fs = require('fs');
fs.writeFileSync(
  'scripts/bom-latest-prices.json',
  JSON.stringify(priceData, null, 2)
);
console.log('\n✅ Data saved to scripts/bom-latest-prices.json');
