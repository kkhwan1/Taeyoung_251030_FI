/**
 * 데이터베이스 연결 테스트
 * Phase P3 Wave 1 Task 1.4
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('============================================================');
console.log('데이터베이스 연결 테스트');
console.log('============================================================');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✓ 설정됨' : '✗ 누락됨');
console.log('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✓ 설정됨' : '✗ 누락됨');
console.log('');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 환경 변수가 설정되지 않았습니다!');
  process.exit(1);
}

async function testConnection() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    console.log('1. Supabase 클라이언트 생성됨');

    // 테스트 1: item_price_history 테이블 스키마 확인
    console.log('\n2. item_price_history 테이블 스키마 확인 중...');
    const { data: schemaData, error: schemaError } = await supabase
      .from('item_price_history')
      .select('*')
      .limit(0);

    if (schemaError) {
      console.error('   ❌ 스키마 조회 실패:', schemaError.message);
      console.error('   상세:', schemaError);
      return;
    }

    console.log('   ✅ 테이블 접근 가능');

    // 테스트 2: 데이터 개수 확인
    console.log('\n3. 데이터 개수 확인 중...');
    const { count, error: countError } = await supabase
      .from('item_price_history')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('   ❌ 개수 조회 실패:', countError.message);
      return;
    }

    console.log(`   ✅ 현재 데이터: ${count}개`);

    // 테스트 3: items 테이블 존재 확인 (JOIN 테스트용)
    console.log('\n4. items 테이블 확인 중...');
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_name')
      .eq('is_active', true)
      .limit(1);

    if (itemsError) {
      console.error('   ❌ items 테이블 조회 실패:', itemsError.message);
      return;
    }

    if (itemsData && itemsData.length > 0) {
      console.log('   ✅ items 테이블 접근 가능');
      console.log(`   테스트용 품목 ID: ${itemsData[0].item_id}`);
    } else {
      console.log('   ⚠️  items 테이블에 활성 데이터가 없습니다');
    }

    // 테스트 4: JOIN 쿼리 테스트
    console.log('\n5. JOIN 쿼리 테스트 중...');
    const { data: joinData, error: joinError } = await supabase
      .from('item_price_history')
      .select(`
        price_history_id,
        price_month,
        unit_price,
        price_per_kg,
        created_by,
        item:items (
          item_id,
          item_name
        )
      `)
      .limit(1);

    if (joinError) {
      console.error('   ❌ JOIN 쿼리 실패:', joinError.message);
      console.error('   상세:', joinError);
      return;
    }

    console.log('   ✅ JOIN 쿼리 성공');
    if (joinData && joinData.length > 0) {
      console.log('   샘플 데이터:', JSON.stringify(joinData[0], null, 2));
    }

    console.log('\n============================================================');
    console.log('✅ 모든 데이터베이스 테스트 통과!');
    console.log('============================================================');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('상세:', error);
  }
}

testConnection();
