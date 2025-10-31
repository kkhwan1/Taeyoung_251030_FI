const fs = require('fs');
const path = require('path');

const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-missing-bom.sql');
let sql = fs.readFileSync(sqlPath, 'utf8');

// VALUES 부분을 추출
const valuesMatch = sql.match(/VALUES\s+([\s\S]*?)\s+AS b/);
if (!valuesMatch) {
  console.error('VALUES 섹션을 찾을 수 없습니다.');
  process.exit(1);
}

const valuesStr = valuesMatch[1];
const lines = valuesStr.split(',').map(l => l.trim()).filter(l => l.startsWith('('));

console.log(`총 ${lines.length}개 BOM 항목 확인 중...\n`);

// 자기 참조 항목 제거 (parent_item_code === child_item_code)
const filteredLines = lines.filter(line => {
  const match = line.match(/\('([^']+)',\s*'([^']+)',\s*(\d+)\)/);
  if (match) {
    const parent = match[1];
    const child = match[2];
    if (parent === child) {
      console.log(`자기 참조 항목 제거: ${parent} -> ${child}`);
      return false;
    }
  }
  return true;
});

console.log(`\n제거 후: ${filteredLines.length}개 BOM 항목\n`);

// 새로운 VALUES 문자열 생성
const newValuesStr = filteredLines.join(',\n    ');

// SQL 수정
sql = sql.replace(/VALUES\s+[\s\S]*?\s+AS b/, `VALUES\n    ${newValuesStr}\n) AS b`);

// 수정된 SQL 저장
fs.writeFileSync(sqlPath, sql, 'utf8');
console.log('✅ 자기 참조 항목 제거 완료');

