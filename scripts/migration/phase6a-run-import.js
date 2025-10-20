/**
 * Phase 6A Import Runner
 *
 * MCP Excel 데이터를 사용하여 실제 import 실행
 */

import { parseCSV, parseSalesRow, parsePurchaseRow, saveSalesTransaction, savePurchaseTransaction, printProgress, printStats, stats } from './phase6a-full-import.js';

// 첫 3행 샘플 테스트는 이미 성공했으므로,
// 이제는 전체 데이터를 처리합니다.
//
// 실행 방법:
// 1. Excel MCP로 sales 데이터를 읽음
// 2. Excel MCP로 purchase 데이터를 읽음
// 3. 두 데이터를 순차적으로 처리

async function runSampleImport() {
  console.log('\n🚀 Phase 6A Sample Import (3 rows each)...\n');
  console.log('=' .repeat(60));

  let sequence = 1;

  // Sample sales data (3 rows from 납품수량(영업))
  const SALES_SAMPLE = `,호원오토DL3,65131-L2500,REINF ASSY-CTR FLOOR(PE 일반,HEV),DL3,7979.0,540.0,486.0,432.0,324.0,432.0,0.0,0.0,216.0,324.0,540.0,378.0,216.0,0.0,0.0,486.0,378.0,432.0,648.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
,호원오토DL3,65131-L2800,REINF ASSY-CTR FLOOR-AWD,DL3,7933.0,54.0,54.0,108.0,108.0,108.0,0.0,0.0,54.0,108.0,0.0,54.0,0.0,0.0,0.0,108.0,54.0,108.0,54.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
,호원오토DL3,65131-L3000,REINF ASSY-CTR FLOOR(일반),DL3,7979.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,`;

  // Sample purchase data (2 rows from 매입부자재(구매))
  const PURCHASE_SAMPLE = `,대우사급DL3/GL3,대우포승DL3/GL3,대우사급,1.0,대우사급,대우포승DL3/GL3,65852-L2000,MBR RR FLR CTR CROSS ,3022.0,900.0,0.0,900.0,1800.0,0.0,0.0,0.0,0.0,900.0,900.0,900.0,0.0,0.0,0.0,0.0,900.0,900.0,900.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
,대우사급DL3/GL3,대우포승DL3/GL3,대우사급,2.0,대우사급,대우포승DL3/GL3,65832-L1000,MBR RR FLR RR CROSS,1655.0,1500.0,0.0,1500.0,0.0,0.0,0.0,0.0,1500.0,0.0,1500.0,1500.0,0.0,0.0,0.0,0.0,0.0,1500.0,1500.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,`;

  // Sales transactions
  console.log('\n📊 Processing Sales Sample (3 rows)...\n');
  const salesRows = parseCSV(SALES_SAMPLE);

  for (let i = 0; i < salesRows.length; i++) {
    const row = salesRows[i];
    const transactions = parseSalesRow(row, 2025, 9);

    for (const transaction of transactions) {
      await saveSalesTransaction(transaction, sequence++);
    }

    printProgress(i + 1, salesRows.length, 'Sales Rows');
  }

  // Purchase transactions
  console.log('\n\n📦 Processing Purchase Sample (2 rows)...\n');
  const purchaseRows = parseCSV(PURCHASE_SAMPLE);

  for (let i = 0; i < purchaseRows.length; i++) {
    const row = purchaseRows[i];
    const transactions = parsePurchaseRow(row, 2025, 9);

    for (const transaction of transactions) {
      await savePurchaseTransaction(transaction, sequence++);
    }

    printProgress(i + 1, purchaseRows.length, 'Purchase Rows');
  }

  printStats();
}

// 이 스크립트를 직접 실행할 때
runSampleImport().catch(console.error);
