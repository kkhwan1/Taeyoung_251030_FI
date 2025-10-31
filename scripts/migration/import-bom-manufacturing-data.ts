/**
 * Import BOM Manufacturing Cost Data from Excel
 *
 * Purpose: Excel BOM 파일의 제조 원가 데이터를 items 테이블에 임포트
 *
 * Source: .example/태창금속 BOM.xlsx
 * Sheets: 대우공업, 풍기산업, 다인, 호원오토, 인알파코리아, 최신단가
 *
 * Fields to Import:
 * - 재질 (material), 두께 (thickness), 폭 (width), 길이 (length)
 * - SEP, 비중 (specific_gravity), EA중량 (ea_weight)
 * - 실적수량 (actual_quantity), 스크랩중량 (scrap_weight)
 * - 스크랩단가 (scrap_unit_price), 스크랩금액 (scrap_amount)
 * - KG단가 (kg_unit_price), 단품단가 (price)
 *
 * Date: 2025-01-30
 */

import * as dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { getSupabaseClient } from '../../src/lib/db-unified';

const supabase = getSupabaseClient();

interface BOMRecord {
  품번: string;
  품명: string;
  재질?: string;
  두께?: number;
  폭?: number;
  길이?: number;
  SEP?: number;
  비중?: number;
  EA중량?: number;
  실적수량?: number;
  스크랩중량?: number;
  '스크랩 단가'?: number;
  스크랩단가?: number;
  스크랩금액?: number;
  KG단가?: number;
  단품단가?: number;
}

interface ProcessedRecord {
  item_code: string;
  item_name: string;
  material?: string;
  thickness?: number;
  width?: number;
  length?: number;
  sep?: number;
  specific_gravity?: number;
  mm_weight?: number;
  actual_quantity?: number;
  scrap_weight?: number;
  scrap_unit_price?: number;
  scrap_amount?: number;
  kg_unit_price?: number;
  price?: number;
}

interface ImportStats {
  totalRecords: number;
  matchedItems: number;
  updatedItems: number;
  skippedRecords: number;
  errors: string[];
}

const HEADER_ROW = 5; // 헤더는 5행에 위치
const SHEETS_TO_PROCESS = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];

async function loadExcelFile(): Promise<XLSX.WorkBook> {
  const filePath = path.join(__dirname, '../../.example/태창금속 BOM.xlsx');
  console.log('📂 Loading Excel file:', filePath);

  try {
    const workbook = XLSX.readFile(filePath);
    console.log('✅ Excel file loaded successfully');
    console.log('📋 Available sheets:', workbook.SheetNames.join(', '));
    return workbook;
  } catch (error: any) {
    console.error('❌ Failed to load Excel file:', error.message);
    throw error;
  }
}

function parseSheet(sheet: XLSX.WorkSheet): BOMRecord[] {
  const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });

  if (data.length <= HEADER_ROW) {
    console.log('⚠️  Sheet has no data rows');
    return [];
  }

  const headers = data[HEADER_ROW] as string[];
  const dataRows = data.slice(HEADER_ROW + 1);

  const records: BOMRecord[] = [];

  for (const row of dataRows) {
    const record: any = {};

    headers.forEach((header, index) => {
      if (header && row[index] !== '') {
        record[header] = row[index];
      }
    });

    // Only include rows with item code and name
    if (record['품번'] && record['품명']) {
      records.push(record);
    }
  }

  return records;
}

function processRecord(bomRecord: BOMRecord): ProcessedRecord {
  const scrapUnitPrice = bomRecord['스크랩 단가'] || bomRecord['스크랩단가'];

  return {
    item_code: String(bomRecord.품번).trim(),
    item_name: String(bomRecord.품명).trim(),
    material: bomRecord.재질 ? String(bomRecord.재질).trim() : undefined,
    thickness: bomRecord.두께 ? Number(bomRecord.두께) : undefined,
    width: bomRecord.폭 ? Number(bomRecord.폭) : undefined,
    length: bomRecord.길이 ? Number(bomRecord.길이) : undefined,
    sep: bomRecord.SEP ? Number(bomRecord.SEP) : undefined,
    specific_gravity: bomRecord.비중 ? Number(bomRecord.비중) : undefined,
    mm_weight: bomRecord.EA중량 ? Number(bomRecord.EA중량) : undefined,
    actual_quantity: bomRecord.실적수량 ? Number(bomRecord.실적수량) : undefined,
    scrap_weight: bomRecord.스크랩중량 ? Number(bomRecord.스크랩중량) : undefined,
    scrap_unit_price: scrapUnitPrice ? Number(scrapUnitPrice) : undefined,
    scrap_amount: bomRecord.스크랩금액 ? Number(bomRecord.스크랩금액) : undefined,
    kg_unit_price: bomRecord.KG단가 ? Number(bomRecord.KG단가) : undefined,
    price: bomRecord.단품단가 ? Number(bomRecord.단품단가) : undefined
  };
}

