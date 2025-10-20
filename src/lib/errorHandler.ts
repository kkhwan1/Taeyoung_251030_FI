import { NextResponse } from 'next/server';
import { errorLoggingManager } from './errorLogger';

/**
 * 에러 유형 정의
 */
export enum ErrorType {
  // 검증 관련 에러
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',

  // 데이터베이스 관련 에러
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  DATABASE_QUERY = 'DATABASE_QUERY',
  DATABASE_CONSTRAINT = 'DATABASE_CONSTRAINT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // 비즈니스 로직 에러
  BUSINESS_RULE = 'BUSINESS_RULE',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVALID_OPERATION = 'INVALID_OPERATION',

  // 시스템 에러
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  FILE_OPERATION = 'FILE_OPERATION',
  SYSTEM = 'SYSTEM',

  // 리소스 에러
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT'
}

/**
 * 에러 심각도 레벨
 */
export enum ErrorSeverity {
  LOW = 'LOW',        // 일반적인 사용자 실수
  MEDIUM = 'MEDIUM',  // 비즈니스 로직 위반
  HIGH = 'HIGH',      // 시스템 오류
  CRITICAL = 'CRITICAL' // 시스템 다운 가능성
}

/**
 * 한국어 에러 메시지 정의
 */
export const ErrorMessages = {
  // 검증 에러
  [ErrorType.VALIDATION]: {
    ko: '입력값이 올바르지 않습니다',
    en: 'Invalid input data'
  },
  [ErrorType.AUTHENTICATION]: {
    ko: '인증이 필요합니다',
    en: 'Authentication required'
  },
  [ErrorType.AUTHORIZATION]: {
    ko: '접근 권한이 없습니다',
    en: 'Access denied'
  },

  // 데이터베이스 에러
  [ErrorType.DATABASE_CONNECTION]: {
    ko: '데이터베이스 연결에 실패했습니다',
    en: 'Database connection failed'
  },
  [ErrorType.DATABASE_QUERY]: {
    ko: '데이터베이스 작업에 실패했습니다',
    en: 'Database operation failed'
  },
  [ErrorType.DATABASE_CONSTRAINT]: {
    ko: '데이터 무결성 제약 조건을 위반했습니다',
    en: 'Database constraint violation'
  },
  [ErrorType.DUPLICATE_ENTRY]: {
    ko: '이미 존재하는 데이터입니다',
    en: 'Duplicate entry'
  },

  // 비즈니스 로직 에러
  [ErrorType.BUSINESS_RULE]: {
    ko: '비즈니스 규칙을 위반했습니다',
    en: 'Business rule violation'
  },
  [ErrorType.INSUFFICIENT_STOCK]: {
    ko: '재고가 부족합니다',
    en: 'Insufficient stock'
  },
  [ErrorType.INVALID_OPERATION]: {
    ko: '유효하지 않은 작업입니다',
    en: 'Invalid operation'
  },

  // 시스템 에러
  [ErrorType.EXTERNAL_SERVICE]: {
    ko: '외부 서비스 연결에 실패했습니다',
    en: 'External service connection failed'
  },
  [ErrorType.FILE_OPERATION]: {
    ko: '파일 작업에 실패했습니다',
    en: 'File operation failed'
  },
  [ErrorType.SYSTEM]: {
    ko: '시스템 오류가 발생했습니다',
    en: 'System error occurred'
  },

  // 리소스 에러
  [ErrorType.NOT_FOUND]: {
    ko: '요청한 리소스를 찾을 수 없습니다',
    en: 'Resource not found'
  },
  [ErrorType.CONFLICT]: {
    ko: '리소스 충돌이 발생했습니다',
    en: 'Resource conflict'
  }
};

/**
 * 에러 유형별 HTTP 상태 코드 매핑
 */
