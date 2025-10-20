/**
 * Centralized Error Messages for ERP System
 * ERP 시스템 중앙집중식 에러 메시지
 */

import { ZodError } from 'zod';

export const ERROR_MESSAGES = {
  // 일반 에러 (General Errors)
  INTERNAL_ERROR: '서버 내부 오류가 발생했습니다.',
  INVALID_REQUEST: '잘못된 요청입니다.',
  NOT_FOUND: '요청하신 데이터를 찾을 수 없습니다.',
  UNAUTHORIZED: '인증이 필요합니다.',
  FORBIDDEN: '접근 권한이 없습니다.',

  // 가격 관련 (Price Related)
  PRICE_NEGATIVE: '단가는 0보다 커야 합니다.',
  PRICE_INVALID: '유효한 숫자를 입력하세요.',
  PRICE_DUPLICATE: '이미 해당 월의 가격 이력이 존재합니다.',
  PRICE_INCREASE_HIGH: (rate: number) =>
    `가격 인상률이 ${rate.toFixed(1)}%로 100%를 초과합니다. 확인 후 진행하세요.`,
  PRICE_DECREASE_HIGH: (rate: number) =>
    `가격 하락률이 ${rate.toFixed(1)}%로 50%를 초과합니다. 확인 후 진행하세요.`,
  PRICE_RANGE_MIN: (min: number) =>
    `단가는 최소 ${min.toLocaleString('ko-KR')}원 이상이어야 합니다.`,
  PRICE_RANGE_MAX: (max: number) =>
    `단가는 최대 ${max.toLocaleString('ko-KR')}원 이하여야 합니다.`,

  // 품목 관련 (Item Related)
  ITEM_NOT_FOUND: '품목을 찾을 수 없습니다.',
  ITEM_INACTIVE: '비활성화된 품목입니다.',
  ITEM_CODE_DUPLICATE: '이미 존재하는 품목 코드입니다.',
  ITEM_NAME_REQUIRED: '품목명은 필수 항목입니다.',

  // 벌크 업데이트 (Bulk Update)
  BULK_LIMIT_EXCEEDED: '한 번에 최대 100개까지만 업데이트할 수 있습니다.',
  BULK_EMPTY: '업데이트할 항목이 없습니다.',
  BULK_PARTIAL_SUCCESS: (success: number, failed: number) =>
    `${success}개 성공, ${failed}개 실패`,

  // 날짜 관련 (Date Related)
  DATE_INVALID: '올바른 날짜 형식(YYYY-MM)을 입력하세요.',
  DATE_FUTURE: '미래 날짜는 입력할 수 없습니다.',
  DATE_RANGE_INVALID: '시작일이 종료일보다 늦을 수 없습니다.',

  // 검증 관련 (Validation Related)
  VALIDATION_FAILED: '입력 데이터 검증에 실패했습니다.',
  REQUIRED_FIELD: (field: string) => `${field}은(는) 필수 항목입니다.`,
  INVALID_FIELD: (field: string) => `${field}의 형식이 올바르지 않습니다.`,

  // 데이터베이스 관련 (Database Related)
  DB_ERROR: '데이터베이스 오류가 발생했습니다.',
  DB_CONNECTION_ERROR: '데이터베이스 연결에 실패했습니다.',
  DB_CONSTRAINT_VIOLATION: '데이터 무결성 제약 조건 위반입니다.',

  // 거래 관련 (Transaction Related)
  TRANSACTION_NOT_FOUND: '거래 내역을 찾을 수 없습니다.',
  TRANSACTION_INVALID_STATUS: '유효하지 않은 거래 상태입니다.',
  TRANSACTION_CANNOT_DELETE: '이미 처리된 거래는 삭제할 수 없습니다.',

  // 재고 관련 (Inventory Related)
  STOCK_INSUFFICIENT: '재고가 부족합니다.',
  STOCK_NEGATIVE: '재고는 음수가 될 수 없습니다.',
  STOCK_NOT_FOUND: '재고 정보를 찾을 수 없습니다.',

  // 회사 관련 (Company Related)
  COMPANY_NOT_FOUND: '거래처를 찾을 수 없습니다.',
  COMPANY_CODE_DUPLICATE: '이미 존재하는 거래처 코드입니다.',
  COMPANY_INACTIVE: '비활성화된 거래처입니다.',

  // BOM 관련 (BOM Related)
  BOM_NOT_FOUND: 'BOM을 찾을 수 없습니다.',
  BOM_CIRCULAR_REFERENCE: 'BOM 순환 참조가 발견되었습니다.',
  BOM_INVALID_QUANTITY: 'BOM 수량은 0보다 커야 합니다.'
} as const;

/**
 * Format Zod validation error into user-friendly Korean message
 * Zod 검증 에러를 사용자 친화적인 한글 메시지로 변환
 */
