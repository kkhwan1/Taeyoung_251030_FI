/**
 * Phase 2: Excel 파일 파싱 (pyhub MCP 직접 호출)
 *
 * 열려있는 Excel 파일에서 직접 데이터를 읽어서 JSON으로 변환합니다.
 * MCP 함수를 직접 호출하여 import 문제를 회피합니다.
 *
 * 실행: npx tsx scripts/migration/02-parse-excel-direct.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './utils/logger';
import {
  BomExcelRow,
  InventoryExcelRow,
  ComprehensiveExcelRow,
  PurchaseSalesExcelRow,
  ParseResult
} from './types/excel-data';

// 출력 디렉토리
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/migration/data');

/**
 * CSV 문자열을 2D 배열로 파싱
 */
function parseCsvToArray(csv: string): any[][] {
  const lines = csv.trim().split('\n');
  return lines.map(line => {
    const values = line.split(',');
    return values.map(v => {
      const trimmed = v.trim();
      // 숫자 변환
      if (trimmed && !isNaN(Number(trimmed))) {
        return Number(trimmed);
      }
      // 날짜 패턴 감지
      if (trimmed.includes('-') && trimmed.includes(':')) {
        return new Date(trimmed);
      }
      return trimmed || '';
    });
  });
}

/**
 * 1. BOM Excel 파싱 - 5개 시트
 */
async function parseBomExcel(logger: ReturnType<typeof createLogger>): Promise<ParseResult<BomExcelRow>> {
  logger.log('📄 BOM 파일 파싱 시작 (5개 시트)', 'info');

  const result: ParseResult<BomExcelRow> = {
    success: true,
    data: [],
    errors: [],
    stats: {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0
    }
  };

  const sheets = ['대우공업', '풍기산업', '다인', '호원오토', '인알파코리아'];

  try {
    // pyhub MCP 함수 동적 import
    const { mcp__pyhub_mcptools__excel_get_values } = await import('../..' + '/src/lib/mcp-tools');

    for (const sheetName of sheets) {
      logger.log(`  시트: ${sheetName}`, 'info');

      const csvData: string = await mcp__pyhub_mcptools__excel_get_values({
        book_name: '태창금속 BOM.xlsx',
        sheet_name: sheetName,
        sheet_range: 'A7:P1000',
        value_type: 'values'
      });

      const rows = parseCsvToArray(csvData);
      result.stats.totalRows += rows.length;

      rows.forEach((row, index) => {
        try {
          const 납품처 = String(row[0] || '').trim();
          const 차종 = String(row[1] || '').trim();
          const 품번 = String(row[2] || '').trim();
          const 품명 = String(row[3] || '').trim();

          if (!품번 && !품명) return;
          if (!품번 || !품명) throw new Error('필수 필드 누락');

          const bomRow: BomExcelRow = {
            고객사: 납품처,
            차종: 차종,
            품번: 품번,
            품명: 품명,
            규격: '',
            단위: 'EA',
            '단위중량(KG)': 0,
            'L(종)': 0,
            'W(횡)': 0,
            'B(Board)': 0,
            '출고단가': Number(row[4]) || 0,
            '자재비': 0,
            level: 1
          };

          result.data.push(bomRow);
          result.stats.validRows++;
        } catch (error: any) {
          result.errors.push({
            row: index + 7,
            field: `${sheetName}.row`,
            error: error.message
          });
          result.stats.invalidRows++;
        }
      });
    }

    logger.log(`✅ BOM 파싱 완료: ${result.stats.validRows}개 성공, ${result.stats.invalidRows}개 실패`, 'success');
  } catch (error: any) {
    logger.log(`❌ BOM 파싱 실패: ${error.message}`, 'error');
    result.success = false;
  }

  return result;
}

/**
 * 2. 매입수불 Excel 파싱 - 21개 시트
 */
