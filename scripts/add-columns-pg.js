const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL
});

(async () => {
  console.log('============================================================');
  console.log('Phase P3: Add Missing Columns (PostgreSQL Direct)');
  console.log('============================================================\n');

  try {
    // 1. price_per_kg 컬럼 추가
    console.log('1. price_per_kg 컬럼 추가 중...');
    await pool.query(`
      ALTER TABLE item_price_history
      ADD COLUMN IF NOT EXISTS price_per_kg DECIMAL(15,2) DEFAULT NULL
      CHECK (price_per_kg >= 0 OR price_per_kg IS NULL);
    `);
    console.log('   ✅ 성공\n');

    // 2. created_by 컬럼 추가
    console.log('2. created_by 컬럼 추가 중...');
    await pool.query(`
      ALTER TABLE item_price_history
      ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
    `);
    console.log('   ✅ 성공\n');

    // 3. 컬럼 코멘트
    console.log('3. 컬럼 설명 추가 중...');
    await pool.query(`COMMENT ON COLUMN item_price_history.price_per_kg IS '중량 단위 단가 (원/kg) - 코일 등';`);
    await pool.query(`COMMENT ON COLUMN item_price_history.created_by IS '변경자 (추후 인증 시스템 연동)';`);
    console.log('   ✅ 성공\n');

    // 4. 검증
    console.log('4. 최종 컬럼 구조 확인 중...');
    console.log('------------------------------------------------------------');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'item_price_history'
      ORDER BY ordinal_position;
    `);

    console.log('\n순번 | 컬럼명              | 타입           | NULL 허용');
    console.log('-----|---------------------|----------------|----------');

    result.rows.forEach((col, idx) => {
      const num = String(idx + 1).padStart(4);
      const name = col.column_name.padEnd(19);
      const type = col.data_type.padEnd(14);
      const nullable = col.is_nullable;
      console.log(`${num} | ${name} | ${type} | ${nullable}`);
    });

    // 새 컬럼 확인
    const hasNewColumns = result.rows.some(col => col.column_name === 'price_per_kg') &&
                          result.rows.some(col => col.column_name === 'created_by');

    console.log('\n============================================================');
    if (hasNewColumns) {
      console.log('✅ 마이그레이션 완료! 새 컬럼이 성공적으로 추가되었습니다.');
      console.log('   - price_per_kg (numeric): 중량 단위 단가 (원/kg)');
      console.log('   - created_by (varchar): 변경자 정보');
      console.log('\n✅ Task 1.3.1 완료!');
    } else {
      console.log('❌ 새 컬럼이 확인되지 않습니다.');
    }
    console.log('============================================================\n');

  } catch (err) {
    console.error('\n❌ 오류:', err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
})();
