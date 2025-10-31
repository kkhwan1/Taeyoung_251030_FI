#!/usr/bin/env node
/**
 * Import All 244 Prices from Excel "최신단가" Sheet
 *
 * This script generates SQL to:
 * 1. Backup current prices to a temporary table
 * 2. Update all matching items with Excel prices
 * 3. Insert missing items
 * 4. Create audit log of all changes
 *
 * Usage: node scripts/import-all-excel-prices.js > scripts/generated-price-import.sql
 */

const fs = require('fs');

console.log('-- ============================================');
console.log('-- Full Price Import from Excel "최신단가"');
console.log('-- Generated:', new Date().toISOString());
console.log('-- Total Records: 244');
console.log('-- ============================================\n');

// Load Excel price data
const excelPrices = JSON.parse(
  fs.readFileSync('scripts/bom-latest-prices.json', 'utf8')
);

console.log('BEGIN;\n');

// Create backup table
console.log('-- ============================================');
console.log('-- STEP 1: Backup Current Prices');
console.log('-- ============================================\n');

console.log('DROP TABLE IF EXISTS items_price_backup_' + Date.now() + ';');
console.log('CREATE TABLE items_price_backup_' + Date.now() + ' AS');
console.log('SELECT item_id, item_code, item_name, price, updated_at');
console.log('FROM items WHERE is_active = true;\n');

// Create audit log table if not exists
console.log('-- ============================================');
console.log('-- STEP 2: Create Audit Log Table');
console.log('-- ============================================\n');

console.log('CREATE TABLE IF NOT EXISTS item_price_changes (');
console.log('  change_id SERIAL PRIMARY KEY,');
console.log('  item_code VARCHAR(50) NOT NULL,');
console.log('  old_price NUMERIC(15,2),');
console.log('  new_price NUMERIC(15,2) NOT NULL,');
console.log('  price_diff NUMERIC(15,2),');
console.log('  change_type VARCHAR(20) NOT NULL, -- INSERT, UPDATE, NO_CHANGE');
console.log('  excel_supplier VARCHAR(100),');
console.log('  changed_at TIMESTAMP DEFAULT NOW()');
console.log(');\n');

// Generate UPDATE statements for existing items
console.log('-- ============================================');
console.log('-- STEP 3: Update Existing Items (CTE Method)');
console.log('-- ============================================\n');

console.log('WITH excel_prices AS (');
console.log('  SELECT item_code, price, supplier FROM (VALUES');

excelPrices.forEach((item, index) => {
  const isLast = index === excelPrices.length - 1;
  const comma = isLast ? '' : ',';
  console.log(
    `    ('${item.item_code}', ${item.price}, '${item.supplier}')${comma}`
  );
});

console.log('  ) AS t(item_code, price, supplier)');
console.log('),');
console.log('price_updates AS (');
console.log('  UPDATE items i');
console.log('  SET');
console.log('    price = e.price,');
console.log('    updated_at = NOW()');
console.log('  FROM excel_prices e');
console.log('  WHERE i.item_code = e.item_code');
console.log('    AND i.is_active = true');
console.log('    AND (i.price IS NULL OR ABS(i.price - e.price) > 0.01)');
console.log('  RETURNING i.item_code, i.price as new_price, e.supplier');
console.log(')');
console.log('INSERT INTO item_price_changes (item_code, new_price, change_type, excel_supplier)');
console.log('SELECT item_code, new_price, \'UPDATE\', supplier FROM price_updates;\n');

// Generate INSERT statements for missing items
console.log('-- ============================================');
console.log('-- STEP 4: Insert Missing Items');
console.log('-- ============================================\n');

console.log('WITH excel_prices AS (');
console.log('  SELECT item_code, price, supplier FROM (VALUES');

excelPrices.forEach((item, index) => {
  const isLast = index === excelPrices.length - 1;
  const comma = isLast ? '' : ',';
  console.log(
    `    ('${item.item_code}', ${item.price}, '${item.supplier}')${comma}`
  );
});

console.log('  ) AS t(item_code, price, supplier)');
console.log('),');
console.log('missing_items AS (');
console.log('  SELECT e.item_code, e.price, e.supplier');
console.log('  FROM excel_prices e');
console.log('  LEFT JOIN items i ON i.item_code = e.item_code AND i.is_active = true');
console.log('  WHERE i.item_code IS NULL');
console.log('),');
console.log('new_items AS (');
console.log('  INSERT INTO items (');
console.log('    item_code,');
console.log('    item_name,');
console.log('    category,');
console.log('    price,');
console.log('    is_active,');
console.log('    created_at,');
console.log('    updated_at');
console.log('  )');
console.log('  SELECT');
console.log('    item_code,');
console.log('    \'IMPORTED FROM EXCEL - 최신단가\' || CASE WHEN supplier != \'\' THEN \' (\' || supplier || \')\' ELSE \'\' END,');
console.log('    \'원자재\',');
console.log('    price,');
console.log('    true,');
console.log('    NOW(),');
console.log('    NOW()');
console.log('  FROM missing_items');
console.log('  RETURNING item_code, price');
console.log(')');
console.log('INSERT INTO item_price_changes (item_code, new_price, change_type)');
console.log('SELECT item_code, price, \'INSERT\' FROM new_items;\n');

// Verification queries
console.log('-- ============================================');
console.log('-- STEP 5: Verification & Statistics');
console.log('-- ============================================\n');

console.log('-- Summary of changes');
console.log('SELECT');
console.log('  change_type,');
console.log('  COUNT(*) as count,');
console.log('  ROUND(AVG(new_price), 2) as avg_price,');
console.log('  MIN(new_price) as min_price,');
console.log('  MAX(new_price) as max_price');
console.log('FROM item_price_changes');
console.log('WHERE changed_at >= NOW() - INTERVAL \'1 minute\'');
console.log('GROUP BY change_type;');
console.log('');

console.log('-- Items with largest price changes');
console.log('SELECT');
console.log('  ipc.item_code,');
console.log('  i.item_name,');
console.log('  ipc.old_price,');
console.log('  ipc.new_price,');
console.log('  ipc.price_diff,');
console.log('  ROUND(ABS(ipc.price_diff) / NULLIF(ipc.old_price, 0) * 100, 2) as percent_change');
console.log('FROM item_price_changes ipc');
console.log('JOIN items i ON i.item_code = ipc.item_code');
console.log('WHERE ipc.changed_at >= NOW() - INTERVAL \'1 minute\'');
console.log('  AND ipc.change_type = \'UPDATE\'');
console.log('  AND ABS(ipc.price_diff) > 100');
console.log('ORDER BY ABS(ipc.price_diff) DESC');
console.log('LIMIT 20;');
console.log('');

console.log('-- Overall database price coverage');
console.log('SELECT');
console.log('  COUNT(*) as total_items,');
console.log('  COUNT(CASE WHEN price IS NOT NULL THEN 1 END) as items_with_price,');
console.log('  COUNT(CASE WHEN price IS NULL THEN 1 END) as items_without_price,');
console.log('  ROUND(COUNT(CASE WHEN price IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as price_coverage_pct');
console.log('FROM items');
console.log('WHERE is_active = true;');

console.log('\nCOMMIT;');
console.log('\n-- To rollback: ROLLBACK;');

console.error('\n✅ SQL generation complete!');
console.error('📊 Generated statements for 244 price records');
console.error('📝 Review the output before execution');
console.error('\n💡 To save: node scripts/import-all-excel-prices.js > scripts/generated-price-import.sql');
