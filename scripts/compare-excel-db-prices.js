const fs = require('fs');

console.log('=== Excel vs Database Price Comparison ===\n');

// Load Excel data
const excelPrices = JSON.parse(fs.readFileSync('scripts/bom-latest-prices.json', 'utf8'));

// Create SQL query for comparison
const itemCodes = excelPrices.map(item => `'${item.item_code}'`).join(', ');

const sqlQuery = `
-- Full comparison of Excel BOM 최신단가 vs Database
WITH excel_prices AS (
  SELECT item_code, price, supplier
  FROM (VALUES
${excelPrices.map(item =>
  `    ('${item.item_code}', ${item.price}, '${item.supplier}')`
).join(',\n')}
  ) AS t(item_code, price, supplier)
)
SELECT
  COALESCE(i.item_code, e.item_code) as item_code,
  i.item_name,
  i.category,
  i.price as db_price,
  e.price as excel_price,
  e.supplier as excel_supplier,
  CASE
    WHEN i.item_code IS NULL THEN 'NOT_IN_DB'
    WHEN i.price IS NULL THEN 'DB_PRICE_NULL'
    WHEN ABS(i.price - e.price) < 0.01 THEN 'MATCH'
    ELSE 'MISMATCH'
  END as status,
  ROUND(i.price - e.price, 2) as price_diff
FROM excel_prices e
LEFT JOIN items i ON i.item_code = e.item_code AND i.is_active = true
ORDER BY
  CASE
    WHEN i.item_code IS NULL THEN 1
    WHEN i.price IS NULL THEN 2
    WHEN ABS(i.price - e.price) > 0.01 THEN 3
    ELSE 4
  END,
  item_code;
`;

// Save SQL query
fs.writeFileSync('scripts/compare-prices.sql', sqlQuery);
console.log('✅ SQL query saved to scripts/compare-prices.sql');
console.log('\nRun this query to see full comparison:');
console.log('  node scripts/run-price-comparison.js');
