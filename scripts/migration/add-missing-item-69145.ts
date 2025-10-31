import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addMissingItem() {
  console.log('📦 누락된 품목 코드 69145-AT000 추가 시작...\n');

  // 1. 품목이 이미 존재하는지 확인
  const { data: existingItem, error: checkError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name')
    .eq('item_code', '69145-AT000')
    .single();

  if (existingItem) {
    console.log('✅ 품목이 이미 데이터베이스에 존재합니다:');
    console.log(`   - item_id: ${existingItem.item_id}`);
    console.log(`   - item_code: ${existingItem.item_code}`);
    console.log(`   - item_name: ${existingItem.item_name}`);
    return existingItem.item_id;
  }

  // 2. 호원사급 회사 ID 조회
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('company_id, company_name')
    .eq('company_name', '호원사급')
    .single();

  if (companyError || !company) {
    console.error('❌ 호원사급 회사를 찾을 수 없습니다:', companyError);
    throw new Error('Required company not found');
  }

  console.log(`✅ 공급사 확인: ${company.company_name} (ID: ${company.company_id})\n`);

  // 3. 새 품목 데이터 준비
  const newItem = {
    item_code: '69145-AT000',
    item_name: 'BRKT-RR BUMPER UPR CTR MTG,LH',
    spec: null, // 사양 정보 없음
    unit: 'EA', // 기본 단위
    supplier_id: company.company_id,
    current_stock: 0,
    safety_stock: 0,
    category: '원자재' as const, // 원자재 카테고리
    is_active: true,
    created_at: new Date().toISOString()
  };

  console.log('📝 추가할 품목 정보:');
  console.log(`   - 품목 코드: ${newItem.item_code}`);
  console.log(`   - 품목명: ${newItem.item_name}`);
  console.log(`   - 공급사: ${company.company_name} (ID: ${newItem.supplier_id})`);
  console.log(`   - 단위: ${newItem.unit}\n`);

  // 4. 품목 추가
  const { data: insertedItem, error: insertError } = await supabase
    .from('items')
    .insert(newItem)
    .select()
    .single();

  if (insertError) {
    console.error('❌ 품목 추가 실패:', insertError);
    throw insertError;
  }

  console.log('✅ 품목 추가 성공!');
  console.log(`   - 생성된 item_id: ${insertedItem.item_id}`);
  console.log(`   - 품목 코드: ${insertedItem.item_code}`);
  console.log(`   - 품목명: ${insertedItem.item_name}\n`);

  // 5. price_master에 단가 정보 추가 (이미 있는지 확인)
  const { data: existingPrice } = await supabase
    .from('price_master')
    .select('*')
    .eq('item_code', '69145-AT000')
    .eq('price_month', '2025-04')
    .single();

  if (!existingPrice) {
    console.log('💰 price_master에 단가 정보 추가 중...');

    const { data: priceData, error: priceError } = await supabase
      .from('price_master')
      .insert({
        item_id: insertedItem.item_id,
        item_code: '69145-AT000',
        supplier_id: company.company_id,
        price: 392, // From price-master.json
        price_month: '2025-04',
        valid: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (priceError) {
      console.warn('⚠️  price_master 추가 실패 (무시 가능):', priceError.message);
    } else {
      console.log('✅ price_master 단가 정보 추가 완료');
      console.log(`   - 단가: ₩${priceData.price.toLocaleString('ko-KR')}`);
      console.log(`   - 적용 월: ${priceData.price_month}\n`);
    }
  } else {
    console.log('ℹ️  price_master에 단가 정보가 이미 존재합니다.\n');
  }

  // 6. 검증: 품목이 정상적으로 조회되는지 확인
  const { data: verifyItem, error: verifyError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, supplier_id, companies(company_name)')
    .eq('item_code', '69145-AT000')
    .single();

  if (verifyError || !verifyItem) {
    console.error('❌ 검증 실패:', verifyError);
    throw new Error('Item verification failed');
  }

  console.log('✅ 최종 검증 완료:');
  console.log(`   - item_id: ${verifyItem.item_id}`);
  console.log(`   - item_code: ${verifyItem.item_code}`);
  console.log(`   - item_name: ${verifyItem.item_name}`);
  console.log(`   - supplier: ${verifyItem.companies?.company_name || 'N/A'}`);
  console.log('\n✨ 품목 추가 작업 완료!');

  return insertedItem.item_id;
}

// 실행
addMissingItem()
  .then((itemId) => {
    console.log(`\n🎯 다음 단계: create-inbound-mapping.js에 다음 매핑 추가`);
    console.log(`   '69145-AT000': ${itemId},`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 치명적 에러:', error);
    process.exit(1);
  });
