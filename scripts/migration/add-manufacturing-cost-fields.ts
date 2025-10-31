/**
 * Migration: Add Manufacturing Cost Fields to items Table
 *
 * Purpose: Excel BOM 파일의 제조 원가 데이터를 저장하기 위한 필드 추가
 *
 * New Fields:
 * - sep: Separator 개수
 * - actual_quantity: 실적수량 (생산 실적)
 * - scrap_weight: 단위당 스크랩중량
 * - scrap_amount: 스크랩금액 (총액)
 * - kg_unit_price: KG단가 (재료비)
 *
 * Date: 2025-01-30
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { getSupabaseClient } from '../../src/lib/db-unified';

const supabase = getSupabaseClient();

async function addManufacturingCostFields() {
  console.log('=== Manufacturing Cost Fields Migration ===\n');

  const migrations = [
    {
      name: 'sep',
      sql: `
        ALTER TABLE items
        ADD COLUMN IF NOT EXISTS sep INTEGER DEFAULT 1;

        COMMENT ON COLUMN items.sep IS 'Separator 개수 (제조 시 필요한 구분자 수)';
      `,
      description: 'SEP (Separator 개수) 필드 추가'
    },
    {
      name: 'actual_quantity',
      sql: `
        ALTER TABLE items
        ADD COLUMN IF NOT EXISTS actual_quantity INTEGER DEFAULT 0;

        COMMENT ON COLUMN items.actual_quantity IS '실적수량 (월별 생산 실적, 개)';
      `,
      description: '실적수량 필드 추가'
    },
    {
      name: 'scrap_weight',
      sql: `
        ALTER TABLE items
        ADD COLUMN IF NOT EXISTS scrap_weight NUMERIC(10,4) DEFAULT 0;

        COMMENT ON COLUMN items.scrap_weight IS '단위당 스크랩중량 (kg/개)';
      `,
      description: '스크랩중량 필드 추가'
    },
    {
      name: 'scrap_amount',
      sql: `
        ALTER TABLE items
        ADD COLUMN IF NOT EXISTS scrap_amount NUMERIC(15,2) DEFAULT 0;

        COMMENT ON COLUMN items.scrap_amount IS '스크랩금액 (실적수량 * 스크랩중량 * 스크랩단가, ₩)';
      `,
      description: '스크랩금액 필드 추가'
    },
    {
      name: 'kg_unit_price',
      sql: `
        ALTER TABLE items
        ADD COLUMN IF NOT EXISTS kg_unit_price NUMERIC(10,2) DEFAULT 0;

        COMMENT ON COLUMN items.kg_unit_price IS 'KG단가 (재료비, ₩/kg)';
      `,
      description: 'KG단가 필드 추가'
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    try {
      console.log(`\n🔄 ${migration.description}...`);
      console.log(`   SQL: ${migration.sql.trim().split('\n')[1].trim()}`);

      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });

      if (error) {
        console.error(`❌ 실패: ${migration.name}`);
        console.error(`   Error: ${error.message}`);
        failCount++;
      } else {
        console.log(`✅ 성공: ${migration.name}`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`❌ 예외 발생: ${migration.name}`);
      console.error(`   Error: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`✅ 성공: ${successCount}/${migrations.length}`);
  console.log(`❌ 실패: ${failCount}/${migrations.length}`);

  if (failCount === 0) {
    console.log('\n🎉 모든 필드가 성공적으로 추가되었습니다!');
    console.log('\nNext Steps:');
    console.log('1. npm run db:types - TypeScript 타입 재생성');
    console.log('2. Run import-bom-manufacturing-data.ts - Excel 데이터 임포트');
    console.log('3. Update Web UI - 제조 원가 섹션 추가');
  } else {
    console.log('\n⚠️  일부 필드 추가에 실패했습니다. 로그를 확인하세요.');
  }
}

// Verify migration
async function verifyMigration() {
  console.log('\n=== Verifying Migration ===\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        column_name,
        data_type,
        column_default,
        col_description('items'::regclass, ordinal_position) as comment
      FROM information_schema.columns
      WHERE table_name = 'items'
        AND column_name IN ('sep', 'actual_quantity', 'scrap_weight', 'scrap_amount', 'kg_unit_price')
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    console.error('❌ Verification failed:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No new fields found. Migration may have failed.');
    return;
  }

  console.log('✅ New Fields in items Table:\n');
  console.table(data);
}

// Main execution
(async () => {
  try {
    await addManufacturingCostFields();
    await verifyMigration();
  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
})();
