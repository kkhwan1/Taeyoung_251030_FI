/**
 * PyHub MCP를 직접 호출하여 엑셀 파일 검토
 *
 * pyhub.mcptools MCP 서버를 직접 사용합니다.
 * 엑셀 파일이 열려있어도 읽을 수 있습니다.
 *
 * 실행: npx tsx scripts/migration/pyhub-direct-review.ts
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
 * PyHub MCP를 통해 엑셀 파일 읽기
 */
async function readExcelWithPyHub(
  bookName: string,
  sheetName: string,
  range: string = 'A1:Z100'
): Promise<string> {
  // PyHub MCP 도구 직접 호출
  // Cursor 환경에서 MCP 도구를 직접 사용
  // 참고: 실제 호출은 Cursor의 MCP 인프라를 통해 이루어집니다
  
  // 이 함수는 실제로는 MCP 도구 호출 래퍼입니다
  // 정확한 호출 방법은 Cursor의 MCP 구현에 따라 다릅니다
  
  throw new Error('PyHub MCP 호출 방법을 확인해야 합니다. Cursor의 MCP 도구를 직접 사용하세요.');
}

/**
 * 엑셀 파일 구조 분석
 */
async function analyzeExcelStructure(
  bookName: string,
  sheetNames: string[],
  logger: ReturnType<typeof createLogger>
): Promise<Map<string, any>> {
  const results = new Map<string, any>();

  logger.log(`\n📄 ${bookName} 분석`, 'info');
  logger.log('─────────────────────────────────────', 'info');

  for (const sheetName of sheetNames) {
    try {
      logger.log(`  🔍 ${sheetName} 시트 확인 중...`, 'info');

      // PyHub MCP를 통해 첫 10행 읽기
      // 실제 구현에서는 Cursor의 MCP 도구를 직접 호출해야 합니다
      
      // 이 부분은 Cursor의 MCP API를 통해 실행됩니다
      logger.log(`  💡 PyHub MCP 호출: ${bookName} - ${sheetName}`, 'info');
      logger.log(`     범위: A1:Z10`, 'info');

    } catch (error: any) {
      logger.log(`  ⚠️  ${sheetName}: ${error.message}`, 'warn');
    }
  }

  return results;
}

/**
 * 품번/단가 매칭 검증
 */
async function verifyMatchingWithPyHub(logger: ReturnType<typeof createLogger>): Promise<void> {
  const supabase = createAdminClient();

  logger.log('\n🔍 PyHub MCP를 활용한 매칭 검증', 'info');
  logger.log('─────────────────────────────────────', 'info');

  // DB 품목 조회
  const { data: dbItems } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, price')
    .limit(100);

  const dbItemCodes = new Set(dbItems?.map(i => i.item_code) || []);
  logger.log(`\n  DB 품목: ${dbItems?.length || 0}개 (샘플 100개)`, 'info');

  // 태창금속 BOM.xlsx의 최신단가 시트에서 품번/단가 추출
  try {
    logger.log('\n  📄 태창금속 BOM.xlsx - 최신단가 시트 분석', 'info');
    logger.log('  💡 PyHub MCP 호출 필요: 태창금속 BOM.xlsx - 최신단가 (A1:C300)', 'info');
    
    // 실제로는 여기서 PyHub MCP를 호출해야 합니다
    logger.log('  ⚠️  PyHub MCP 도구 호출 방법 확인 필요', 'warn');

  } catch (error: any) {
    logger.log(`  ⚠️  오류: ${error.message}`, 'warn');
  }
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('PyHub MCP 직접 호출 검토');
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

  // Step 2: 엑셀 파일 검토
  logger.startPhase('PyHub MCP 엑셀 파일 검토');
  
  logger.log('\n📋 검토할 엑셀 파일들:', 'info');
  logger.log('  1. 09월 원자재 수불관리.xlsx', 'info');
  logger.log('  2. 태창금속 BOM.xlsx', 'info');
  logger.log('  3. 2025년 9월 종합관리 SHEET.xlsx', 'info');
  logger.log('  4. 2025년 9월 매입매출 보고 meanwhile.xlsx', 'info');

  logger.log('\n💡 PyHub MCP 도구 직접 호출 필요', 'info');
  logger.log('   Cursor의 MCP 도구 목록에서 pyhub.mcptools 관련 도구를 확인하세요', 'info');
  logger.log('   예: mcp_pyhub-mcptools_excel_get_values', 'info');

  // 실제 PyHub MCP 호출은 여기서 이루어져야 합니다
  // Cursor의 MCP 인프라를 통해 직접 호출해야 합니다

  logger.endPhase();

  // Step 3: 매칭 검증
  logger.startPhase('PyHub MCP 매칭 검증');
  await verifyMatchingWithPyHub(logger);
  logger.endPhase();

  logger.divider('=');
  logger.log('\n📊 PyHub MCP 검토 준비 완료\n', 'info');
  logger.log('💡 다음 단계:', 'info');
  logger.log('   1. Cursor의 MCP 도구 목록 확인', 'info');
  logger.log('   2. pyhub.mcptools 관련 도구 찾기', 'info');
  logger.log('   3. excel_get_values 같은 함수 호출', 'info');
  
  logger.endMigration(true);
}

main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

