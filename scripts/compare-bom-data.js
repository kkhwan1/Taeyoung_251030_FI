const fs = require('fs');
const path = require('path');

const excelBomPath = path.join(process.cwd(), 'data', 'bom-excel-correct.json');
const excelBom = JSON.parse(fs.readFileSync(excelBomPath, 'utf8'));

console.log('=== BOM 데이터 비교 분석 ===\n');
console.log(`엑셀에서 추출한 BOM 항목: ${excelBom.length}개\n`);

// 엑셀 BOM 데이터를 맵으로 변환 (parent-child 조합으로 키 생성)
const excelBomMap = new Map();
excelBom.forEach(item => {
  const key = `${item.parent_item_code}|${item.child_item_code}`;
  if (!excelBomMap.has(key)) {
    excelBomMap.set(key, item);
  }
});

console.log(`엑셀 고유 BOM 조합: ${excelBomMap.size}개\n`);

// 모품목별 통계
const byParent = {};
excelBom.forEach(item => {
  if (!byParent[item.parent_item_code]) {
    byParent[item.parent_item_code] = [];
  }
  byParent[item.parent_item_code].push(item);
});

console.log('모품목별 BOM 항목 수:');
Object.entries(byParent).forEach(([parent, items]) => {
  console.log(`  ${parent}: ${items.length}개`);
});

// 시트별 통계
const bySheet = {};
excelBom.forEach(item => {
  if (!bySheet[item.sheet]) {
    bySheet[item.sheet] = [];
  }
  bySheet[item.sheet].push(item);
});

console.log('\n시트별 BOM 항목 수:');
Object.entries(bySheet).forEach(([sheet, items]) => {
  console.log(`  ${sheet}: ${items.length}개`);
});

// 결과 저장
const output = {
  total_excel_items: excelBom.length,
  unique_combinations: excelBomMap.size,
  by_parent: byParent,
  by_sheet: bySheet,
  bom_list: excelBom
};

const outputPath = path.join(process.cwd(), 'data', 'bom-analysis.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`\n✅ 분석 결과가 ${outputPath}에 저장되었습니다.`);

