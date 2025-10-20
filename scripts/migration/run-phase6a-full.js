/**
 * Phase 6A Full Import Runner
 *
 * Excel 데이터를 읽어서 DB에 import하는 실행 스크립트
 */

import { parseCSV, parseSalesRow, parsePurchaseRow, saveSalesTransaction, savePurchaseTransaction, printProgress, printStats, stats } from './phase6a-full-import.js';

// Excel CSV 데이터 - 여기에 mcp__pyhub-mcptools__excel_get_values로 가져온 데이터를 붙여넣음
const SALES_CSV_DATA = `여기에 CSV 데이터`;

const PURCHASE_CSV_DATA = `여기에 CSV 데이터`;

async function runFullImport() {
  console.log('\n🚀 Phase 6A Full Import Starting...\n');
  console.log('=' .repeat(60));

  let sequence = 1;

  // Sales transactions
  console.log('\n📊 Processing Sales Transactions...\n');
  const salesRows = parseCSV(SALES_CSV_DATA);
  const totalSalesRows = salesRows.length;

  for (let i = 0; i < salesRows.length; i++) {
    const row = salesRows[i];
    const transactions = parseSalesRow(row, 2025, 9);

    for (const transaction of transactions) {
      await saveSalesTransaction(transaction, sequence++);
    }

    printProgress(i + 1, totalSalesRows, 'Sales Rows');
  }

  console.log('\n\n📦 Processing Purchase Transactions...\n');
  const purchaseRows = parseCSV(PURCHASE_CSV_DATA);
  const totalPurchaseRows = purchaseRows.length;

  for (let i = 0; i < purchaseRows.length; i++) {
    const row = purchaseRows[i];
    const transactions = parsePurchaseRow(row, 2025, 9);

    for (const transaction of transactions) {
      await savePurchaseTransaction(transaction, sequence++);
    }

    printProgress(i + 1, totalPurchaseRows, 'Purchase Rows');
  }

  printStats();
}

// 실행하지 않고 함수만 export (수동 실행용)
export { runFullImport };

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  runFullImport().catch(console.error);
}
