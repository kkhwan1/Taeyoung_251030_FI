const fs = require('fs');
const path = require('path');

// This script will be run in the terminal
// It reads the SQL file and executes sections sequentially

const projectId = 'pybjnkbmtlyaftuiieyq';
const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-new-data.sql');

if (!fs.existsSync(sqlPath)) {
  console.error('SQL 파일을 찾을 수 없습니다:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('=== SQL 파일 섹션 분할 ===\n');

// Extract sections using regex
const section1Match = sql.match(/-- =+\n-- 1\. 신규 품목 추가\n-- =+\n([\s\S]*?)(?=-- =+\n-- 2\.|$)/);
const section2Match = sql.match(/-- =+\n-- 2\. 신규 거래처 추가\n-- =+\n([\s\S]*?)(?=-- =+\n-- 3\.|$)/);
const section3Match = sql.match(/-- =+\n-- 3\. 신규 단가 이력 추가\n-- =+\n([\s\S]*?)(?=-- =+\n-- 4\.|$)/);
const section4Match = sql.match(/-- =+\n-- 4\. 신규 재고 거래 추가\n-- =+\n([\s\S]*?)$/);

const sections = [
  { name: '신규 품목 추가', sql: section1Match ? section1Match[1].trim() : '' },
  { name: '신규 거래처 추가', sql: section2Match ? section2Match[1].trim() : '' },
  { name: '신규 단가 이력 추가', sql: section3Match ? section3Match[1].trim() : '' },
  { name: '신규 재고 거래 추가', sql: section4Match ? section4Match[1].trim() : '' }
];

console.log('섹션 확인:');
sections.forEach((section, idx) => {
  console.log(`  ${idx + 1}. ${section.name}: ${section.sql.length}자`);
});

// Save each section to a separate file
sections.forEach((section, idx) => {
  if (section.sql) {
    const fileName = `new-section-${idx + 1}.sql`;
    const filePath = path.join(process.cwd(), 'data', 'sql', fileName);
    fs.writeFileSync(filePath, section.sql, 'utf8');
    console.log(`\n✅ ${section.name} 섹션 저장: ${fileName}`);
  }
});

console.log('\n=== 섹션 분할 완료 ===');
console.log('\n다음 단계: mcp_supabase_execute_sql을 사용하여 각 섹션을 실행하세요.');

