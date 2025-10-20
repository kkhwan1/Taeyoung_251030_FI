#!/usr/bin/env tsx

/**
 * Phase 3: Create Parsed JSON Files from BOM CSV Data
 * Uses the CSV data already retrieved from pyhub MCP
 */

import * as fs from 'fs';
import * as path from 'path';

// BOM CSV Data from 대우공업 sheet (sample - will be replaced with actual data)
const bomData_daewoo = `풍기서산,CN7,65852-BY000,MBR-RR FLR CTR CROSS (HEV),5015.0,6200.0,31093000.0,,풍기서산,CN7,65852-BY000,MBR-RR FLR CTR CROSS (HEV),,5844.0,,
,,,,,,,태창금속,태창금속,CN7,65852-BY000,MBR-RR FLR CTR CROSS (HEV),1.0,5844.0,6200.0,36232800.0`;

interface BOMItem {
  납품처: string;
  차종: string;
  품번: string;
  품명: string;
  단가?: number;
  수량?: number;
  금액?: number;
  부품목록: BOMComponent[];
}

interface BOMComponent {
  사급구분: string;
  공급사명: string;
  차종: string;
  품번: string;
  품명: string;
  소요량: number;
  단가: number;
  고객단가?: number;
  금액: number;
}

interface ParsedBOM {
  파일명: string;
  시트명: string;
  파싱일시: string;
  총항목수: number;
  BOM목록: BOMItem[];
}

/**
 * Parse CSV line handling quoted commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(f => f.trim());
}

/**
 * Parse BOM CSV data into structured JSON
 */
function parseBOMSheet(csvData: string, sheetName: string): ParsedBOM {
  const lines = csvData.trim().split('\n');
  const items: BOMItem[] = [];
  let currentItem: BOMItem | null = null;

  for (const line of lines) {
    const fields = parseCSVLine(line);

    // Skip completely empty lines
    if (fields.every(f => !f)) continue;

    // Parent row: first column has data
    if (fields[0]) {
      if (currentItem) items.push(currentItem);

      currentItem = {
        납품처: fields[0],
        차종: fields[1],
        품번: fields[2],
        품명: fields[3],
        단가: fields[4] ? parseFloat(fields[4]) : undefined,
        수량: fields[5] ? parseFloat(fields[5]) : undefined,
        금액: fields[6] ? parseFloat(fields[6]) : undefined,
        부품목록: []
      };
    }
    // Component row: first columns empty, supplier info in column 7+
    else if (currentItem && fields[7]) {
      const component: BOMComponent = {
        사급구분: fields[7],
        공급사명: fields[8],
        차종: fields[9],
        품번: fields[10],
        품명: fields[11],
        소요량: parseFloat(fields[12]) || 0,
        단가: parseFloat(fields[13]) || 0,
        고객단가: fields[14] ? parseFloat(fields[14]) : undefined,
        금액: parseFloat(fields[15]) || 0
      };
      currentItem.부품목록.push(component);
    }
  }

  if (currentItem) items.push(currentItem);

  return {
    파일명: '태창금속 BOM.xlsx',
    시트명: sheetName,
    파싱일시: new Date().toISOString(),
    총항목수: items.length,
    BOM목록: items
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Phase 3: BOM 데이터 파싱 시작...\n');

  // Create output directory
  const outputDir = path.join(process.cwd(), 'scripts', 'migration', 'parsed');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Parse sample data (will be replaced with actual pyhub MCP data)
  const parsed = parseBOMSheet(bomData_daewoo, '대우공업');

  console.log(`✅ ${parsed.시트명} 파싱 완료:`);
  console.log(`   - 총 BOM 항목: ${parsed.총항목수}개`);
  console.log(`   - 총 부품 수: ${parsed.BOM목록.reduce((sum, item) => sum + item.부품목록.length, 0)}개\n`);

  // Save to JSON
  const outputPath = path.join(outputDir, 'parsed-bom-daewoo.json');
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2), 'utf-8');
  console.log(`💾 저장 완료: ${outputPath}\n`);

  console.log('📊 파싱 결과 샘플:');
  console.log(JSON.stringify(parsed.BOM목록[0], null, 2));
}

main().catch(console.error);