export function formatValidationError(zodError: ZodError): string {
  const errors = zodError.issues.map((err) => {
    const field = err.path.join('.');
    const fieldKorean = translateFieldName(field);

    switch (err.code) {
      case 'invalid_type':
        return `${fieldKorean}: 올바른 형식이 아닙니다 (${err.expected} 필요)`;
      case 'too_small':
        if (err.type === 'string') {
          return `${fieldKorean}: 최소 ${err.minimum}자 이상이어야 합니다`;
        } else if (err.type === 'number') {
          return `${fieldKorean}: 최소값은 ${err.minimum}입니다`;
        }
        break;
      case 'too_big':
        if (err.type === 'string') {
          return `${fieldKorean}: 최대 ${err.maximum}자까지 입력 가능합니다`;
        } else if (err.type === 'number') {
          return `${fieldKorean}: 최대값은 ${err.maximum}입니다`;
        }
        break;
      case 'invalid_string':
        return `${fieldKorean}: 올바른 ${err.validation} 형식이 아닙니다`;
      case 'custom':
        return `${fieldKorean}: ${err.message}`;
      default:
        return `${fieldKorean}: ${err.message}`;
    }
    return `${fieldKorean}: ${err.message}`;
  });

  return errors.join(', ');
}

/**
 * Translate field name to Korean
 * 필드명을 한글로 번역
 */
function translateFieldName(field: string): string {
  const translations: Record<string, string> = {
    'item_id': '품목 ID',
    'item_code': '품목 코드',
    'item_name': '품목명',
    'unit_price': '단가',
    'price_month': '가격 월',
    'company_id': '거래처 ID',
    'company_code': '거래처 코드',
    'company_name': '거래처명',
    'transaction_id': '거래 ID',
    'transaction_no': '거래번호',
    'quantity': '수량',
    'total_amount': '총액',
    'payment_status': '결제 상태',
    'transaction_date': '거래일자',
    'is_active': '활성화 상태',
    'created_at': '생성일시',
    'updated_at': '수정일시',
    'notes': '비고',
    'contact': '연락처',
    'address': '주소',
    'email': '이메일',
    'phone': '전화번호',
    'business_number': '사업자번호',
    'representative': '대표자',
    'updates': '업데이트 항목',
    'override_existing': '기존 데이터 덮어쓰기'
  };

  return translations[field] || field;
}

/**
 * Format error response with Korean messages
 * 한글 메시지로 에러 응답 포맷
 */
export function formatErrorResponse(
  error: unknown,
  context?: string
): {
  success: false;
  error: string;
  details?: any;
} {
  if (error instanceof ZodError) {
    return {
      success: false,
      error: ERROR_MESSAGES.VALIDATION_FAILED,
      details: formatValidationError(error)
    };
  }

  if (error instanceof Error) {
    // Check for Supabase-specific errors
    if (error.message.includes('duplicate key')) {
      return {
        success: false,
        error: ERROR_MESSAGES.DB_CONSTRAINT_VIOLATION,
        details: '중복된 값이 존재합니다.'
      };
    }

    if (error.message.includes('foreign key')) {
      return {
        success: false,
        error: ERROR_MESSAGES.DB_CONSTRAINT_VIOLATION,
        details: '참조하는 데이터가 존재하지 않습니다.'
      };
    }

    return {
      success: false,
      error: context ? `${context}: ${error.message}` : error.message
    };
  }

  return {
    success: false,
    error: ERROR_MESSAGES.INTERNAL_ERROR
  };
}

/**
 * Create success response with Korean message
 * 한글 메시지로 성공 응답 생성
 */
export function createSuccessMessage(
  action: 'create' | 'update' | 'delete',
  resource: string
): string {
  const resourceKorean = translateResourceName(resource);

  switch (action) {
    case 'create':
      return `${resourceKorean}이(가) 성공적으로 생성되었습니다.`;
    case 'update':
      return `${resourceKorean}이(가) 성공적으로 수정되었습니다.`;
    case 'delete':
      return `${resourceKorean}이(가) 성공적으로 삭제되었습니다.`;
  }
}

/**
 * Translate resource name to Korean
 * 리소스명을 한글로 번역
 */
function translateResourceName(resource: string): string {
  const translations: Record<string, string> = {
    'item': '품목',
    'items': '품목',
    'company': '거래처',
    'companies': '거래처',
    'transaction': '거래',
    'transactions': '거래',
    'price_history': '가격 이력',
    'bom': 'BOM',
    'stock': '재고',
    'inventory': '재고'
  };

  return translations[resource] || resource;
}

/**
 * Validate and format bulk operation results
 * 벌크 작업 결과 검증 및 포맷
 */
export function formatBulkOperationResult(
  successCount: number,
  failedCount: number,
  failedItems?: Array<{ error: string; [key: string]: any }>
): {
  success: boolean;
  message: string;
  data: {
    success_count: number;
    failed_count: number;
    failed_items?: Array<{ error: string; [key: string]: any }>;
  };
} {
  const totalCount = successCount + failedCount;
  const allSuccess = failedCount === 0;

  return {
    success: allSuccess,
    message: allSuccess
      ? `${successCount}개 항목이 성공적으로 처리되었습니다.`
      : `${successCount}개 성공, ${failedCount}개 실패`,
    data: {
      success_count: successCount,
      failed_count: failedCount,
      failed_items: failedItems
    }
  };
}
