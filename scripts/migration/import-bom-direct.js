/**
 * Direct BOM Import - Generates SQL for manufacturing cost data
 * Reads Excel and outputs SQL UPDATE statements
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXCEL_PATH = path.join(__dirname, '../../.example/태창금속 BOM.xlsx');
const HEADER_ROW = 5;
const SHEETS_TO_PROCESS = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];

console.log('=== BOM Manufacturing Data Import ===\n');
console.log('📂 Loading Excel file:', EXCEL_PATH);

const workbook = XLSX.readFile(EXCEL_PATH);
console.log('✅ Excel file loaded');
console.log('📋 Available sheets:', workbook.SheetNames.join(', '));

const allUpdates = [];
let totalRecords = 0;
let processedRecords = 0;

SHEETS_TO_PROCESS.forEach(sheetName => {
  if (!workbook.SheetNames.includes(sheetName)) {
    console.log(`⚠️  Sheet "${sheetName}" not found, skipping...`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing Sheet: ${sheetName}`);
  console.log('='.repeat(60));

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (data.length <= HEADER_ROW) {
    console.log('⚠️  Sheet has no data rows');
    return;
  }

  const headers = data[HEADER_ROW];
  const dataRows = data.slice(HEADER_ROW + 1);

  console.log(`📊 Found ${dataRows.length} data rows`);

  dataRows.forEach(row => {
    const record = {};
    headers.forEach((header, index) => {
      if (header && row[index] !== '') {
        record[header] = row[index];
      }
    });

    // Only process rows with item code and name
    if (!record['품번'] || !record['품명']) return;

    totalRecords++;

    const itemCode = String(record['품번']).trim();
    const itemName = String(record['품명']).trim();

    // Extract manufacturing cost fields
    const updates = [];

    if (record['재질']) {
      updates.push(`material = '${String(record['재질']).replace(/'/g, "''")}'`);
    }
    if (record['두께']) {
      updates.push(`thickness = ${Number(record['두께'])}`);
    }
    if (record['폭']) {
      updates.push(`width = ${Number(record['폭'])}`);
    }
    if (record['길이']) {
      updates.push(`height = ${Number(record['길이'])}`); // DB uses 'height' field
    }
    if (record['SEP']) {
      updates.push(`sep = ${Number(record['SEP'])}`);
    }
    if (record['비중']) {
      updates.push(`specific_gravity = ${Number(record['비중'])}`);
    }
    if (record['EA중량']) {
      updates.push(`mm_weight = ${Number(record['EA중량'])}`); // DB uses 'mm_weight' field
    }
    if (record['실적수량']) {
      updates.push(`actual_quantity = ${Number(record['실적수량'])}`);
    }
    if (record['스크랩중량']) {
      updates.push(`scrap_weight = ${Number(record['스크랩중량'])}`);
    }

    // Handle both possible column names for scrap unit price
    const scrapUnitPrice = record['스크랩 단가'] || record['스크랩단가'];
    if (scrapUnitPrice) {
      updates.push(`scrap_unit_price = ${Number(scrapUnitPrice)}`);
    }

    if (record['스크랩금액']) {
      updates.push(`scrap_amount = ${Number(record['스크랩금액'])}`);
    }
    if (record['KG단가']) {
      updates.push(`kg_unit_price = ${Number(record['KG단가'])}`);
    }
    if (record['단품단가']) {
      updates.push(`price = ${Number(record['단품단가'])}`);
    }

    if (updates.length > 0) {
      const sql = `UPDATE items SET ${updates.join(', ')}, updated_at = NOW() WHERE item_code = '${itemCode.replace(/'/g, "''")}';`;
      allUpdates.push(sql);
      processedRecords++;
    }
  });

  console.log(`✅ Sheet "${sheetName}" complete: ${dataRows.length} rows processed`);
});

console.log('\n' + '='.repeat(60));
console.log('Import Summary');
console.log('='.repeat(60));
console.log(`📊 Total Records with item codes: ${totalRecords}`);
console.log(`🔄 Records with updates: ${processedRecords}`);
console.log(`📝 SQL statements generated: ${allUpdates.length}`);

// Write SQL to file
const sqlOutputPath = path.join(__dirname, 'bom-import-updates.sql');
const sqlContent = `-- BOM Manufacturing Cost Data Import
-- Generated: ${new Date().toISOString()}
-- Total Updates: ${allUpdates.length}

${allUpdates.join('\n')}

-- Verification query
SELECT COUNT(*) as updated_items FROM items
WHERE sep IS NOT NULL OR actual_quantity > 0 OR scrap_weight > 0 OR kg_unit_price > 0;
`;

fs.writeFileSync(sqlOutputPath, sqlContent, 'utf8');
console.log(`\n📄 SQL file generated: ${sqlOutputPath}`);
console.log(`\n🎉 Ready to execute ${allUpdates.length} UPDATE statements`);
console.log('\nNext Steps:');
console.log('1. Review generated SQL file');
console.log('2. Execute SQL via Supabase MCP');
console.log('3. Verify data import with db:check-data');
