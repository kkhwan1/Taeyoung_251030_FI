import { getSupabaseClient } from '../../src/lib/db-unified';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const supabase = getSupabaseClient();

  console.log('=== Invalid P/NO 복구 검증 ===\n');

  // Step 1: 추가된 품목 확인
  console.log('Step 1: 추가된 품목 확인...\n');

  const numericCodes = [
    '50007315', '50007752', '50008457', '50008458', '50008630',
    '50009745', '50009770', '50009772', '50009877', '50009878',
    '50010027', '50010086', '50010567', '50010569', '50010988',
    '50010989', '50010990', '50010991', '50010992', '50010993',
    '50011308', '50011384', '50011385', '50011800', '50011801',
    '50011833', '50012234'
  ];

  const { data: addedItems, error: itemsError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, category, is_active')
    .in('item_code', numericCodes)
    .order('item_code');

  if (itemsError) {
    console.error('❌ 품목 조회 실패:', itemsError);
    process.exit(1);
  }

  console.log(`✅ 추가된 품목: ${addedItems?.length || 0}/${numericCodes.length}개\n`);

  if (addedItems && addedItems.length > 0) {
    console.log('품목 목록:');
    addedItems.forEach((item, i) => {
      console.log(
        `  ${i + 1}. [${item.item_code}] ${item.item_name} (${item.category}) - Active: ${item.is_active}`
      );
    });
    console.log();
  }

  // Step 2: 복구된 입고 거래 확인
  console.log('Step 2: 복구된 입고 거래 확인...\n');

  const itemIds = addedItems?.map(i => i.item_id) || [];

  const { data: recoveredTransactions, error: transError } = await supabase
    .from('inventory_transactions')
    .select('*, item:items(item_code, item_name), company:companies(company_name)')
    .eq('transaction_type', '입고')
    .in('item_id', itemIds)
    .order('transaction_id');

  if (transError) {
    console.error('❌ 입고 거래 조회 실패:', transError);
    process.exit(1);
  }

  console.log(`✅ 복구된 입고 거래: ${recoveredTransactions?.length || 0}건\n`);

  if (recoveredTransactions && recoveredTransactions.length > 0) {
    console.log('입고 거래 목록:');
    recoveredTransactions.forEach((t, i) => {
      console.log(
        `  ${i + 1}. ${t.transaction_id} | [${t.item?.item_code}] ${t.item?.item_name} | ${t.quantity}개 | ${t.company?.company_name || 'N/A'}`
      );
    });
    console.log();
  }

  // Step 3: 카테고리별 통계
  console.log('Step 3: 카테고리별 통계...\n');

  const categoryStats: { [key: string]: { items: number; transactions: number; totalQty: number } } = {};

  addedItems?.forEach(item => {
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = { items: 0, transactions: 0, totalQty: 0 };
    }
    categoryStats[item.category].items++;
  });

  recoveredTransactions?.forEach(t => {
    const category = addedItems?.find(i => i.item_id === t.item_id)?.category || 'UNKNOWN';
    if (!categoryStats[category]) {
      categoryStats[category] = { items: 0, transactions: 0, totalQty: 0 };
    }
    categoryStats[category].transactions++;
    categoryStats[category].totalQty += t.quantity || 0;
  });

  console.log('카테고리별 통계:');
  console.log('┌─────────────────┬──────────┬──────────┬──────────────┐');
  console.log('│ Category        │ Items    │ Trans    │ Total Qty    │');
  console.log('├─────────────────┼──────────┼──────────┼──────────────┤');

  Object.entries(categoryStats)
    .sort((a, b) => b[1].totalQty - a[1].totalQty)
    .forEach(([category, stats]) => {
      const catPadded = category.padEnd(15);
      const itemsPadded = String(stats.items).padStart(8);
      const transPadded = String(stats.transactions).padStart(8);
      const qtyPadded = String(stats.totalQty).padStart(12);
      console.log(`│ ${catPadded} │ ${itemsPadded} │ ${transPadded} │ ${qtyPadded} │`);
    });

  console.log('└─────────────────┴──────────┴──────────┴──────────────┘\n');

  // Step 4: 데이터 품질 검증
  console.log('Step 4: 데이터 품질 검증...\n');

  const qualityChecks = {
    allItemsActive: addedItems?.every(i => i.is_active) || false,
    allTransactionsHaveQuantity: recoveredTransactions?.every(t => t.quantity > 0) || false,
    itemCodeFormat: addedItems?.every(i => /^[0-9]{8}$/.test(i.item_code)) || false,
    transactionNumbersUnique:
      new Set(recoveredTransactions?.map(t => t.transaction_id)).size ===
        recoveredTransactions?.length || false
  };

  console.log('품질 검증 결과:');
  console.log(`  ✅ 모든 품목 활성화: ${qualityChecks.allItemsActive ? 'PASS' : 'FAIL'}`);
  console.log(`  ✅ 모든 거래에 수량: ${qualityChecks.allTransactionsHaveQuantity ? 'PASS' : 'FAIL'}`);
  console.log(`  ✅ 품목 코드 형식: ${qualityChecks.itemCodeFormat ? 'PASS' : 'FAIL'}`);
  console.log(`  ✅ 거래 번호 고유: ${qualityChecks.transactionNumbersUnique ? 'PASS' : 'FAIL'}`);
  console.log();

  // Step 5: 재고 수량 검증
  console.log('Step 5: 재고 수량 검증...\n');

  const stockVerification: Array<{
    item_code: string;
    item_name: string;
    current_stock: number;
    inbound_total: number;
    match: boolean;
  }> = [];

  for (const item of addedItems || []) {
    const inboundTransactions = recoveredTransactions?.filter(t => t.item_id === item.item_id) || [];
    const inboundTotal = inboundTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0);

    const { data: currentItem } = await supabase
      .from('items')
      .select('current_stock')
      .eq('item_id', item.item_id)
      .single();

    stockVerification.push({
      item_code: item.item_code,
      item_name: item.item_name,
      current_stock: currentItem?.current_stock || 0,
      inbound_total: inboundTotal,
      match: (currentItem?.current_stock || 0) === inboundTotal
    });
  }

  const stockMismatches = stockVerification.filter(v => !v.match);

  if (stockMismatches.length > 0) {
    console.log('⚠️ 재고 불일치 발견:');
    stockMismatches.forEach(v => {
      console.log(
        `  - [${v.item_code}] ${v.item_name}: 현재=${v.current_stock}, 입고합계=${v.inbound_total}`
      );
    });
  } else {
    console.log('✅ 모든 재고 수량이 입고 합계와 일치합니다.');
  }
  console.log();

  // Step 6: 최종 요약
  console.log('=== 복구 완료 요약 ===\n');

  const totalQuantity = recoveredTransactions?.reduce((sum, t) => sum + (t.quantity || 0), 0) || 0;

  const finalSummary = {
    itemsAdded: addedItems?.length || 0,
    transactionsRecovered: recoveredTransactions?.length || 0,
    totalQuantity,
    categoriesAffected: Object.keys(categoryStats).length,
    qualityScore:
      Object.values(qualityChecks).filter(Boolean).length / Object.keys(qualityChecks).length,
    stockAccurate: stockMismatches.length === 0
  };

  console.log(`추가된 품목: ${finalSummary.itemsAdded}개`);
  console.log(`복구된 입고 거래: ${finalSummary.transactionsRecovered}건`);
  console.log(`총 입고 수량: ${finalSummary.totalQuantity.toLocaleString('ko-KR')}개`);
  console.log(`영향받은 카테고리: ${finalSummary.categoriesAffected}개`);
  console.log(`데이터 품질 점수: ${(finalSummary.qualityScore * 100).toFixed(1)}%`);
  console.log(`재고 정확도: ${finalSummary.stockAccurate ? '✅ PASS' : '⚠️ REVIEW NEEDED'}`);
  console.log();

  // Step 7: 로그 저장
  const reportPath = path.join(__dirname, 'invalid-pno-recovery-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: finalSummary,
    addedItems: addedItems?.map(i => ({
      item_code: i.item_code,
      item_name: i.item_name,
      category: i.category
    })),
    recoveredTransactions: recoveredTransactions?.map(t => ({
      transaction_id: t.transaction_id,
      item_code: t.item?.item_code,
      quantity: t.quantity,
      company: t.company?.company_name
    })),
    categoryStats,
    qualityChecks,
    stockVerification
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`✅ 검증 보고서 저장: ${reportPath}\n`);

  console.log('=== 권장 사항 ===\n');

  if (finalSummary.qualityScore < 1) {
    console.log('⚠️ 데이터 품질 이슈 해결 필요');
  }

  if (!finalSummary.stockAccurate) {
    console.log('⚠️ 재고 불일치 조사 필요');
  }

  if (finalSummary.itemsAdded < 27) {
    console.log(`⚠️ 일부 품목 추가 실패 (${27 - finalSummary.itemsAdded}개 누락)`);
  }

  if (finalSummary.transactionsRecovered === 0) {
    console.log('⚠️ 입고 거래 복구 실패 - reimport 스크립트 재실행 필요');
  }

  console.log('✅ 검증 완료\n');
}

main()
  .then(() => {
    console.log('✅ 검증 스크립트 실행 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 검증 실패:', error);
    process.exit(1);
  });
