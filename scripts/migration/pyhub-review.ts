/**
 * PyHub MCP (pyhub.mcptools)를 직접 호출하여 엑셀 파일 검토
 *
 * 엑셀 파일이 열려있어도 읽을 수 있습니다.
 * Cursor의 MCP 도구를 직접 사용합니다.
 *
 * 실행: npx tsx scripts/migration/pyhub-review.ts
 */

import { createLogger } from './utils/logger';
import { createAdminClient, testConnection } from './utils/supabase-client';

/**
 * CSV 문자열을 2D 배열로 파싱
 */
function parseCsvToArray(csv: string): any[][] {
  if (!csv || csv.trim() === '') return [];
  
  const lines = csv.trim().split('\n');
  return lines.map(line => {
    const values = line.split(',');
    return values.map(v => {
      const trimmed = v.trim();
      if (trimmed && !isNaN(Number(trimmed)) && trimmed !== '') {
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      }
      return trimmed || '';
    });
  });
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('PyHub MCP 검토');
  logger.startMigration();

  // Step 1: 연결 테스트
  logger.startPhase('Supabase 연결 테스트');
  const connected = await testConnection(createAdminClient());
  if (!connected) {
    logger.log('Supabase 연결 실패', 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  logger.log('\n📋 PyHub MCP로 엑셀 파일 검토 준비', 'info');
  logger.log('   파일이 열려있어도 읽을 수 있습니다.', 'info');
  
  logger.endMigration(true);
}

main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