export const ErrorStatusCodes = {
  [ErrorType.VALIDATION]: 400,
  [ErrorType.AUTHENTICATION]: 401,
  [ErrorType.AUTHORIZATION]: 403,
  [ErrorType.DATABASE_CONNECTION]: 503,
  [ErrorType.DATABASE_QUERY]: 500,
  [ErrorType.DATABASE_CONSTRAINT]: 422,
  [ErrorType.DUPLICATE_ENTRY]: 409,
  [ErrorType.BUSINESS_RULE]: 422,
  [ErrorType.INSUFFICIENT_STOCK]: 422,
  [ErrorType.INVALID_OPERATION]: 400,
  [ErrorType.EXTERNAL_SERVICE]: 503,
  [ErrorType.FILE_OPERATION]: 500,
  [ErrorType.SYSTEM]: 500,
  [ErrorType.NOT_FOUND]: 404,
  [ErrorType.CONFLICT]: 409
};

/**
 * 에러 유형별 심각도 매핑
 */
export const ErrorSeverityMap = {
  [ErrorType.VALIDATION]: ErrorSeverity.LOW,
  [ErrorType.AUTHENTICATION]: ErrorSeverity.MEDIUM,
  [ErrorType.AUTHORIZATION]: ErrorSeverity.MEDIUM,
  [ErrorType.DATABASE_CONNECTION]: ErrorSeverity.CRITICAL,
  [ErrorType.DATABASE_QUERY]: ErrorSeverity.HIGH,
  [ErrorType.DATABASE_CONSTRAINT]: ErrorSeverity.MEDIUM,
  [ErrorType.DUPLICATE_ENTRY]: ErrorSeverity.LOW,
  [ErrorType.BUSINESS_RULE]: ErrorSeverity.MEDIUM,
  [ErrorType.INSUFFICIENT_STOCK]: ErrorSeverity.MEDIUM,
  [ErrorType.INVALID_OPERATION]: ErrorSeverity.LOW,
  [ErrorType.EXTERNAL_SERVICE]: ErrorSeverity.HIGH,
  [ErrorType.FILE_OPERATION]: ErrorSeverity.MEDIUM,
  [ErrorType.SYSTEM]: ErrorSeverity.CRITICAL,
  [ErrorType.NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorType.CONFLICT]: ErrorSeverity.MEDIUM
};

/**
 * 구조화된 에러 정보
 */
export type ErrorDetails = Record<string, unknown> | string[] | string | null;

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  details?: ErrorDetails;
  severity: ErrorSeverity;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  userId?: string;
  resource?: string;
  action?: string;
  stackTrace?: string;
}

/**
 * 표준 API 응답 인터페이스
 */
export interface StandardResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    message: string;
    details?: ErrorDetails;
    timestamp: string;
    requestId?: string;
  };
  metadata?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

/**
 * 커스텀 에러 클래스
 */
export class ERPError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly timestamp: string;
  public readonly requestId?: string;
  public readonly userId?: string;
  public readonly resource?: string;
  public readonly action?: string;

  constructor(
    type: ErrorType,
    message?: string,
    details?: ErrorDetails,
    options?: {
      requestId?: string;
      userId?: string;
      resource?: string;
      action?: string;
    }
  ) {
    const errorMessage = message || ErrorMessages[type].ko;
    super(errorMessage);

    this.name = 'ERPError';
    this.type = type;
    this.severity = ErrorSeverityMap[type];
    this.statusCode = ErrorStatusCodes[type];
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.requestId = options?.requestId;
    this.userId = options?.userId;
    this.resource = options?.resource;
    this.action = options?.action;

    // Error.captureStackTrace가 존재하는 경우에만 사용
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ERPError);
    }
  }

  toJSON(): ErrorInfo {
    return {
      type: this.type,
      message: this.message,
      details: this.details,
      severity: this.severity,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      requestId: this.requestId,
      userId: this.userId,
      resource: this.resource,
      action: this.action,
      stackTrace: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }
}

