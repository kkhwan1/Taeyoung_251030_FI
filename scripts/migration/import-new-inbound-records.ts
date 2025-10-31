import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InboundTransactionRecord {
  transaction_no: string;
  transaction_date: string;
  transaction_type: string;
  item_id: number;
  item_code: string;
  company_id: number;
  company_name: string;
  quantity: number;
  unit_price: number | null;
  total_amount: number | null;
  notes: string | null;
  status: string;
}

async function importNewInboundRecords() {
  console.log('📦 새로운 입고 거래 데이터 임포트 시작...\n');

  // 변환된 데이터 로드
  const dataPath = path.join(__dirname, 'data', 'clean-data', 'inbound-transformed.json');
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(rawData);

  const records: InboundTransactionRecord[] = data.records;
  console.log(`✅ ${records.length}개 레코드 로드 완료\n`);

  // 기존 transaction_number 조회
  const { data: existingTransactions } = await supabase
    .from('inventory_transactions')
    .select('transaction_number')
    .eq('transaction_type', '입고')
    .like('transaction_number', 'IN-2025-%');

  const existingNumbers = new Set(existingTransactions?.map(t => t.transaction_number) || []);
  console.log(`📊 기존 레코드: ${existingNumbers.size}개\n`);

  // 중복되지 않은 레코드만 필터링
  const newRecords = records.filter(r => !existingNumbers.has(r.transaction_no));

  if (newRecords.length === 0) {
    console.log('ℹ️  모든 레코드가 이미 데이터베이스에 존재합니다.');
    return;
  }

  console.log(`🆕 임포트할 신규 레코드: ${newRecords.length}개`);
  console.log('\n신규 레코드 목록:');
  newRecords.forEach((record, idx) => {
    console.log(`  ${idx + 1}. ${record.transaction_no} | ${record.company_name} | ${record.item_code} | ${record.quantity}개`);
  });
  console.log();

  // 데이터베이스에 삽입할 레코드 준비
  const recordsToInsert = newRecords.map(record => ({
    transaction_number: record.transaction_no,
    transaction_date: record.transaction_date,
    transaction_type: record.transaction_type,
    item_id: record.item_id,
    company_id: record.company_id,
    quantity: record.quantity,
    unit_price: record.unit_price,
    total_amount: record.total_amount,
    notes: record.notes,
    status: record.status === 'COMPLETED' ? '완료' : record.status
  }));

  console.log('📥 데이터베이스에 삽입 중...\n');

  // 배치 삽입
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  const errors: any[] = [];

  for (let i = 0; i < recordsToInsert.length; i += batchSize) {
    const batch = recordsToInsert.slice(i, i + batchSize);

    const { data: insertedData, error } = await supabase
      .from('inventory_transactions')
      .insert(batch)
      .select();

    if (error) {
      console.error(`❌ 배치 ${Math.floor(i / batchSize) + 1} 삽입 실패:`, error.message);
      errorCount += batch.length;
      errors.push({ batch: Math.floor(i / batchSize) + 1, error: error.message });
    } else {
      successCount += insertedData?.length || 0;
      console.log(`✅ 배치 ${Math.floor(i / batchSize) + 1}: ${insertedData?.length || 0}개 레코드 삽입 완료`);
    }
  }

  console.log('\n📊 신규 입고 거래 임포트 완료:');
  console.log(`  - 성공: ${successCount}개`);
  console.log(`  - 실패: ${errorCount}개`);

  if (errors.length > 0) {
    console.log('\n⚠️  에러 상세:');
    errors.forEach(err => {
      console.log(`  배치 ${err.batch}: ${err.error}`);
    });
  }

  // 최종 검증
  const { count, error: countError } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('transaction_type', '입고');

  if (countError) {
    console.error('\n❌ 검증 실패:', countError.message);
  } else {
    console.log(`\n✅ 검증: 데이터베이스에 총 ${count}개의 입고 거래가 있습니다.`);
    console.log(`   (이전: ${existingNumbers.size}개 → 현재: ${count}개, +${count! - existingNumbers.size}개 추가됨)`);
  }

  // 새로 추가된 회사별 통계
  console.log('\n📈 새로 추가된 회사별 입고 통계:');
  const newCompanies = ['현대제철', '창경', '민현', '유동금속 (호원사급)', '대상', '신성산업', '신성산업 (호원사급)', '풍기사급', '오토다임', '신호 (호원사급)', '광성산업'];

  const { data: newStats } = await supabase
    .from('inventory_transactions')
    .select('company_id, companies(company_name), quantity')
    .eq('transaction_type', '입고')
    .in('transaction_number', newRecords.map(r => r.transaction_no));

  if (newStats && newStats.length > 0) {
    const companyStats: { [key: string]: number } = {};

    newStats.forEach((record: any) => {
      const companyName = record.companies?.company_name || '알 수 없음';
      if (newCompanies.includes(companyName)) {
        companyStats[companyName] = (companyStats[companyName] || 0) + record.quantity;
      }
    });

    Object.entries(companyStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([company, qty]) => {
        console.log(`  ${company}: ${qty.toLocaleString()}개`);
      });
  }

  console.log('\n✨ 신규 입고 거래 임포트 완료!');
}

// 실행
importNewInboundRecords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 치명적 에러:', error);
    process.exit(1);
  });
