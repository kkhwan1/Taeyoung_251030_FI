import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';

console.log('\n================================================================================');
console.log('🚀 실제 재고, 생산, 출고 테스트 데이터 생성');
console.log('================================================================================\n');

// 환경 변수 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestTransactions() {
  try {
    // 1. 품목 조회
    console.log('📦 품목 조회 중...');
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name')
      .eq('is_active', true)
      .limit(10);
    
    if (itemsError) throw itemsError;
    
    console.log(`✅ ${items?.length || 0}개 품목 확인\n`);
    
    if (!items || items.length === 0) {
      console.log('❌ 등록된 품목이 없습니다.');
      return;
    }
    
    // 2. 창고 조회
    console.log('🏭 창고 조회 중...');
    const { data: warehouses, error: warehousesError } = await supabase
      .from('warehouses')
      .select('warehouse_id, warehouse_name')
      .eq('is_active', true);
    
    if (warehousesError) throw warehousesError;
    
    console.log(`✅ ${warehouses?.length || 0}개 창고 확인\n`);
    
    if (!warehouses || warehouses.length === 0) {
      console.log('❌ 등록된 창고가 없습니다.');
      return;
    }
    
    const warehouse = warehouses[0];
    
    // 3. 거래 데이터 생성
    console.log('📝 거래 데이터 생성 중...\n');
    
    const transactions = [];
    
    // 입고 거래 (3개)
    for (let i = 0; i < Math.min(3, items.length); i++) {
      const item = items[i];
      transactions.push({
        item_id: item.item_id,
        warehouse_id: warehouse.warehouse_id,
        transaction_type: '입고',
        quantity: Math.floor(Math.random() * 1000) + 100,
        unit_price: Math.floor(Math.random() * 10000) + 1000,
        transaction_date: new Date(),
        notes: `테스트 입고 - ${item.item_name}`,
        created_by: 1
      });
    }
    
    console.log(`✅ 입고 거래 3개 생성`);
    
    // 출고 거래 (2개)
    for (let i = 0; i < Math.min(2, items.length); i++) {
      const item = items[i + 3] || items[i];
      transactions.push({
        item_id: item.item_id,
        warehouse_id: warehouse.warehouse_id,
        transaction_type: '출고',
        quantity: Math.floor(Math.random() * 500) + 50,
        unit_price: Math.floor(Math.random() * 10000) + 1000,
        transaction_date: new Date(),
        notes: `테스트 출고 - ${item.item_name}`,
        created_by: 1
      });
    }
    
    console.log(`✅ 출고 거래 2개 생성`);
    
    // 생산 거래 (2개)
    for (let i = 0; i < Math.min(2, items.length); i++) {
      const item = items[i + 5] || items[i];
      transactions.push({
        item_id: item.item_id,
        warehouse_id: warehouse.warehouse_id,
        transaction_type: '생산',
        quantity: Math.floor(Math.random() * 200) + 20,
        unit_price: Math.floor(Math.random() * 15000) + 2000,
        transaction_date: new Date(),
        notes: `테스트 생산 - ${item.item_name}`,
        created_by: 1
      });
    }
    
    console.log(`✅ 생산 거래 2개 생성\n`);
    
    // 4. 거래 데이터 삽입
    console.log('💾 데이터베이스에 저장 중...');
    
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert(transactions)
      .select();
    
    if (error) throw error;
    
    console.log(`✅ 총 ${data?.length || 0}개 거래 저장 완료\n`);
    
    // 5. 재고 현황 확인
    console.log('📊 재고 현황 조회 중...');
    
    const { data: stock, error: stockError } = await supabase
      .from('warehouse_stock')
      .select('*')
      .eq('warehouse_id', warehouse.warehouse_id)
      .order('item_id');
    
    if (stockError) throw stockError;
    
    console.log(`✅ 재고 현황: ${stock?.length || 0}개 품목\n`);
    
    if (stock && stock.length > 0) {
      console.log('📋 재고 현황 (처음 5개):');
      stock.slice(0, 5).forEach((item, index) => {
        console.log(`   ${index + 1}. 품목 ID: ${item.item_id}, 재고량: ${item.quantity}, 안전재고: ${item.safety_stock}`);
      });
    }
    
    console.log('\n================================================================================');
    console.log('✅ 테스트 데이터 생성 완료');
    console.log('================================================================================\n');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

createTestTransactions();





