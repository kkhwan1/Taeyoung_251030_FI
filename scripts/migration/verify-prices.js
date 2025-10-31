require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('transaction_number, item_id, unit_price, total_amount')
    .eq('transaction_type', '입고')
    .order('transaction_number');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n입고 거래 단가 채우기 검증 결과:\n');
  console.log(`총 입고 거래 레코드: ${data.length}개\n`);

  const withPrice = data.filter(r => r.unit_price !== null);
  const withoutPrice = data.filter(r => r.unit_price === null);

  console.log(`✅ 단가 있음: ${withPrice.length}개`);
  console.log(`⚠️  단가 없음: ${withoutPrice.length}개\n`);

  if (withPrice.length > 0) {
    const totalValue = withPrice.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    console.log(`💰 총 입고 금액: ₩${totalValue.toLocaleString('ko-KR')}\n`);
  }

  if (withoutPrice.length > 0) {
    console.log('단가 없는 레코드:');
    withoutPrice.forEach(r => {
      console.log(`  - ${r.transaction_number}`);
    });
  }
})();
