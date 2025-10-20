/**
 * 프로젝트 정리 전 백업 스크립트
 * 실행 시점: 2025-10-17 (1차 배포 완료 후)
 *
 * 백업 대상:
 * - .plan/.before/ (3.1 MB)
 * - .plan2/archive/ (18+ MB)
 * - scripts/test-*.js (9개 파일)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = './.backup-20251017';
const ITEMS_TO_BACKUP = [
  '.plan/.before',
  '.plan2/archive',
  'scripts/test-collections-api.js',
  'scripts/test-new-fields.js',
  'scripts/test-payments-api.js',
  'scripts/test-purchase-api.js',
  'scripts/test-sales-api.js',
  'scripts/test-supabase-mcp.js',
  'scripts/create-october-test-data.js',
  'scripts/create_test_transactions.js',
];

console.log('🗂️  프로젝트 정리 전 백업 시작...\n');

// 백업 디렉토리 생성
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`✅ 백업 디렉토리 생성: ${BACKUP_DIR}`);
}

// 백업 실행
let backupCount = 0;
let backupSize = 0;

ITEMS_TO_BACKUP.forEach(item => {
  const sourcePath = path.resolve(item);

  if (!fs.existsSync(sourcePath)) {
    console.log(`⏭️  건너뜀 (존재하지 않음): ${item}`);
    return;
  }

  const targetPath = path.join(BACKUP_DIR, item);
  const targetDir = path.dirname(targetPath);

  // 대상 디렉토리 생성
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  try {
    // 파일 또는 디렉토리 복사
    const stats = fs.statSync(sourcePath);

    if (stats.isDirectory()) {
      execSync(`xcopy "${sourcePath}" "${targetPath}" /E /I /H /Y`, { stdio: 'inherit' });
      console.log(`📁 디렉토리 백업: ${item}`);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`📄 파일 백업: ${item}`);
    }

    backupCount++;
    backupSize += stats.size;
  } catch (error) {
    console.error(`❌ 백업 실패: ${item}`, error.message);
  }
});

// 백업 메타데이터 저장
const metadata = {
  backupDate: new Date().toISOString(),
  backupReason: '1차 배포 완료 후 프로젝트 정리',
  itemsBackedUp: backupCount,
  totalSize: `${(backupSize / 1024 / 1024).toFixed(2)} MB`,
  items: ITEMS_TO_BACKUP,
  restorationNote: '백업 복원이 필요한 경우 이 디렉토리의 파일들을 원래 위치로 복사하세요.'
};

fs.writeFileSync(
  path.join(BACKUP_DIR, 'BACKUP_INFO.json'),
  JSON.stringify(metadata, null, 2)
);

console.log('\n✅ 백업 완료!');
console.log(`📊 백업 항목: ${backupCount}개`);
console.log(`💾 총 크기: ${metadata.totalSize}`);
console.log(`📂 백업 위치: ${BACKUP_DIR}`);
console.log('\n⚠️  백업 후 정리를 진행하려면 cleanup-execute.js를 실행하세요.');
