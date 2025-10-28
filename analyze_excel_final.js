const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('items_export.xlsx');
  
  const analysis = {
    totalSheets: workbook.SheetNames.length,
    sheets: {}
  };
  
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    analysis.sheets[sheetName] = {
      rowCount: data.length,
      colCount: data[0] ? data[0].length : 0,
      headers: data[0] || [],
      sampleRows: data.slice(0, 5),
      sampleJson: jsonData.slice(0, 3),
      hasFormulas: Object.keys(worksheet).some(cell => worksheet[cell] && worksheet[cell].f),
      totalCells: Object.keys(worksheet).filter(k => !k.startsWith('!')).length
    };
  });
  
  console.log(JSON.stringify(analysis, null, 2));
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
