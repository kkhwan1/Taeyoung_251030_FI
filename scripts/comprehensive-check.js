const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelDir = path.join(process.cwd(), '.example');
const files = fs.readdirSync(excelDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

console.log('=== 엑셀 파일 전체 재분석 ===\n');

const summary = {
  total_files: files.length,
  files: []
};

files.forEach(file => {
  try {
    const filePath = path.join(excelDir, file);
    const workbook = XLSX.readFile(filePath, { sheetStubs: true });
    const fileInfo = {
      name: file,
      sheets: workbook.SheetNames.length,
      sheet_names: workbook.SheetNames,
      hidden_sheets: workbook.SheetNames.filter((name, idx) => {
        const sheet = workbook.Sheets[name];
        return sheet && sheet.Hidden === 1;
      })
    };
    summary.files.push(fileInfo);
    
    console.log(`파일: ${file}`);
    console.log(`  시트 수: ${workbook.SheetNames.length}`);
    workbook.SheetNames.forEach((sheetName, idx) => {
      const sheet = workbook.Sheets[sheetName];
      const isHidden = sheet && sheet.Hidden === 1;
      console.log(`    ${idx + 1}. ${sheetName}${isHidden ? ' (숨김)' : ''}`);
    });
    console.log('');
  } catch (error) {
    console.error(`파일 ${file} 처리 중 오류:`, error.message);
  }
});

fs.writeFileSync(
  path.join(process.cwd(), 'data', 'excel-files-summary.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
);

console.log('=== 엑셀 파일 분석 완료 ===');
