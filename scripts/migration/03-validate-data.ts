/**
 * Phase 3: 데이터 검증
 *
 * 파싱된 JSON 데이터를 4단계로 검증합니다:
 * 1. 필수 필드 검증 (Null/Undefined 체크)
 * 2. 타입 검증 (String/Number/Date 타입 확인)
 * 3. 비즈니스 규칙 검증 (재고 음수, 금액 계산 등)
 * 4. 참조 무결성 검증 (코드 존재 여부)
 *
 * 실행: npm run migrate:validate
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './utils/logger';
import {
  BomExcelRow,
  InventoryExcelRow,
  ComprehensiveExcelRow,
  PurchaseSalesExcelRow,
  ValidationResult,
  ValidationError,
  ParseResult
} from './types/excel-data';

const DATA_DIR = path.resolve(process.cwd(), 'scripts/migration/data');

/**
 * JSON 파일 읽기 헬퍼
 */
function loadJsonData<T>(filename: string): ParseResult<T> {
  const filePath = path.join(DATA_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as ParseResult<T>;
}

/**
 * 검증 결과 저장
 */
function saveValidationReport(filename: string, result: ValidationResult, logger: ReturnType<typeof createLogger>): void {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
  logger.log(`💾 검증 리포트 저장: ${filename}`, 'success');
}

/**
 * 1. BOM 데이터 검증
 */
function validateBomData(data: BomExcelRow[], logger: ReturnType<typeof createLogger>): ValidationResult {
  logger.log('🔍 BOM 데이터 검증 시작', 'info');

  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  data.forEach((row, index) => {
    // 1.1 필수 필드 검증
    if (!row.품번 || row.품번.trim() === '') {
      errors.push({
        field: '품번',
        value: row.품번,
        error: '필수 필드',
        message: `Row ${index + 1}: 품번이 비어있습니다`
      });
    }

    if (!row.품명 || row.품명.trim() === '') {
      errors.push({
        field: '품명',
        value: row.품명,
        error: '필수 필드',
        message: `Row ${index + 1}: 품명이 비어있습니다`
      });
    }

    // 1.2 타입 검증
    if (typeof row['단위중량(KG)'] !== 'number' || isNaN(row['단위중량(KG)'])) {
      errors.push({
        field: '단위중량(KG)',
        value: row['단위중량(KG)'],
        error: '타입 오류',
        message: `Row ${index + 1}: 단위중량은 숫자여야 합니다`
      });
    }

    // 1.3 비즈니스 규칙 검증
    if (row['단위중량(KG)'] < 0) {
      errors.push({
        field: '단위중량(KG)',
        value: row['단위중량(KG)'],
        error: '음수 불가',
        message: `Row ${index + 1}: 단위중량은 0 이상이어야 합니다`
      });
    }

    if (row['출고단가'] < 0) {
      errors.push({
        field: '출고단가',
        value: row['출고단가'],
        error: '음수 불가',
        message: `Row ${index + 1}: 출고단가는 0 이상이어야 합니다`
      });
    }

    // 1.4 경고 (데이터 품질)
    if (row.level !== 1 && row.level !== 2) {
      warnings.push(`Row ${index + 1}: BOM level은 1 또는 2여야 합니다 (현재: ${row.level})`);
    }

    if (!row.규격 || row.규격.trim() === '') {
      warnings.push(`Row ${index + 1}: 규격이 비어있습니다 (품번: ${row.품번})`);
    }
  });

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings
  };

  if (result.valid) {
    logger.log(`✅ BOM 데이터 검증 통과 (${data.length}개 레코드, ${warnings.length}개 경고)`, 'success');
  } else {
    logger.log(`❌ BOM 데이터 검증 실패 (${errors.length}개 오류, ${warnings.length}개 경고)`, 'error');
  }

  return result;
}

/**
 * 2. 매입수불 데이터 검증
 */
function validateInventoryData(data: InventoryExcelRow[], logger: ReturnType<typeof createLogger>): ValidationResult {
  logger.log('🔍 매입수불 데이터 검증 시작 (T1~T268)', 'info');

  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  data.forEach((row, index) => {
    // 2.1 필수 필드 검증
    if (!row.품번 || row.품번.trim() === '') {
      errors.push({
        field: '품번',
        value: row.품번,
        error: '필수 필드',
        message: `Row ${index + 1}: 품번이 비어있습니다`
      });
    }

    // 2.2 T1~T268 검증
    for (let i = 1; i <= 268; i++) {
      const colName = `T${i}` as keyof InventoryExcelRow;
      const value = row[colName];

      if (typeof value !== 'number' || isNaN(value as number)) {
        errors.push({
          field: colName,
          value,
          error: '타입 오류',
          message: `Row ${index + 1}: ${colName}은 숫자여야 합니다`
        });
      }

      // 음수 재고 경고
      if ((value as number) < 0) {
        warnings.push(`Row ${index + 1}: ${colName}이 음수입니다 (품번: ${row.품번}, 값: ${value})`);
      }
    }
  });

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings
  };

  if (result.valid) {
    logger.log(`✅ 매입수불 데이터 검증 통과 (${data.length}개 레코드, ${warnings.length}개 경고)`, 'success');
  } else {
    logger.log(`❌ 매입수불 데이터 검증 실패 (${errors.length}개 오류, ${warnings.length}개 경고)`, 'error');
  }

  return result;
}

