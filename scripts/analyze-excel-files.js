const XLSX = require('xlsx');
const fs = require('fs');

const files = [
  { name: 'BOM', path: '.example/태창금속 BOM.xlsx' },
  { name: 'Purchase-Sales', path: '.example/2025년 9월 매입매출 보고현황.xlsx' },
  { name: 'Management', path: '.example/2025년 9월 종합관리 SHEET.xlsx' },
  { name: 'Items-Export', path: 'items_export.xlsx' }
];

files.forEach((file, idx) => {
  console.log('\n' + '='.repeat(80));
  console.log(`FILE ${idx + 1}: ${file.name}`);
  console.log('='.repeat(80));

  if (!fs.existsSync(file.path)) {
    console.log('File not found');
    return;
  }

  try {
    const workbook = XLSX.readFile(file.path);
    console.log(`\nSheets (${workbook.SheetNames.length}):`, workbook.SheetNames.join(', '));

    // Analyze first sheet
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    console.log(`\nFirst sheet "${firstSheetName}":`);
    console.log(`   Total rows (raw): ${data.length}`);
    console.log(`   Data rows (JSON): ${jsonData.length}`);

    if (data.length > 0) {
      console.log('\nFirst 3 rows (raw):');
      data.slice(0, 3).forEach((row, i) => {
        const display = row.slice(0, 8).map(cell =>
          cell === '' ? '' : String(cell).substring(0, 20)
        ).join(' | ');
        console.log(`   Row ${i}: ${display}`);
      });
    }

    if (jsonData.length > 0) {
      console.log('\nColumn names:', Object.keys(jsonData[0]).slice(0, 10).join(', '));
      const firstRow = JSON.stringify(jsonData[0], null, 2);
      console.log('\nFirst row sample:', firstRow.substring(0, 400));

      // Count non-empty fields
      const fields = Object.keys(jsonData[0]);
      console.log(`\nTotal columns: ${fields.length}`);
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
});
