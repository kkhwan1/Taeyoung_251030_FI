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

async function checkTableStructure() {
  console.log('=== 테이블 구조 확인 ===\n');

  // inventory_transactions 테이블의 샘플 데이터 확인
  const { data: sample, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .limit(1);

  if (error) {
    console.error('테이블 조회 오류:', error);
    return;
  }

  if (sample && sample.length > 0) {
    console.log('📊 inventory_transactions 테이블 컬럼:');
    console.log('─'.repeat(50));
    Object.keys(sample[0]).forEach(key => {
      const value = sample[0][key];
      const type = value === null ? 'null' : typeof value;
      console.log(`  - ${key}: ${type}`);
    });
  }

  // 입고 거래 샘플 확인
  const { data: inboundSample } = await supabase
    .from('inventory_transactions')
    .select('*')
    .eq('transaction_type', '입고')
    .limit(5);

  if (inboundSample) {
    console.log('\n\n📦 입고 거래 샘플 (5건):');
    console.log('─'.repeat(80));
    inboundSample.forEach((t, idx) => {
      console.log(`\n${idx + 1}. 거래 번호: ${t.transaction_number}`);
      console.log(`   날짜: ${t.transaction_date}`);
      console.log(`   타입: ${t.transaction_type}`);
      console.log(`   품목 ID: ${t.item_id}`);
      console.log(`   수량: ${t.quantity}`);

      // supplier 관련 필드 찾기
      Object.keys(t).forEach(key => {
        if (key.includes('supplier') || key.includes('company') || key.includes('vendor')) {
          console.log(`   ${key}: ${t[key]}`);
        }
      });
    });
  }

  // items 테이블 구조도 확인
  const { data: itemSample } = await supabase
    .from('items')
    .select('*')
    .limit(1);

  if (itemSample && itemSample.length > 0) {
    console.log('\n\n📋 items 테이블 컬럼:');
    console.log('─'.repeat(50));
    Object.keys(itemSample[0]).forEach(key => {
      const value = itemSample[0][key];
      const type = value === null ? 'null' : typeof value;
      console.log(`  - ${key}: ${type}`);
    });
  }

  // companies 테이블 구조 확인
  const { data: companySample } = await supabase
    .from('companies')
    .select('*')
    .limit(1);

  if (companySample && companySample.length > 0) {
    console.log('\n\n🏢 companies 테이블 컬럼:');
    console.log('─'.repeat(50));
    Object.keys(companySample[0]).forEach(key => {
      const value = companySample[0][key];
      const type = value === null ? 'null' : typeof value;
      console.log(`  - ${key}: ${type}`);
    });
  }

  // 입고 거래와 items 조인
  const { data: joinedData } = await supabase
    .from('inventory_transactions')
    .select(`
      *,
      items(*)
    `)
    .eq('transaction_type', '입고')
    .limit(3);

  if (joinedData) {
    console.log('\n\n🔗 입고 거래 + 품목 정보 조인 (3건):');
    console.log('─'.repeat(80));
    joinedData.forEach((t, idx) => {
      console.log(`\n${idx + 1}. 거래: ${t.transaction_number}`);
      console.log(`   품목: ${t.items?.item_code} - ${t.items?.item_name}`);

      // items 테이블에서 supplier 관련 필드 확인
      if (t.items) {
        Object.keys(t.items).forEach(key => {
          if (key.includes('supplier') || key.includes('company') || key.includes('vendor')) {
            console.log(`   items.${key}: ${t.items[key]}`);
          }
        });
      }
    });
  }
}

// 실행
checkTableStructure()
  .then(() => console.log('\n✅ 확인 완료'))
  .catch(console.error);