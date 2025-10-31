const fs = require('fs');
const path = require('path');

const missingBomPath = path.join(process.cwd(), 'data', 'missing-bom-analysis.json');
const missingData = JSON.parse(fs.readFileSync(missingBomPath, 'utf8'));

const missingBom = missingData.missing_bom_list;

console.log('=== BOM INSERT SQL 생성 ===\n');
console.log(`누락된 BOM 항목: ${missingBom.length}개\n`);

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// SQL 생성
const sql = `
-- 누락된 BOM 항목 추가
-- 생성일: ${new Date().toISOString()}
-- 엑셀 파일: 태창금속 BOM.xlsx

INSERT INTO bom (parent_item_id, child_item_id, quantity_required, level_no, is_active, created_at, updated_at)
SELECT 
  p.item_id as parent_item_id,
  c.item_id as child_item_id,
  bom_data.quantity_required,
  1 as level_no,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM (
  VALUES
${missingBom.map((item, idx) => {
  const comma = idx < missingBom.length - 1 ? ',' : '';
  return `    (${escapeSQL(item.parent_item_code)}, ${escapeSQL(item.child_item_code)}, ${item.quantity || 1})${comma}`;
}).join('\n')}
) AS bom_data(parent_item_code, child_item_code, quantity_required)
INNER JOIN items p ON p.item_code = bom_data.parent_item_code
INNER JOIN items c ON c.item_code = bom_data.child_item_code
WHERE NOT EXISTS (
  SELECT 1 FROM bom 
  WHERE bom.parent_item_id = p.item_id 
    AND bom.child_item_id = c.item_id
    AND bom.is_active = true
)
ON CONFLICT (parent_item_id, child_item_id) DO NOTHING;
`;

// SQL 파일 저장
const outputPath = path.join(process.cwd(), 'data', 'sql', 'insert-missing-bom.sql');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sql, 'utf8');

console.log(`✅ SQL 파일 생성 완료: ${outputPath}`);
console.log(`   SQL 길이: ${sql.length}자`);
console.log(`   INSERT 항목 수: ${missingBom.length}개`);

// 통계
const byParent = {};
missingBom.forEach(item => {
  if (!byParent[item.parent_item_code]) byParent[item.parent_item_code] = 0;
  byParent[item.parent_item_code]++;
});

console.log(`\n모품목별 추가 예정 BOM 항목 수 (상위 10개):`);
Object.entries(byParent)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([parent, count]) => {
    console.log(`  ${parent}: ${count}개`);
  });

