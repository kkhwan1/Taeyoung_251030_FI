const fs = require('fs');
const path = require('path');

// 회사 매핑 (데이터베이스 조회 결과)
const companyMapping = {
  'JS테크': 170,
  '양산처': 206,
  '에이오에스': 169,
  '태영금속': 168,
  '태창금속': 163,
  '호원 사급': 174,
  '호원사급': 208
};

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

// 고유 P/NO 목록 추출 (유효한 것만)
const uniqueItemCodes = [...new Set(allRecords
  .map(r => r['P/NO'])
  .filter(c => c && typeof c === 'string' && c.trim()))];

console.log(`고유 P/NO ${uniqueItemCodes.length}개 (item_id 조회 필요)`);

// item_code 목록 저장 (Supabase 조회용)
fs.writeFileSync(
  path.join(dataDir, 'item-codes-for-lookup.json'),
  JSON.stringify({
    total: uniqueItemCodes.length,
    item_codes: uniqueItemCodes
  }, null, 2)
);

console.log('\nitem-codes-for-lookup.json 저장 완료');
console.log('\n다음 단계: Supabase에서 이 item_codes에 대한 item_id 조회 필요');
