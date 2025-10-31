const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const bomFile = path.join(process.cwd(), '.example', '태창금속 BOM.xlsx');
const workbook = XLSX.readFile(bomFile, { sheetStubs: true });

console.log('=== BOM 엑셀 파일 상세 분석 ===\n');

const bomData = [];

workbook.SheetNames.forEach(sheetName => {
  if (sheetName !== '최신단가') {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`시트: ${sheetName}`);
    console.log('='.repeat(80));
    
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    console.log(`총 ${rawData.length}개 행`);
    
    // 처음 10개 행 확인
    console.log('\n처음 10개 행:');
    rawData.slice(0, 10).forEach((row, idx) => {
      console.log(`\n행 ${idx + 1}:`);
      row.slice(0, 15).forEach((cell, colIdx) => {
        if (cell !== null && String(cell).trim() !== '') {
          console.log(`  [${colIdx}]: ${String(cell).trim()}`);
        }
      });
    });
    
    // BOM 데이터 추출 시도
    // 일반적으로 BOM 구조는: 모품번, 모품명, 자품번, 자품명, 소요량, 단위 등
    let headerRow = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      const rowStr = row.map(cell => String(cell || '').trim().toLowerCase()).join('|');
      if (rowStr.includes('품번') || rowStr.includes('모품') || rowStr.includes('자품')) {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow >= 0) {
      console.log(`\n헤더 행 발견: ${headerRow + 1}행`);
      console.log('헤더:', rawData[headerRow].slice(0, 10).map(c => c ? String(c).trim() : '').join(' | '));
      
      // 데이터 행 추출
      for (let i = headerRow + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (row && row.length > 0 && row.some(cell => cell !== null && String(cell).trim() !== '')) {
          const parentItemCode = row[0] ? String(row[0]).trim() : null;
          const childItemCode = row[2] || row[3] ? String(row[2] || row[3]).trim() : null;
          const quantity = row[4] || row[5] ? parseFloat(String(row[4] || row[5]).replace(/,/g, '')) : null;
          
          if (parentItemCode && childItemCode && quantity) {
            bomData.push({
              sheet: sheetName,
              parent_item_code: parentItemCode,
              child_item_code: childItemCode,
              quantity: quantity,
              unit: row[5] || row[6] || 'PCS'
            });
          }
        }
      }
      
      console.log(`\n추출된 BOM 항목: ${bomData.filter(b => b.sheet === sheetName).length}개`);
    } else {
      console.log('\n헤더 행을 찾을 수 없습니다. 수동 확인 필요.');
    }
  }
});

console.log(`\n\n=== 전체 BOM 데이터 요약 ===`);
console.log(`총 추출된 BOM 항목: ${bomData.length}개`);
console.log(`시트별 분포:`);
const bySheet = {};
bomData.forEach(item => {
  if (!bySheet[item.sheet]) bySheet[item.sheet] = 0;
  bySheet[item.sheet]++;
});
Object.entries(bySheet).forEach(([sheet, count]) => {
  console.log(`  ${sheet}: ${count}개`);
});

// JSON으로 저장
const outputPath = path.join(process.cwd(), 'data', 'bom-excel-data.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(bomData, null, 2), 'utf8');
console.log(`\n✅ BOM 데이터가 ${outputPath}에 저장되었습니다.`);

