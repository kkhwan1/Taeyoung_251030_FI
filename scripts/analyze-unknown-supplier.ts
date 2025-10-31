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

async function analyzeUnknownSupplierTransactions() {
  console.log('=== "알 수 없음" 거래처 입고 거래 분석 ===\n');

  // 1. 먼저 "알 수 없음" 회사 찾기
  const { data: unknownCompany, error: companyError } = await supabase
    .from('companies')
    .select('company_id, company_code')
    .eq('company_name', '알 수 없음')
    .single();

  if (companyError || !unknownCompany) {
    console.log('❌ "알 수 없음" 거래처를 찾을 수 없습니다.');
    console.error(companyError);
    return;
  }

  console.log(`✅ "알 수 없음" 거래처 ID: ${unknownCompany.company_id} (코드: ${unknownCompany.company_code})\n`);

  // 2. 해당 거래처의 입고 거래와 품목 정보 조회
  const { data: transactions, error: transError } = await supabase
    .from('inventory_transactions')
    .select(`
      transaction_id,
      transaction_number,
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
    .eq('supplier_id', unknownCompany.company_id)
    .eq('transaction_type', '입고')
    .order('transaction_date', { ascending: false });

  if (transError || !transactions) {
    console.error('거래 조회 오류:', transError);
    return;
  }

  // 3. 전체 현황 분석
  console.log('📊 전체 현황:');
  console.log(`  - 총 거래 건수: ${transactions.length}건`);

  const uniqueItems = new Set(transactions.map(t => t.item_id));
  console.log(`  - 유니크 품목 수: ${uniqueItems.size}개`);

  const totalQuantity = transactions.reduce((sum, t) => sum + (t.quantity || 0), 0);
  console.log(`  - 총 수량: ${totalQuantity.toLocaleString()}개`);

  const totalAmount = transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  console.log(`  - 총 금액: ₩${totalAmount.toLocaleString()}`);

  if (transactions.length > 0) {
    const dates = transactions.map(t => t.transaction_date).sort();
    console.log(`  - 거래 기간: ${dates[0]} ~ ${dates[dates.length - 1]}\n`);
  }

  // 4. 품목 코드 패턴 분석
  const itemPatterns = new Map<string, {
    items: Set<string>,
    transactions: number,
    quantity: number,
    sampleNames: string[]
  }>();

  transactions.forEach(t => {
    const prefix = (t.items as any)?.item_code?.substring(0, 3) || 'NONE';
    if (!itemPatterns.has(prefix)) {
      itemPatterns.set(prefix, {
        items: new Set(),
        transactions: 0,
        quantity: 0,
        sampleNames: []
      });
    }
    const pattern = itemPatterns.get(prefix)!;
    pattern.items.add(t.item_id);
    pattern.transactions++;
    pattern.quantity += t.quantity || 0;

    // 샘플 이름 수집 (최대 3개)
    if (pattern.sampleNames.length < 3 && (t.items as any)?.item_name) {
      if (!pattern.sampleNames.includes((t.items as any).item_name)) {
        pattern.sampleNames.push((t.items as any).item_name);
      }
    }
  });

  console.log('🔍 품목 코드 패턴별 분석:');
  console.log('─'.repeat(80));

  const sortedPatterns = Array.from(itemPatterns.entries())
    .sort((a, b) => b[1].transactions - a[1].transactions);

  for (const [prefix, data] of sortedPatterns.slice(0, 10)) {
    console.log(`\n📦 접두사: ${prefix}`);
    console.log(`   - 품목 수: ${data.items.size}개`);
    console.log(`   - 거래 건수: ${data.transactions}건`);
    console.log(`   - 총 수량: ${data.quantity.toLocaleString()}개`);
    console.log(`   - 샘플 품목: ${data.sampleNames.join(', ') || '없음'}`);
  }

  // 5. 날짜별 거래 패턴 분석 (최근 10일)
  const datePatterns = new Map<string, {
    transactions: number,
    items: Set<string>,
    quantity: number,
    amount: number,
    prefixes: Set<string>
  }>();

  transactions.forEach(t => {
    const date = t.transaction_date;
    if (!datePatterns.has(date)) {
      datePatterns.set(date, {
        transactions: 0,
        items: new Set(),
        quantity: 0,
        amount: 0,
        prefixes: new Set()
      });
    }
    const pattern = datePatterns.get(date)!;
    pattern.transactions++;
    pattern.items.add(t.item_id);
    pattern.quantity += t.quantity || 0;
    pattern.amount += t.total_amount || 0;

    const prefix = (t.items as any)?.item_code?.substring(0, 3) || 'NONE';
    pattern.prefixes.add(prefix);
  });

  console.log('\n\n📅 날짜별 거래 패턴 (최근 10일):');
  console.log('─'.repeat(80));

  const sortedDates = Array.from(datePatterns.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10);

  for (const [date, data] of sortedDates) {
    console.log(`\n📅 ${date}`);
    console.log(`   - 거래 수: ${data.transactions}건`);
    console.log(`   - 품목 수: ${data.items.size}개`);
    console.log(`   - 수량: ${data.quantity.toLocaleString()}개`);
    console.log(`   - 금액: ₩${data.amount.toLocaleString()}`);
    console.log(`   - 품목 접두사: ${Array.from(data.prefixes).join(', ')}`);
  }

  // 6. 기존 공급사와의 품목 코드 유사성 분석
  console.log('\n\n🔗 기존 공급사와의 품목 코드 유사성 분석:');
  console.log('─'.repeat(80));

  // 알 수 없음 거래처 품목들의 접두사 수집
  const unknownPrefixes = new Set<string>();
  transactions.forEach(t => {
    const prefix = (t.items as any)?.item_code?.substring(0, 3);
    if (prefix) unknownPrefixes.add(prefix);
  });

  // 각 접두사별로 기존 공급사 확인
  for (const prefix of Array.from(unknownPrefixes).slice(0, 5)) {
    // 해당 접두사를 가진 다른 공급사의 거래 찾기
    const { data: otherSuppliers } = await supabase
      .from('inventory_transactions')
      .select(`
        supplier_id,
        companies!inner(
          company_id,
          company_name,
          company_code
        ),
        items!inner(
          item_code
        )
      `)
      .neq('supplier_id', unknownCompany.company_id)
      .eq('transaction_type', '입고')
      .like('items.item_code', `${prefix}%`)
      .limit(100);

    if (otherSuppliers && otherSuppliers.length > 0) {
      // 공급사별로 그룹화
      const supplierMap = new Map<string, { name: string, code: string, count: number }>();

      otherSuppliers.forEach(s => {
        const id = (s.companies as any)?.company_id;
        if (id && (s.companies as any)?.company_name !== '알 수 없음') {
          if (!supplierMap.has(id)) {
            supplierMap.set(id, {
              name: (s.companies as any).company_name,
              code: (s.companies as any).company_code,
              count: 0
            });
          }
          supplierMap.get(id)!.count++;
        }
      });

      if (supplierMap.size > 0) {
        console.log(`\n접두사 "${prefix}"와 관련된 기존 공급사:`);
        const sorted = Array.from(supplierMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        sorted.forEach(supplier => {
          console.log(`  → ${supplier.name} (${supplier.code}): ${supplier.count}건`);
        });
      }
    }
  }

  // 7. 최근 거래 샘플 (20건)
  console.log('\n\n📋 최근 거래 샘플 (20건):');
  console.log('─'.repeat(100));
  console.log('거래번호'.padEnd(20) + '날짜'.padEnd(12) + '품목코드'.padEnd(15) + '품목명'.padEnd(30) + '수량'.padEnd(10) + '단가');
  console.log('─'.repeat(100));

  transactions.slice(0, 20).forEach(t => {
    const txNo = (t.transaction_number || '').padEnd(20);
    const date = (t.transaction_date || '').padEnd(12);
    const code = ((t.items as any)?.item_code || '').padEnd(15);
    const name = ((t.items as any)?.item_name || '').substring(0, 28).padEnd(30);
    const qty = (t.quantity || 0).toLocaleString().padEnd(10);
    const price = (t.unit_price || 0).toLocaleString();

    console.log(`${txNo}${date}${code}${name}${qty}${price}`);
  });

  console.log('\n' + '='.repeat(100));

  // 8. 해결 방안 제시
  console.log('\n📌 권장 해결 방안:');
  console.log('─'.repeat(80));
  console.log('\n1. 품목 코드 접두사 기반 공급사 매핑');
  console.log('   - 각 접두사별로 실제 공급사를 확인하여 매핑');
  console.log('   - 위 유사성 분석 결과를 참고하여 공급사 추정\n');

  console.log('2. 신규 공급사 생성 필요 품목');
  console.log('   - 기존 공급사와 매칭되지 않는 고유한 접두사');
  console.log('   - 해당 품목들에 대한 실제 공급사 정보 확인 필요\n');

  console.log('3. 데이터 정리 절차');
  console.log('   - Step 1: 품목 코드별 실제 공급사 확인');
  console.log('   - Step 2: companies 테이블에 신규 공급사 추가');
  console.log('   - Step 3: inventory_transactions의 supplier_id 업데이트');
  console.log('   - Step 4: "알 수 없음" 거래처의 거래가 0건인지 확인\n');

  return transactions;
}

// 실행
analyzeUnknownSupplierTransactions()
  .then(() => console.log('\n✅ 분석 완료'))
  .catch(console.error);