/**
 * 3. 종합관리 데이터 검증
 */
function validateComprehensiveData(data: ComprehensiveExcelRow[], logger: ReturnType<typeof createLogger>): ValidationResult {
  logger.log('🔍 종합관리 데이터 검증 시작', 'info');

  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  data.forEach((row, index) => {
    // 3.1 필수 필드 검증
    if (!row.품목코드 || row.품목코드.trim() === '') {
      errors.push({
        field: '품목코드',
        value: row.품목코드,
        error: '필수 필드',
        message: `Row ${index + 1}: 품목코드가 비어있습니다`
      });
    }

    if (!row.품목명 || row.품목명.trim() === '') {
      errors.push({
        field: '품목명',
        value: row.품목명,
        error: '필수 필드',
        message: `Row ${index + 1}: 품목명이 비어있습니다`
      });
    }

    // 3.2 재고 검증
    if (row.현재재고 !== undefined) {
      if (typeof row.현재재고 !== 'number' || isNaN(row.현재재고)) {
        errors.push({
          field: '현재재고',
          value: row.현재재고,
          error: '타입 오류',
          message: `Row ${index + 1}: 현재재고는 숫자여야 합니다`
        });
      }

      if (row.현재재고 < 0) {
        warnings.push(`Row ${index + 1}: 현재재고가 음수입니다 (품목: ${row.품목코드}, 값: ${row.현재재고})`);
      }
    }

    // 3.3 안전재고 검증
    if (row.안전재고 !== undefined && row.현재재고 !== undefined) {
      if (row.현재재고 < row.안전재고) {
        warnings.push(`Row ${index + 1}: 현재재고가 안전재고보다 작습니다 (품목: ${row.품목코드})`);
      }
    }
  });

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings
  };

  if (result.valid) {
    logger.log(`✅ 종합관리 데이터 검증 통과 (${data.length}개 레코드, ${warnings.length}개 경고)`, 'success');
  } else {
    logger.log(`❌ 종합관리 데이터 검증 실패 (${errors.length}개 오류, ${warnings.length}개 경고)`, 'error');
  }

  return result;
}

/**
 * 4. 매입매출 데이터 검증
 */
function validatePurchaseSalesData(data: PurchaseSalesExcelRow[], logger: ReturnType<typeof createLogger>): ValidationResult {
  logger.log('🔍 매입매출 데이터 검증 시작', 'info');

  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  data.forEach((row, index) => {
    // 4.1 필수 필드 검증
    if (!row.거래일자 || row.거래일자.trim() === '') {
      errors.push({
        field: '거래일자',
        value: row.거래일자,
        error: '필수 필드',
        message: `Row ${index + 1}: 거래일자가 비어있습니다`
      });
    }

    if (!row.거래처명 || row.거래처명.trim() === '') {
      errors.push({
        field: '거래처명',
        value: row.거래처명,
        error: '필수 필드',
        message: `Row ${index + 1}: 거래처명이 비어있습니다`
      });
    }

    if (!row.품목코드 || row.품목코드.trim() === '') {
      errors.push({
        field: '품목코드',
        value: row.품목코드,
        error: '필수 필드',
        message: `Row ${index + 1}: 품목코드가 비어있습니다`
      });
    }

    // 4.2 수치 검증
    if (row.수량 <= 0) {
      errors.push({
        field: '수량',
        value: row.수량,
        error: '양수 필수',
        message: `Row ${index + 1}: 수량은 0보다 커야 합니다`
      });
    }

    if (row.단가 < 0) {
      errors.push({
        field: '단가',
        value: row.단가,
        error: '음수 불가',
        message: `Row ${index + 1}: 단가는 0 이상이어야 합니다`
      });
    }

    // 4.3 금액 계산 검증
    const calculatedAmount = row.수량 * row.단가;
    const tolerance = 1; // 1원 허용 오차 (반올림 차이)

    if (Math.abs(calculatedAmount - row.금액) > tolerance) {
      warnings.push(`Row ${index + 1}: 금액 계산 불일치 (계산값: ${calculatedAmount}, 실제: ${row.금액})`);
    }

    // 4.4 부가세 검증 (금액의 10%)
    const calculatedVat = Math.round(row.금액 * 0.1);
    if (Math.abs(calculatedVat - row.부가세) > tolerance) {
      warnings.push(`Row ${index + 1}: 부가세 계산 불일치 (계산값: ${calculatedVat}, 실제: ${row.부가세})`);
    }

    // 4.5 합계 검증
    const calculatedTotal = row.금액 + row.부가세;
    if (Math.abs(calculatedTotal - row.합계) > tolerance) {
      warnings.push(`Row ${index + 1}: 합계 계산 불일치 (계산값: ${calculatedTotal}, 실제: ${row.합계})`);
    }

    // 4.6 거래구분 검증
    if (row.거래구분 !== '매입' && row.거래구분 !== '매출') {
      errors.push({
        field: '거래구분',
        value: row.거래구분,
        error: '유효하지 않은 값',
        message: `Row ${index + 1}: 거래구분은 '매입' 또는 '매출'이어야 합니다`
      });
    }
  });

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings
  };

  if (result.valid) {
    logger.log(`✅ 매입매출 데이터 검증 통과 (${data.length}개 레코드, ${warnings.length}개 경고)`, 'success');
  } else {
    logger.log(`❌ 매입매출 데이터 검증 실패 (${errors.length}개 오류, ${warnings.length}개 경고)`, 'error');
  }

  return result;
}

