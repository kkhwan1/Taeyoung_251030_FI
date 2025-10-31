const fs = require('fs');
const path = require('path');

const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-excel-data-fixed.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// 섹션별로 분리
const sections = sql.split('-- ============================================');

console.log(`총 ${sections.length}개 섹션 발견\n`);

sections.forEach((section, idx) => {
  if (section.trim()) {
    const lines = section.trim().split('\n');
    const title = lines.find(l => l.includes('1.') || l.includes('2.') || l.includes('3.') || l.includes('4.'));
    if (title) {
      console.log(`섹션 ${idx + 1}: ${title.trim()}`);
      console.log(`  SQL 길이: ${section.length}자\n`);
      
      // 각 섹션을 별도 파일로 저장
      const sectionFile = path.join(process.cwd(), 'data', 'sql', `section-${idx + 1}.sql`);
      fs.writeFileSync(sectionFile, section, 'utf8');
    }
  }
});

console.log('\n섹션별 SQL 파일 생성 완료');

