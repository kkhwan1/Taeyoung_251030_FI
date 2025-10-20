/**
 * 프로젝트 정리 실행 스크립트
 * 실행 시점: 2025-10-17 (백업 완료 후)
 *
 * 삭제 대상:
 * - .plan/.before/ (3.1 MB) - Phase 0 레거시 문서
 * - .plan2/archive/ (18+ MB) - Phase 1-2 아카이브
 * - .plan2/참고/*.xlsx (대용량 Excel)
 * - scripts/test-*.js (9개 테스트 스크립트)
 * - scripts/migration/phase6*.js (검증 완료된 마이그레이션)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ITEMS_TO_DELETE = [
  // 레거시 계획 문서
  '.plan/.before',
  '.plan2/archive',

  // 대용량 참고 파일
  '.plan2/참고/2025년 09월 매입 수불관리 (3).xlsx',

  // 테스트 스크립트 (1차 배포 완료)
  'scripts/test-collections-api.js',
  'scripts/test-new-fields.js',
  'scripts/test-payments-api.js',
  'scripts/test-purchase-api.js',
  'scripts/test-sales-api.js',
  'scripts/test-supabase-mcp.js',
  'scripts/create-october-test-data.js',
  'scripts/create_test_transactions.js',

  // 검증 완료된 마이그레이션 스크립트
  'scripts/migration/phase6a-import-transactions.js',
  'scripts/migration/phase6a-verify.js',
  'scripts/migration/phase6a-excel-import.js',
  'scripts/migration/phase6b-import-collections-payments.js',
  'scripts/migration/phase6b-verify.js',
  'scripts/migration/check-excel-data.js',
  'scripts/migration/check-sales-structure.js',
  'scripts/migration/check-web-fields.js',
  'scripts/migration/check-collections-payments-schema.js',
  'scripts/migration/web-page-test.js',
];

console.log('🧹 프로젝트 정리 시작...\n');
console.log('⚠️  백업을 먼저 실행했는지 확인하세요: node scripts/cleanup-backup.js\n');

// 사용자 확인
console.log('다음 항목들이 삭제됩니다:');
ITEMS_TO_DELETE.forEach((item, index) => {
  console.log(`  ${index + 1}. ${item}`);
});

console.log('\n계속하려면 Ctrl+C를 눌러 중단하거나, 5초 후 자동으로 시작됩니다...');

setTimeout(() => {
  executeCleanup();
}, 5000);

function executeCleanup() {
  console.log('\n🗑️  삭제 시작...\n');

  let deletedCount = 0;
  let freedSpace = 0;

  ITEMS_TO_DELETE.forEach(item => {
    const targetPath = path.resolve(item);

    if (!fs.existsSync(targetPath)) {
      console.log(`⏭️  건너뜀 (존재하지 않음): ${item}`);
      return;
    }

    try {
      const stats = fs.statSync(targetPath);
      freedSpace += stats.size;

      if (stats.isDirectory()) {
        // 디렉토리 삭제 (Windows: rmdir /s /q)
        execSync(`rmdir /s /q "${targetPath}"`, { stdio: 'inherit' });
        console.log(`🗂️  디렉토리 삭제: ${item}`);
      } else {
        // 파일 삭제
        fs.unlinkSync(targetPath);
        console.log(`📄 파일 삭제: ${item}`);
      }

      deletedCount++;
    } catch (error) {
      console.error(`❌ 삭제 실패: ${item}`, error.message);
    }
  });

  // 정리 완료 보고서
  const report = {
    cleanupDate: new Date().toISOString(),
    itemsDeleted: deletedCount,
    spaceFreed: `${(freedSpace / 1024 / 1024).toFixed(2)} MB`,
    remainingPlanDocs: ['.plan3/', '.plan/results/', '.plan2/마이그레이션_계획/'],
    nextSteps: [
      'Phase P3 Wave 2 & 3 진행',
      '인증/권한 시스템 구현',
      'API 성능 최적화',
      'E2E 테스트 작성',
    ],
  };

  fs.writeFileSync(
    './CLEANUP_REPORT.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n✅ 정리 완료!');
  console.log(`🗑️  삭제 항목: ${deletedCount}개`);
  console.log(`💾 확보 공간: ${report.spaceFreed}`);
  console.log(`📄 보고서: CLEANUP_REPORT.json`);

  console.log('\n📂 유지된 중요 문서:');
  report.remainingPlanDocs.forEach(doc => {
    console.log(`  ✅ ${doc}`);
  });

  console.log('\n🚀 다음 단계:');
  report.nextSteps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step}`);
  });
}
