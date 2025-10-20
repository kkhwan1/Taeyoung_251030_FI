/**
 * Standardized error format for ERP system
 * 태창 ERP 시스템의 표준화된 오류 형식
 */

/**
 * Error codes with Korean descriptions
 */
export enum ErrorCode {
  // Validation errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_VALUE = 'INVALID_VALUE',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // Authentication & Authorization errors (401, 403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Resource errors (404, 409)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // Business logic errors (422)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVALID_OPERATION = 'INVALID_OPERATION',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

/**
 * Korean error messages mapping
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Validation errors
  [ErrorCode.VALIDATION_ERROR]: '입력값 검증에 실패했습니다',
  [ErrorCode.MISSING_REQUIRED_FIELD]: '필수 입력 항목이 누락되었습니다',
  [ErrorCode.INVALID_FORMAT]: '입력 형식이 올바르지 않습니다',
  [ErrorCode.INVALID_TYPE]: '입력 타입이 올바르지 않습니다',
  [ErrorCode.INVALID_VALUE]: '입력값이 유효하지 않습니다',
  [ErrorCode.DUPLICATE_ENTRY]: '중복된 데이터입니다',

  // Authentication & Authorization
  [ErrorCode.UNAUTHORIZED]: '인증이 필요합니다',
  [ErrorCode.FORBIDDEN]: '접근 권한이 없습니다',
  [ErrorCode.INVALID_CREDENTIALS]: '로그인 정보가 올바르지 않습니다',
  [ErrorCode.TOKEN_EXPIRED]: '세션이 만료되었습니다. 다시 로그인해주세요',
  [ErrorCode.TOKEN_INVALID]: '유효하지 않은 토큰입니다',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '해당 작업을 수행할 권한이 없습니다',

  // Resource errors
  [ErrorCode.RESOURCE_NOT_FOUND]: '요청한 리소스를 찾을 수 없습니다',
  [ErrorCode.RESOURCE_CONFLICT]: '리소스 충돌이 발생했습니다',
  [ErrorCode.RESOURCE_LOCKED]: '리소스가 잠겨있습니다',

  // Business logic errors
  [ErrorCode.BUSINESS_RULE_VIOLATION]: '비즈니스 규칙 위반입니다',
  [ErrorCode.INSUFFICIENT_STOCK]: '재고가 부족합니다',
  [ErrorCode.INVALID_OPERATION]: '유효하지 않은 작업입니다',
  [ErrorCode.CONSTRAINT_VIOLATION]: '제약 조건 위반입니다',

  // Rate limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '요청 한도를 초과했습니다',
  [ErrorCode.TOO_MANY_REQUESTS]: '너무 많은 요청이 발생했습니다',

  // Server errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: '서버 내부 오류가 발생했습니다',
  [ErrorCode.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '외부 서비스 오류가 발생했습니다',
  [ErrorCode.CONFIGURATION_ERROR]: '서버 설정 오류입니다',
  [ErrorCode.SERVICE_UNAVAILABLE]: '서비스를 사용할 수 없습니다',
  [ErrorCode.TIMEOUT_ERROR]: '요청 시간이 초과되었습니다',
};

/**
 * HTTP status code mapping for error codes
 */
export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.INVALID_TYPE]: 400,
  [ErrorCode.INVALID_VALUE]: 400,

  // 401 Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,

  // 403 Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // 404 Not Found
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,

  // 409 Conflict
  [ErrorCode.DUPLICATE_ENTRY]: 409,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
  [ErrorCode.RESOURCE_LOCKED]: 409,

  // 422 Unprocessable Entity
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 422,
  [ErrorCode.INSUFFICIENT_STOCK]: 422,
  [ErrorCode.INVALID_OPERATION]: 422,
  [ErrorCode.CONSTRAINT_VIOLATION]: 422,

  // 429 Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,

  // 500 Internal Server Error
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CONFIGURATION_ERROR]: 500,

  // 502 Bad Gateway
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,

  // 503 Service Unavailable
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,

  // 504 Gateway Timeout
  [ErrorCode.TIMEOUT_ERROR]: 504,
};

/**
 * Standardized error response interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    field?: string;
    resource?: string;
    action?: string;
  };
  timestamp: string;
  requestId?: string;
  path?: string;
}

/**
 * Standardized success response interface
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
  requestId?: string;
}

/**
 * API Response type union
 */
export type APIResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Error details for specific error types
 */
export interface ValidationErrorDetails {
  field: string;
  value?: any;
  expectedType?: string;
  allowedValues?: any[];
  constraints?: Record<string, any>;
}

export interface BusinessRuleErrorDetails {
  rule: string;
  entity?: string;
  entityId?: string | number;
  conflictingData?: any;
}

export interface ResourceErrorDetails {
  resource: string;
  id?: string | number;
  action?: string;
  availability?: Date;
}

export interface RateLimitErrorDetails {
  limit: number;
  windowMs: number;
  retryAfter: number;
  endpoint?: string;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  customMessage?: string,
  details?: any,
  options: {
    field?: string;
    resource?: string;
    action?: string;
    requestId?: string;
    path?: string;
  } = {}
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message: customMessage || ERROR_MESSAGES[code],
      details,
      field: options.field,
      resource: options.resource,
      action: options.action,
    },
    timestamp: new Date().toISOString(),
    requestId: options.requestId,
    path: options.path,
  };
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  options: {
    requestId?: string;
  } = {}
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId: options.requestId,
  };
}

