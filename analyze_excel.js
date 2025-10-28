const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('items_export.xlsx');
  
  const analysis = {
    totalSheets: workbook.SheetNames.length,
    sheetNames: workbook.SheetNames,
    sheets: {}
  };
  
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const numRows = range.e.r + 1;
    const numCols = range.e.c + 1;
    
    const headers = data[0] || [];
    const sampleData = data.slice(0, 10);
    
    const columnTypes = {};
    headers.forEach((header, idx) => {
      const samples = data.slice(1, 50).map(row => row[idx]).filter(val => val !== '' && val !== null && val !== undefined);
      
      if (samples.length === 0) {
        columnTypes[header] = 'empty';
      } else {
        const types = new Set();
        samples.forEach(val => {
          if (typeof val === 'number') types.add('number');
          else if (typeof val === 'boolean') types.add('boolean');
          else if (val instanceof Date) types.add('date');
          else types.add('string');
        });
        columnTypes[header] = Array.from(types).join('|');
      }
    });
    
    analysis.sheets[sheetName] = {
      rows: numRows,
      columns: numCols,
      headers: headers,
      columnTypes: columnTypes,
      sampleData: sampleData,
      hasFormulas: Object.keys(worksheet).some(cell => 
        worksheet[cell] && worksheet[cell].f
      )
    };
  });
  
  console.log(JSON.stringify(analysis, null, 2));
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
