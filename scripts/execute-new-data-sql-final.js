const fs = require('fs');
const path = require('path');

const projectId = 'pybjnkbmtlyaftuiieyq';
const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-new-data.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('=== SQL 파일 섹션 분할 및 적용 ===\n');

// SQL을 섹션별로 분할
const section1Start = sql.indexOf('-- 신규 품목 추가 (중복 확인 후)');
const section1End = sql.indexOf('-- ============================================\n-- 2. 신규 거래처 추가');

const section2Start = sql.indexOf('-- 신규 거래처 추가 (중복 확인 후)');
const section2End = sql.indexOf('-- ============================================\n-- 3. 신규 단가 이력 추가');

const section3Start = sql.indexOf('-- 신규 단가 이력 추가 (중복 확인 후)');
const section3End = sql.indexOf('-- ============================================\n-- 4. 신규 재고 거래 추가');

const section4Start = sql.indexOf('-- 신규 재고 거래 추가');

const sections = [
  { 
    name: '신규 품목 추가', 
    sql: sql.substring(section1Start, section2Start).trim(),
    countQuery: 'SELECT COUNT(*) as count FROM items WHERE is_active = true;'
  },
  { 
    name: '신규 거래처 추가', 
    sql: sql.substring(section2Start, section3Start).trim(),
    countQuery: 'SELECT COUNT(*) as count FROM companies WHERE is_active = true;'
  },
  { 
    name: '신규 단가 이력 추가', 
    sql: sql.substring(section3Start, section4Start).trim(),
    countQuery: 'SELECT COUNT(*) as count FROM item_price_history;'
  },
  { 
    name: '신규 재고 거래 추가', 
    sql: sql.substring(section4Start).trim(),
    countQuery: 'SELECT COUNT(*) as count FROM inventory_transactions;'
  }
];

// 각 섹션을 개별 파일로 저장
sections.forEach((section, index) => {
  const fileName = `new-section-${index + 1}.sql`;
  const filePath = path.join(process.cwd(), 'data', 'sql', fileName);
  fs.writeFileSync(filePath, section.sql, 'utf8');
  console.log(`✅ 섹션 ${index + 1} 저장: ${fileName} (${section.sql.length}자)`);
});

console.log('\n=== SQL 파일 생성 완료 ===');
console.log('각 섹션의 SQL 파일이 생성되었습니다.');
console.log('이제 mcp_supabase_execute_sql을 사용하여 각 섹션을 실행하세요.');

