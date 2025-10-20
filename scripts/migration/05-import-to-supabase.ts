#!/usr/bin/env tsx

/**
 * Phase 5: Import Master Data to Supabase
 * Companies, Items, BOM relationships
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('📥 Phase 5: Supabase 데이터 임포트 시작...\n');

  // Load validated data
  const validatedPath = path.join(process.cwd(), 'scripts', 'migration', 'validated', 'validated-master-data.json');
  const data = JSON.parse(fs.readFileSync(validatedPath, 'utf-8'));

  console.log(`📊 임포트할 데이터:`);
  console.log(`   - 거래처: ${data.companies.length}개`);
  console.log(`   - 품목: ${data.items.length}개`);
  console.log(`   - BOM 관계: ${data.bom_records.length}개\n`);

  let imported = {
    companies: 0,
    items: 0,
    bom: 0,
    errors: [] as string[]
  };

  // 1. Import Companies
  console.log('1️⃣ 거래처 임포트...');
  for (const company of data.companies) {
    const { error } = await supabase
      .from('companies')
      .upsert({
        company_code: company.company_code,
        company_name: company.company_name,
        company_type: company.company_type,
        is_active: company.is_active
      }, { onConflict: 'company_code' });

    if (error) {
      imported.errors.push(`거래처 ${company.company_code}: ${error.message}`);
    } else {
      imported.companies++;
    }
  }
  console.log(`   ✅ ${imported.companies}/${data.companies.length}개 완료\n`);

  // 2. Import Items (need to map supplier names to IDs)
  console.log('2️⃣ 품목 임포트...');

  // Get supplier IDs
  const { data: suppliers } = await supabase
    .from('companies')
    .select('company_id, company_name, company_code')
    .eq('company_type', '공급사');

  const supplierMap = new Map(
    suppliers?.map(s => [s.company_name, s.company_id]) || []
  );

  for (const item of data.items) {
    // Try to find supplier ID from category/notes
    let supplierId: number | null = null;
    if (item.category && item.category !== '기타') {
      supplierId = supplierMap.get(item.category) || null;
    }

    // Map to database category enum
    const categoryMap: { [key: string]: string } = {
      '기타': '상품',
      '태창금속': '제품',
      '사급': '원자재',
      '하드웨어': '부자재'
    };
    const dbCategory = categoryMap[item.category || '기타'] || '상품';

    const { error } = await supabase
      .from('items')
      .upsert({
        item_code: item.item_code,
        item_name: item.item_name,
        spec: item.spec,
        category: dbCategory,
        price: item.unit_price || 0,
        supplier_id: supplierId,
        is_active: item.is_active
      }, { onConflict: 'item_code' });

    if (error) {
      imported.errors.push(`품목 ${item.item_code}: ${error.message}`);
    } else {
      imported.items++;
    }
  }
  console.log(`   ✅ ${imported.items}/${data.items.length}개 완료\n`);

  // 3. Import BOM (need to map item codes to IDs)
  console.log('3️⃣ BOM 관계 임포트...');

  const { data: items } = await supabase
    .from('items')
    .select('item_id, item_code');

  const itemMap = new Map(
    items?.map(i => [i.item_code, i.item_id]) || []
  );

  for (const bom of data.bom_records) {
    const parentId = itemMap.get(bom.parent_item_code);
    const childId = itemMap.get(bom.child_item_code);

    if (!parentId || !childId) {
      imported.errors.push(`BOM ${bom.parent_item_code} -> ${bom.child_item_code}: 품목 ID 찾기 실패`);
      continue;
    }

    const { error } = await supabase
      .from('bom')
      .upsert({
        parent_item_id: parentId,
        child_item_id: childId,
        quantity_required: bom.quantity || 1,
        level_no: 1,
        is_active: true
      });

    if (error) {
      imported.errors.push(`BOM ${bom.parent_item_code} -> ${bom.child_item_code}: ${error.message}`);
    } else {
      imported.bom++;
    }
  }
  console.log(`   ✅ ${imported.bom}/${data.bom_records.length}개 완료\n`);

  // Report
  console.log('📊 임포트 결과:');
  console.log(`   ✅ 거래처: ${imported.companies}개`);
  console.log(`   ✅ 품목: ${imported.items}개`);
  console.log(`   ✅ BOM: ${imported.bom}개`);

  if (imported.errors.length > 0) {
    console.log(`\n   ⚠️ 에러: ${imported.errors.length}개`);
    imported.errors.slice(0, 5).forEach(e => console.log(`      - ${e}`));
    if (imported.errors.length > 5) {
      console.log(`      ... ${imported.errors.length - 5}개 더`);
    }
  }

  console.log('\n✅ Phase 5 완료!');
}

main().catch(console.error);
