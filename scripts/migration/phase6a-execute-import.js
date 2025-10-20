/**
 * Phase 6A Import Execution
 *
 * 실제 Excel 데이터를 읽어서 DB에 import 실행
 */

import { parseCSV, parseSalesRow, parsePurchaseRow, saveSalesTransaction, savePurchaseTransaction, printProgress, printStats, stats } from './phase6a-full-import.js';

// Excel MCP로 읽은 실제 데이터
const SALES_CSV_DATA = `,호원오토DL3,65131-L2500,REINF ASSY-CTR FLOOR(PE 일반,HEV),DL3,7979.0,540.0,486.0,432.0,324.0,432.0,0.0,0.0,216.0,324.0,540.0,378.0,216.0,0.0,0.0,486.0,378.0,432.0,648.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
,호원오토DL3,65131-L2800,REINF ASSY-CTR FLOOR-AWD,DL3,7933.0,54.0,54.0,108.0,108.0,108.0,0.0,0.0,54.0,108.0,0.0,54.0,0.0,0.0,0.0,108.0,54.0,108.0,54.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
,호원오토DL3,65131-L3000,REINF ASSY-CTR FLOOR(일반),DL3,7979.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,`;

const PURCHASE_CSV_DATA = `,대우사급DL3/GL3,대우포승DL3/GL3,대우사급,1.0,대우사급,대우포승DL3/GL3,65852-L2000,MBR RR FLR CTR CROSS ,3022.0,900.0,0.0,900.0,1800.0,0.0,0.0,0.0,0.0,900.0,900.0,900.0,0.0,0.0,0.0,0.0,900.0,900.0,900.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
,대우사급DL3/GL3,대우포승DL3/GL3,대우사급,2.0,대우사급,대우포승DL3/GL3,65832-L1000,MBR RR FLR RR CROSS,1655.0,1500.0,0.0,1500.0,0.0,0.0,0.0,0.0,1500.0,0.0,1500.0,1500.0,0.0,0.0,0.0,0.0,0.0,1500.0,1500.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,`;

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

runFullImport().catch(console.error);
