const XLSX = require('xlsx');
const path = require('path');

// BOM 엑셀 파일 읽기
const filePath = path.join(__dirname, '../../.example/태창금속 BOM.xlsx');
console.log('Reading file:', filePath);

const workbook = XLSX.readFile(filePath);
console.log('\n=== Sheet Names ===');
console.log(workbook.SheetNames);

// 첫 번째 시트 분석
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

console.log('\n=== Sheet:', sheetName, '===');

// 데이터를 배열로 변환
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('\n=== 총 행 수 ===');
console.log(data.length);

console.log('\n=== 헤더 (Row 0) ===');
console.log(data[0]);

console.log('\n=== 첫 3개 데이터 행 ===');
for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
  console.log(`\nRow ${i}:`);
  console.log(JSON.stringify(data[i], null, 2));
}

// 컬럼 분석
console.log('\n=== 컬럼 분석 ===');
const headers = data[0];
headers.forEach((header, index) => {
  if (header) {
    console.log(`Column ${index}: "${header}"`);
  }
});

// 샘플 데이터를 JSON으로 저장
const jsonData = XLSX.utils.sheet_to_json(sheet);
console.log('\n=== 첫 3개 레코드 (JSON 형식) ===');
console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));
