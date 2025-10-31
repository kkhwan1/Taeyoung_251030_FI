const fs = require('fs');
const path = require('path');

// DB BOM 데이터 (SQL 결과)
const dbBomData = [
  {parent_code:"502666-1000",child_code:"503666",quantity_required:"1.0000"},
  {parent_code:"502777-1000",child_code:"503777",quantity_required:"1.0000"},
  {parent_code:"503666-L1000",child_code:"503666",quantity_required:"1.0000"},
  {parent_code:"503777-L1000",child_code:"503777",quantity_required:"1.0000"},
  {parent_code:"504666-1000",child_code:"503777",quantity_required:"1.0000"},
  {parent_code:"504667-1000",child_code:"503777",quantity_required:"1.0000"},
  {parent_code:"504777-1000",child_code:"503777",quantity_required:"1.0000"},
  {parent_code:"504778-1000",child_code:"503777",quantity_required:"1.0000"},
  {parent_code:"65510-E2510",child_code:"12900-06161",quantity_required:"2.0000"},
  {parent_code:"65510-E2510",child_code:"13905-06000",quantity_required:"1.0000"},
  {parent_code:"65510-E2510",child_code:"65512-E2510",quantity_required:"1.0000"},
  {parent_code:"65510-E2510",child_code:"65522-E2510",quantity_required:"1.0000"},
  {parent_code:"65510-E2510",child_code:"65567-E2510",quantity_required:"1.0000"},
  {parent_code:"65510-E2510",child_code:"65821-1Y800",quantity_required:"1.0000"},
  {parent_code:"65510-E2510",child_code:"65837-A3000",quantity_required:"1.0000"},
  {parent_code:"65510-E2510",child_code:"65847-A3000",quantity_required:"1.0000"},
  {parent_code:"65510-E2520",child_code:"12900-06161",quantity_required:"2.0000"},
  {parent_code:"65510-E2520",child_code:"13905-06000",quantity_required:"1.0000"},
  {parent_code:"65510-E2520",child_code:"65512-E2510",quantity_required:"1.0000"},
  {parent_code:"65510-E2520",child_code:"65522-E2510",quantity_required:"1.0000"},
  {parent_code:"65510-E2520",child_code:"65523-A3500",quantity_required:"1.0000"},
  {parent_code:"65510-E2520",child_code:"65567-E2510",quantity_required:"1.0000"},
  {parent_code:"65510-E2520",child_code:"65837-A3000",quantity_required:"1.0000"},
  {parent_code:"65510-E2520",child_code:"65847-A3000",quantity_required:"1.0000"},
  {parent_code:"65511-A3000",child_code:"13905-06000",quantity_required:"1.0000"},
  {parent_code:"65511-A3000",child_code:"65512-A3000",quantity_required:"1.0000"},
  {parent_code:"65511-A3000",child_code:"65522-A3000",quantity_required:"1.0000"},
  {parent_code:"65511-A3000",child_code:"65821-1Y800",quantity_required:"2.0000"},
  {parent_code:"65511-A3000",child_code:"65837-A3000",quantity_required:"1.0000"},
  {parent_code:"65511-A3000",child_code:"65847-A3000",quantity_required:"1.0000"},
  {parent_code:"65511-A3500",child_code:"13905-06000",quantity_required:"1.0000"},
  {parent_code:"65511-A3500",child_code:"65512-A3000",quantity_required:"1.0000"},
  {parent_code:"65511-A3500",child_code:"65522-A3000",quantity_required:"1.0000"},
  {parent_code:"65511-A3500",child_code:"65523-A3500",quantity_required:"2.0000"},
  {parent_code:"65511-A3500",child_code:"65821-1Y800",quantity_required:"1.0000"},
  {parent_code:"65511-A3500",child_code:"65837-A3000",quantity_required:"1.0000"},
  {parent_code:"65511-A3500",child_code:"65847-A3000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"13194-08220",quantity_required:"2.0000"},
  {parent_code:"65630-L2000",child_code:"13911-08001",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"13917-10120",quantity_required:"2.0000"},
  {parent_code:"65630-L2000",child_code:"19353-07250",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"65412-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"65422-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"655N6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"655P6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"65639-3K000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"657N2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"657P2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"65832-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"65852-L2000",quantity_required:"1.0000"},
  {parent_code:"65630-L2000",child_code:"65916-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"13911-08001",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"13917-10120",quantity_required:"2.0000"},
  {parent_code:"65630-L2010",child_code:"19353-07250",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"65412-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"65422-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"655N6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"655P6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"65639-3K000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"657N2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"657P2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"65832-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"65852-L2000",quantity_required:"1.0000"},
  {parent_code:"65630-L2010",child_code:"65916-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"13194-08220",quantity_required:"2.0000"},
  {parent_code:"65630-L2020",child_code:"13905-06000",quantity_required:"3.0000"},
  {parent_code:"65630-L2020",child_code:"13911-08001",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"13917-10120",quantity_required:"2.0000"},
  {parent_code:"65630-L2020",child_code:"19353-07250",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"65412-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"65422-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"655N6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"655P6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"657N2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"657P2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"65832-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2020",child_code:"65852-L2000",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"13911-08001",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"13917-10120",quantity_required:"2.0000"},
  {parent_code:"65630-L2800",child_code:"19353-07250",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"65412-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"65422-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"655N6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"655P6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"65639-3K000",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"657N2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"657P2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"65832-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"65852-L3400",quantity_required:"1.0000"},
  {parent_code:"65630-L2800",child_code:"65916-L8400",quantity_required:"1.0000"},
  {parent_code:"65630-L5000",child_code:"13911-08001",quantity_required:"1.0000"},
  {parent_code:"65630-L5000",child_code:"13917-10120",quantity_required:"2.0000"},
  {parent_code:"65630-L5000",child_code:"19353-07250",quantity_required:"2.0000"},
  {parent_code:"65630-L5000",child_code:"65554-D4000",quantity_required:"2.0000"},
  {parent_code:"65630-L5000",child_code:"655N6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5000",child_code:"655P6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5000",child_code:"65639-3K000",quantity_required:"1.0000"},
  {parent_code:"65630-L5000",child_code:"657N2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5000",child_code:"657P2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5000",child_code:"65832-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5000",child_code:"65852-L2000",quantity_required:"1.0000"},
  {parent_code:"65630-L5000",child_code:"65916-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5010",child_code:"13194-08220",quantity_required:"2.0000"},
  {parent_code:"65630-L5010",child_code:"13911-08001",quantity_required:"1.0000"},
  {parent_code:"65630-L5010",child_code:"13917-10120",quantity_required:"2.0000"},
  {parent_code:"65630-L5010",child_code:"19353-07250",quantity_required:"2.0000"},
  {parent_code:"65630-L5010",child_code:"65554-D4000",quantity_required:"2.0000"},
  {parent_code:"65630-L5010",child_code:"655N6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5010",child_code:"655P6-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5010",child_code:"657N2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5010",child_code:"657P2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5010",child_code:"65832-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L5010",child_code:"65852-L2000",quantity_required:"1.0000"},
  {parent_code:"65630-L8400",child_code:"13194-08220",quantity_required:"2.0000"},
  {parent_code:"65630-L8400",child_code:"13911-08001",quantity_required:"1.0000"},
  {parent_code:"65630-L8400",child_code:"13917-10120",quantity_required:"2.0000"},
  {parent_code:"65630-L8400",child_code:"655N6-L8400",quantity_required:"1.0000"},
  {parent_code:"65630-L8400",child_code:"655P6-L8400",quantity_required:"1.0000"},
  {parent_code:"65630-L8400",child_code:"65639-3K000",quantity_required:"1.0000"},
  {parent_code:"65630-L8400",child_code:"657N2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L8400",child_code:"657P2-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L8400",child_code:"65832-L1000",quantity_required:"1.0000"},
  {parent_code:"65630-L8400",child_code:"65852-L3400",quantity_required:"1.0000"},
  {parent_code:"65630-L8400",child_code:"65916-L8400",quantity_required:"1.0000"},
  {parent_code:"65711-A3000",child_code:"65712-A3000",quantity_required:"1.0000"},
  {parent_code:"65711-A3000",child_code:"65779-1Y010",quantity_required:"1.0000"},
  {parent_code:"65711-A3000",child_code:"65798-1Y000",quantity_required:"1.0000"},
  {parent_code:"65711-E2510",child_code:"65712-A3000",quantity_required:"1.0000"},
  {parent_code:"65711-E2510",child_code:"65779-1Y010",quantity_required:"1.0000"},
  {parent_code:"65721-A3000",child_code:"65722-A3000",quantity_required:"1.0000"},
  {parent_code:"65721-A3000",child_code:"65789-1Y010",quantity_required:"1.0000"},
  {parent_code:"657A5-E2510",child_code:"64749-CV000",quantity_required:"1.0000"},
  {parent_code:"657A5-E2510",child_code:"65598-E2510",quantity_required:"1.0000"},
  {parent_code:"657A5-E2510",child_code:"657A6-E2510",quantity_required:"1.0000"},
  {parent_code:"657B5-E2510",child_code:"64749-CV000",quantity_required:"1.0000"},
  {parent_code:"657B5-E2510",child_code:"65598-E2510",quantity_required:"1.0000"},
  {parent_code:"657B5-E2510",child_code:"657B6-E2510",quantity_required:"1.0000"},
  {parent_code:"65852-AT000",child_code:"65722-A3000",quantity_required:"1.0000"}
];

// 엑셀 BOM 데이터
const excelBomPath = path.join(process.cwd(), 'data', 'bom-excel-correct.json');
const excelBom = JSON.parse(fs.readFileSync(excelBomPath, 'utf8'));

console.log('=== BOM 데이터 비교 ===\n');
console.log(`DB BOM 항목: ${dbBomData.length}개`);
console.log(`엑셀 BOM 항목: ${excelBom.length}개\n`);

// DB BOM을 Set으로 변환
const dbBomSet = new Set();
dbBomData.forEach(item => {
  const key = `${item.parent_code}|${item.child_code}`;
  dbBomSet.add(key);
});

// 엑셀에 있지만 DB에 없는 BOM 항목 찾기
const missingBom = [];
excelBom.forEach(item => {
  const key = `${item.parent_item_code}|${item.child_item_code}`;
  if (!dbBomSet.has(key)) {
    missingBom.push(item);
  }
});

console.log(`엑셀에 있지만 DB에 없는 BOM 항목: ${missingBom.length}개\n`);

// 모품목별로 그룹화
const missingByParent = {};
missingBom.forEach(item => {
  if (!missingByParent[item.parent_item_code]) {
    missingByParent[item.parent_item_code] = [];
  }
  missingByParent[item.parent_item_code].push(item);
});

console.log('모품목별 누락된 BOM 항목 수:');
Object.entries(missingByParent)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([parent, items]) => {
    console.log(`  ${parent}: ${items.length}개`);
  });

// 결과 저장
const output = {
  db_bom_count: dbBomData.length,
  excel_bom_count: excelBom.length,
  missing_bom_count: missingBom.length,
  missing_by_parent: missingByParent,
  missing_bom_list: missingBom
};

const outputPath = path.join(process.cwd(), 'data', 'missing-bom-analysis.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`\n✅ 누락된 BOM 분석 결과가 ${outputPath}에 저장되었습니다.`);

// 샘플 출력
console.log(`\n처음 10개 누락된 BOM 항목:`);
missingBom.slice(0, 10).forEach((item, i) => {
  console.log(`  ${i + 1}. ${item.parent_item_code} -> ${item.child_item_code} (${item.quantity})`);
});