/**
 * Get HTTP status code for error code
 */
export function getStatusCode(errorCode: ErrorCode): number {
  return ERROR_STATUS_CODES[errorCode] || 500;
}

/**
 * Check if error is client error (4xx)
 */
export function isClientError(errorCode: ErrorCode): boolean {
  const statusCode = getStatusCode(errorCode);
  return statusCode >= 400 && statusCode < 500;
}

/**
 * Check if error is server error (5xx)
 */
export function isServerError(errorCode: ErrorCode): boolean {
  const statusCode = getStatusCode(errorCode);
  return statusCode >= 500;
}

/**
 * ERP-specific error class
 */
export class ERPError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: any;
  public readonly field?: string;
  public readonly resource?: string;
  public readonly action?: string;

  constructor(
    code: ErrorCode,
    message?: string,
    details?: any,
    options: {
      field?: string;
      resource?: string;
      action?: string;
    } = {}
  ) {
    super(message || ERROR_MESSAGES[code]);
    this.name = 'ERPError';
    this.code = code;
    this.details = details;
    this.field = options.field;
    this.resource = options.resource;
    this.action = options.action;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ERPError);
    }
  }

  /**
   * Get HTTP status code for this error
   */
  get statusCode(): number {
    return getStatusCode(this.code);
  }

  /**
   * Convert to error response format
   */
  toErrorResponse(options: {
    requestId?: string;
    path?: string;
  } = {}): ErrorResponse {
    return createErrorResponse(
      this.code,
      this.message,
      this.details,
      {
        field: this.field,
        resource: this.resource,
        action: this.action,
        requestId: options.requestId,
        path: options.path,
      }
    );
  }

  /**
   * Create validation error
   */
  static validation(
    message: string,
    field?: string,
    details?: ValidationErrorDetails
  ): ERPError {
    return new ERPError(
      ErrorCode.VALIDATION_ERROR,
      message,
      details,
      { field }
    );
  }

  /**
   * Create business rule error
   */
  static businessRule(
    message: string,
    details?: BusinessRuleErrorDetails
  ): ERPError {
    return new ERPError(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      message,
      details
    );
  }

  /**
   * Create resource not found error
   */
  static notFound(
    resource: string,
    id?: string | number,
    action?: string
  ): ERPError {
    return new ERPError(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resource}을(를) 찾을 수 없습니다`,
      { id },
      { resource, action }
    );
  }

  /**
   * Create duplicate entry error
   */
  static duplicate(
    resource: string,
    field?: string,
    value?: any
  ): ERPError {
    return new ERPError(
      ErrorCode.DUPLICATE_ENTRY,
      `중복된 ${resource}입니다`,
      { field, value },
      { resource, field }
    );
  }

  /**
   * Create insufficient permissions error
   */
  static forbidden(
    action?: string,
    resource?: string
  ): ERPError {
    return new ERPError(
      ErrorCode.FORBIDDEN,
      '접근 권한이 없습니다',
      { action, resource },
      { action, resource }
    );
  }

  /**
   * Create database error
   */
  static database(
    message: string,
    details?: any
  ): ERPError {
    return new ERPError(
      ErrorCode.DATABASE_ERROR,
      message,
      details
    );
  }
}

/**
 * MySQL error code mapping to ERP error codes
 */
export const MYSQL_ERROR_MAPPING: Record<string, ErrorCode> = {
  'ER_NO_SUCH_TABLE': ErrorCode.CONFIGURATION_ERROR,
  'ER_BAD_FIELD_ERROR': ErrorCode.CONFIGURATION_ERROR,
  'ER_DUP_ENTRY': ErrorCode.DUPLICATE_ENTRY,
  'ER_NO_REFERENCED_ROW': ErrorCode.CONSTRAINT_VIOLATION,
  'ER_ROW_IS_REFERENCED': ErrorCode.CONSTRAINT_VIOLATION,
  'ER_LOCK_WAIT_TIMEOUT': ErrorCode.RESOURCE_LOCKED,
  'ER_LOCK_DEADLOCK': ErrorCode.RESOURCE_CONFLICT,
  'ECONNREFUSED': ErrorCode.SERVICE_UNAVAILABLE,
  'ETIMEDOUT': ErrorCode.TIMEOUT_ERROR,
  'ENOTFOUND': ErrorCode.CONFIGURATION_ERROR,
};

/**
 * Convert MySQL error to ERP error
 */
export function convertMySQLError(mysqlError: any): ERPError {
  const errorCode = MYSQL_ERROR_MAPPING[mysqlError.code] || ErrorCode.DATABASE_ERROR;

  let message = ERROR_MESSAGES[errorCode];
  let details = mysqlError;

  // Customize messages for specific MySQL errors
  switch (mysqlError.code) {
    case 'ER_DUP_ENTRY':
      message = '중복된 데이터입니다';
      break;
    case 'ER_NO_REFERENCED_ROW':
      message = '참조하는 데이터가 존재하지 않습니다';
      break;
    case 'ER_ROW_IS_REFERENCED':
      message = '삭제할 수 없습니다. 다른 데이터에서 참조중입니다';
      break;
    case 'ER_LOCK_WAIT_TIMEOUT':
      message = '다른 사용자가 사용중입니다. 잠시 후 다시 시도해주세요';
      break;
  }

  // Hide sensitive details in production
  if (process.env.NODE_ENV === 'production') {
    details = { code: mysqlError.code };
  }

  return new ERPError(errorCode, message, details);
}