const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyCompany() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('company_code', 'SUP003')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\n✅ Phase 2 거래처 생성 검증 완료!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 기본 정보:');
  console.log(`  - ID: ${data.company_id}`);
  console.log(`  - 코드: ${data.company_code}`);
  console.log(`  - 이름: ${data.company_name}`);
  console.log(`  - 유형: ${data.company_type}`);
  console.log(`  - 전화: ${data.phone}`);
  
  console.log('\n🆕 Phase 2 필드:');
  console.log(`  - 거래처 분류: ${data.company_category}`);
  console.log('  - 사업자 정보:');
  if (data.business_info) {
    console.log(`    • 업태: ${data.business_info.business_type || 'N/A'}`);
    console.log(`    • 종목: ${data.business_info.business_item || 'N/A'}`);
    console.log(`    • 주요품목: ${data.business_info.main_products || 'N/A'}`);
  }
  
  console.log('\n✅ UTF-8 인코딩 검증:');
  console.log(`  - 한글 거래처명: ${data.company_name === '테스트협력사' ? '정상' : '오류'}`);
  console.log(`  - 한글 거래처 유형: ${data.company_type === '공급사' ? '정상' : '오류'}`);
  console.log(`  - 한글 거래처 분류: ${data.company_category === '협력업체-원자재' ? '정상' : '오류'}`);
  console.log(`  - JSONB 한글: ${data.business_info?.business_type === '제조업' ? '정상' : '오류'}`);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

verifyCompany();
