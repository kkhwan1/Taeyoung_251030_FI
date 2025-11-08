const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_DIR = path.join(__dirname, '.example');
const OUTPUT_FILE = path.join(__dirname, 'EXCEL_DETAILED_ANALYSIS.json');

const excelFiles = [
  '2025년 9월 종합관리 SHEET.xlsx',
  '태창금속 BOM.xlsx',
  '09월 원자재 수불관리.xlsx',
  '2025년 9월 매입매출 보고현황.xlsx'
];

const analysis = {
  timestamp: new Date().toISOString(),
  files: []
};

console.log('🔍 Starting detailed Excel analysis...\n');

excelFiles.forEach(fileName => {
  const filePath = path.join(EXCEL_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${fileName}`);
    return;
  }

  console.log(`📊 Analyzing: ${fileName}`);

  try {
    const workbook = XLSX.readFile(filePath);
    const fileAnalysis = {
      fileName,
      sheets: []
    };

    workbook.SheetNames.forEach(sheetName => {
      console.log(`  📄 Sheet: ${sheetName}`);

      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      // Extract all data with formulas preserved
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: null
      });

      // Extract formulas
      const formulas = [];
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];

          if (cell && cell.f) {
            formulas.push({
              cell: cellAddress,
              formula: cell.f,
              value: cell.v,
              row: R + 1,
              col: C + 1
            });
          }
        }
      }

      // Extract headers (first row)
      const headers = data[0] || [];

      // Analyze data types
      const columnTypes = headers.map((header, colIndex) => {
        const samples = data.slice(1, Math.min(11, data.length))
          .map(row => row[colIndex])
          .filter(val => val !== null && val !== undefined && val !== '');

        let type = 'empty';
        if (samples.length > 0) {
          if (samples.every(v => !isNaN(v) && typeof v !== 'boolean')) {
            type = 'number';
          } else if (samples.some(v => /^\d{4}-\d{2}-\d{2}/.test(String(v)))) {
            type = 'date';
          } else {
            type = 'text';
          }
        }

        return {
          header: header || `Column_${colIndex + 1}`,
          type,
          sampleCount: samples.length
        };
      });

      // Find cross-sheet references
      const crossSheetRefs = formulas.filter(f =>
        f.formula.includes('!') &&
        !f.formula.startsWith(sheetName + '!')
      ).map(f => {
        const match = f.formula.match(/([^!]+)!/);
        return {
          cell: f.cell,
          formula: f.formula,
          referencedSheet: match ? match[1] : 'unknown'
        };
      });

      const sheetAnalysis = {
        sheetName,
        dimensions: {
          rows: range.e.r + 1,
          cols: range.e.c + 1,
          dataRows: data.length - 1
        },
        headers: headers.filter(h => h),
        columnTypes,
        formulas: {
          total: formulas.length,
          examples: formulas.slice(0, 10).map(f => ({
            cell: f.cell,
            formula: f.formula
          }))
        },
        crossSheetReferences: {
          total: crossSheetRefs.length,
          examples: crossSheetRefs.slice(0, 5)
        }
      };

      console.log(`    ✓ ${sheetAnalysis.dimensions.rows} rows × ${sheetAnalysis.dimensions.cols} cols`);
      console.log(`    ✓ ${headers.length} headers`);
      console.log(`    ✓ ${formulas.length} formulas`);
      console.log(`    ✓ ${crossSheetRefs.length} cross-sheet references`);

      fileAnalysis.sheets.push(sheetAnalysis);
    });

    analysis.files.push(fileAnalysis);
    console.log(`  ✅ Completed: ${fileName}\n`);

  } catch (error) {
    console.error(`  ❌ Error analyzing ${fileName}:`, error.message);
  }
});

// Save analysis to JSON file
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(analysis, null, 2), 'utf8');

console.log(`\n✅ Analysis complete! Report saved to: ${OUTPUT_FILE}`);
console.log(`\n📊 Summary:`);
console.log(`   Total files analyzed: ${analysis.files.length}`);
console.log(`   Total sheets: ${analysis.files.reduce((sum, f) => sum + f.sheets.length, 0)}`);

// Print summary table
analysis.files.forEach(file => {
  console.log(`\n📁 ${file.fileName}:`);
  file.sheets.forEach(sheet => {
    console.log(`   • ${sheet.sheetName}: ${sheet.dimensions.dataRows} rows, ${sheet.formulas.total} formulas, ${sheet.crossSheetReferences.total} refs`);
  });
});
