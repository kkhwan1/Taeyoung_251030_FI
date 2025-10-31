const fs = require('fs');
const path = require('path');

const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-excel-data-fixed.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// 섹션별로 분리
const sections = sql.split('-- ============================================');

console.log('=== SQL 섹션 실행 계획 ===\n');

const sectionFiles = {
  1: 'section-3.sql',  // 품목 추가
  2: 'section-5.sql',  // 거래처 추가 (없음)
  3: 'section-7.sql',  // 단가 이력 추가
  4: 'section-9.sql'   // 재고 거래 추가 (없음)
};

// 섹션 내용 추출
let sectionIndex = 0;
sections.forEach((section, idx) => {
  if (section.trim() && section.includes('INSERT INTO')) {
    sectionIndex++;
    const title = section.match(/--\s*[0-9]+\.\s*([^\n]+)/)?.[1] || `섹션 ${idx}`;
    console.log(`섹션 ${sectionIndex}: ${title}`);
    
    // 주석 제거 및 SQL만 추출
    const cleanSQL = section
      .replace(/^--[^\n]*$/gm, '')
      .trim();
    
    if (cleanSQL) {
      const fileName = `section-${sectionIndex}.sql`;
      const filePath = path.join(process.cwd(), 'data', 'sql', fileName);
      fs.writeFileSync(filePath, cleanSQL, 'utf8');
      console.log(`  → ${fileName} 생성 완료 (${cleanSQL.length}자)`);
    }
  }
});

console.log('\n=== 섹션별 SQL 파일 생성 완료 ===');
console.log('\n각 섹션 파일을 Supabase execute_sql로 실행해야 합니다.');

