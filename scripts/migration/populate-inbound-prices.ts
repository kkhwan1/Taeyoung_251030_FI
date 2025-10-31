import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InboundRecord {
  transaction_no: string;
  item_code: string;
  quantity: number;
  unit_price: number | null;
  total_amount: number | null;
}

interface PriceData {
  item_code: string;
  price: number;
  supplier: string;
  price_month: string;
  valid: boolean;
}

async function populateInboundPrices() {
  console.log('💰 입고 거래 단가 정보 채우기 시작...\n');

  // 1. 변환된 입고 데이터 로드
  const inboundPath = path.join(__dirname, 'data', 'clean-data', 'inbound-transformed.json');
  const inboundData = JSON.parse(fs.readFileSync(inboundPath, 'utf8'));
  const inboundRecords: InboundRecord[] = inboundData.records;

  console.log(`✅ ${inboundRecords.length}개 입고 레코드 로드 완료\n`);

  // 2. 가격 마스터 데이터 로드
  const pricePath = path.join(__dirname, 'data', 'clean-data', 'price-master.json');
  const priceData = JSON.parse(fs.readFileSync(pricePath, 'utf8'));
  const prices: PriceData[] = priceData.prices;

  console.log(`✅ ${prices.length}개 가격 정보 로드 완료\n`);

  // 3. 가격 매핑 테이블 생성 (item_code → price)
  const priceMap = new Map<string, number>();
  prices.forEach(p => {
    if (p.valid && p.price > 0) {
      // 품목 코드 정규화 (공백 제거, 슬래시 제거)
      const normalizedCode = p.item_code.trim().replace(/\/$/, '');
      priceMap.set(normalizedCode, p.price);
    }
  });

  console.log(`📊 ${priceMap.size}개 유효한 가격 매핑 생성\n`);

  // 4. 각 입고 레코드에 대해 가격 찾기 및 업데이트
  let foundCount = 0;
  let notFoundCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  const notFoundItems: string[] = [];
  const errors: any[] = [];

  for (const record of inboundRecords) {
    // 품목 코드 정규화
    const normalizedCode = record.item_code.trim().replace(/\/$/, '');
    const price = priceMap.get(normalizedCode);

    if (price !== undefined) {
      foundCount++;
      const totalAmount = Math.round(record.quantity * price);

      // 데이터베이스 업데이트
      const { error } = await supabase
        .from('inventory_transactions')
        .update({
          unit_price: price,
          total_amount: totalAmount
        })
        .eq('transaction_number', record.transaction_no);

      if (error) {
        console.error(`❌ ${record.transaction_no} 업데이트 실패:`, error.message);
        errorCount++;
        errors.push({
          transaction_no: record.transaction_no,
          item_code: record.item_code,
          error: error.message
        });
      } else {
        updatedCount++;
        console.log(`✅ ${record.transaction_no}: ${record.item_code} | 단가 ₩${price.toLocaleString('ko-KR')} | 총액 ₩${totalAmount.toLocaleString('ko-KR')}`);
      }
    } else {
      notFoundCount++;
      notFoundItems.push(record.item_code);
      console.warn(`⚠️  ${record.transaction_no}: ${record.item_code} - 가격 정보 없음`);
    }
  }

  // 5. 최종 통계 출력
  console.log('\n' + '='.repeat(80));
  console.log('📊 입고 거래 단가 채우기 완료\n');
  console.log(`총 레코드 수: ${inboundRecords.length}개`);
  console.log(`  - 가격 찾음: ${foundCount}개 (${((foundCount / inboundRecords.length) * 100).toFixed(1)}%)`);
  console.log(`  - 가격 없음: ${notFoundCount}개 (${((notFoundCount / inboundRecords.length) * 100).toFixed(1)}%)`);
  console.log(`  - 업데이트 성공: ${updatedCount}개`);
  console.log(`  - 업데이트 실패: ${errorCount}개\n`);

  if (notFoundItems.length > 0) {
    console.log('⚠️  가격 정보가 없는 품목 코드:');
    const uniqueNotFound = [...new Set(notFoundItems)].sort();
    uniqueNotFound.forEach(code => {
      const count = notFoundItems.filter(c => c === code).length;
      console.log(`   - ${code} (${count}건)`);
    });
    console.log();
  }

  if (errors.length > 0) {
    console.log('❌ 업데이트 실패 상세:');
    errors.forEach(err => {
      console.log(`   - ${err.transaction_no} (${err.item_code}): ${err.error}`);
    });
    console.log();
  }

  // 6. 검증: 업데이트된 레코드 확인
  const { data: verifyData, error: verifyError } = await supabase
    .from('inventory_transactions')
    .select('transaction_number, item_id, unit_price, total_amount')
    .eq('transaction_type', '입고')
    .in('transaction_number', inboundRecords.map(r => r.transaction_no))
    .not('unit_price', 'is', null);

  if (verifyError) {
    console.error('❌ 검증 실패:', verifyError.message);
  } else {
    console.log(`✅ 검증: ${verifyData.length}개 레코드에 단가 정보가 성공적으로 채워졌습니다.`);

    // 총 금액 계산
    const totalValue = verifyData.reduce((sum, record) => sum + (record.total_amount || 0), 0);
    console.log(`💰 총 입고 금액: ₩${totalValue.toLocaleString('ko-KR')}\n`);
  }

  console.log('✨ 작업 완료!');
}

// 실행
populateInboundPrices()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 치명적 에러:', error);
    process.exit(1);
  });
