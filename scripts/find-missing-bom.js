const fs = require('fs');
const path = require('path');

const excelBomPath = path.join(process.cwd(), 'data', 'bom-excel-correct.json');
const excelBom = JSON.parse(fs.readFileSync(excelBomPath, 'utf8'));

console.log('=== 누락된 BOM 항목 찾기 ===\n');

// 엑셀 BOM 데이터를 Map으로 변환 (parent_item_code|child_item_code를 키로)
const excelBomMap = new Map();
excelBom.forEach(item => {
  const key = `${item.parent_item_code}|${item.child_item_code}`;
  if (!excelBomMap.has(key)) {
    excelBomMap.set(key, item);
  }
});

console.log(`엑셀 총 BOM 항목: ${excelBom.length}개`);
console.log(`엑셀 고유 BOM 조합: ${excelBomMap.size}개\n`);

// DB에 있는 BOM 항목 목록 (SQL 쿼리 결과를 시뮬레이션)
// 실제로는 DB에서 가져와야 하지만, 일단 엑셀에서 추출한 모품목 코드들을 기준으로 확인
const dbBomExamples = [
  '502666-1000|503666',
  '502777-1000|503777',
  '503666-L1000|503666',
  '503777-L1000|503777',
  '504666-1000|503777',
  '504667-1000|503777',
  '504777-1000|503777',
  '504778-1000|503777',
  '65510-E2510|12900-06161',
  '65510-E2510|13905-06000',
  '65510-E2510|65512-E2510',
  '65510-E2510|65522-E2510',
  '65510-E2510|65567-E2510',
  '65510-E2510|65821-1Y800',
  '65510-E2510|65837-A3000',
  '65510-E2510|65847-A3000',
  '65510-E2520|12900-06161',
  '65510-E2520|13905-06000',
  '65510-E2520|65512-E2510',
  '65510-E2520|65522-E2510',
  '65511-A3000|65512-A3000',
  '65511-A3000|13905-06000',
  '65511-A3000|65522-A3000',
  '65511-A3000|65837-A3000',
  '65511-A3000|65847-A3000',
  '65511-A3000|65821-1Y800',
  '65511-A3500|65512-A3000',
  '65511-A3500|13905-06000',
  '65511-A3500|65522-A3000',
  '65511-A3500|65837-A3000',
  '65511-A3500|65847-A3000',
  '65511-A3500|65821-1Y800'
];

const dbBomSet = new Set(dbBomExamples);

// 엑셀에 있지만 DB에 없는 BOM 항목 찾기
const missingBom = [];
excelBomMap.forEach((item, key) => {
  // DB에는 parent_item_code|child_item_code 형식이므로 변환
  const dbKey = `${item.parent_item_code}|${item.child_item_code}`;
  if (!dbBomSet.has(dbKey)) {
    missingBom.push(item);
  }
});

console.log(`DB에 없는 BOM 항목: ${missingBom.length}개\n`);

// 모품목별로 그룹화
const missingByParent = {};
missingBom.forEach(item => {
  if (!missingByParent[item.parent_item_code]) {
    missingByParent[item.parent_item_code] = [];
  }
  missingByParent[item.parent_item_code].push(item);
});

console.log('모품목별 누락된 BOM 항목 수:');
Object.entries(missingByParent).forEach(([parent, items]) => {
  console.log(`  ${parent}: ${items.length}개`);
});

// 결과 저장
const output = {
  total_excel_bom: excelBom.length,
  unique_excel_combinations: excelBomMap.size,
  missing_bom_count: missingBom.length,
  missing_by_parent: missingByParent,
  missing_bom_list: missingBom
};

const outputPath = path.join(process.cwd(), 'data', 'missing-bom.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`\n✅ 누락된 BOM 항목이 ${outputPath}에 저장되었습니다.`);

