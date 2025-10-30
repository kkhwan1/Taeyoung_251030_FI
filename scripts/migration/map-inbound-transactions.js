const fs = require('fs');
const path = require('path');

// 입고 데이터 파일 로드
const files = [
  'inbound-coop.json',
  'inbound-daewoo.json',
  'inbound-howon.json',
  'inbound-partners.json'
];

const dataDir = path.join(__dirname, 'data', 'clean-data');
let allRecords = [];

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  allRecords = allRecords.concat(data);
});

console.log(`총 ${allRecords.length}개 입고 레코드 로드됨`);

// 고유 협력사 목록 추출
const uniqueCompanies = [...new Set(allRecords
  .map(r => r['협력사'])
  .filter(c => c && c.trim()))];

console.log(`\n고유 협력사 ${uniqueCompanies.length}개:`);
console.log(uniqueCompanies.join(', '));

// 고유 P/NO 목록 추출
const uniqueItemCodes = [...new Set(allRecords
  .map(r => r['P/NO'])
  .filter(c => c && typeof c === 'string' && c.trim()))];

console.log(`\n고유 P/NO ${uniqueItemCodes.length}개`);

// 유효하지 않은 P/NO 확인
const invalidPNO = allRecords
  .filter(r => !r['P/NO'] || typeof r['P/NO'] !== 'string' || !r['P/NO'].trim())
  .map(r => ({ NO: r.NO, 협력사: r['협력사'], 'P/NO': r['P/NO'] }));

if (invalidPNO.length > 0) {
  console.log(`\n경고: 유효하지 않은 P/NO ${invalidPNO.length}개`);
}

// 매핑용 데이터 저장
fs.writeFileSync(
  path.join(dataDir, 'inbound-mapping-data.json'),
  JSON.stringify({
    total_records: allRecords.length,
    unique_companies: uniqueCompanies,
    unique_item_codes: uniqueItemCodes,
    sample_records: allRecords.slice(0, 5)
  }, null, 2)
);

console.log('\n매핑 데이터 저장 완료: inbound-mapping-data.json');