/**
 * 통합 에러 핸들러 클래스
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private loggers: ((error: ErrorInfo) => void)[] = [];

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 로거 추가
   */
  public addLogger(logger: (error: ErrorInfo) => void): void {
    this.loggers.push(logger);
  }

  /**
   * 에러 로깅
   */
  private logError(error: ErrorInfo): void {
    // 콘솔 로깅 (개발 환경)
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 ERP Error:', {
        type: error.type,
        message: error.message,
        severity: error.severity,
        details: error.details,
        timestamp: error.timestamp,
        resource: error.resource,
        action: error.action
      });
    }

    // 등록된 추가 로거들 실행
    this.loggers.forEach(logger => {
      try {
        logger(error);
      } catch (loggerError) {
        console.error('Logger error:', loggerError);
      }
    });
  }

  /**
   * MySQL 에러 코드를 ERPError로 변환
   */
  public convertMySQLError(error: unknown, context?: { resource?: string; action?: string; userId?: string }): ERPError {
    const { resource, action, userId } = context || {};

    // Type guard for error object
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return new ERPError(
        ErrorType.DATABASE_QUERY,
        '알 수 없는 데이터베이스 오류가 발생했습니다',
        { originalError: String(error) },
        { resource, action, userId }
      );
    }

    const dbError = error as { code?: string; sqlState?: string; errno?: number; message?: string };

    switch (dbError.code) {
      case 'ER_NO_SUCH_TABLE':
        return new ERPError(
          ErrorType.DATABASE_QUERY,
          '데이터베이스 테이블을 찾을 수 없습니다',
          { sqlState: dbError.sqlState, errno: dbError.errno },
          { resource, action, userId }
        );

      case 'ER_BAD_FIELD_ERROR':
        return new ERPError(
          ErrorType.DATABASE_QUERY,
          '유효하지 않은 데이터베이스 필드입니다',
          { sqlState: dbError.sqlState, errno: dbError.errno },
          { resource, action, userId }
        );

      case 'ER_DUP_ENTRY':
        return new ERPError(
          ErrorType.DUPLICATE_ENTRY,
          '이미 존재하는 데이터입니다',
          { sqlState: dbError.sqlState, errno: dbError.errno },
          { resource, action, userId }
        );

      case 'ER_ROW_IS_REFERENCED_2':
        return new ERPError(
          ErrorType.DATABASE_CONSTRAINT,
          '다른 데이터에서 참조 중인 항목은 삭제할 수 없습니다',
          { sqlState: dbError.sqlState, errno: dbError.errno },
          { resource, action, userId }
        );

      case 'ER_NO_REFERENCED_ROW_2':
        return new ERPError(
          ErrorType.DATABASE_CONSTRAINT,
          '참조하는 데이터가 존재하지 않습니다',
          { sqlState: dbError.sqlState, errno: dbError.errno },
          { resource, action, userId }
        );

      case 'ECONNREFUSED':
      case 'ENOTFOUND':
        return new ERPError(
          ErrorType.DATABASE_CONNECTION,
          '데이터베이스 연결에 실패했습니다',
          { code: dbError.code, errno: dbError.errno },
          { resource, action, userId }
        );

      default:
        return new ERPError(
          ErrorType.DATABASE_QUERY,
          '데이터베이스 작업 중 오류가 발생했습니다',
          {
            code: dbError.code,
            sqlState: dbError.sqlState,
            errno: dbError.errno,
            originalMessage: dbError.message
          },
          { resource, action, userId }
        );
    }
  }

  /**
   * 에러를 NextResponse로 변환
   */
  public handleError(
    error: unknown,
    context?: {
      resource?: string;
      action?: string;
      userId?: string;
      requestId?: string;
    }
  ): NextResponse {
    let erpError: ERPError;

    if (error instanceof ERPError) {
      erpError = error;
    } else if (error && typeof error === 'object' && 'code' in error) {
      // MySQL 에러
      erpError = this.convertMySQLError(error, context);
    } else if (error instanceof Error) {
      // 일반 JavaScript 에러
      erpError = new ERPError(
        ErrorType.SYSTEM,
        error.message || '시스템 오류가 발생했습니다',
        { originalError: error.name },
        context
      );
    } else {
      // 알 수 없는 에러
      erpError = new ERPError(
        ErrorType.SYSTEM,
        '알 수 없는 오류가 발생했습니다',
        { originalError: String(error) },
        context
      );
    }

    // 에러 로깅 (로깅 매니저에 위임)
    errorLoggingManager.logError(erpError.toJSON()).catch(logError => {
      console.error('Failed to log error:', logError);
    });

    // NextResponse 생성
    const response: StandardResponse = {
      success: false,
      error: {
        type: erpError.type,
        message: erpError.message,
        details: process.env.NODE_ENV === 'development' ? erpError.details : undefined,
        timestamp: erpError.timestamp,
        requestId: erpError.requestId
      }
    };

    return NextResponse.json(response, { status: erpError.statusCode });
  }

  /**
   * 성공 응답 생성
   */
  public createSuccessResponse<T>(
    data: T,
    message?: string,
    metadata?: {
      total?: number;
      page?: number;
      limit?: number;
      hasMore?: boolean;
    }
  ): NextResponse {
    const response: StandardResponse<T> = {
      success: true,
      data,
      metadata
    };

    return NextResponse.json(response);
  }

  /**
   * 검증 에러 처리
   */
  public handleValidationError(
    errors: string[] | Record<string, string>,
    context?: { resource?: string; action?: string; userId?: string }
  ): NextResponse {
    const errorDetails = Array.isArray(errors)
      ? { fields: errors }
      : { validation: errors };

    const erpError = new ERPError(
      ErrorType.VALIDATION,
      '입력 데이터가 유효하지 않습니다',
      errorDetails,
      context
    );

    return this.handleError(erpError, context);
  }

  /**
   * 비즈니스 로직 에러 처리
   */
  public handleBusinessError(
    message: string,
    details?: ErrorDetails,
    context?: { resource?: string; action?: string; userId?: string }
  ): NextResponse {
    const erpError = new ERPError(
      ErrorType.BUSINESS_RULE,
      message,
      details,
      context
    );

    return this.handleError(erpError, context);
  }

  /**
   * 리소스 미발견 에러 처리
   */
  public handleNotFoundError(
    resource: string,
    identifier?: string | number | null,
    context?: { userId?: string }
  ): NextResponse {
    const erpError = new ERPError(
      ErrorType.NOT_FOUND,
      `${resource}을(를) 찾을 수 없습니다`,
      { resource, identifier },
      { ...context, resource, action: 'read' }
    );

    return this.handleError(erpError, context);
  }

  /**
   * 재고 부족 에러 처리
   */
  public handleInsufficientStockError(
    itemCode: string,
    requested: number,
    available: number,
    context?: { userId?: string }
  ): NextResponse {
    const erpError = new ERPError(
      ErrorType.INSUFFICIENT_STOCK,
      `재고가 부족합니다. 요청: ${requested}, 가용: ${available}`,
      { itemCode, requested, available },
      { ...context, resource: 'stock', action: 'check' }
    );

    return this.handleError(erpError, context);
  }
}

// 싱글톤 인스턴스 내보내기
export const errorHandler = ErrorHandler.getInstance();

// Context type for error handlers
export interface ErrorContext {
  resource?: string;
  action?: string;
  userId?: string;
  requestId?: string;
}

// Metadata type for success responses
export interface ResponseMetadata {
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

// 편의 함수들
export const handleError = (error: unknown, context?: ErrorContext) =>
  errorHandler.handleError(error, context);

export const createSuccessResponse = <T>(data: T, message?: string, metadata?: ResponseMetadata) =>
  errorHandler.createSuccessResponse(data, message, metadata);

export const handleValidationError = (errors: string[] | Record<string, string>, context?: ErrorContext) =>
  errorHandler.handleValidationError(errors, context);

export const handleBusinessError = (message: string, details?: ErrorDetails, context?: ErrorContext) =>
  errorHandler.handleBusinessError(message, details, context);

export const handleNotFoundError = (resource: string, identifier?: string | number | null, context?: ErrorContext) =>
  errorHandler.handleNotFoundError(resource, identifier, context);

export const handleInsufficientStockError = (itemCode: string, requested: number, available: number, context?: ErrorContext) =>
  errorHandler.handleInsufficientStockError(itemCode, requested, available, context);