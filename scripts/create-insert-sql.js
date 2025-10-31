const fs = require('fs');
const path = require('path');

// 추출된 엑셀 데이터 읽기
const extractedDataPath = path.join(process.cwd(), 'data', 'extracted-excel-data.json');
const extractedData = JSON.parse(fs.readFileSync(extractedDataPath, 'utf8'));

console.log('=== INSERT SQL 생성 ===\n');

// INSERT SQL 생성 함수
function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function escapeSQLNullable(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return escapeSQL(str);
}

// 품목 INSERT SQL 생성
const itemCodes = extractedData.items.map(item => item.item_code);
const itemsSQL = `
-- 신규 품목 추가 (중복 확인 후)
INSERT INTO items (item_code, item_name, spec, unit, category, material, thickness, width, height, current_stock, is_active, created_at, updated_at)
SELECT 
  item_code,
  item_name,
  spec,
  unit,
  category,
  material,
  thickness,
  width,
  height,
  0 as current_stock,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  VALUES
${extractedData.items.map((item, idx) => {
  return `    (${escapeSQL(item.item_code)}, ${escapeSQLNullable(item.item_name)}, ${escapeSQLNullable(item.spec || null)}, ${escapeSQLNullable(item.unit || 'PCS')}, ${escapeSQLNullable(item.category || '원자재')}, ${escapeSQLNullable(item.material || null)}, ${item.thickness || 'NULL'}, ${item.width || 'NULL'}, ${item.height || 'NULL'})`;
}).join(',\n')}
) AS new_items(item_code, item_name, spec, unit, category, material, thickness, width, height)
WHERE NOT EXISTS (
  SELECT 1 FROM items WHERE items.item_code = new_items.item_code
)
ON CONFLICT (item_code) DO NOTHING;
`;

// 거래처 INSERT SQL 생성
const companiesSQL = `
-- 신규 거래처 추가
INSERT INTO companies (company_name, company_type, is_active, created_at, updated_at)
SELECT 
  company_name,
  company_type::company_type_enum,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  VALUES
${extractedData.companies.map((comp, idx) => {
  return `    (${escapeSQL(comp.company_name)}, ${escapeSQL(comp.company_type || 'SUPPLIER')})`;
}).join(',\n')}
) AS new_companies(company_name, company_type)
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE companies.company_name = new_companies.company_name
);
`;

// 단가 이력 INSERT SQL 생성 (item_id와 company_id 조회 필요)
const priceHistorySQL = `
-- 단가 이력 추가 (품목 ID와 거래처 ID 조회)
INSERT INTO item_price_history (item_id, company_id, unit_price, price_date, created_at)
SELECT 
  i.item_id,
  c.company_id,
  ph.unit_price,
  CASE 
    WHEN ph.price_date = '4월기준' THEN DATE '2025-04-01'
    ELSE CURRENT_DATE
  END as price_date,
  NOW() as created_at
FROM (
  VALUES
${extractedData.price_history.map((ph, idx) => {
  return `    (${escapeSQL(ph.item_code)}, ${escapeSQLNullable(ph.supplier_name)}, ${ph.unit_price || 0})`;
}).join(',\n')}
) AS ph(item_code, supplier_name, unit_price)
INNER JOIN items i ON i.item_code = ph.item_code
LEFT JOIN companies c ON c.company_name = ph.supplier_name
WHERE NOT EXISTS (
  SELECT 1 FROM item_price_history 
  WHERE item_price_history.item_id = i.item_id 
    AND item_price_history.company_id = c.company_id
    AND item_price_history.price_date = CASE 
      WHEN ph.price_date = '4월기준' THEN DATE '2025-04-01'
      ELSE CURRENT_DATE
    END
);
`;

// 재고 거래 INSERT SQL 생성
const inventoryTransactionsSQL = `
-- 재고 거래 추가
INSERT INTO inventory_transactions (transaction_date, transaction_type, item_id, company_id, quantity, unit, reference_number, created_at, updated_at)
SELECT 
  ph.transaction_date::date,
  ph.transaction_type::transaction_type_enum,
  i.item_id,
  c.company_id,
  ph.quantity,
  ph.unit,
  ph.reference_number,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  VALUES
${extractedData.inventory_transactions.map((inv, idx) => {
  return `    (${escapeSQL(inv.transaction_date || '2025-09-01')}, ${escapeSQL(inv.transaction_type || '입고')}, ${escapeSQL(inv.item_code)}, ${escapeSQLNullable(inv.company_name)}, ${inv.quantity || 0}, ${escapeSQLNullable(inv.unit || 'PCS')}, ${escapeSQLNullable(inv.reference_number || null)})`;
}).join(',\n')}
) AS ph(transaction_date, transaction_type, item_code, company_name, quantity, unit, reference_number)
INNER JOIN items i ON i.item_code = ph.item_code
LEFT JOIN companies c ON c.company_name = ph.company_name;
`;

// SQL 파일 저장
const sqlDir = path.join(process.cwd(), 'data', 'sql');
if (!fs.existsSync(sqlDir)) {
  fs.mkdirSync(sqlDir, { recursive: true });
}

const allSQL = `-- 엑셀 데이터를 DB에 추가하는 SQL
-- 생성일: ${new Date().toISOString()}
-- 엑셀 파일: .example 폴더의 파일들

-- ============================================
-- 1. 품목 추가 (중복 확인)
-- ============================================
${itemsSQL}

-- ============================================
-- 2. 거래처 추가
-- ============================================
${companiesSQL}

-- ============================================
-- 3. 단가 이력 추가
-- ============================================
${priceHistorySQL}

-- ============================================
-- 4. 재고 거래 추가
-- ============================================
${inventoryTransactionsSQL}
`;

fs.writeFileSync(
  path.join(sqlDir, 'insert-excel-data.sql'),
  allSQL,
  'utf8'
);

console.log('INSERT SQL 생성 완료:');
console.log(`  - 품목: ${extractedData.items.length}개`);
console.log(`  - 거래처: ${extractedData.companies.length}개`);
console.log(`  - 단가 이력: ${extractedData.price_history.length}개`);
console.log(`  - 재고 거래: ${extractedData.inventory_transactions.length}개`);
console.log(`\nSQL 파일이 data/sql/insert-excel-data.sql에 저장되었습니다.`);

