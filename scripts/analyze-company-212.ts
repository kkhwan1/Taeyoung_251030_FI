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

async function analyzeCompany212() {
  console.log('=== Company ID 212 분석 ===\n');

  // 1. company_id = 212 정보 확인
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('company_id', 212)
    .single();

  if (companyError) {
    console.error('회사 조회 오류:', companyError);
    return;
  }

  console.log('🏢 Company 정보:');
  console.log('─'.repeat(50));
  console.log(`  - ID: ${company.company_id}`);
  console.log(`  - 코드: ${company.company_code}`);
  console.log(`  - 이름: ${company.company_name}`);
  console.log(`  - 타입: ${company.company_type}`);
  console.log(`  - 카테고리: ${company.company_category || 'null'}`);
  console.log(`  - 활성: ${company.is_active}`);
  console.log(`  - 생성일: ${company.created_at}\n`);

  // 2. 이 회사의 입고 거래 통계
  const { data: transactions, error: transError } = await supabase
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
    .eq('company_id', 212)
    .eq('transaction_type', '입고')
    .order('transaction_date', { ascending: false });

  if (transError) {
    console.error('거래 조회 오류:', transError);
    return;
  }

  console.log(`📊 입고 거래 통계:`);
  console.log(`  - 총 거래 수: ${transactions?.length || 0}건`);

  if (transactions && transactions.length > 0) {
    const uniqueItems = new Set(transactions.map(t => t.item_id));
    const totalQuantity = transactions.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalAmount = transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const dates = transactions.map(t => t.transaction_date).sort();

    console.log(`  - 유니크 품목 수: ${uniqueItems.size}개`);
    console.log(`  - 총 수량: ${totalQuantity.toLocaleString()}개`);
    console.log(`  - 총 금액: ₩${totalAmount.toLocaleString()}`);
    console.log(`  - 거래 기간: ${dates[0]} ~ ${dates[dates.length - 1]}\n`);

    // 품목 코드 패턴 분석
    const itemPatterns = new Map<string, { count: number, items: Set<string>, sampleNames: string[] }>();

    transactions.forEach(t => {
      const prefix = (t.items as any)?.item_code?.substring(0, 3) || 'NONE';
      if (!itemPatterns.has(prefix)) {
        itemPatterns.set(prefix, { count: 0, items: new Set(), sampleNames: [] });
      }
      const pattern = itemPatterns.get(prefix)!;
      pattern.count++;
      pattern.items.add(t.item_id);

      if (pattern.sampleNames.length < 3 && (t.items as any)?.item_name && !pattern.sampleNames.includes((t.items as any).item_name)) {
        pattern.sampleNames.push((t.items as any).item_name);
      }
    });

    console.log('🔍 품목 코드 접두사별 분포:');
    console.log('─'.repeat(80));

    const sortedPatterns = Array.from(itemPatterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    sortedPatterns.forEach(([prefix, data]) => {
      console.log(`\n  접두사 "${prefix}": ${data.count}건, ${data.items.size}개 품목`);
      console.log(`    샘플: ${data.sampleNames.join(', ')}`);
    });

    // 최근 거래 샘플
    console.log('\n\n📋 최근 거래 샘플 (10건):');
    console.log('─'.repeat(100));
    console.log('날짜'.padEnd(12) + '품목코드'.padEnd(20) + '품목명'.padEnd(35) + '수량'.padEnd(10) + '단가');
    console.log('─'.repeat(100));

    transactions.slice(0, 10).forEach(t => {
      const date = (t.transaction_date || '').padEnd(12);
      const code = ((t.items as any)?.item_code || '').padEnd(20);
      const name = ((t.items as any)?.item_name || '').substring(0, 33).padEnd(35);
      const qty = (t.quantity || 0).toLocaleString().padEnd(10);
      const price = (t.unit_price || 0).toLocaleString();
      console.log(`${date}${code}${name}${qty}${price}`);
    });
  }

  // 3. 다른 회사들과 비교
  console.log('\n\n📊 다른 주요 입고 거래처와 비교:');
  console.log('─'.repeat(80));

  let topCompanies = null;
  try {
    const rpcResult = await supabase.rpc('execute_sql', {
      query: `
        SELECT
          it.company_id,
          c.company_name,
          c.company_code,
          c.company_type,
          COUNT(*) as transaction_count
        FROM inventory_transactions it
        JOIN companies c ON it.company_id = c.company_id
        WHERE it.transaction_type = '입고'
        GROUP BY it.company_id, c.company_name, c.company_code, c.company_type
        ORDER BY transaction_count DESC
        LIMIT 10
      `
    });
    topCompanies = rpcResult.data;
  } catch (err) {
    console.log('RPC 실행 실패, 대체 방법 사용');
    topCompanies = null;
  }

  if (!topCompanies) {
    // RPC 실패 시 대체 방법
    const { data: allTransactions } = await supabase
      .from('inventory_transactions')
      .select('company_id')
      .eq('transaction_type', '입고');

    if (allTransactions) {
      const companyCounts = new Map<number, number>();
      allTransactions.forEach(t => {
        if (t.company_id) {
          companyCounts.set(t.company_id, (companyCounts.get(t.company_id) || 0) + 1);
        }
      });

      const sorted = Array.from(companyCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      for (const [companyId, count] of sorted) {
        const { data: comp } = await supabase
          .from('companies')
          .select('company_name, company_code, company_type')
          .eq('company_id', companyId)
          .single();

        if (comp) {
          const highlight = companyId === 212 ? ' ⭐' : '';
          console.log(`  ${comp.company_name.padEnd(30)} (${comp.company_code?.padEnd(10) || 'NO_CODE'.padEnd(10)}): ${count}건${highlight}`);
        }
      }
    }
  } else {
    topCompanies.forEach((c: any) => {
      const highlight = c.company_id === 212 ? ' ⭐' : '';
      console.log(`  ${c.company_name.padEnd(30)} (${c.company_code?.padEnd(10) || 'NO_CODE'.padEnd(10)}): ${c.transaction_count}건${highlight}`);
    });
  }

  // 4. 권장사항
  console.log('\n\n💡 분석 결론 및 권장사항:');
  console.log('─'.repeat(80));

  if (company.company_name === '알 수 없음' || company.company_name === '-' ||
      company.company_name.toLowerCase().includes('unknown')) {
    console.log(`\n✅ Company ID 212 ("${company.company_name}")는 "알 수 없음" 거래처입니다.`);
    console.log(`   - 총 ${transactions?.length || 0}건의 입고 거래가 이 회사로 등록되어 있습니다.`);
    console.log('\n📌 해결 방안:');
    console.log('   1. 품목 코드 패턴을 기반으로 실제 공급사 파악');
    console.log('   2. 새로운 공급사를 companies 테이블에 추가');
    console.log('   3. inventory_transactions의 company_id를 적절한 공급사로 업데이트');
    console.log('   4. 향후 입고 시 정확한 공급사 정보 입력 프로세스 개선');
  } else {
    console.log(`\n✅ Company ID 212 ("${company.company_name}")는 정상적인 거래처입니다.`);
  }
}

// 실행
analyzeCompany212()
  .then(() => console.log('\n✅ 분석 완료'))
  .catch(console.error);