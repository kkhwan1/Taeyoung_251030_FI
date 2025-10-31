import { getSupabaseClient } from '../../src/lib/db-unified';
import * as fs from 'fs';
import * as path from 'path';

interface SkippedRecord {
  index: number;
  reason: string;
  record: {
    NO: number;
    협력사: string | null;
    차종: string | null;
    'P/NO': string | number | null;
    'Part Name': string | null;
    납품실적: number | null;
    _sourceFile: string;
  };
}

async function main() {
  const supabase = getSupabaseClient();

  console.log('=== Invalid P/NO 레코드 재임포트 ===\n');

  // Step 1: 건너뛴 레코드 로드
  const skippedPath = path.join(__dirname, 'data/clean-data/inbound-skipped.json');
  const skippedFile = JSON.parse(fs.readFileSync(skippedPath, 'utf8'));
  const skippedRecords: SkippedRecord[] = skippedFile.records || skippedFile;

  // Invalid P/NO 레코드만 필터링 (numeric만)
  const numericPNORecords = skippedRecords.filter(r => {
    if (!r.reason || !r.reason.includes('Invalid P/NO')) return false;

    const pno = r.record['P/NO'];
    if (!pno || pno === null) return false;

    const pnoStr = String(pno).trim();
    return /^[0-9]+$/.test(pnoStr); // 숫자 전용 코드만
  });

  console.log(`Step 1: Invalid P/NO 레코드 로드 완료`);
  console.log(`  - 총 건너뛴 레코드: ${skippedRecords.length}개`);
  console.log(`  - Invalid P/NO (숫자): ${numericPNORecords.length}개\n`);

  if (numericPNORecords.length === 0) {
    console.log('⚠️ 재임포트할 레코드가 없습니다.');
    return;
  }

  // Step 2: 품목 및 거래처 정보 로드
  console.log('Step 2: 마스터 데이터 로드...');

  const itemCodes = Array.from(
    new Set(
      numericPNORecords
        .map(r => String(r.record['P/NO']).trim())
        .filter(code => code && code !== 'null')
    )
  );

  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name')
    .in('item_code', itemCodes);

  if (itemsError) {
    console.error('❌ 품목 정보 로드 실패:', itemsError);
    process.exit(1);
  }

  const itemMap = new Map(items?.map(i => [i.item_code, i.item_id]) || []);
  console.log(`✅ 품목 정보: ${itemMap.size}개 로드됨`);

  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, company_name');

  const companyMap = new Map(companies?.map(c => [c.company_name, c.company_id]) || []);
  console.log(`✅ 거래처 정보: ${companyMap.size}개 로드됨\n`);

  // Step 3: 기존 입고 거래 확인
  console.log('Step 3: 기존 입고 거래 확인...');
  const { data: existingTransactions } = await supabase
    .from('inventory_transactions')
    .select('transaction_no')
    .eq('transaction_type', 'INBOUND');

  const existingTransactionNos = new Set(
    existingTransactions?.map(t => t.transaction_no) || []
  );
  console.log(`✅ 기존 입고 거래: ${existingTransactionNos.size}개\n`);

  // Step 4: 입고 거래 데이터 준비
  console.log('Step 4: 입고 거래 데이터 준비...\n');

  const transactionsToInsert = [];
  const skipped = {
    itemNotFound: [] as any[],
    companyNotFound: [] as any[],
    zeroQuantity: [] as any[],
    alreadyExists: [] as any[]
  };

  let transactionCounter = existingTransactionNos.size + 1;

  for (const record of numericPNORecords) {
    const pno = String(record.record['P/NO']).trim();
    const itemId = itemMap.get(pno);

    if (!itemId) {
      skipped.itemNotFound.push({ pno, record: record.record });
      continue;
    }

    const quantity = record.record.납품실적;
    if (!quantity || quantity === 0) {
      skipped.zeroQuantity.push({ pno, record: record.record });
      continue;
    }

    const companyName = record.record.협력사;
    const companyId = companyName ? companyMap.get(companyName) : null;

    if (companyName && !companyId) {
      skipped.companyNotFound.push({ pno, company: companyName, record: record.record });
      continue;
    }

    const transactionNo = `IN-2025-${String(transactionCounter).padStart(4, '0')}`;

    if (existingTransactionNos.has(transactionNo)) {
      skipped.alreadyExists.push({ transactionNo, record: record.record });
      continue;
    }

    transactionsToInsert.push({
      transaction_no: transactionNo,
      transaction_type: 'INBOUND',
      item_id: itemId,
      company_id: companyId,
      quantity: quantity,
      transaction_date: new Date().toISOString().split('T')[0],
      notes: `Recovered from Invalid P/NO (${pno})`
    });

    transactionCounter++;
  }

  console.log('데이터 준비 결과:');
  console.log(`  ✅ 임포트 가능: ${transactionsToInsert.length}건`);
  console.log(`  ⚠️ 품목 없음: ${skipped.itemNotFound.length}건`);
  console.log(`  ⚠️ 거래처 없음: ${skipped.companyNotFound.length}건`);
  console.log(`  ⚠️ 0 수량: ${skipped.zeroQuantity.length}건`);
  console.log(`  ⚠️ 이미 존재: ${skipped.alreadyExists.length}건\n`);

  if (transactionsToInsert.length === 0) {
    console.log('⚠️ 임포트할 거래가 없습니다.');

    // 건너뛴 이유 저장
    const skippedLogPath = path.join(__dirname, 'reimport-skipped-log.json');
    fs.writeFileSync(skippedLogPath, JSON.stringify(skipped, null, 2), 'utf8');
    console.log(`\n✅ 건너뛴 레코드 저장: ${skippedLogPath}`);
    return;
  }

  // Step 5: 입고 거래 임포트
  console.log('Step 5: 입고 거래 임포트 시작...\n');

  const { data: insertedTransactions, error: insertError } = await supabase
    .from('inventory_transactions')
    .insert(transactionsToInsert)
    .select();

  if (insertError) {
    console.error('❌ 입고 거래 임포트 실패:', insertError);

    // 에러 로그 저장
    const errorLogPath = path.join(__dirname, 'reimport-error-log.json');
    fs.writeFileSync(
      errorLogPath,
      JSON.stringify({ error: insertError, transactions: transactionsToInsert }, null, 2),
      'utf8'
    );
    console.log(`\n❌ 에러 로그 저장: ${errorLogPath}`);
    process.exit(1);
  }

  console.log(`✅ 성공적으로 ${insertedTransactions?.length || 0}건 임포트 완료!\n`);

  // Step 6: 결과 요약
  console.log('=== 임포트 결과 요약 ===\n');

  const summary = {
    totalAttempted: numericPNORecords.length,
    successfullyImported: insertedTransactions?.length || 0,
    skipped: {
      itemNotFound: skipped.itemNotFound.length,
      companyNotFound: skipped.companyNotFound.length,
      zeroQuantity: skipped.zeroQuantity.length,
      alreadyExists: skipped.alreadyExists.length
    }
  };

  console.log(`총 시도: ${summary.totalAttempted}건`);
  console.log(`성공: ${summary.successfullyImported}건`);
  console.log(`건너뜀: ${Object.values(summary.skipped).reduce((a, b) => a + b, 0)}건\n`);

  // Step 7: 신규 입고 거래 목록
  if (insertedTransactions && insertedTransactions.length > 0) {
    console.log('=== 신규 입고 거래 목록 ===\n');

    const transactionIds = insertedTransactions.map(t => t.transaction_id);
    const { data: fullTransactions } = await supabase
      .from('inventory_transactions')
      .select('*, item:items(item_code, item_name), company:companies(company_name)')
      .in('transaction_id', transactionIds);

    fullTransactions?.forEach((t, i) => {
      console.log(
        `${i + 1}. ${t.transaction_no} | ${t.item?.item_code} | ${t.quantity}개 | ${t.company?.company_name || 'N/A'}`
      );
    });
  }

  // Step 8: 로그 저장
  const logPath = path.join(__dirname, 'reimport-numeric-pno-log.json');
  const logData = {
    timestamp: new Date().toISOString(),
    summary,
    skipped,
    insertedTransactions: insertedTransactions?.map(t => ({
      transaction_no: t.transaction_no,
      item_id: t.item_id,
      quantity: t.quantity
    }))
  };

  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf8');
  console.log(`\n✅ 로그 저장: ${logPath}`);

  console.log('\n=== 다음 단계 ===');
  console.log('1. 프론트엔드에서 입고 거래 조회');
  console.log('2. 재고 수량 확인');
  console.log('3. INBOUND_IMPORT_FINAL_SUMMARY.md 업데이트\n');
}

main()
  .then(() => {
    console.log('✅ 재임포트 스크립트 실행 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
