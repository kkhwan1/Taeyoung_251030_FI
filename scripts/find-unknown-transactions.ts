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

async function findUnknownTransactions() {
  console.log('=== 입고 거래 현황 조사 ===\n');

  // 1. 전체 입고 거래 수 확인
  const { count: totalCount } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('transaction_type', '입고');

  console.log(`📊 전체 입고 거래 수: ${totalCount}건\n`);

  // 2. supplier_id별 입고 거래 통계
  const { data: transactions, error: transError } = await supabase
    .from('inventory_transactions')
    .select(`
      transaction_id,
      transaction_number,
      transaction_date,
      supplier_id,
      item_id,
      quantity,
      items!inner(item_code, item_name)
    `)
    .eq('transaction_type', '입고')
    .order('transaction_date', { ascending: false })
    .limit(100);

  if (transError) {
    console.error('거래 조회 오류:', transError);
    return;
  }

  // 3. supplier_id별로 그룹화
  const supplierGroups = new Map<string | null, number>();
  transactions?.forEach(t => {
    const supplierId = t.supplier_id || 'NULL';
    supplierGroups.set(supplierId, (supplierGroups.get(supplierId) || 0) + 1);
  });

  console.log('최근 100건의 supplier_id 분포:');
  console.log('─'.repeat(50));
  Array.from(supplierGroups.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, count]) => {
      console.log(`  ${id}: ${count}건`);
    });

  // 4. 각 supplier_id에 대한 company 정보 확인
  const uniqueSupplierIds = Array.from(new Set(transactions?.map(t => t.supplier_id).filter(id => id)));

  console.log('\n\n📌 사용된 supplier_id와 회사 정보 매칭:');
  console.log('─'.repeat(80));

  for (const supplierId of uniqueSupplierIds.slice(0, 10)) {
    const { data: company } = await supabase
      .from('companies')
      .select('company_name, company_code, company_type')
      .eq('company_id', supplierId)
      .single();

    if (company) {
      console.log(`  ${supplierId} → ${company.company_name} (${company.company_code}, ${company.company_type})`);
    } else {
      console.log(`  ${supplierId} → ❌ 회사 정보 없음`);
    }
  }

  // 5. 특정 문제 패턴 찾기
  console.log('\n\n🔍 특수 케이스 조사:');
  console.log('─'.repeat(80));

  // NULL supplier_id 거래
  const { data: nullSuppliers } = await supabase
    .from('inventory_transactions')
    .select('transaction_number, transaction_date, items(item_code, item_name)')
    .eq('transaction_type', '입고')
    .is('supplier_id', null)
    .limit(5);

  if (nullSuppliers && nullSuppliers.length > 0) {
    console.log('\n❌ supplier_id가 NULL인 거래 샘플:');
    nullSuppliers.forEach(t => {
      console.log(`  - ${t.transaction_number} (${t.transaction_date}): ${(t.items as any)?.item_code} - ${(t.items as any)?.item_name}`);
    });
  }

  // 6. 회사 테이블에서 특수 이름 찾기
  const { data: specialCompanies } = await supabase
    .from('companies')
    .select('company_id, company_name, company_code')
    .or(`company_name.ilike.%미상%,company_name.ilike.%unknown%,company_name.ilike.%없음%,company_name.eq.-`);

  if (specialCompanies && specialCompanies.length > 0) {
    console.log('\n📍 특수 이름을 가진 회사들:');
    specialCompanies.forEach(c => {
      console.log(`  - ${c.company_name} (ID: ${c.company_id}, 코드: ${c.company_code})`);
    });

    // 각 회사의 거래 수 확인
    for (const company of specialCompanies) {
      const { count } = await supabase
        .from('inventory_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', company.company_id)
        .eq('transaction_type', '입고');

      console.log(`    → ${company.company_name}: ${count}건의 입고 거래`);
    }
  }

  // 7. 가장 많은 입고 거래를 가진 공급사
  console.log('\n\n📈 입고 거래 TOP 10 공급사:');
  console.log('─'.repeat(80));

  try {
    const { data: topSuppliers } = await supabase.rpc('execute_sql', {
      query: `
        SELECT
          it.supplier_id,
          c.company_name,
          c.company_code,
          COUNT(*) as transaction_count,
          SUM(it.quantity) as total_quantity
        FROM inventory_transactions it
        LEFT JOIN companies c ON it.supplier_id = c.company_id
        WHERE it.transaction_type = '입고'
        GROUP BY it.supplier_id, c.company_name, c.company_code
        ORDER BY transaction_count DESC
        LIMIT 10
      `
    });

    if (topSuppliers) {
      topSuppliers.forEach((s: any) => {
        const name = s.company_name || `[ID: ${s.supplier_id}]`;
        const code = s.company_code || 'NO_CODE';
        console.log(`  ${name.padEnd(30)} (${code.padEnd(10)}): ${s.transaction_count}건, ${parseInt(s.total_quantity).toLocaleString()}개`);
      });
    }
  } catch (error) {
    // Ignore RPC errors
  }
}

// 실행
findUnknownTransactions()
  .then(() => console.log('\n✅ 조사 완료'))
  .catch(console.error);