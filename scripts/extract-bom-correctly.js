const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const bomFile = path.join(process.cwd(), '.example', '태창금속 BOM.xlsx');
const workbook = XLSX.readFile(bomFile, { sheetStubs: true });

console.log('=== BOM 엑셀 파일 올바른 파싱 ===\n');

const bomData = [];

workbook.SheetNames.forEach(sheetName => {
  if (sheetName !== '최신단가') {
    console.log(`\n시트: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    // 헤더 행 찾기 (보통 6행, 인덱스 5)
    let headerRow = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      const rowStr = row.map(cell => String(cell || '').trim()).join('|').toLowerCase();
      if (rowStr.includes('품번') && (rowStr.includes('품명') || rowStr.includes('소요량'))) {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow < 0) {
      console.log('  헤더 행을 찾을 수 없습니다.');
      return;
    }
    
    const header = rawData[headerRow];
    console.log(`  헤더 행: ${headerRow + 1}행`);
    
    // 컬럼 인덱스 찾기
    // 왼쪽: 모품목 (납품처 기준) - 품번(2), 품명(3)
    // 오른쪽: 자품목 - 품번(10), 품명(11), 소요량(12), 단가(13)
    const parentCodeIdx = header.findIndex(c => String(c || '').includes('품번') && header.indexOf(c) < 5);
    const parentNameIdx = parentCodeIdx >= 0 ? parentCodeIdx + 1 : -1;
    const childCodeIdx = header.findIndex((c, i) => i > 7 && String(c || '').includes('품번'));
    const childNameIdx = childCodeIdx >= 0 ? childCodeIdx + 1 : -1;
    const quantityIdx = header.findIndex((c, i) => i > 7 && String(c || '').includes('소요량'));
    
    console.log(`  컬럼 인덱스: 모품목품번=${parentCodeIdx}, 모품목품명=${parentNameIdx}, 자품목품번=${childCodeIdx}, 자품목품명=${childNameIdx}, 소요량=${quantityIdx}`);
    
    // 현재 모품목 추적
    let currentParentCode = null;
    let currentParentName = null;
    
    // 데이터 행 처리 (헤더 행 다음부터)
    for (let i = headerRow + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      
      // 모품목 확인 (왼쪽 영역에 값이 있으면)
      const parentCode = parentCodeIdx >= 0 && row[parentCodeIdx] ? String(row[parentCodeIdx]).trim() : null;
      const parentName = parentNameIdx >= 0 && row[parentNameIdx] ? String(row[parentNameIdx]).trim() : null;
      
      if (parentCode && parentCode !== '품번' && !parentCode.includes('납품처')) {
        currentParentCode = parentCode;
        currentParentName = parentName || null;
      }
      
      // 자품목 확인 (오른쪽 영역에 값이 있으면)
      const childCode = childCodeIdx >= 0 && row[childCodeIdx] ? String(row[childCodeIdx]).trim() : null;
      const childName = childNameIdx >= 0 && row[childNameIdx] ? String(row[childNameIdx]).trim() : null;
      const quantity = quantityIdx >= 0 && row[quantityIdx] ? parseFloat(String(row[quantityIdx]).replace(/,/g, '')) : null;
      
      // BOM 항목 생성
      if (currentParentCode && childCode && childCode !== '품번' && !childCode.includes('구매처') && quantity && !isNaN(quantity)) {
        bomData.push({
          sheet: sheetName,
          parent_item_code: currentParentCode,
          parent_item_name: currentParentName,
          child_item_code: childCode,
          child_item_name: childName,
          quantity: quantity
        });
      }
    }
    
    console.log(`  추출된 BOM 항목: ${bomData.filter(b => b.sheet === sheetName).length}개`);
  }
});

console.log(`\n=== 전체 BOM 데이터 요약 ===`);
console.log(`총 추출된 BOM 항목: ${bomData.length}개`);

const bySheet = {};
bomData.forEach(item => {
  if (!bySheet[item.sheet]) bySheet[item.sheet] = 0;
  bySheet[item.sheet]++;
});
Object.entries(bySheet).forEach(([sheet, count]) => {
  console.log(`  ${sheet}: ${count}개`);
});

// JSON으로 저장
const outputPath = path.join(process.cwd(), 'data', 'bom-excel-correct.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(bomData, null, 2), 'utf8');
console.log(`\n✅ BOM 데이터가 ${outputPath}에 저장되었습니다.`);

// 샘플 출력
console.log(`\n처음 5개 BOM 항목:`);
bomData.slice(0, 5).forEach((item, i) => {
  console.log(`  ${i + 1}. ${item.parent_item_code} -> ${item.child_item_code} (${item.quantity})`);
});

