const fs = require('fs');
const path = require('path');

const sqlPath = path.join(process.cwd(), 'data', 'sql', 'insert-missing-bom.sql');
let sql = fs.readFileSync(sqlPath, 'utf8');

console.log('=== BOM SQL 파일 수정 ===\n');

// (PAD) 또는 특수 문자 포함된 품목 코드 처리
// DB에는 실제 품목 코드가 다를 수 있으므로 해당 항목 제외
const problematicCodes = [
  '69156-DO000 (PAD)',
  '69166-DO000 (PAD)',
  '69162-G8000'
];

// 문제가 있는 항목 제거
let removedCount = 0;
problematicCodes.forEach(code => {
  const pattern = new RegExp(`\\('${code.replace(/[()]/g, '\\$&')}', '[^']+', [0-9.]+\\),?\\s*`, 'g');
  if (sql.match(pattern)) {
    sql = sql.replace(pattern, '');
    removedCount++;
  }
});

// 빈 줄 정리
sql = sql.replace(/\n\s*\n\s*\n/g, '\n\n');

// 마지막 VALUES의 마지막 항목 뒤 쉼표 제거
sql = sql.replace(/,\s*\n\s*\) AS bom_data/m, '\n) AS bom_data');

// 수정된 SQL 저장
fs.writeFileSync(sqlPath, sql, 'utf8');

console.log(`제거된 문제 코드 항목: ${removedCount}개`);
console.log(`✅ SQL 파일 수정 완료: ${sqlPath}`);

// 통계
const valuesMatch = sql.match(/VALUES\s*([\s\S]*?)\) AS bom_data/);
if (valuesMatch) {
  const valuesContent = valuesMatch[1];
  const valueLines = valuesContent.split('\n').filter(line => line.trim().match(/^\('/));
  console.log(`남은 VALUES 항목 수: ${valueLines.length}개`);
}

