import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CompanyRecord {
  company_name: string;
  company_type: string;
  contact_person?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

async function addMissingCompanies() {
  console.log('🏢 누락된 회사 추가 시작...\n');

  // 누락된 14개 회사 목록 (inbound-skipped.json 분석 결과)
  const missingCompanies: CompanyRecord[] = [
    {
      company_name: '현대제철',
      company_type: '공급사',
      notes: '입고 레코드 4개'
    },
    {
      company_name: '창경',
      company_type: '공급사',
      notes: '입고 레코드 5개'
    },
    {
      company_name: '민현',
      company_type: '공급사',
      notes: '입고 레코드 3개'
    },
    {
      company_name: '유동금속 (호원사급)',
      company_type: '공급사',
      notes: '호원 사급 협력사, 입고 레코드 2개'
    },
    {
      company_name: '대상',
      company_type: '공급사',
      notes: '입고 레코드 2개'
    },
    {
      company_name: '신성산업',
      company_type: '공급사',
      notes: '입고 레코드 2개'
    },
    {
      company_name: '신성산업 (호원사급)',
      company_type: '공급사',
      notes: '호원 사급 협력사, 입고 레코드 1개'
    },
    {
      company_name: '풍기사급',
      company_type: '공급사',
      notes: '입고 레코드 1개'
    },
    {
      company_name: '오토다임',
      company_type: '공급사',
      notes: '입고 레코드 1개'
    },
    {
      company_name: '신호 (호원사급)',
      company_type: '공급사',
      notes: '호원 사급 협력사, 입고 레코드 1개'
    },
    {
      company_name: '광성산업',
      company_type: '공급사',
      notes: '입고 레코드 1개'
    }
  ];

  console.log(`📋 추가할 회사 수: ${missingCompanies.length}개\n`);

  // 기존 회사명 확인 (중복 방지)
  const { data: existingCompanies } = await supabase
    .from('companies')
    .select('company_name');

  const existingNames = new Set(existingCompanies?.map(c => c.company_name) || []);
  console.log(`✅ 기존 회사 수: ${existingNames.size}개\n`);

  // 중복되지 않은 회사만 필터링
  const newCompanies = missingCompanies.filter(c => !existingNames.has(c.company_name));

  if (newCompanies.length === 0) {
    console.log('ℹ️  모든 회사가 이미 데이터베이스에 존재합니다.');
    return;
  }

  console.log(`🆕 추가할 신규 회사: ${newCompanies.length}개`);
  newCompanies.forEach((company, idx) => {
    console.log(`  ${idx + 1}. ${company.company_name} (${company.notes})`);
  });
  console.log();

  // 회사 추가
  const { data: insertedData, error } = await supabase
    .from('companies')
    .insert(newCompanies)
    .select();

  if (error) {
    console.error('❌ 회사 추가 실패:', error.message);
    throw error;
  }

  console.log(`✅ ${insertedData?.length || 0}개 회사 추가 완료\n`);

  // 추가된 회사 상세 정보 출력
  if (insertedData && insertedData.length > 0) {
    console.log('📊 추가된 회사 목록:');
    insertedData.forEach((company: any) => {
      console.log(`  - ID: ${company.company_id}, 이름: ${company.company_name}, 타입: ${company.company_type}`);
    });
  }

  // 최종 검증
  const { count: totalCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('company_type', '공급사');

  console.log(`\n✅ 검증: 데이터베이스에 총 ${totalCount}개의 공급사가 있습니다.`);
  console.log('\n✨ 회사 추가 완료!');
}

// 실행
addMissingCompanies()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 치명적 에러:', error);
    process.exit(1);
  });
