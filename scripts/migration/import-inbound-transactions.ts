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

async function importInboundTransactions() {
  console.log('📦 입고 거래 데이터 가져오기 시작...\n');

  // 변환된 데이터 로드
  const dataPath = path.join(__dirname, 'data', 'clean-data', 'inbound-transformed.json');
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(rawData);

  const records: InboundTransactionRecord[] = data.records;
  console.log(`✅ ${records.length}개 레코드 로드 완료\n`);

  // 데이터베이스에 삽입할 레코드 준비 (transaction_number로 매핑)
  const recordsToInsert = records.map(record => ({
    transaction_number: record.transaction_no, // 스키마에는 transaction_number
    transaction_date: record.transaction_date,
    transaction_type: record.transaction_type,
    item_id: record.item_id,
    company_id: record.company_id,
    quantity: record.quantity,
    unit_price: record.unit_price,
    total_amount: record.total_amount,
    notes: record.notes,
    status: record.status === 'COMPLETED' ? '완료' : record.status // 한글 상태로 변환
  }));

  console.log('📥 데이터베이스에 삽입 중...\n');

  // 배치 삽입 (Supabase는 한 번에 최대 1000개 레코드)
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

  console.log('\n📊 입고 거래 임포트 완료:');
  console.log(`  - 성공: ${successCount}개`);
  console.log(`  - 실패: ${errorCount}개`);

  if (errors.length > 0) {
    console.log('\n⚠️  에러 상세:');
    errors.forEach(err => {
      console.log(`  배치 ${err.batch}: ${err.error}`);
    });
  }

  // 검증: 삽입된 레코드 수 확인
  const { count, error: countError } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('transaction_type', '입고');

  if (countError) {
    console.error('\n❌ 검증 실패:', countError.message);
  } else {
    console.log(`\n✅ 검증: 데이터베이스에 총 ${count}개의 입고 거래가 있습니다.`);
  }

  // 통계 출력
  console.log('\n📈 입고 거래 통계:');
  const { data: stats } = await supabase
    .from('inventory_transactions')
    .select('company_id, companies(company_name), quantity')
    .eq('transaction_type', '입고');

  if (stats && stats.length > 0) {
    const companyStats: { [key: string]: number } = {};
    let totalQuantity = 0;

    stats.forEach((record: any) => {
      const companyName = record.companies?.company_name || '알 수 없음';
      companyStats[companyName] = (companyStats[companyName] || 0) + record.quantity;
      totalQuantity += record.quantity;
    });

    console.log(`  - 총 입고 수량: ${totalQuantity.toLocaleString()}개`);
    console.log(`  - 거래처별 입고 수량:`);
    Object.entries(companyStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([company, qty]) => {
        console.log(`    ${company}: ${qty.toLocaleString()}개`);
      });
  }

  console.log('\n✨ 입고 거래 임포트 완료!');
}

// 실행
importInboundTransactions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 치명적 에러:', error);
    process.exit(1);
  });
