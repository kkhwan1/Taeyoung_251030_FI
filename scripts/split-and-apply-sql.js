const fs = require('fs');
const path = require('path');

const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-new-data.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('=== SQL 파일 섹션 분할 ===\n');

// SQL을 섹션별로 분할
const section1 = sql.match(/-- 1\. .*?\n(.*?)(?=-- =+|$)/s)?.[1] || '';
const section2 = sql.match(/-- 2\. .*?\n(.*?)(?=-- =+|$)/s)?.[1] || '';
const section3 = sql.match(/-- 3\. .*?\n(.*?)(?=-- =+|$)/s)?.[1] || '';
const section4 = sql.match(/-- 4\. .*?\n(.*?)$/s)?.[1] || '';

const sections = [
  { name: 'items', sql: section1.trim() },
  { name: 'companies', sql: section2.trim() },
  { name: 'price_history', sql: section3.trim() },
  { name: 'inventory_transactions', sql: section4.trim() }
];

sections.forEach((section, idx) => {
  if (section.sql) {
    const filePath = path.join(process.cwd(), 'data', 'sql', `new-${idx + 1}-${section.name}.sql`);
    fs.writeFileSync(filePath, section.sql, 'utf8');
    console.log(`✅ ${idx + 1}. ${section.name}: ${section.sql.length}자`);
  }
});

console.log('\n=== 섹션 분할 완료 ===');

