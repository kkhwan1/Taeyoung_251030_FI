const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('============================================================');
  console.log('item_price_history 테이블 구조 확인');
  console.log('============================================================\n');

  const { data, error } = await supabase.rpc('execute_sql', {
    query_text: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'item_price_history'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.error('❌ 에러:', error.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.log('데이터 타입:', typeof data);
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  console.log('순번 | 컬럼명              | 타입           | NULL 허용');
  console.log('-----|---------------------|----------------|----------');

  data.forEach((col, idx) => {
    const num = String(idx + 1).padStart(4);
    const name = col.column_name.padEnd(19);
    const type = col.data_type.padEnd(14);
    const nullable = col.is_nullable;
    console.log(`${num} | ${name} | ${type} | ${nullable}`);
  });

  console.log('\n============================================================');

  // price_per_kg와 created_by 확인
  const hasNewColumns = data.some(col => col.column_name === 'price_per_kg') &&
                        data.some(col => col.column_name === 'created_by');

  if (hasNewColumns) {
    console.log('✅ 새 컬럼이 성공적으로 추가되었습니다!');
    console.log('   - price_per_kg: 중량 단위 단가 (원/kg)');
    console.log('   - created_by: 변경자 정보');
  } else {
    console.log('❌ 새 컬럼이 없습니다. 마이그레이션이 실패했을 수 있습니다.');
  }

  console.log('============================================================\n');
})();
