const XLSX = require('xlsx');
const path = require('path');

// BOM 엑셀 파일 읽기
const filePath = path.join(__dirname, '../../.example/태창금속 BOM.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== BOM 파일 상세 분석 ===\n');

// 모든 시트 분석
workbook.SheetNames.forEach((sheetName, idx) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Sheet ${idx + 1}: ${sheetName}`);
  console.log('='.repeat(60));

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // 헤더 찾기 (첫 번째 비어있지 않은 행 찾기)
  let headerRow = -1;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    const nonEmptyCount = row.filter(cell => cell !== '').length;
    if (nonEmptyCount > 10) { // 10개 이상의 컬럼이 있으면 헤더로 판단
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) {
    console.log('❌ 헤더를 찾을 수 없습니다.');
    return;
  }

  console.log(`\n📋 헤더 행: ${headerRow}`);
  const headers = data[headerRow];
  console.log('\n컬럼 목록:');
  headers.forEach((header, index) => {
    if (header && header !== '') {
      console.log(`  [${index}] ${header}`);
    }
  });

  // 데이터 행 개수
  const dataRows = data.slice(headerRow + 1).filter(row =>
    row.some(cell => cell !== '')
  );
  console.log(`\n📊 데이터 행 수: ${dataRows.length}`);

  // 샘플 데이터 (첫 2개)
  if (dataRows.length > 0) {
    console.log('\n📝 샘플 데이터 (첫 2개):');

    for (let i = 0; i < Math.min(2, dataRows.length); i++) {
      console.log(`\n--- 레코드 ${i + 1} ---`);
      const row = dataRows[i];
      headers.forEach((header, index) => {
        if (header && header !== '' && row[index] !== '') {
          console.log(`  ${header}: ${row[index]}`);
        }
      });
    }
  }

  // 주요 필드 존재 여부 확인
  console.log('\n✅ 주요 필드 확인:');
  const keyFields = [
    '품번', '품명', '재질', '두께', '폭', '길이',
    'SEP', '비중', 'EA중량', '실적수량',
    '스크랩중량', '스크랩단가', '스크랩금액',
    'KG단가', '단품단가'
  ];

  keyFields.forEach(field => {
    const found = headers.includes(field);
    console.log(`  ${found ? '✓' : '✗'} ${field}`);
  });
});

// 최신단가 시트 상세 분석
console.log('\n\n' + '='.repeat(60));
console.log('특별 분석: 최신단가 시트');
console.log('='.repeat(60));

if (workbook.SheetNames.includes('최신단가')) {
  const sheet = workbook.Sheets['최신단가'];
  const jsonData = XLSX.utils.sheet_to_json(sheet);

  console.log(`\n총 레코드 수: ${jsonData.length}`);

  if (jsonData.length > 0) {
    console.log('\n컬럼 목록:');
    Object.keys(jsonData[0]).forEach(key => {
      console.log(`  - ${key}`);
    });

    console.log('\n샘플 데이터 (첫 3개):');
    console.log(JSON.stringify(jsonData.slice(0, 3), null, 2));
  }
}
