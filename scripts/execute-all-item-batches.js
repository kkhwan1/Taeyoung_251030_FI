const fs = require('fs');
const path = require('path');

/**
 * 모든 품목 배치를 순차적으로 실행하는 스크립트
 */

const projectId = 'pybjnkbmtlyaftuiieyq';
const batchDir = path.join(process.cwd(), 'data', 'sql', 'batches', '신규-품목-추가');

console.log('=== 품목 배치 실행 스크립트 ===\n');

// 배치 파일 목록
const batchFiles = [];
for (let i = 2; i <= 12; i++) {
  const batchFile = path.join(batchDir, `batch-${String(i).padStart(3, '0')}.sql`);
  if (fs.existsSync(batchFile)) {
    batchFiles.push(batchFile);
  }
}

console.log(`총 ${batchFiles.length}개 배치 파일 발견`);
console.log('배치 파일 목록:');
batchFiles.forEach(file => {
  const sql = fs.readFileSync(file, 'utf8');
  console.log(`  ${path.basename(file)}: ${sql.length}자`);
});

console.log('\n각 배치를 순차적으로 실행하려면 mcp_supabase_execute_sql을 사용하세요.');
console.log('\n=== 배치 정보 출력 완료 ===');

