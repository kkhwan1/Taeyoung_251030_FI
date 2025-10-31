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

async function analyzeUnknownSuppliers() {
  console.log('=== 의심스러운 공급사 상세 분석 ===\n');

  // 의심스러운 회사들 ID
  const suspectCompanyIds = [
    171, // 업체
    201, // AOS
    199, // 창경
    176, // 민현
    180, // 대상
    185  // 신성
  ];

  const totalStats = {
    totalTransactions: 0,
    totalItems: new Set<number>(),
    totalQuantity: 0,
    totalAmount: 0
  };

  for (const companyId of suspectCompanyIds) {
    // 회사 정보 조회
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (!company) continue;

    // 입고 거래 조회
    const { data: transactions } = await supabase
      .from('inventory_transactions')
      .select(`
        transaction_id,
        transaction_date,
        item_id,
        quantity,
        unit_price,
        total_amount,
        items!inner(
          item_code,
          item_name,
          spec
        )
      `)
      .eq('company_id', companyId)
      .eq('transaction_type', '입고')
      .order('transaction_date', { ascending: false });

    if (!transactions || transactions.length === 0) continue;

    console.log('═'.repeat(80));
    console.log(`\n🏢 ${company.company_name} (ID: ${company.company_id}, 코드: ${company.company_code})`);
    console.log('─'.repeat(80));

    // 통계 계산
    const uniqueItems = new Set(transactions.map(t => t.item_id));
    const totalQuantity = transactions.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalAmount = transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const dates = transactions.map(t => t.transaction_date).sort();

    console.log(`\n📊 거래 통계:`);
    console.log(`  - 입고 거래 수: ${transactions.length}건`);
    console.log(`  - 유니크 품목: ${uniqueItems.size}개`);
    console.log(`  - 총 수량: ${totalQuantity.toLocaleString()}개`);
    console.log(`  - 총 금액: ₩${totalAmount.toLocaleString()}`);
    console.log(`  - 거래 기간: ${dates[0]} ~ ${dates[dates.length - 1]}`);

    // 전체 통계 업데이트
    totalStats.totalTransactions += transactions.length;
    uniqueItems.forEach(id => totalStats.totalItems.add(id));
    totalStats.totalQuantity += totalQuantity;
    totalStats.totalAmount += totalAmount;

    // 품목 코드 패턴 분석
    const prefixMap = new Map<string, {
      count: number,
      items: Set<string>,
      sampleNames: string[]
    }>();

    transactions.forEach(t => {
      const prefix = (t.items as any)?.item_code?.substring(0, 3) || 'NONE';
      if (!prefixMap.has(prefix)) {
        prefixMap.set(prefix, {
          count: 0,
          items: new Set(),
          sampleNames: []
        });
      }
      const data = prefixMap.get(prefix)!;
      data.count++;
      data.items.add(t.item_id);
      if (data.sampleNames.length < 3 && (t.items as any)?.item_name && !data.sampleNames.includes((t.items as any).item_name)) {
        data.sampleNames.push((t.items as any).item_name);
      }
    });

    console.log(`\n🔤 품목 코드 패턴:`);
    const sortedPrefixes = Array.from(prefixMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    sortedPrefixes.forEach(([prefix, data]) => {
      console.log(`  - ${prefix}: ${data.count}건, ${data.items.size}개 품목`);
      if (data.sampleNames.length > 0) {
        console.log(`    샘플: ${data.sampleNames.join(', ')}`);
      }
    });

    // 최근 거래 샘플
    console.log(`\n📦 최근 거래 샘플 (5건):`);
    transactions.slice(0, 5).forEach((t, idx) => {
      console.log(`  ${idx + 1}. ${t.transaction_date}: ${(t.items as any)?.item_code} - ${(t.items as any)?.item_name}`);
      console.log(`     수량: ${t.quantity}, 단가: ₩${t.unit_price?.toLocaleString()}, 총액: ₩${t.total_amount?.toLocaleString()}`);
    });
  }

  // 전체 요약
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 전체 요약:');
  console.log('─'.repeat(80));
  console.log(`  - 의심 거래처 수: ${suspectCompanyIds.length}개`);
  console.log(`  - 총 입고 거래: ${totalStats.totalTransactions}건`);
  console.log(`  - 총 유니크 품목: ${totalStats.totalItems.size}개`);
  console.log(`  - 총 수량: ${totalStats.totalQuantity.toLocaleString()}개`);
  console.log(`  - 총 금액: ₩${totalStats.totalAmount.toLocaleString()}`);

  // 품목별 공급사 매핑 추천
  console.log('\n\n💡 품목 코드 기반 공급사 매핑 추천:');
  console.log('═'.repeat(80));

  // 각 품목 코드 접두사별로 실제 공급사 찾기
  const prefixToSupplier = new Map<string, Map<string, number>>();

  // 정상적인 회사들의 품목 패턴 수집
  const { data: normalCompanies } = await supabase
    .from('companies')
    .select('company_id, company_name, company_code')
    .not('company_id', 'in', `(${suspectCompanyIds.join(',')})`)
    .eq('company_type', '공급사')
    .eq('is_active', true);

  if (normalCompanies) {
    console.log('\n품목 코드 접두사별 잠재 공급사 분석 중...\n');

    for (const company of normalCompanies.slice(0, 20)) { // 상위 20개만
      const { data: companyTrans } = await supabase
        .from('inventory_transactions')
        .select('items!inner(item_code)')
        .eq('company_id', company.company_id)
        .eq('transaction_type', '입고')
        .limit(100);

      if (companyTrans) {
        companyTrans.forEach(t => {
          const prefix = (t.items as any)?.item_code?.substring(0, 3);
          if (prefix) {
            if (!prefixToSupplier.has(prefix)) {
              prefixToSupplier.set(prefix, new Map());
            }
            const suppliers = prefixToSupplier.get(prefix)!;
            const key = `${company.company_name} (${company.company_code})`;
            suppliers.set(key, (suppliers.get(key) || 0) + 1);
          }
        });
      }
    }

    // 접두사별 추천 공급사 출력
    const prefixesToCheck = ['655', '657', '658', '647', '316', '231', '311'];

    prefixesToCheck.forEach(prefix => {
      const suppliers = prefixToSupplier.get(prefix);
      if (suppliers && suppliers.size > 0) {
        console.log(`\n📦 접두사 "${prefix}"의 추천 공급사:`);
        const sorted = Array.from(suppliers.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        sorted.forEach(([name, count]) => {
          console.log(`  → ${name}: ${count}건의 유사 패턴`);
        });
      }
    });
  }

  // SQL 스크립트 생성 제안
  console.log('\n\n📝 데이터 정리 SQL 스크립트 (예시):');
  console.log('═'.repeat(80));
  console.log('```sql');
  console.log('-- 1. 신규 공급사 추가 (필요한 경우)');
  console.log(`INSERT INTO companies (company_code, company_name, company_type, is_active)
VALUES
  ('SUP-UNKNOWN-001', '미확인공급사1', '공급사', true),
  ('SUP-UNKNOWN-002', '미확인공급사2', '공급사', true);`);

  console.log('\n-- 2. 품목 코드 패턴 기반 supplier 업데이트');
  console.log(`-- 예: 655로 시작하는 품목들을 특정 공급사로 변경
UPDATE inventory_transactions
SET company_id = (SELECT company_id FROM companies WHERE company_code = 'COMP-풍기서산')
WHERE company_id IN (171, 201) -- 업체, AOS
  AND item_id IN (
    SELECT item_id FROM items WHERE item_code LIKE '655%'
  )
  AND transaction_type = '입고';`);

  console.log('\n-- 3. 거래 후 확인');
  console.log(`SELECT c.company_name, COUNT(*) as count
FROM inventory_transactions it
JOIN companies c ON it.company_id = c.company_id
WHERE it.transaction_type = '입고'
  AND c.company_name IN ('업체', 'AOS', '창경', '민현')
GROUP BY c.company_name;`);
  console.log('```');
}

// 실행
analyzeUnknownSuppliers()
  .then(() => console.log('\n✅ 분석 완료'))
  .catch(console.error);