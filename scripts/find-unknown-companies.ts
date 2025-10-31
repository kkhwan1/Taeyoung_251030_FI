import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findUnknownCompanies() {
  console.log('=== "알 수 없음" 유사 거래처 검색 ===\n');

  // 1. 의심스러운 패턴으로 회사 검색
  const suspectPatterns = [
    '알 수 없음', '알수없음', '미상', '불명',
    'unknown', 'Unknown', 'UNKNOWN',
    '없음', '-', 'N/A', 'NA',
    'temp', 'TEMP', '임시', '테스트'
  ];

  console.log('🔍 검색 패턴:');
  console.log(suspectPatterns.join(', '));
  console.log();

  // 모든 회사 조회
  const { data: companies, error } = await supabase
    .from('companies')
    .select('company_id, company_code, company_name, company_type, is_active')
    .order('company_name');

  if (error) {
    console.error('회사 조회 오류:', error);
    return;
  }

  // 의심스러운 회사 찾기
  const suspectCompanies = companies?.filter(c => {
    // ✅ HIGH FIX: Add null guard to prevent crash when company_name is null
    const name = (c.company_name ?? '').toLowerCase();
    return suspectPatterns.some(pattern =>
      name.includes(pattern.toLowerCase()) ||
      name === pattern.toLowerCase()
    );
  }) || [];

  if (suspectCompanies.length > 0) {
    console.log(`📌 의심스러운 이름의 거래처 ${suspectCompanies.length}개 발견:\n`);

    for (const company of suspectCompanies) {
      console.log('─'.repeat(80));
      console.log(`\n🏢 회사 정보:`);
      console.log(`  - ID: ${company.company_id}`);
      console.log(`  - 코드: ${company.company_code}`);
      console.log(`  - 이름: "${company.company_name}"`);
      console.log(`  - 타입: ${company.company_type}`);
      console.log(`  - 활성: ${company.is_active}`);

      // 입고 거래 수 확인
      const { count: inboundCount } = await supabase
        .from('inventory_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.company_id)
        .eq('transaction_type', '입고');

      // 출고 거래 수 확인
      const { count: outboundCount } = await supabase
        .from('inventory_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.company_id)
        .eq('transaction_type', '출고');

      console.log(`\n  📊 거래 현황:`);
      console.log(`     - 입고 거래: ${inboundCount || 0}건`);
      console.log(`     - 출고 거래: ${outboundCount || 0}건`);

      // 입고 거래가 있는 경우 상세 분석
      if (inboundCount && inboundCount > 0) {
        const { data: transactions } = await supabase
          .from('inventory_transactions')
          .select(`
            transaction_date,
            quantity,
            total_amount,
            items!inner(item_code, item_name)
          `)
          .eq('company_id', company.company_id)
          .eq('transaction_type', '입고')
          .order('transaction_date', { ascending: false })
          .limit(5);

        if (transactions && transactions.length > 0) {
          console.log(`\n  📦 최근 입고 품목 (최대 5건):`);
          transactions.forEach(t => {
            console.log(`     ${t.transaction_date}: ${(t.items as any)?.item_code} - ${(t.items as any)?.item_name} (${t.quantity}개)`);
          });

          // 품목 코드 패턴 분석
          const { data: allTrans } = await supabase
            .from('inventory_transactions')
            .select('items!inner(item_code)')
            .eq('company_id', company.company_id)
            .eq('transaction_type', '입고');

          if (allTrans) {
            const prefixes = new Set<string>();
            allTrans.forEach(t => {
              const prefix = (t.items as any)?.item_code?.substring(0, 3);
              if (prefix) prefixes.add(prefix);
            });

            console.log(`\n  🔤 품목 코드 접두사: ${Array.from(prefixes).join(', ')}`);
          }
        }
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('\n💡 권장 조치사항:');
    console.log('─'.repeat(80));
    console.log('1. 위 거래처들의 실제 공급사 확인');
    console.log('2. 품목 코드 패턴을 기반으로 실제 공급사 추정');
    console.log('3. 정확한 공급사 정보로 업데이트');
    console.log('4. 입력 시스템 개선으로 재발 방지');
  } else {
    console.log('✅ "알 수 없음" 유사 거래처를 찾을 수 없습니다.');
    console.log('모든 거래처가 정상적인 이름을 가지고 있습니다.');
  }

  // 2. 짧은 이름 또는 의미없는 이름 확인
  console.log('\n\n🔍 추가 검사: 짧거나 의미없는 이름');
  console.log('─'.repeat(80));

  const shortNameCompanies = companies?.filter(c =>
    c.company_name.length <= 2 ||
    /^[A-Z0-9\-_]+$/.test(c.company_name) // 대문자/숫자/특수문자만
  ) || [];

  if (shortNameCompanies.length > 0) {
    console.log(`\n📌 짧거나 의미없는 이름 ${shortNameCompanies.length}개 발견:`);
    for (const company of shortNameCompanies) {
      const { count } = await supabase
        .from('inventory_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.company_id)
        .eq('transaction_type', '입고');

      if (count && count > 0) {
        console.log(`  - "${company.company_name}" (ID: ${company.company_id}, 코드: ${company.company_code}): 입고 ${count}건`);
      }
    }
  }

  // 3. 거래 수가 많은데 이름이 이상한 회사들
  console.log('\n\n📊 거래 수가 많지만 이름이 의심스러운 회사:');
  console.log('─'.repeat(80));

  // 입고 거래가 10건 이상인 회사들 중 이름이 이상한 것 찾기
  let activeCompanies = null;
  try {
    const result = await supabase.rpc('execute_sql', {
      query: `
        SELECT
          it.company_id,
          c.company_name,
          c.company_code,
          COUNT(*) as transaction_count
        FROM inventory_transactions it
        JOIN companies c ON it.company_id = c.company_id
        WHERE it.transaction_type = '입고'
        GROUP BY it.company_id, c.company_name, c.company_code
        HAVING COUNT(*) >= 10
        ORDER BY transaction_count DESC
      `
    });
    activeCompanies = result.data;
  } catch (error) {
    // Ignore error, activeCompanies will be null
  }

  if (activeCompanies) {
    const suspectActive = activeCompanies.filter((c: any) => {
      // ✅ HIGH FIX: Add null guard to prevent crash when company_name is null
      const name = (c.company_name ?? '').toLowerCase();
      return name.length <= 3 ||
             name.includes('업체') ||
             name.includes('테스트') ||
             name.includes('임시') ||
             /^[A-Z0-9\-_]+$/.test(c.company_name ?? '');
    });

    if (suspectActive.length > 0) {
      console.log('\n⚠️ 주의가 필요한 거래처:');
      suspectActive.forEach((c: any) => {
        console.log(`  - "${c.company_name}" (${c.company_code}): ${c.transaction_count}건의 입고 거래`);
      });
    }
  }
}

// 실행
findUnknownCompanies()
  .then(() => console.log('\n✅ 검색 완료'))
  .catch(console.error);