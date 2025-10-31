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

async function checkSuppliers() {
  console.log('=== 공급사 현황 확인 ===\n');

  // 1. 모든 회사 목록 확인
  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('company_id, company_name, company_code, company_type')
    .order('company_name');

  if (companiesError) {
    console.error('회사 조회 오류:', companiesError);
    return;
  }

  console.log(`총 ${companies?.length || 0}개 회사 등록됨\n`);

  // 2. "알 수 없음" 또는 유사한 이름 찾기
  const unknownPatterns = ['알 수 없음', '미상', 'unknown', 'Unknown', 'UNKNOWN', '없음', '-'];
  const suspectCompanies = companies?.filter(c => {
    // ✅ HIGH FIX: Add null guard to prevent undefined.includes() crash
    const name = c.company_name?.toLowerCase() ?? '';
    return unknownPatterns.some(pattern =>
      name.includes(pattern.toLowerCase())
    );
  });

  if (suspectCompanies && suspectCompanies.length > 0) {
    console.log('📌 "알 수 없음" 유사 거래처:');
    suspectCompanies.forEach(c => {
      console.log(`  - ${c.company_name} (ID: ${c.company_id}, 코드: ${c.company_code}, 타입: ${c.company_type})`);
    });
    console.log();
  }

  // 3. supplier_id별 입고 거래 수 확인
  const { data: supplierStats, error: statsError } = await supabase
    .from('inventory_transactions')
    .select('supplier_id')
    .eq('transaction_type', '입고')
    .not('supplier_id', 'is', null);

  if (!statsError && supplierStats) {
    // supplier_id별로 카운트
    const supplierCounts = new Map<string, number>();
    supplierStats.forEach(s => {
      const id = s.supplier_id;
      supplierCounts.set(id, (supplierCounts.get(id) || 0) + 1);
    });

    // 회사 정보와 매칭
    console.log('\n📊 입고 거래가 있는 공급사 TOP 10:');
    console.log('─'.repeat(80));

    const sortedSuppliers = Array.from(supplierCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [supplierId, count] of sortedSuppliers) {
      const company = companies?.find(c => c.company_id === supplierId);
      if (company) {
        console.log(`  ${company.company_name.padEnd(30)} (${company.company_code?.padEnd(10) || '코드없음'.padEnd(10)}): ${count}건`);
      } else {
        console.log(`  [회사 정보 없음 - ID: ${supplierId}]: ${count}건 ⚠️`);
      }
    }
  }

  // 4. NULL supplier_id 확인
  const { data: nullSuppliers, error: nullError } = await supabase
    .from('inventory_transactions')
    .select('transaction_id')
    .eq('transaction_type', '입고')
    .is('supplier_id', null);

  if (!nullError) {
    console.log(`\n⚠️ supplier_id가 NULL인 입고 거래: ${nullSuppliers?.length || 0}건`);
  }

  // 5. 입고 거래에서 사용된 모든 유니크 supplier_id 확인
  const { data: uniqueSuppliers, error: uniqueError } = await supabase
    .from('inventory_transactions')
    .select('supplier_id, items(item_code, item_name)')
    .eq('transaction_type', '입고')
    .not('supplier_id', 'is', null)
    .limit(1000);

  if (!uniqueError && uniqueSuppliers) {
    const supplierSet = new Set(uniqueSuppliers.map(s => s.supplier_id));
    const companyIds = new Set(companies?.map(c => c.company_id));

    // companies 테이블에 없는 supplier_id 찾기
    const orphanSuppliers = Array.from(supplierSet).filter(id => !companyIds.has(id));

    if (orphanSuppliers.length > 0) {
      console.log(`\n❌ companies 테이블에 없는 supplier_id 발견: ${orphanSuppliers.length}개`);
      orphanSuppliers.forEach(id => {
        console.log(`  - ${id}`);
      });
    }
  }

  // 6. 품목 코드 패턴별 공급사 분포
  console.log('\n\n🔍 품목 코드 접두사별 공급사 분포:');
  console.log('─'.repeat(80));

  const { data: itemPatterns, error: patternError } = await supabase
    .from('inventory_transactions')
    .select(`
      supplier_id,
      items!inner(item_code, item_name),
      companies!inner(company_name, company_code)
    `)
    .eq('transaction_type', '입고')
    .limit(5000);

  if (!patternError && itemPatterns) {
    const prefixSupplierMap = new Map<string, Map<string, { name: string, count: number }>>();

    itemPatterns.forEach(t => {
      const prefix = (t.items as any)?.item_code?.substring(0, 3);
      const supplierId = t.supplier_id;
      const supplierName = (t.companies as any)?.company_name || '이름없음';

      if (prefix && supplierId) {
        if (!prefixSupplierMap.has(prefix)) {
          prefixSupplierMap.set(prefix, new Map());
        }

        const suppliers = prefixSupplierMap.get(prefix)!;
        if (!suppliers.has(supplierId)) {
          suppliers.set(supplierId, { name: supplierName, count: 0 });
        }
        suppliers.get(supplierId)!.count++;
      }
    });

    // 상위 5개 접두사 출력
    const sortedPrefixes = Array.from(prefixSupplierMap.entries())
      .sort((a, b) => {
        const totalA = Array.from(a[1].values()).reduce((sum, s) => sum + s.count, 0);
        const totalB = Array.from(b[1].values()).reduce((sum, s) => sum + s.count, 0);
        return totalB - totalA;
      })
      .slice(0, 5);

    sortedPrefixes.forEach(([prefix, suppliers]) => {
      const total = Array.from(suppliers.values()).reduce((sum, s) => sum + s.count, 0);
      console.log(`\n접두사 "${prefix}" (총 ${total}건):`);

      const sortedSuppliers = Array.from(suppliers.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      sortedSuppliers.forEach(s => {
        console.log(`  → ${s.name}: ${s.count}건`);
      });
    });
  }
}

// 실행
checkSuppliers()
  .then(() => console.log('\n✅ 확인 완료'))
  .catch(console.error);