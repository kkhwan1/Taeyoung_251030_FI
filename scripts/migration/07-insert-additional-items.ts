import * as fs from 'fs';
import * as path from 'path';

console.log('\n================================================================================');
console.log('🚀 추가 품목 등록 시작');
console.log('================================================================================\n');

// 거래처 매핑 (company_name -> company_id)
const companyMap: Record<string, number> = {
  '풍기산업': 133,
  '대우공업': 130,
  '호원오토': 131,
  '인알파코리아': 132,
  '인알파': 132,
  '다인': 135,
  '풍기광주': 127,
  '풍기서산': 129
};

const additionalItemsPath = path.join(process.cwd(), 'scripts/migration/data/additional-items.json');
const data = JSON.parse(fs.readFileSync(additionalItemsPath, 'utf8'));

const items = data.items;

console.log(`📦 총 ${items.length}개 품목 등록\n`);

// SQL INSERT 쿼리 생성
for (const item of items) {
  const companyId = companyMap[item.company_name] || 127; // 기본값: 풍기광주
  
  const sql = `
INSERT INTO items (
  item_code, item_name, spec, thickness, width, height, 
  specific_gravity, mm_weight, material, category, 
  supplier_id, is_active, created_at
) VALUES (
  '${item.item_code.replace(/'/g, "''")}',
  '${item.item_name.replace(/'/g, "''")}',
  '${(item.spec || '').toString().replace(/'/g, "''")}',
  ${item.thickness || 'NULL'},
  ${item.width || 'NULL'},
  ${item.height || 'NULL'},
  ${item.specific_gravity || 'NULL'},
  ${item.mm_weight || 'NULL'},
  '${item.material.replace(/'/g, "''")}',
  '원자재',
  ${companyId},
  true,
  NOW()
)
ON CONFLICT (item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  updated_at = NOW();
  `;
  
  console.log(`\n${items.indexOf(item) + 1}. ${item.item_code} - ${item.item_name}`);
  console.log(`   거래처: ${item.company_name} (ID: ${companyId})`);
  console.log(`   재질: ${item.material}`);
}

console.log('\n================================================================================');
console.log('✅ SQL 쿼리 준비 완료');
console.log('================================================================================\n');





