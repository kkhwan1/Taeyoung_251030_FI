const fs = require('fs');
const path = require('path');

const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-excel-data-fixed.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// 섹션별로 분리
const sections = sql.split('-- ============================================');

console.log('=== SQL 섹션 분석 ===\n');
console.log(`총 ${sections.length}개 섹션\n`);

// 각 섹션 추출
const itemsSQL = sections.find(s => s.includes('1. 품목 추가'));
const companiesSQL = sections.find(s => s.includes('2. 거래처 추가'));
const priceHistorySQL = sections.find(s => s.includes('3. 단가 이력 추가'));
const inventorySQL = sections.find(s => s.includes('4. 재고 거래 추가'));

if (itemsSQL) {
  const cleanSQL = itemsSQL.replace(/^-- .*$/gm, '').trim();
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'sql', '1-insert-items.sql'),
    cleanSQL,
    'utf8'
  );
  console.log('✅ 1-insert-items.sql 생성 완료');
  console.log(`   길이: ${cleanSQL.length} bytes\n`);
}

if (companiesSQL) {
  const cleanSQL = companiesSQL.replace(/^-- .*$/gm, '').trim();
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'sql', '2-insert-companies.sql'),
    cleanSQL,
    'utf8'
  );
  console.log('✅ 2-insert-companies.sql 생성 완료');
  console.log(`   길이: ${cleanSQL.length} bytes\n`);
}

if (priceHistorySQL) {
  const cleanSQL = priceHistorySQL.replace(/^-- .*$/gm, '').trim();
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'sql', '3-insert-price-history.sql'),
    cleanSQL,
    'utf8'
  );
  console.log('✅ 3-insert-price-history.sql 생성 완료');
  console.log(`   길이: ${cleanSQL.length} bytes\n`);
}

if (inventorySQL) {
  const cleanSQL = inventorySQL.replace(/^-- .*$/gm, '').trim();
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'sql', '4-insert-inventory.sql'),
    cleanSQL,
    'utf8'
  );
  console.log('✅ 4-insert-inventory.sql 생성 완료');
  console.log(`   길이: ${cleanSQL.length} bytes\n`);
}

console.log('모든 SQL 섹션 파일 생성 완료!');

