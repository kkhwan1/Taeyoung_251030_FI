/**
 * PyHub MCP를 활용한 엑셀 파일 종합 검토
 *
 * 모든 엑셀 파일의 시트 목록, 구조, 데이터 샘플을 확인합니다.
 *
 * 실행: npx tsx scripts/migration/pyhub-comprehensive-review.ts
 */

import * as path from 'path';
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
      // 숫자 변환 시도
      if (trimmed && !isNaN(Number(trimmed)) && trimmed !== '') {
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      }
      return trimmed || '';
    });
  });
}

/**
 * PyHub MCP를 사용하여 엑셀 파일 검토
 */
async function reviewExcelWithPyHub(
  bookName: string,
  logger: ReturnType<typeof createLogger>
): Promise<{
  sheetNames: string[];
  sheetStructures: Map<string, any>;
}> {
  // 상대 경로 사용 (Windows 경로 이슈 해결)
  const { mcp__pyhub_mcptools__excel_get_values } = await import('../..' + '/src/lib/mcp-tools');

  const sheetStructures = new Map<string, any>();

  try {
    // 먼저 각 시트의 첫 몇 행을 읽어서 구조 파악
    // 시트 목록은 직접 지정하거나, 첫 시트를 시도해볼 수 있음
    // 여기서는 주요 시트들을 시도

    logger.log(`\n📄 ${bookName} 분석`, 'info');
    logger.log('─────────────────────────────────────', 'info');

    // 주요 시트들을 시도 (실제 시트명은 파일에 따라 다를 수 있음)
    const potentialSheets: string[] = [];

    if (bookName.includes('09월 원자재 수불관리')) {
      potentialSheets.push(
        '풍기서산(사급)', '세원테크(사급)', '대우포승(사급)', '호원오토(사급)',
        '웅지테크', '태영금속', 'JS테크', '에이오에스', '창경테크', '신성테크',
        '광성산업', 'MV1 , SV (재고관리)', 'TAM,KA4,인알파', 'DL3 GL3 (재고관리)',
        '대우사급 입고현황', '호원사급 입고현황', '협력업체 입고현황'
      );
    } else if (bookName.includes('태창금속 BOM')) {
      potentialSheets.push(
        '대우공업', '풍기산업', '다인', '호원오토', '인알파코리아', '최신단가'
      );
    } else if (bookName.includes('종합관리')) {
      potentialSheets.push('종합재고');
    } else if (bookName.includes('매입매출')) {
      potentialSheets.push('정리');
    }

    const validSheets: string[] = [];

    for (const sheetName of potentialSheets) {
      try {
        // 각 시트의 첫 10행 읽기 (헤더 + 샘플)
        const csvData = await mcp__pyhub_mcptools__excel_get_values({
          book_name: bookName,
          sheet_name: sheetName,
          sheet_range: 'A1:Z10', // 첫 10행, A-Z 컬럼
          value_type: 'values'
        });

        if (csvData && csvData.trim() !== '') {
          const rows = parseCsvToArray(csvData);
          validSheets.push(sheetName);
          
          // 구조 정보 저장
          sheetStructures.set(sheetName, {
            rows: rows.length,
            headers: rows[0] || [],
            sampleData: rows.slice(1, Math.min(4, rows.length))
          });

          logger.log(`  ✅ ${sheetName}: ${rows.length}행 확인`, 'success');
        }
      } catch (error: any) {
        // 시트가 없거나 읽기 실패한 경우 무시
        continue;
      }
    }

    logger.log(`\n  📊 총 ${validSheets.length}개 시트 확인`, 'info');

    // 각 시트의 상세 정보 출력
    for (const [sheetName, structure] of sheetStructures.entries()) {
      logger.log(`\n  📋 ${sheetName}:`, 'info');
      logger.log(`     헤더 (${structure.headers.length}개 컬럼):`, 'info');
      structure.headers.slice(0, 15).forEach((header: string, idx: number) => {
        if (header) {
          logger.log(`       [${idx}]: "${header}"`, 'info');
        }
      });

      if (structure.sampleData.length > 0) {
        logger.log(`     데이터 샘플 (${structure.sampleData.length}행):`, 'info');
        structure.sampleData.forEach((row: any[], idx: number) => {
          const rowData = row.slice(0, 10).map((cell, cellIdx) => {
            const cellStr = String(cell || '').trim();
            return cellStr ? `[${cellIdx}]="${cellStr.substring(0, 20)}"` : '';
          }).filter(Boolean).join(', ');
          
          if (rowData) {
            logger.log(`       행 ${idx + 1}: ${rowData}`, 'info');
          }
        });
      }
    }

    return {
      sheetNames: validSheets,
      sheetStructures
    };

  } catch (error: any) {
    logger.log(`  ❌ 오류: ${error.message}`, 'error');
    return {
      sheetNames: [],
      sheetStructures: new Map()
    };
  }
}

/**
 * PyHub MCP를 사용하여 품번/단가 매칭 확인
 */
