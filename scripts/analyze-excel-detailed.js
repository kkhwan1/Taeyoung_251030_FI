const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelDir = path.join(process.cwd(), '.example');
const files = fs.readdirSync(excelDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

console.log('=== 엑셀 파일 상세 분석 (숨겨진 시트, 수식, 차트 포함) ===\n');

files.forEach(file => {
  try {
    const filePath = path.join(excelDir, file);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`파일: ${file}`);
    console.log('='.repeat(80));
    
    // 수식 및 스타일 포함하여 읽기
    const workbook = XLSX.readFile(filePath, { 
      cellFormulas: true, 
      cellStyles: true,
      sheetStubs: true
    });
    
    console.log(`\n시트 수: ${workbook.SheetNames.length}`);
    
    workbook.SheetNames.forEach((sheetName, idx) => {
      const sheet = workbook.Sheets[sheetName];
      const sheetInfo = workbook.Sheets[sheetName];
      
      // 숨겨진 시트 확인
      const isHidden = workbook.Workbook && 
                       workbook.Workbook.Sheets && 
                       workbook.Workbook.Sheets[idx] &&
                       workbook.Workbook.Sheets[idx].Hidden === 1;
      
      // JSON으로 변환하여 데이터 확인
      const jsonData = XLSX.utils.sheet_to_json(sheet, { 
        defval: null,
        raw: false // 수식 결과값 사용
      });
      
      // 수식이 있는지 확인 (원본 데이터 확인)
      const rawData = XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        raw: true // 원본 수식 확인
      });
      
      // 수식 찾기
      const formulas = [];
      const sheetRange = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      
      for (let R = sheetRange.s.r; R <= sheetRange.e.r; R++) {
        for (let C = sheetRange.s.c; C <= sheetRange.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = sheet[cellAddress];
          if (cell && cell.f) {
            formulas.push({
              cell: cellAddress,
              formula: cell.f,
              value: cell.v
            });
          }
        }
      }
      
      console.log(`\n  시트 ${idx + 1}: ${sheetName}${isHidden ? ' [숨김]' : ''}`);
      console.log(`    - 행 수: ${jsonData.length}`);
      console.log(`    - 열 수: ${Object.keys(jsonData[0] || {}).length}`);
      console.log(`    - 수식 개수: ${formulas.length}`);
      
      if (formulas.length > 0) {
        console.log(`    - 수식 샘플 (처음 5개):`);
        formulas.slice(0, 5).forEach(f => {
          console.log(`      ${f.cell}: ${f.formula} = ${f.value}`);
        });
      }
      
      // 헤더 확인
      if (jsonData.length > 0) {
        const headers = Object.keys(jsonData[0]);
        console.log(`    - 헤더: ${headers.slice(0, 10).join(', ')}${headers.length > 10 ? '...' : ''}`);
        
        // 샘플 데이터 (처음 2행)
        console.log(`    - 샘플 데이터 (첫 행):`);
        const firstRow = jsonData[0];
        Object.keys(firstRow).slice(0, 5).forEach(key => {
          const val = firstRow[key];
          console.log(`      ${key}: ${val !== null && val !== undefined ? String(val).substring(0, 50) : '(null)'}`);
        });
      }
    });
    
    // 차트 정보 확인 (Workbook 객체 내)
    if (workbook.Workbook && workbook.Workbook.Drawings) {
      console.log(`\n  차트/그림 개수: ${workbook.Workbook.Drawings.length}`);
    }
    
  } catch (error) {
    console.error(`  오류: ${error.message}`);
  }
});

console.log('\n\n=== 분석 완료 ===');

