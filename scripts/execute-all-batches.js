const fs = require('fs');
const path = require('path');

/**
 * 모든 배치를 순차적으로 실행하는 스크립트
 * 각 배치 파일을 읽어서 mcp_supabase_execute_sql로 실행
 */

const projectId = 'pybjnkbmtlyaftuiieyq';

// 배치 정보 파일 읽기
const batchInfoFiles = [
  'data/sql/batches/신규-단가-이력-추가/batch-info.json',
  'data/sql/batches/신규-재고-거래-추가/batch-info.json',
  'data/sql/batches/신규-품목-추가/batch-info.json'
];

const countQueries = {
  '신규 단가 이력 추가': 'SELECT COUNT(*) as count FROM item_price_history;',
  '신규 재고 거래 추가': 'SELECT COUNT(*) as count FROM inventory_transactions;',
  '신규 품목 추가': 'SELECT COUNT(*) as count FROM items WHERE is_active = true;'
};

console.log('=== 배치 실행 스크립트 ===\n');
console.log('이 스크립트는 배치 정보를 읽어서 각 배치 파일의 경로를 출력합니다.');
console.log('실제 실행은 mcp_supabase_execute_sql을 사용하여 각 배치를 순차적으로 실행하세요.\n');

batchInfoFiles.forEach(infoFile => {
  if (!fs.existsSync(infoFile)) {
    console.log(`⚠️  배치 정보 파일이 없습니다: ${infoFile}`);
    return;
  }
  
  const batchInfo = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
  const sectionName = batchInfo.sectionName;
  
  console.log(`\n=== ${sectionName} ===`);
  console.log(`총 ${batchInfo.totalBatches}개 배치, ${batchInfo.totalRecords}개 레코드`);
  console.log(`배치 파일 목록:`);
  
  batchInfo.batches.forEach(batch => {
    const batchPath = path.join(process.cwd(), 'data', 'sql', batch.sqlFile);
    console.log(`  배치 ${batch.batchNumber}: ${batch.sqlFile} (${batch.recordCount}개 레코드)`);
    if (fs.existsSync(batchPath)) {
      const sql = fs.readFileSync(batchPath, 'utf8');
      console.log(`    SQL 길이: ${sql.length}자`);
    } else {
      console.log(`    ⚠️  파일 없음`);
    }
  });
});

console.log('\n=== 배치 정보 출력 완료 ===');
console.log('\n각 배치를 순차적으로 실행하려면 mcp_supabase_execute_sql을 사용하세요.');