async function verifyMatchingWithPyHub(
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  const supabase = createAdminClient();
  // 상대 경로 사용 (Windows 경로 이슈 해결)
  const { mcp__pyhub_mcptools__excel_get_values } = await import('../..' + '/src/lib/mcp-tools');

  logger.log('\n🔍 PyHub MCP를 활용한 매칭 검증', 'info');
  logger.log('─────────────────────────────────────', 'info');

  // DB 품목 조회
  const { data: dbItems } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, price')
    .limit(50);

  const dbItemCodes = new Set(dbItems?.map(i => i.item_code) || []);
  logger.log(`\n  DB 품목: ${dbItems?.length || 0}개 (샘플 50개)`, 'info');

  // 태창금속 BOM.xlsx의 최신단가 시트에서 품번/단가 추출
  try {
    logger.log('\n  📄 태창금속 BOM.xlsx - 최신단가 시트 분석', 'info');
    
    const csvData = await mcp__pyhub_mcptools__excel_get_values({
      book_name: '태창금속 BOM.xlsx',
      sheet_name: '최신단가',
      sheet_range: 'A1:C300', // 품번, 단가, 거래처
      value_type: 'values'
    });

    const rows = parseCsvToArray(csvData);
    logger.log(`  시트 데이터: ${rows.length}행`, 'info');

    if (rows.length > 0) {
      // 헤더 확인
      const headerRow = rows[0];
      logger.log(`  헤더: ${headerRow.slice(0, 5).join(', ')}`, 'info');

      // 데이터 행 분석
      let matchedCodes = 0;
      let unmatchedCodes = 0;
      const unmatchedSamples: string[] = [];

      for (let i = 1; i < Math.min(rows.length, 100); i++) {
        const row = rows[i];
        const itemCode = String(row[0] || '').trim(); // 첫 번째 컬럼이 품번일 것으로 예상

        if (itemCode && itemCode.length >= 3) {
          if (dbItemCodes.has(itemCode)) {
            matchedCodes++;
          } else {
            unmatchedCodes++;
            if (unmatchedSamples.length < 10) {
              unmatchedSamples.push(itemCode);
            }
          }
        }
      }

      logger.log(`  매칭: ${matchedCodes}개`, 'success');
      logger.log(`  비매칭: ${unmatchedCodes}개`, unmatchedCodes > 0 ? 'warn' : 'info');
      
      if (unmatchedSamples.length > 0) {
        logger.log(`  비매칭 샘플: ${unmatchedSamples.slice(0, 5).join(', ')}`, 'warn');
      }
    }
  } catch (error: any) {
    logger.log(`  ⚠️  최신단가 시트 읽기 실패: ${error.message}`, 'warn');
  }

  // 09월 원자재 수불관리.xlsx에서 품번 추출
  try {
    logger.log('\n  📄 09월 원자재 수불관리.xlsx - 시트별 품번 추출', 'info');
    
    const sheets = ['풍기서산(사급)', '세원테크(사급)', 'MV1 , SV (재고관리)'];
    let totalExtracted = 0;
    let totalMatched = 0;

    for (const sheetName of sheets.slice(0, 1)) { // 첫 번째 시트만 샘플로
      try {
        const csvData = await mcp__pyhub_mcptools__excel_get_values({
          book_name: '09월 원자재 수불관리.xlsx',
          sheet_name: sheetName,
          sheet_range: 'A6:L50', // 6행부터, 첫 50행
          value_type: 'values'
        });

        const rows = parseCsvToArray(csvData);
        const itemCodeCol = 3; // 품번 컬럼 (0-based)

        for (const row of rows) {
          const itemCode = String(row[itemCodeCol] || '').trim();
          if (itemCode && itemCode.length >= 3) {
            totalExtracted++;
            if (dbItemCodes.has(itemCode)) {
              totalMatched++;
            }
          }
        }

        logger.log(`  ${sheetName}: 추출 ${totalExtracted}개, 매칭 ${totalMatched}개`, 'info');
      } catch (error: any) {
        // 개별 시트 오류 무시
        continue;
      }
    }
  } catch (error: any) {
    logger.log(`  ⚠️  엑셀 읽기 오류: ${error.message}`, 'warn');
  }
}

/**
 * Main function
 */
async function main() {
  const logger = createLogger('PyHub MCP 종합 검토');
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
  const excelFiles = [
    '09월 원자재 수불관리.xlsx',
    '태창금속 BOM.xlsx',
    '2025년 9월 종합관리 SHEET.xlsx',
    '2025년 9월 매입매출 보고현황.xlsx'
  ];

  logger.startPhase('PyHub MCP 엑셀 파일 검토');
  
  const reviewResults: Map<string, { sheetNames: string[]; sheetStructures: Map<string, any> }> = new Map();

  for (const fileName of excelFiles) {
    try {
      const result = await reviewExcelWithPyHub(fileName, logger);
      reviewResults.set(fileName, result);
    } catch (error: any) {
      logger.log(`  ❌ ${fileName}: ${error.message}`, 'error');
    }
  }

  logger.endPhase();

  // Step 3: 매칭 검증
  logger.startPhase('PyHub MCP 매칭 검증');
  await verifyMatchingWithPyHub(logger);
  logger.endPhase();

  // Step 4: 결과 요약
  logger.divider('=');
  logger.log('\n📊 PyHub MCP 종합 검토 결과\n', 'info');

  const summary: Record<string, any> = {};
  for (const [fileName, result] of reviewResults.entries()) {
    summary[fileName] = `${result.sheetNames.length}개 시트 확인`;
  }

  logger.table(summary);

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});

