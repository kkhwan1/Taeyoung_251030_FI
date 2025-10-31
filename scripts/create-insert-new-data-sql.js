const fs = require('fs');
const path = require('path');

const outputDir = path.join(process.cwd(), 'data');
const sqlDir = path.join(process.cwd(), 'data', 'sql');

// 최종 추출 데이터 읽기
const finalDataPath = path.join(outputDir, 'extracted-excel-data-final.json');
const finalData = JSON.parse(fs.readFileSync(finalDataPath, 'utf8'));

console.log('=== 신규 데이터 INSERT SQL 생성 ===\n');

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function escapeSQLNullable(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return escapeSQL(str);
}

// 1. 신규 품목 추가 SQL
const newItems = finalData.items.filter(item => {
  // 기본 정보만 있는 품목도 포함 (이미 DB에 있을 수 있지만 중복 체크로 처리)
  return item.item_code;
});

console.log(`총 품목: ${newItems.length}개`);
console.log(`신규 품목 SQL 생성 중...`);

const itemsSQL = `
-- 신규 품목 추가 (중복 확인 후)
INSERT INTO items (item_code, item_name, spec, unit, category, material, thickness, width, height, current_stock, is_active, created_at, updated_at)
SELECT 
  item_code,
  item_name,
  spec,
  unit,
  category::item_category,
  material,
  thickness,
  width,
  height,
  COALESCE(current_stock, 0) as current_stock,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  VALUES
${newItems.map(item => `    (${escapeSQL(item.item_code)}, ${escapeSQLNullable(item.item_name)}, ${escapeSQLNullable(item.spec)}, ${escapeSQL(item.unit || 'PCS')}, ${escapeSQL(item.category || '원자재')}, ${escapeSQLNullable(item.material)}, ${item.thickness || 'NULL'}, ${item.width || 'NULL'}, ${item.height || 'NULL'}, ${item.current_stock || 0})`).join(',\n')}
) AS new_items(item_code, item_name, spec, unit, category, material, thickness, width, height, current_stock)
WHERE NOT EXISTS (
  SELECT 1 FROM items WHERE items.item_code = new_items.item_code
)
ON CONFLICT (item_code) DO NOTHING;
`;

// 2. 신규 거래처 추가 SQL
const newCompanies = finalData.companies.filter(company => {
  return company.company_name;
});

console.log(`총 거래처: ${newCompanies.length}개`);
console.log(`신규 거래처 SQL 생성 중...`);

const companiesSQL = `
-- 신규 거래처 추가 (중복 확인 후)
INSERT INTO companies (company_code, company_name, company_type, is_active, created_at, updated_at)
SELECT 
  COALESCE(company_code, SUBSTRING(company_name, 1, 10)) as company_code,
  company_name,
  company_type::company_type,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  VALUES
${newCompanies.map(company => `    (${escapeSQLNullable(company.company_code)}, ${escapeSQL(company.company_name)}, ${escapeSQL(company.company_type || '공급사')})`).join(',\n')}
) AS new_companies(company_code, company_name, company_type)
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE companies.company_name = new_companies.company_name
)
ON CONFLICT (company_name) DO NOTHING;
`;

// 3. 신규 단가 이력 추가 SQL
const newPriceHistory = finalData.price_history.filter(ph => {
  return ph.item_code && ph.unit_price && !isNaN(ph.unit_price);
});

console.log(`총 단가 이력: ${newPriceHistory.length}개`);
console.log(`신규 단가 이력 SQL 생성 중...`);

const priceHistorySQL = `
-- 신규 단가 이력 추가 (중복 확인 후)
INSERT INTO item_price_history (item_id, unit_price, price_month, created_at)
SELECT 
  i.item_id,
  ph.unit_price,
  CASE 
    WHEN ph.price_date = '4월기준' THEN DATE '2025-04-01'
    ELSE DATE_TRUNC('month', CURRENT_DATE)::date
  END as price_month,
  NOW() as created_at
FROM (
  VALUES
${newPriceHistory.map(ph => `    (${escapeSQL(ph.item_code)}, ${escapeSQLNullable(ph.supplier_name)}, ${escapeSQLNullable(ph.price_date)}, ${ph.unit_price})`).join(',\n')}
) AS ph(item_code, supplier_name, price_date, unit_price)
INNER JOIN items i ON i.item_code = ph.item_code
WHERE NOT EXISTS (
  SELECT 1 FROM item_price_history 
  WHERE item_price_history.item_id = i.item_id 
    AND item_price_history.price_month = CASE 
      WHEN ph.price_date = '4월기준' THEN DATE '2025-04-01'
      ELSE DATE_TRUNC('month', CURRENT_DATE)
    END
);
`;

// 4. 신규 재고 거래 추가 SQL
const newInventoryTransactions = finalData.inventory_transactions.filter(t => {
  return t.item_code && t.quantity && !isNaN(t.quantity);
});

console.log(`총 재고 거래: ${newInventoryTransactions.length}개`);
console.log(`신규 재고 거래 SQL 생성 중...`);

const inventorySQL = `
-- 신규 재고 거래 추가
INSERT INTO inventory_transactions (transaction_date, transaction_type, item_id, company_id, quantity, reference_number, created_at, updated_at)
SELECT 
  ph.transaction_date::date,
  ph.transaction_type::transaction_type,
  i.item_id,
  c.company_id,
  ph.quantity,
  ph.reference_number,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  VALUES
${newInventoryTransactions.map(t => `    ('${t.transaction_date || '2025-09-01'}', '${t.transaction_type || '입고'}', ${escapeSQL(t.item_code)}, ${escapeSQLNullable(t.company_name)}, ${t.quantity}, ${escapeSQLNullable(t.reference_number)})`).join(',\n')}
) AS ph(transaction_date, transaction_type, item_code, company_name, quantity, reference_number)
INNER JOIN items i ON i.item_code = ph.item_code
LEFT JOIN companies c ON c.company_name = ph.company_name;
`;

// 전체 SQL 생성
const fullSQL = `
-- 미분석 엑셀 파일에서 추출한 신규 데이터 추가
-- 생성일: ${new Date().toISOString()}
-- 데이터 소스: 
--   - 2025년 9월 매입매출 보고현황.xlsx
--   - 2025년 9월 종합관리 SHEET.xlsx
--   - 09월 원자재 수불관리.xlsx

-- ============================================
-- 1. 신규 품목 추가
-- ============================================
${itemsSQL}

-- ============================================
-- 2. 신규 거래처 추가
-- ============================================
${companiesSQL}

-- ============================================
-- 3. 신규 단가 이력 추가
-- ============================================
${priceHistorySQL}

-- ============================================
-- 4. 신규 재고 거래 추가
-- ============================================
${inventorySQL}
`;

fs.mkdirSync(sqlDir, { recursive: true });
fs.writeFileSync(
  path.join(sqlDir, 'insert-new-data.sql'),
  fullSQL,
  'utf8'
);

console.log('\n=== SQL 생성 완료 ===');
console.log(`저장 위치: data/sql/insert-new-data.sql`);
console.log(`SQL 길이: ${fullSQL.length}자`);
console.log(`\n통계:`);
console.log(`  - 품목: ${newItems.length}개`);
console.log(`  - 거래처: ${newCompanies.length}개`);
console.log(`  - 단가 이력: ${newPriceHistory.length}개`);
console.log(`  - 재고 거래: ${newInventoryTransactions.length}개`);

