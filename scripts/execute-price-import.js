#!/usr/bin/env node
/**
 * Execute Price Import via Supabase MCP
 * Reads bom-latest-prices.json and applies all 244 price updates
 */

const fs = require('fs');
const { execSync } = require('child_process');

// Load Excel price data
const excelPrices = JSON.parse(
  fs.readFileSync('scripts/bom-latest-prices.json', 'utf8')
);

console.log(`\n${'='.repeat(60)}`);
console.log('EXECUTING COMPLETE PRICE IMPORT');
console.log(`Total records to process: ${excelPrices.length}`);
console.log(`${'='.repeat(60)}\n`);

// Generate VALUES clause
const valuesClause = excelPrices.map((item, index) => {
  const isLast = index === excelPrices.length - 1;
  const comma = isLast ? '' : ',';
  return `    ('${item.item_code}', ${item.price}, '${item.supplier.replace(/'/g, "''")}')${comma}`;
}).join('\n');

// Complete SQL with CTE pattern
const sql = `
-- STEP 3: Update Existing Items
WITH excel_prices AS (
  SELECT item_code, price, supplier FROM (VALUES
${valuesClause}
  ) AS t(item_code, price, supplier)
),
price_updates AS (
  UPDATE items i
  SET
    price = e.price,
    updated_at = NOW()
  FROM excel_prices e
  WHERE i.item_code = e.item_code
    AND i.is_active = true
    AND (i.price IS NULL OR ABS(i.price - e.price) > 0.01)
  RETURNING i.item_code, i.price as new_price, e.supplier
)
INSERT INTO item_price_changes (item_code, new_price, change_type, excel_supplier)
SELECT item_code, new_price, 'UPDATE', supplier FROM price_updates;

-- STEP 4: Insert Missing Items
WITH excel_prices AS (
  SELECT item_code, price, supplier FROM (VALUES
${valuesClause}
  ) AS t(item_code, price, supplier)
),
missing_items AS (
  SELECT e.item_code, e.price, e.supplier
  FROM excel_prices e
  LEFT JOIN items i ON i.item_code = e.item_code AND i.is_active = true
  WHERE i.item_code IS NULL
),
new_items AS (
  INSERT INTO items (
    item_code,
    item_name,
    category,
    price,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    item_code,
    'IMPORTED FROM EXCEL - 최신단가' || CASE WHEN supplier != '' THEN ' (' || supplier || ')' ELSE '' END,
    '원자재',
    price,
    true,
    NOW(),
    NOW()
  FROM missing_items
  RETURNING item_code, price
)
INSERT INTO item_price_changes (item_code, new_price, change_type)
SELECT item_code, price, 'INSERT' FROM new_items;
`;

// Write SQL to temp file
fs.writeFileSync('scripts/temp-price-import.sql', sql);

console.log('✅ Generated SQL (saved to temp-price-import.sql)');
console.log('📤 Executing via Supabase MCP...\n');

// Output the SQL for manual execution
console.log('SQL Content:');
console.log(sql);

console.log('\n✅ SQL generation complete!');
console.log('📝 Next: Execute this SQL via Supabase MCP tool\n');
