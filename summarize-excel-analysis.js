const fs = require('fs');
const path = require('path');

const analysisFile = path.join(__dirname, 'EXCEL_DETAILED_ANALYSIS.json');
const outputFile = path.join(__dirname, 'EXCEL_SUMMARY.md');

console.log('📊 Generating Excel analysis summary...\n');

const data = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));

let markdown = `# Excel 파일 상세 분석 요약\n\n`;
markdown += `**분석 일시**: ${new Date(data.timestamp).toLocaleString('ko-KR')}\n\n`;

// Overall statistics
const totalSheets = data.files.reduce((sum, f) => sum + f.sheets.length, 0);
const totalFormulas = data.files.reduce((sum, f) =>
  sum + f.sheets.reduce((s, sheet) => s + sheet.formulas.total, 0), 0
);
const totalCrossRefs = data.files.reduce((sum, f) =>
  sum + f.sheets.reduce((s, sheet) => s + sheet.crossSheetReferences.total, 0), 0
);

markdown += `## 전체 통계\n\n`;
markdown += `- **총 파일 수**: ${data.files.length}개\n`;
markdown += `- **총 시트 수**: ${totalSheets}개\n`;
markdown += `- **총 수식 수**: ${totalFormulas.toLocaleString()}개\n`;
markdown += `- **총 시트 간 참조**: ${totalCrossRefs.toLocaleString()}개\n\n`;

markdown += `---\n\n`;

// Per-file analysis
data.files.forEach(file => {
  markdown += `## ${file.fileName}\n\n`;

  const fileFormulas = file.sheets.reduce((sum, s) => sum + s.formulas.total, 0);
  const fileCrossRefs = file.sheets.reduce((sum, s) => sum + s.crossSheetReferences.total, 0);

  markdown += `**시트 수**: ${file.sheets.length}개 | **수식**: ${fileFormulas.toLocaleString()}개 | **시트간참조**: ${fileCrossRefs.toLocaleString()}개\n\n`;

  file.sheets.forEach(sheet => {
    markdown += `### 📄 ${sheet.sheetName}\n\n`;

    markdown += `**크기**: ${sheet.dimensions.rows}행 × ${sheet.dimensions.cols}열 (데이터: ${sheet.dimensions.dataRows}행)\n\n`;

    // Headers
    if (sheet.headers.length > 0) {
      markdown += `**컬럼 (${sheet.headers.length}개)**:\n`;
      markdown += sheet.headers.slice(0, 20).map(h => `- ${h}`).join('\n');
      if (sheet.headers.length > 20) {
        markdown += `\n- ... 외 ${sheet.headers.length - 20}개 더`;
      }
      markdown += `\n\n`;
    }

    // Column types
    if (sheet.columnTypes.length > 0) {
      const typeCount = {
        number: sheet.columnTypes.filter(c => c.type === 'number').length,
        text: sheet.columnTypes.filter(c => c.type === 'text').length,
        date: sheet.columnTypes.filter(c => c.type === 'date').length,
        empty: sheet.columnTypes.filter(c => c.type === 'empty').length
      };
      markdown += `**컬럼 타입**: 숫자(${typeCount.number}) | 텍스트(${typeCount.text}) | 날짜(${typeCount.date}) | 빈(${typeCount.empty})\n\n`;
    }

    // Formulas
    if (sheet.formulas.total > 0) {
      markdown += `**수식**: ${sheet.formulas.total}개\n`;
      if (sheet.formulas.examples && sheet.formulas.examples.length > 0) {
        markdown += `\n예시:\n`;
        sheet.formulas.examples.slice(0, 5).forEach(f => {
          markdown += `- \`${f.cell}\`: \`${f.formula}\`\n`;
        });
        markdown += `\n`;
      }
    }

    // Cross-sheet references
    if (sheet.crossSheetReferences.total > 0) {
      markdown += `**시트 간 참조**: ${sheet.crossSheetReferences.total}개\n`;
      if (sheet.crossSheetReferences.examples && sheet.crossSheetReferences.examples.length > 0) {
        markdown += `\n참조하는 시트:\n`;
        const referencedSheets = [...new Set(sheet.crossSheetReferences.examples.map(r => r.referencedSheet))];
        referencedSheets.forEach(s => {
          markdown += `- ${s}\n`;
        });
        markdown += `\n`;
      }
    }

    markdown += `---\n\n`;
  });
});

// Key findings
markdown += `## 🔍 주요 발견사항\n\n`;

// Most complex sheets (by formulas)
const allSheets = data.files.flatMap(f =>
  f.sheets.map(s => ({ fileName: f.fileName, ...s }))
);
const topFormulaSheets = allSheets
  .sort((a, b) => b.formulas.total - a.formulas.total)
  .slice(0, 10);

markdown += `### 수식이 가장 많은 시트 TOP 10\n\n`;
topFormulaSheets.forEach((sheet, i) => {
  markdown += `${i + 1}. **${sheet.fileName}** - ${sheet.sheetName}: ${sheet.formulas.total.toLocaleString()}개 수식\n`;
});
markdown += `\n`;

// Most cross-referenced sheets
const topCrossRefSheets = allSheets
  .sort((a, b) => b.crossSheetReferences.total - a.crossSheetReferences.total)
  .slice(0, 10);

markdown += `### 시트 간 참조가 가장 많은 시트 TOP 10\n\n`;
topCrossRefSheets.forEach((sheet, i) => {
  markdown += `${i + 1}. **${sheet.fileName}** - ${sheet.sheetName}: ${sheet.crossSheetReferences.total.toLocaleString()}개 참조\n`;
});
markdown += `\n`;

// Save summary
fs.writeFileSync(outputFile, markdown, 'utf8');

console.log(`✅ Summary saved to: ${outputFile}`);
console.log(`\n📊 Key Statistics:`);
console.log(`   Total sheets: ${totalSheets}`);
console.log(`   Total formulas: ${totalFormulas.toLocaleString()}`);
console.log(`   Total cross-references: ${totalCrossRefs.toLocaleString()}`);