async function parseInventoryExcel(logger: ReturnType<typeof createLogger>): Promise<ParseResult<InventoryExcelRow>> {
  logger.log('📄 매입수불 파일 파싱 시작 (21개 시트)', 'info');

  const result: ParseResult<InventoryExcelRow> = {
    success: true,
    data: [],
    errors: [],
    stats: {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0
    }
  };

  const sheets = [
    '풍기서산(사급)', '세원테크(사급)', '대우포승(사급)', '호원오토(사급)',
    '웅지테크', '태영금속', 'JS테크', '에이오에스', '창경테크', '신성테크', '광성산업',
    'MV1 , SV (재고관리)', 'TAM,KA4,인알파', 'DL3 GL3 (재고관리)', '태창금속 (전착도장)',
    '인알파 (주간계획)', '실적 취합', '협력업체 (C.O 납품현황)',
    '대우사급 입고현황', '호원사급 입고현황', '협력업체 입고현황'
  ];

  try {
    const { mcp__pyhub_mcptools__excel_get_values } = await import('../..' + '/src/lib/mcp-tools');

    for (const sheetName of sheets) {
      logger.log(`  시트: ${sheetName}`, 'info');

      const csvData: string = await mcp__pyhub_mcptools__excel_get_values({
        book_name: '09월 원자재 수불관리.xlsx',
        sheet_name: sheetName,
        sheet_range: 'A6:L500',
        value_type: 'values'
      });

      const rows = parseCsvToArray(csvData);
      result.stats.totalRows += rows.length;

      rows.forEach((row, index) => {
        try {
          const 품번 = String(row[3] || '').trim();
          const 품명 = String(row[4] || '').trim();

          if (!품번 && !품명) return;
          if (!품번 || !품명) throw new Error('필수 필드 누락');

          const inventoryRow: InventoryExcelRow = {
            품번: 품번,
            품명: 품명,
            규격: String(row[6] || '').trim(),
            단위: 'EA'
          };

          result.data.push(inventoryRow);
          result.stats.validRows++;
        } catch (error: any) {
          result.errors.push({
            row: index + 6,
            field: `${sheetName}.row`,
            error: error.message
          });
          result.stats.invalidRows++;
        }
      });
    }

    logger.log(`✅ 매입수불 파싱 완료: ${result.stats.validRows}개 성공, ${result.stats.invalidRows}개 실패`, 'success');
  } catch (error: any) {
    logger.log(`❌ 매입수불 파싱 실패: ${error.message}`, 'error');
    result.success = false;
  }

  return result;
}

/**
 * 3. 종합관리 SHEET 파싱 - 종합재고 시트
 */
async function parseComprehensiveExcel(logger: ReturnType<typeof createLogger>): Promise<ParseResult<ComprehensiveExcelRow>> {
  logger.log('📄 종합관리 SHEET 파일 파싱 시작', 'info');

  const result: ParseResult<ComprehensiveExcelRow> = {
    success: true,
    data: [],
    errors: [],
    stats: {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0
    }
  };

  try {
    const { mcp__pyhub_mcptools__excel_get_values } = await import('../..' + '/src/lib/mcp-tools');

    const csvData: string = await mcp__pyhub_mcptools__excel_get_values({
      book_name: '2025년 9월 종합관리 SHEET.xlsx',
      sheet_name: '종합재고',
      sheet_range: 'A5:M400',
      value_type: 'values'
    });

    const rows = parseCsvToArray(csvData);
    result.stats.totalRows = rows.length;

    rows.forEach((row, index) => {
      try {
        const 품목코드 = String(row[2] || '').trim();
        const 품목명 = String(row[4] || '').trim();

        if (!품목코드 && !품목명) return;
        if (!품목코드 || !품목명) throw new Error('필수 필드 누락: 품목코드, 품목명');

        const comprehensiveRow: ComprehensiveExcelRow = {
          품목코드: 품목코드,
          품목명: 품목명,
          규격: String(row[6] || '').trim(),
          단위: 'EA',
          거래처코드: undefined,
          거래처명: String(row[0] || '').trim() || undefined,
          현재재고: undefined,
          안전재고: undefined
        };

        result.data.push(comprehensiveRow);
        result.stats.validRows++;
      } catch (error: any) {
        result.errors.push({
          row: index + 5,
          field: 'row',
          error: error.message
        });
        result.stats.invalidRows++;
      }
    });

    logger.log(`✅ 종합관리 파싱 완료: ${result.stats.validRows}개 성공, ${result.stats.invalidRows}개 실패`, 'success');
  } catch (error: any) {
    logger.log(`❌ 종합관리 파싱 실패: ${error.message}`, 'error');
    result.success = false;
  }

  return result;
}

/**
 * 4. 매입매출 Excel 파싱 - 정리 시트
 */
