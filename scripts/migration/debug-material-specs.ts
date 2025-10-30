/**
 * 재질 정보 추출 디버깅 - 품번 매칭 확인
 */

import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { createAdminClient } from './utils/supabase-client';

const BOM_EXCEL = '태창금속 BOM.xlsx';
const EXCEL_DIR = path.resolve(process.cwd(), '.example');

function readExcelFile(filename: string): XLSX.WorkBook {
  const filePath = path.join(EXCEL_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel 파일을 찾을 수 없습니다: ${filePath}`);
  }

  return XLSX.readFile(filePath, {
    type: 'file',
    cellDates: true,
    cellNF: false,
    cellText: false
  });
}

async function main() {
  const supabase = createAdminClient();

  // DB 품목 조회
  const { data: dbItems } = await supabase
    .from('items')
    .select('item_id, item_code, material, thickness, width, height, specific_gravity, mm_weight')
    .limit(20);

  console.log('\n=== DB 품목 샘플 (20개) ===\n');
  dbItems?.forEach(item => {
    console.log(`품번: ${item.item_code}, material: ${item.material || 'NULL'}, thickness: ${item.thickness || 'NULL'}`);
  });

  // 엑셀에서 추출한 품번 샘플
  console.log('\n\n=== 엑셀에서 추출한 품번 샘플 ===\n');
  
  const workbook = readExcelFile(BOM_EXCEL);
  const bomSheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];

  const excelItemCodes = new Set<string>();

  for (const sheetName of bomSheets) {
    if (!workbook.SheetNames.includes(sheetName)) continue;

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      range: 5
    }) as any[][];

    const ITEM_CODE_COL = 10; // 구매품목 품번
    const MATERIAL_COL = 19;

    let count = 0;
    for (let i = 1; i < rawData.length && count < 5; i++) {
      const row = rawData[i];
      if (!row) continue;

      const itemCode = String(row[ITEM_CODE_COL] || '').trim();
      const material = String(row[MATERIAL_COL] || '').trim();

      if (itemCode) {
        excelItemCodes.add(itemCode);
        if (count < 5) {
          console.log(`시트: ${sheetName}, 품번: "${itemCode}", 재질: "${material}"`);
          count++;
        }
      }
    }
  }

  // 매칭 확인
  console.log('\n\n=== 매칭 확인 ===\n');
  const dbItemCodes = new Set(dbItems?.map(i => i.item_code) || []);
  
  let matched = 0;
  let unmatched = 0;
  const unmatchedSamples: string[] = [];

  for (const excelCode of excelItemCodes) {
    if (dbItemCodes.has(excelCode)) {
      matched++;
    } else {
      unmatched++;
      if (unmatchedSamples.length < 10) {
        unmatchedSamples.push(excelCode);
      }
    }
  }

  console.log(`엑셀 품번: ${excelItemCodes.size}개`);
  console.log(`DB 품번: ${dbItemCodes.size}개`);
  console.log(`매칭: ${matched}개`);
  console.log(`비매칭: ${unmatched}개`);
  
  if (unmatchedSamples.length > 0) {
    console.log('\n비매칭 샘플:');
    unmatchedSamples.forEach(code => console.log(`  - "${code}"`));
  }

  // DB 품번 샘플과 비교
  console.log('\n\n=== DB 품번 샘플 ===\n');
  const dbSampleCodes = Array.from(dbItemCodes).slice(0, 10);
  dbSampleCodes.forEach(code => {
    const hasMatch = excelItemCodes.has(code);
    console.log(`"${code}" ${hasMatch ? '✅' : '❌'}`);
  });
}

main().catch(console.error);

