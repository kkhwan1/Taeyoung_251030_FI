/**
 * 단가 없는 거래 및 품목 상세 분석
 */

import { createAdminClient } from './utils/supabase-client';

async function main() {
  const supabase = createAdminClient();

  // 전체 거래 수 확인
  const { count: totalCount } = await supabase
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true });

  console.log(`\n전체 거래 수: ${totalCount}\n`);

  // 단가 없는 거래 조회
  const { data: transactionsWithoutPrice, error } = await supabase
    .from('inventory_transactions')
    .select(`
      transaction_id,
      item_id,
      quantity,
      unit_price,
      reference_number,
      transaction_type,
      items(item_code, item_name, price)
    `)
    .or('unit_price.is.null,unit_price.eq.0')
    .limit(50);

  if (error) {
    console.error('오류:', error.message);
    return;
  }

  console.log(`단가 없는 거래 샘플 (최대 50개):\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let withItemPrice = 0;
  let withoutItemPrice = 0;

  transactionsWithoutPrice?.forEach((txn, idx) => {
    const item = txn.items as any;
    const hasItemPrice = item?.price && item.price > 0;
    
    if (hasItemPrice) {
      withItemPrice++;
    } else {
      withoutItemPrice++;
    }

    console.log(`${idx + 1}. 거래 ID: ${txn.transaction_id}`);
    console.log(`   품번: ${item?.item_code || 'N/A'}`);
    console.log(`   품명: ${item?.item_name || 'N/A'}`);
    console.log(`   수량: ${txn.quantity}`);
    console.log(`   거래 단가: ${txn.unit_price || 'NULL'}`);
    console.log(`   품목 단가: ${item?.price || 'NULL'}`);
    console.log(`   거래 유형: ${txn.transaction_type}`);
    console.log(`   참조번호: ${txn.reference_number}`);
    console.log('');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n품목에 단가 있는 거래: ${withItemPrice}개`);
  console.log(`품목에 단가 없는 거래: ${withoutItemPrice}개`);

  // 단가 없는 품목 확인
  const { data: itemsWithoutPrice } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, price')
    .or('price.is.null,price.eq.0')
    .limit(20);

  if (itemsWithoutPrice && itemsWithoutPrice.length > 0) {
    console.log(`\n단가 없는 품목 샘플 (최대 20개):\n`);
    itemsWithoutPrice.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.item_code} - ${item.item_name || 'N/A'}`);
    });
  }
}

main().catch(console.error);