async function parsePurchaseSalesExcel(logger: ReturnType<typeof createLogger>): Promise<ParseResult<PurchaseSalesExcelRow>> {
  logger.log('📄 매입매출 파일 파싱 시작', 'info');

  const result: ParseResult<PurchaseSalesExcelRow> = {
    success: true,
    data: [],
    errors: [],
    stats: {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0
    }
  };

  try {
    const { mcp__pyhub_mcptools__excel_get_values } = await import('../..' + '/src/lib/mcp-tools');

    const csvData: string = await mcp__pyhub_mcptools__excel_get_values({
      book_name: '2025년 9월 매입매출 보고현황.xlsx',
      sheet_name: '정리',
      sheet_range: 'A5:C300',
      value_type: 'values'
    });

    const rows = parseCsvToArray(csvData);
    result.stats.totalRows = rows.length;

    rows.forEach((row, index) => {
      try {
        const 거래처명 = String(row[1] || '').trim();
        const 품목코드 = String(row[2] || '').trim();

        if (!거래처명 && !품목코드) return;
        if (!거래처명 || !품목코드) throw new Error('필수 필드 누락: 거래처명, 품목코드');

        const purchaseSalesRow: PurchaseSalesExcelRow = {
          거래일자: '2025-09-01',
          거래처명: 거래처명,
          품목코드: 품목코드,
          품목명: 품목코드,
          규격: '',
          수량: 1,
          단가: 0,
          금액: 0,
          부가세: 0,
          합계: 0,
          비고: undefined,
          거래구분: '매출'
        };

        result.data.push(purchaseSalesRow);
        result.stats.validRows++;
      } catch (error: any) {
        result.errors.push({
          row: index + 5,
          field: 'row',
          error: error.message
        });
        result.stats.invalidRows++;
      }
    });

    logger.log(`✅ 매입매출 파싱 완료: ${result.stats.validRows}개 성공, ${result.stats.invalidRows}개 실패`, 'success');
  } catch (error: any) {
    logger.log(`❌ 매입매출 파싱 실패: ${error.message}`, 'error');
    result.success = false;
  }

  return result;
}

/**
 * JSON 저장 헬퍼
 */
function saveToJson(filename: string, data: any, logger: ReturnType<typeof createLogger>): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  logger.log(`💾 저장 완료: ${filename}`, 'success');
}

async function main() {
  const logger = createLogger('Excel 파싱 (pyhub)');
  logger.startMigration();

  logger.log('🔷 pyhub MCP를 사용하여 열려있는 Excel 파일에서 데이터를 직접 읽습니다', 'info');
  logger.log('', 'info');

  let totalValid = 0;
  let totalInvalid = 0;

  // 1. BOM 파싱
  const bomResult = await parseBomExcel(logger);
  saveToJson('parsed-bom.json', bomResult, logger);
  totalValid += bomResult.stats.validRows;
  totalInvalid += bomResult.stats.invalidRows;

  // 2. 매입수불 파싱
  const inventoryResult = await parseInventoryExcel(logger);
  saveToJson('parsed-inventory.json', inventoryResult, logger);
  totalValid += inventoryResult.stats.validRows;
  totalInvalid += inventoryResult.stats.invalidRows;

  // 3. 종합관리 파싱
  const comprehensiveResult = await parseComprehensiveExcel(logger);
  saveToJson('parsed-comprehensive.json', comprehensiveResult, logger);
  totalValid += comprehensiveResult.stats.validRows;
  totalInvalid += comprehensiveResult.stats.invalidRows;

  // 4. 매입매출 파싱
  const purchaseSalesResult = await parsePurchaseSalesExcel(logger);
  saveToJson('parsed-purchase-sales.json', purchaseSalesResult, logger);
  totalValid += purchaseSalesResult.stats.validRows;
  totalInvalid += purchaseSalesResult.stats.invalidRows;

  // 결과 요약
  logger.divider('=');
  logger.log('\n📊 파싱 결과 요약\n', 'info');

  logger.table({
    'BOM 레코드': bomResult.stats.validRows.toLocaleString('ko-KR'),
    '매입수불 레코드': inventoryResult.stats.validRows.toLocaleString('ko-KR'),
    '종합관리 레코드': comprehensiveResult.stats.validRows.toLocaleString('ko-KR'),
    '매입매출 레코드': purchaseSalesResult.stats.validRows.toLocaleString('ko-KR'),
    '총 유효 레코드': totalValid.toLocaleString('ko-KR'),
    '총 실패 레코드': totalInvalid.toLocaleString('ko-KR')
  });

  if (totalValid === 0) {
    logger.log('\n❌ 파싱된 데이터가 없습니다. Excel 파일이 열려있는지 확인하세요.', 'error');
    logger.endMigration(false);
    process.exit(1);
  }

  if (totalInvalid > 0) {
    logger.log('\n⚠️  일부 레코드 파싱 실패', 'warn');
  }

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
