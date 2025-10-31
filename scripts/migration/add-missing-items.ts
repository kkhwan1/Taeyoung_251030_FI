import { getSupabaseClient } from '../../src/lib/db-unified';
import * as fs from 'fs';
import * as path from 'path';

interface ItemToAdd {
  item_code: string;
  item_name: string;
  category: string;
  unit: string;
  spec?: string;
  supplier_name?: string;
}

// 품목 카테고리 자동 분류
function categorizeItem(partName: string, itemCode: string): string {
  const name = partName.toUpperCase();

  if (name.includes('ROLLO')) return 'ROLLO';
  if (name.includes('BRACKET') || name.includes('BRKT') || name.includes('B/K')) return 'BRACKET';
  if (name.includes('REINF')) return 'REINFORCEMENT';
  if (name.includes('CROSS MEMBER')) return 'CROSS_MEMBER';
  if (name.includes('BOLT')) return 'FASTENER';
  if (name.includes('BEAM')) return 'BEAM';
  if (name.includes('LINER')) return 'LINER';
  if (name.includes('CONNECTOR')) return 'CONNECTOR';
  if (name.includes('TUBE')) return 'TUBE';
  if (name.includes('ROOM')) return 'INTERIOR';

  return 'MISC';
}

// Invalid P/NO 분석 결과 로드
const analysisPath = path.join(__dirname, '../analysis/invalid-pno-analysis.json');
const analysisData = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

// 27개 고유 품목 코드 추출
const itemsToAdd: ItemToAdd[] = [];
const processedCodes = new Set<string>();

analysisData.detailedPatterns.numeric.forEach((record: any) => {
  if (!processedCodes.has(record.pno)) {
    processedCodes.add(record.pno);

    itemsToAdd.push({
      item_code: record.pno,
      item_name: record.partName || `품목-${record.pno}`,
      category: categorizeItem(record.partName || '', record.pno),
      unit: 'EA',
      spec: record.partName || undefined,
      supplier_name: record.company || undefined
    });
  }
});

console.log('=== Invalid P/NO 품목 추가 스크립트 ===\n');
console.log(`총 추가할 품목: ${itemsToAdd.length}개\n`);

// 카테고리별 통계
const categoryStats: { [key: string]: number } = {};
itemsToAdd.forEach(item => {
  categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
});

console.log('카테고리별 분포:');
Object.entries(categoryStats).forEach(([category, count]) => {
  console.log(`  ${category}: ${count}개`);
});
console.log();

async function main() {
  const supabase = getSupabaseClient();

  console.log('Step 1: 기존 품목 코드 확인...');

  const itemCodes = itemsToAdd.map(i => i.item_code);
  const { data: existingItems, error: checkError } = await supabase
    .from('items')
    .select('item_code')
    .in('item_code', itemCodes);

  if (checkError) {
    console.error('❌ 기존 품목 확인 실패:', checkError);
    process.exit(1);
  }

  const existingCodes = new Set(existingItems?.map(i => i.item_code) || []);
  const newItems = itemsToAdd.filter(item => !existingCodes.has(item.item_code));

  console.log(`✅ 기존 품목: ${existingCodes.size}개`);
  console.log(`✅ 신규 추가: ${newItems.length}개\n`);

  if (newItems.length === 0) {
    console.log('⚠️ 추가할 신규 품목이 없습니다. 모든 품목이 이미 존재합니다.');
    return;
  }

  // Step 2: 거래처 ID 매핑 (에이오에스만 확인됨)
  console.log('Step 2: 거래처 정보 확인...');
  const { data: companies } = await supabase
    .from('companies')
    .select('company_id, company_name')
    .eq('company_name', '에이오에스');

  const aosCompanyId = companies?.[0]?.company_id;
  console.log(`✅ 에이오에스 company_id: ${aosCompanyId || 'N/A'}\n`);

  // Step 3: 품목 추가
  console.log('Step 3: 품목 추가 시작...\n');

  const insertData = newItems.map(item => ({
    item_code: item.item_code,
    item_name: item.item_name,
    category: item.category,
    unit: item.unit,
    spec: item.spec,
    supplier_id: item.supplier_name === '에이오에스' ? aosCompanyId : null,
    is_active: true,
    current_stock: 0,
    safety_stock: 0
  }));

  const { data: insertedItems, error: insertError } = await supabase
    .from('items')
    .insert(insertData)
    .select();

  if (insertError) {
    console.error('❌ 품목 추가 실패:', insertError);
    process.exit(1);
  }

  console.log(`✅ 성공적으로 ${insertedItems?.length || 0}개 품목 추가 완료!\n`);

  // Step 4: 결과 요약
  console.log('=== 추가된 품목 목록 ===\n');
  insertedItems?.forEach((item, i) => {
    console.log(`${i + 1}. [${item.item_code}] ${item.item_name} (${item.category})`);
  });

  console.log('\n=== 카테고리별 추가 통계 ===\n');
  const addedCategoryStats: { [key: string]: number } = {};
  insertedItems?.forEach(item => {
    addedCategoryStats[item.category] = (addedCategoryStats[item.category] || 0) + 1;
  });

  Object.entries(addedCategoryStats).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}개`);
  });

  // Step 5: 로그 저장
  const logPath = path.join(__dirname, 'add-missing-items-log.json');
  const logData = {
    timestamp: new Date().toISOString(),
    totalItems: itemsToAdd.length,
    existingItems: existingCodes.size,
    newItemsAdded: insertedItems?.length || 0,
    categoryStats: addedCategoryStats,
    itemCodes: insertedItems?.map(i => i.item_code) || []
  };

  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf8');
  console.log(`\n✅ 로그 저장: ${logPath}`);

  console.log('\n=== 다음 단계 ===');
  console.log('1. 재임포트 스크립트 실행: npm run tsx scripts/migration/reimport-numeric-pno.ts');
  console.log('2. 검증: 프론트엔드에서 신규 품목 조회');
  console.log('3. 입고 거래 확인: 31건의 레코드가 정상 임포트되었는지 확인\n');
}

main()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
