/**
 * Phase 2: Excel 파일 파싱
 *
 * 4개 Excel 파일을 읽어서 JSON으로 변환 후 저장합니다.
 * - 태창금속 BOM.xlsx → parsed-bom.json
 * - 매입수불관리.xlsx → parsed-inventory.json
 * - 종합관리 SHEET.xlsx → parsed-comprehensive.json
 * - 매입매출 보고현황.xlsx → parsed-purchase-sales.json
 *
 * 실행: npm run migrate:parse
 */

import * as XLSX from 'xlsx';
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

// Excel 파일 경로
const EXCEL_DIR = path.resolve(process.cwd(), '.plan2/참고');
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/migration/data');

const EXCEL_FILES = {
  bom: '태창금속 BOM (1).xlsx',
  inventory: '2025년 09월 매입 수불관리 (3).xlsx',
  comprehensive: '2025년 9월 19일 종합관리 SHEET (1).xlsx',
  purchaseSales: '2025년 9월 매입매출 보고현황 (1).xlsx'
};

/**
 * Excel 파일 읽기 헬퍼
 */
function readExcelFile(filename: string): XLSX.WorkBook {
  const filePath = path.join(EXCEL_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel 파일을 찾을 수 없습니다: ${filePath}`);
  }

  return XLSX.readFile(filePath, {
    type: 'file',
    cellDates: true,
    cellNF: false,
    cellText: false
  });
}

/**
 * 1. BOM Excel 파싱
 */
function parseBomExcel(logger: ReturnType<typeof createLogger>): ParseResult<BomExcelRow> {
  logger.log('📄 BOM 파일 파싱 시작', 'info');

  const workbook = readExcelFile(EXCEL_FILES.bom);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Excel → JSON 변환
  const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

  const result: ParseResult<BomExcelRow> = {
    success: true,
    data: [],
    errors: [],
    stats: {
      totalRows: rawData.length,
      validRows: 0,
      invalidRows: 0
    }
  };

  rawData.forEach((row, index) => {
    try {
      // 필수 필드 확인
      if (!row['품번'] || !row['품명']) {
        throw new Error('필수 필드 누락: 품번, 품명');
      }

      const bomRow: BomExcelRow = {
        고객사: String(row['고객사'] || ''),
        차종: String(row['차종'] || ''),
        품번: String(row['품번']),
        품명: String(row['품명']),
        규격: String(row['규격'] || ''),
        단위: String(row['단위'] || 'EA'),
        '단위중량(KG)': Number(row['단위중량(KG)'] || 0),
        'L(종)': Number(row['L(종)'] || 0),
        'W(횡)': Number(row['W(횡)'] || 0),
        'B(Board)': Number(row['B(Board)'] || 0),
        '출고단가': Number(row['출고단가'] || 0),
        '자재비': Number(row['자재비'] || 0),
        level: Number(row['level'] || 1)
      };

      result.data.push(bomRow);
      result.stats.validRows++;
    } catch (error: any) {
      result.errors.push({
        row: index + 2, // Excel row number (header = 1)
        field: 'row',
        error: error.message
      });
      result.stats.invalidRows++;
    }
  });

  logger.log(`✅ BOM 파싱 완료: ${result.stats.validRows}개 성공, ${result.stats.invalidRows}개 실패`, 'success');
  return result;
}

/**
 * 2. 매입수불 Excel 파싱
 */
function parseInventoryExcel(logger: ReturnType<typeof createLogger>): ParseResult<InventoryExcelRow> {
  logger.log('📄 매입수불 파일 파싱 시작 (8개 시트)', 'info');

  const workbook = readExcelFile(EXCEL_FILES.inventory);

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

  // 8개 시트 순회
  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    logger.log(`  시트 ${sheetIndex + 1}/8: ${sheetName}`, 'info');

    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

    result.stats.totalRows += rawData.length;

    rawData.forEach((row, index) => {
      try {
        if (!row['품번'] || !row['품명']) {
          throw new Error('필수 필드 누락: 품번, 품명');
        }

        const inventoryRow: InventoryExcelRow = {
          품번: String(row['품번']),
          품명: String(row['품명']),
          규격: String(row['규격'] || ''),
          단위: String(row['단위'] || 'EA')
        };

        // T1 ~ T268 컬럼 추가
        for (let i = 1; i <= 268; i++) {
          const colName = `T${i}`;
          inventoryRow[colName] = Number(row[colName] || 0);
        }

        result.data.push(inventoryRow);
        result.stats.validRows++;
      } catch (error: any) {
        result.errors.push({
          row: index + 2,
          field: `${sheetName}.row`,
          error: error.message
        });
        result.stats.invalidRows++;
      }
    });
  });

  logger.log(`✅ 매입수불 파싱 완료: ${result.stats.validRows}개 성공, ${result.stats.invalidRows}개 실패`, 'success');
  return result;
}

/**
 * 3. 종합관리 SHEET 파싱
 */
function parseComprehensiveExcel(logger: ReturnType<typeof createLogger>): ParseResult<ComprehensiveExcelRow> {
  logger.log('📄 종합관리 SHEET 파일 파싱 시작', 'info');

  const workbook = readExcelFile(EXCEL_FILES.comprehensive);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

  const result: ParseResult<ComprehensiveExcelRow> = {
    success: true,
    data: [],
    errors: [],
    stats: {
      totalRows: rawData.length,
      validRows: 0,
      invalidRows: 0
    }
  };

  rawData.forEach((row, index) => {
    try {
      if (!row['품목코드'] || !row['품목명']) {
        throw new Error('필수 필드 누락: 품목코드, 품목명');
      }

      const comprehensiveRow: ComprehensiveExcelRow = {
        품목코드: String(row['품목코드']),
        품목명: String(row['품목명']),
        규격: String(row['규격'] || ''),
        단위: String(row['단위'] || 'EA'),
        거래처코드: row['거래처코드'] ? String(row['거래처코드']) : undefined,
        거래처명: row['거래처명'] ? String(row['거래처명']) : undefined,
        현재재고: row['현재재고'] ? Number(row['현재재고']) : undefined,
        안전재고: row['안전재고'] ? Number(row['안전재고']) : undefined
      };

      result.data.push(comprehensiveRow);
      result.stats.validRows++;
    } catch (error: any) {
      result.errors.push({
        row: index + 2,
        field: 'row',
        error: error.message
      });
      result.stats.invalidRows++;
    }
  });

  logger.log(`✅ 종합관리 파싱 완료: ${result.stats.validRows}개 성공, ${result.stats.invalidRows}개 실패`, 'success');
  return result;
}

/**
 * 4. 매입매출 Excel 파싱
 */
function parsePurchaseSalesExcel(logger: ReturnType<typeof createLogger>): ParseResult<PurchaseSalesExcelRow> {
  logger.log('📄 매입매출 파일 파싱 시작', 'info');

  const workbook = readExcelFile(EXCEL_FILES.purchaseSales);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

  const result: ParseResult<PurchaseSalesExcelRow> = {
    success: true,
    data: [],
    errors: [],
    stats: {
      totalRows: rawData.length,
      validRows: 0,
      invalidRows: 0
    }
  };

  rawData.forEach((row, index) => {
    try {
      if (!row['거래일자'] || !row['거래처명'] || !row['품목코드']) {
        throw new Error('필수 필드 누락: 거래일자, 거래처명, 품목코드');
      }

      // 거래구분 판단 (매입/매출)
      let transactionType: '매입' | '매출' = '매입';
      if (row['거래구분']) {
        const typeStr = String(row['거래구분']).trim();
        if (typeStr === '매출' || typeStr === 'SALES') {
          transactionType = '매출';
        }
      }

      const purchaseSalesRow: PurchaseSalesExcelRow = {
        거래일자: String(row['거래일자']),
        거래처명: String(row['거래처명']),
        품목코드: String(row['품목코드']),
        품목명: String(row['품목명'] || ''),
        규격: String(row['규격'] || ''),
        수량: Number(row['수량'] || 0),
        단가: Number(row['단가'] || 0),
        금액: Number(row['금액'] || 0),
        부가세: Number(row['부가세'] || 0),
        합계: Number(row['합계'] || 0),
        비고: row['비고'] ? String(row['비고']) : undefined,
        거래구분: transactionType
      };

      result.data.push(purchaseSalesRow);
      result.stats.validRows++;
    } catch (error: any) {
      result.errors.push({
        row: index + 2,
        field: 'row',
        error: error.message
      });
      result.stats.invalidRows++;
    }
  });

  logger.log(`✅ 매입매출 파싱 완료: ${result.stats.validRows}개 성공, ${result.stats.invalidRows}개 실패`, 'success');
  return result;
}

/**
 * JSON 저장 헬퍼
 */
function saveToJson(filename: string, data: any, logger: ReturnType<typeof createLogger>): void {
  // 출력 디렉토리 생성
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  logger.log(`💾 저장 완료: ${filename}`, 'success');
}

async function main() {
  const logger = createLogger('Excel 파싱');
  logger.startMigration();

  // Step 1: 파일 존재 확인
  logger.startPhase('Excel 파일 확인');
  const missingFiles: string[] = [];
  Object.entries(EXCEL_FILES).forEach(([key, filename]) => {
    const filePath = path.join(EXCEL_DIR, filename);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(filename);
      logger.log(`❌ 파일 없음: ${filename}`, 'error');
    } else {
      logger.log(`✅ 파일 확인: ${filename}`, 'success');
    }
  });

  if (missingFiles.length > 0) {
    logger.log(`\n❌ ${missingFiles.length}개 파일을 찾을 수 없습니다`, 'error');
    logger.endMigration(false);
    process.exit(1);
  }
  logger.endPhase();

  // Step 2: 파일 파싱
  logger.startPhase('Excel 파일 파싱');

  let totalValid = 0;
  let totalInvalid = 0;

  // 2.1 BOM 파싱
  const bomResult = parseBomExcel(logger);
  saveToJson('parsed-bom.json', bomResult, logger);
  totalValid += bomResult.stats.validRows;
  totalInvalid += bomResult.stats.invalidRows;

  // 2.2 매입수불 파싱
  const inventoryResult = parseInventoryExcel(logger);
  saveToJson('parsed-inventory.json', inventoryResult, logger);
  totalValid += inventoryResult.stats.validRows;
  totalInvalid += inventoryResult.stats.invalidRows;

  // 2.3 종합관리 파싱
  const comprehensiveResult = parseComprehensiveExcel(logger);
  saveToJson('parsed-comprehensive.json', comprehensiveResult, logger);
  totalValid += comprehensiveResult.stats.validRows;
  totalInvalid += comprehensiveResult.stats.invalidRows;

  // 2.4 매입매출 파싱
  const purchaseSalesResult = parsePurchaseSalesExcel(logger);
  saveToJson('parsed-purchase-sales.json', purchaseSalesResult, logger);
  totalValid += purchaseSalesResult.stats.validRows;
  totalInvalid += purchaseSalesResult.stats.invalidRows;

  logger.endPhase();

  // Step 3: 결과 요약
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

  if (totalInvalid > 0) {
    logger.log('\n⚠️  일부 레코드 파싱 실패', 'warn');
    logger.log('다음 검증 단계에서 상세 검증이 수행됩니다', 'info');
  }

  logger.endMigration(true);
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