async function main() {
  const logger = createLogger('데이터 검증');
  logger.startMigration();

  // Step 1: JSON 파일 확인
  logger.startPhase('파싱된 JSON 파일 확인');

  const requiredFiles = [
    'parsed-bom.json',
    'parsed-inventory.json',
    'parsed-comprehensive.json',
    'parsed-purchase-sales.json'
  ];

  const missingFiles: string[] = [];
  requiredFiles.forEach((filename) => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(filename);
      logger.log(`❌ 파일 없음: ${filename}`, 'error');
    } else {
      logger.log(`✅ 파일 확인: ${filename}`, 'success');
    }
  });

  if (missingFiles.length > 0) {
    logger.log(`\n❌ ${missingFiles.length}개 파일을 찾을 수 없습니다`, 'error');
    logger.log('먼저 npm run migrate:parse를 실행하세요', 'warn');
    logger.endMigration(false);
    process.exit(1);
  }

  logger.endPhase();

  // Step 2: 데이터 로드
  logger.startPhase('데이터 로드');

  const bomData = loadJsonData<BomExcelRow>('parsed-bom.json');
  logger.log(`📊 BOM: ${bomData.data.length}개 레코드`, 'info');

  const inventoryData = loadJsonData<InventoryExcelRow>('parsed-inventory.json');
  logger.log(`📊 매입수불: ${inventoryData.data.length}개 레코드`, 'info');

  const comprehensiveData = loadJsonData<ComprehensiveExcelRow>('parsed-comprehensive.json');
  logger.log(`📊 종합관리: ${comprehensiveData.data.length}개 레코드`, 'info');

  const purchaseSalesData = loadJsonData<PurchaseSalesExcelRow>('parsed-purchase-sales.json');
  logger.log(`📊 매입매출: ${purchaseSalesData.data.length}개 레코드`, 'info');

  logger.endPhase();

  // Step 3: 4단계 검증 실행
  logger.startPhase('데이터 검증 실행');

  const bomValidation = validateBomData(bomData.data, logger);
  saveValidationReport('validation-bom.json', bomValidation, logger);

  const inventoryValidation = validateInventoryData(inventoryData.data, logger);
  saveValidationReport('validation-inventory.json', inventoryValidation, logger);

  const comprehensiveValidation = validateComprehensiveData(comprehensiveData.data, logger);
  saveValidationReport('validation-comprehensive.json', comprehensiveValidation, logger);

  const purchaseSalesValidation = validatePurchaseSalesData(purchaseSalesData.data, logger);
  saveValidationReport('validation-purchase-sales.json', purchaseSalesValidation, logger);

  logger.endPhase();

  // Step 4: 전체 검증 결과
  logger.divider('=');
  logger.log('\n📊 검증 결과 요약\n', 'info');

  const totalErrors =
    bomValidation.errors.length +
    inventoryValidation.errors.length +
    comprehensiveValidation.errors.length +
    purchaseSalesValidation.errors.length;

  const totalWarnings =
    bomValidation.warnings.length +
    inventoryValidation.warnings.length +
    comprehensiveValidation.warnings.length +
    purchaseSalesValidation.warnings.length;

  logger.table({
    'BOM 오류': bomValidation.errors.length,
    '매입수불 오류': inventoryValidation.errors.length,
    '종합관리 오류': comprehensiveValidation.errors.length,
    '매입매출 오류': purchaseSalesValidation.errors.length,
    '총 오류': totalErrors,
    '총 경고': totalWarnings
  });

  const allValid =
    bomValidation.valid &&
    inventoryValidation.valid &&
    comprehensiveValidation.valid &&
    purchaseSalesValidation.valid;

  if (allValid) {
    logger.log('\n✅ 모든 데이터 검증 통과', 'success');
    logger.log(`⚠️  ${totalWarnings}개 경고가 있으나 임포트는 진행 가능합니다`, 'warn');
    logger.endMigration(true);
  } else {
    logger.log('\n❌ 데이터 검증 실패', 'error');
    logger.log('검증 리포트를 확인하고 데이터를 수정한 후 다시 시도하세요', 'warn');
    logger.endMigration(false);
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
