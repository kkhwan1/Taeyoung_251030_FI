const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('📊 Excel 종합재고 데이터 추출 시작...\n');

// Load Excel file
const excelPath = path.join(__dirname, '.example', '2025년 9월 종합관리 SHEET.xlsx');

if (!fs.existsSync(excelPath)) {
  console.error('❌ Excel 파일을 찾을 수 없습니다:', excelPath);
  process.exit(1);
}

const workbook = XLSX.readFile(excelPath);

// Find 종합재고 sheet
const sheetName = workbook.SheetNames.find(name => name.includes('종합재고'));

if (!sheetName) {
  console.error('❌ 종합재고 시트를 찾을 수 없습니다');
  console.log('사용 가능한 시트:', workbook.SheetNames);
  process.exit(1);
}

console.log(`✅ 종합재고 시트 발견: "${sheetName}"\n`);

const sheet = workbook.Sheets[sheetName];
const range = XLSX.utils.decode_range(sheet['!ref']);

console.log(`📐 시트 크기: ${range.e.r + 1}행 x ${range.e.c + 1}열\n`);

// Convert to JSON with header detection
const data = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  defval: '',
  blankrows: false
});

console.log(`📋 총 데이터 행 수: ${data.length}\n`);

// Try to find header row by looking for common Korean column names
let headerRowIndex = -1;
const possibleHeaders = ['품목코드', '품번', '품명', '재고', '수량', 'PART NO', '품목'];

for (let i = 0; i < Math.min(20, data.length); i++) {
  const row = data[i];
  const rowText = row.join('').toLowerCase();

  if (possibleHeaders.some(h => rowText.includes(h.toLowerCase()))) {
    headerRowIndex = i;
    console.log(`🎯 헤더 행 발견 (행 ${i + 1}):`, row.slice(0, 10));
    break;
  }
}

if (headerRowIndex === -1) {
  console.log('⚠️ 자동 헤더 감지 실패. 처음 20행 샘플:');
  data.slice(0, 20).forEach((row, i) => {
    console.log(`행 ${i + 1}:`, row.slice(0, 5).join(' | '));
  });

  console.log('\n📤 전체 데이터를 JSON으로 저장합니다...');

  const output = {
    fileName: '2025년 9월 종합관리 SHEET.xlsx',
    sheetName: sheetName,
    totalRows: data.length,
    totalColumns: range.e.c + 1,
    sampleData: data.slice(0, 50),
    allData: data
  };

  fs.writeFileSync(
    path.join(__dirname, 'EXCEL_INVENTORY_RAW.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );

  console.log('✅ EXCEL_INVENTORY_RAW.json 생성 완료');
  console.log('\n다음 단계: 수동으로 헤더 행과 데이터 컬럼을 확인하세요');

} else {
  // Extract headers and data
  const headers = data[headerRowIndex];
  const dataRows = data.slice(headerRowIndex + 1);

  console.log(`\n📊 헤더 (${headers.length}개):`, headers.slice(0, 15));
  console.log(`\n📋 데이터 행 수: ${dataRows.length}`);

  // Convert to objects
  const inventory = dataRows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      if (header && header.trim()) {
        obj[header.trim()] = row[i] || '';
      }
    });
    return obj;
  }).filter(obj => Object.keys(obj).length > 0);

  console.log(`\n✅ 변환된 재고 데이터: ${inventory.length}개 품목`);
  console.log('\n샘플 데이터 (처음 3개):');
  inventory.slice(0, 3).forEach((item, i) => {
    console.log(`\n품목 ${i + 1}:`, JSON.stringify(item, null, 2));
  });

  // Save to file
  const output = {
    fileName: '2025년 9월 종합관리 SHEET.xlsx',
    sheetName: sheetName,
    extractedAt: new Date().toISOString(),
    headerRowIndex: headerRowIndex + 1,
    headers: headers,
    totalItems: inventory.length,
    inventory: inventory
  };

  fs.writeFileSync(
    path.join(__dirname, 'EXCEL_INVENTORY_EXTRACTED.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );

  console.log('\n✅ EXCEL_INVENTORY_EXTRACTED.json 생성 완료');
}

console.log('\n완료!');