async function updateItemWithManufacturingData(
  processed: ProcessedRecord,
  stats: ImportStats
): Promise<void> {
  // Check if item exists
  const { data: existingItem, error: selectError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name')
    .eq('item_code', processed.item_code)
    .single();

  if (selectError || !existingItem) {
    stats.skippedRecords++;
    stats.errors.push(`Item not found: ${processed.item_code} (${processed.item_name})`);
    return;
  }

  stats.matchedItems++;

  // Prepare update data (only non-null values)
  const updateData: any = {};

  if (processed.material !== undefined) updateData.material = processed.material;
  if (processed.thickness !== undefined) updateData.thickness = processed.thickness;
  if (processed.width !== undefined) updateData.width = processed.width;
  if (processed.length !== undefined) updateData.height = processed.length; // DB uses 'height'
  if (processed.sep !== undefined) updateData.sep = processed.sep;
  if (processed.specific_gravity !== undefined) updateData.specific_gravity = processed.specific_gravity;
  if (processed.mm_weight !== undefined) updateData.mm_weight = processed.mm_weight;
  if (processed.actual_quantity !== undefined) updateData.actual_quantity = processed.actual_quantity;
  if (processed.scrap_weight !== undefined) updateData.scrap_weight = processed.scrap_weight;
  if (processed.scrap_unit_price !== undefined) updateData.scrap_unit_price = processed.scrap_unit_price;
  if (processed.scrap_amount !== undefined) updateData.scrap_amount = processed.scrap_amount;
  if (processed.kg_unit_price !== undefined) updateData.kg_unit_price = processed.kg_unit_price;
  if (processed.price !== undefined) updateData.price = processed.price;

  if (Object.keys(updateData).length === 0) {
    stats.skippedRecords++;
    return;
  }

  // Update item
  const { error: updateError } = await supabase
    .from('items')
    .update(updateData)
    .eq('item_id', existingItem.item_id);

  if (updateError) {
    stats.errors.push(`Update failed for ${processed.item_code}: ${updateError.message}`);
  } else {
    stats.updatedItems++;
  }
}

async function processSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet,
  stats: ImportStats
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing Sheet: ${sheetName}`);
  console.log('='.repeat(60));

  const bomRecords = parseSheet(sheet);
  console.log(`📊 Found ${bomRecords.length} records with item codes`);

  if (bomRecords.length === 0) {
    return;
  }

  let processedCount = 0;

  for (const bomRecord of bomRecords) {
    const processed = processRecord(bomRecord);
    stats.totalRecords++;

    await updateItemWithManufacturingData(processed, stats);

    processedCount++;
    if (processedCount % 50 === 0) {
      console.log(`   Processed ${processedCount}/${bomRecords.length} records...`);
    }
  }

  console.log(`✅ Sheet "${sheetName}" complete: ${processedCount} records processed`);
}

async function importBOMManufacturingData(): Promise<void> {
  console.log('=== BOM Manufacturing Data Import ===\n');

  const stats: ImportStats = {
    totalRecords: 0,
    matchedItems: 0,
    updatedItems: 0,
    skippedRecords: 0,
    errors: []
  };

  try {
    // Load Excel file
    const workbook = await loadExcelFile();

    // Process each sheet
    for (const sheetName of SHEETS_TO_PROCESS) {
      if (!workbook.SheetNames.includes(sheetName)) {
        console.log(`⚠️  Sheet "${sheetName}" not found, skipping...`);
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      await processSheet(sheetName, sheet, stats);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Import Summary');
    console.log('='.repeat(60));
    console.log(`📊 Total Records Processed: ${stats.totalRecords}`);
    console.log(`✅ Matched Items: ${stats.matchedItems}`);
    console.log(`🔄 Updated Items: ${stats.updatedItems}`);
    console.log(`⏭️  Skipped Records: ${stats.skippedRecords}`);
    console.log(`❌ Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n=== Errors (First 10) ===');
      stats.errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });

      if (stats.errors.length > 10) {
        console.log(`... and ${stats.errors.length - 10} more errors`);
      }
    }

    const successRate = stats.totalRecords > 0
      ? ((stats.updatedItems / stats.totalRecords) * 100).toFixed(1)
      : '0.0';

    console.log(`\n📈 Success Rate: ${successRate}%`);

    if (stats.updatedItems > 0) {
      console.log('\n🎉 Import completed successfully!');
      console.log('\nNext Steps:');
      console.log('1. Verify data in database');
      console.log('2. Update Web UI to display manufacturing cost fields');
      console.log('3. Test cost calculations');
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error during import:', error.message);
    throw error;
  }
}

// Main execution
(async () => {
  try {
    await importBOMManufacturingData();
  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
})();
