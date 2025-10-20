/**
 * Phase 6A Excel Reader
 *
 * Excel MCP를 통해 2025년 9월 매입매출 데이터를 읽는 유틸리티
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXCEL_FILE = '2025년 9월 매입매출 보고현황.xlsx';
const SALES_SHEET = '납품수량(영업)';
const PURCHASE_SHEET = '매입부자재(구매)';

/**
 * CSV 문자열을 배열로 파싱
 */
function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  return lines.map(line => {
    // 간단한 CSV 파싱 (Excel MCP가 반환하는 형식 기준)
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  });
}

/**
 * Excel MCP 호출 시뮬레이션 (실제로는 MCP 서버 호출)
 *
 * 실제 구현에서는:
 * - mcp__pyhub-mcptools__excel_get_values 도구 사용
 * - book_name, sheet_name, sheet_range 파라미터 전달
 */
async function readExcelSheet(sheetName, startRow = 2, endRow = 100) {
  console.log(`\n📖 Reading ${sheetName} (rows ${startRow}-${endRow})...`);

  // 이 부분은 실제로는 MCP 도구 호출로 대체됩니다
  // 여기서는 플레이스홀더로 빈 배열 반환
  return [];
}

/**
 * 전체 시트 데이터 읽기 (배치 처리)
 */
async function readFullSheet(sheetName, batchSize = 50) {
  const allRows = [];
  let currentRow = 2; // 헤더 건너뛰기
  let hasMore = true;

  while (hasMore) {
    const endRow = currentRow + batchSize - 1;
    const rows = await readExcelSheet(sheetName, currentRow, endRow);

    if (rows.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...rows);
      currentRow = endRow + 1;

      // 빈 행이 연속으로 나오면 종료
      const emptyCount = rows.filter(row =>
        row.every(cell => !cell || cell === '')
      ).length;

      if (emptyCount > 10) {
        hasMore = false;
      }
    }
  }

  return allRows;
}

export {
  parseCSV,
  readExcelSheet,
  readFullSheet,
  EXCEL_FILE,
  SALES_SHEET,
  PURCHASE_SHEET
};
