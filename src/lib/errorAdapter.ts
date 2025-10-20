import { NextResponse } from 'next/server';
import {
  errorHandler,
  ErrorType,
  ERPError,
  createSuccessResponse as newCreateSuccessResponse,
  handleError as newHandleError
} from './errorHandler';

/**
 * 기존 validationMiddleware와의 호환성을 위한 어댑터
 */

/**
 * 기존 createErrorResponse와 호환되는 함수
 * @deprecated 새로운 handleError 사용 권장
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  details?: any
): NextResponse {
  // 상태 코드에 따른 에러 유형 매핑
  let errorType: ErrorType;

  switch (statusCode) {
    case 400:
      errorType = ErrorType.VALIDATION;
      break;
    case 401:
      errorType = ErrorType.AUTHENTICATION;
      break;
    case 403:
      errorType = ErrorType.AUTHORIZATION;
      break;
    case 404:
      errorType = ErrorType.NOT_FOUND;
      break;
    case 409:
      errorType = ErrorType.CONFLICT;
      break;
    case 422:
      errorType = ErrorType.BUSINESS_RULE;
      break;
    case 503:
      errorType = ErrorType.DATABASE_CONNECTION;
      break;
    default:
      errorType = ErrorType.SYSTEM;
  }

  const erpError = new ERPError(errorType, message, details);
  return errorHandler.handleError(erpError);
}

/**
 * 기존 createSuccessResponse와 호환되는 함수
 * 새로운 시스템으로 자동 전달
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  statusCode?: number,
  metadata?: any
): NextResponse {
  return newCreateSuccessResponse(data, message, metadata);
}

/**
 * 기존 withErrorHandler와 호환되는 함수
 * @deprecated 새로운 handleError 직접 사용 권장
 */
export async function withErrorHandler<T>(
  handler: () => Promise<T>,
  context?: {
    resource?: string;
    action?: string;
    userId?: string;
    requestId?: string;
  }
): Promise<NextResponse> {
  try {
    const result = await handler();
    return newCreateSuccessResponse(result);
  } catch (error) {
    return newHandleError(error, context);
  }
}

/**
 * 기존 API 라우트를 새로운 에러 핸들러로 감싸는 래퍼
 */
export function wrapApiRoute(
  handler: (request: any, context?: any) => Promise<NextResponse>,
  options?: {
    resource?: string;
    action?: string;
  }
) {
  return async (request: any, routeContext?: any) => {
    const context = {
      resource: options?.resource,
      action: options?.action,
      userId: request.headers?.get?.('x-user-id') || undefined,
      requestId: request.headers?.get?.('x-request-id') || undefined
    };

    try {
      return await handler(request, routeContext);
    } catch (error) {
      return newHandleError(error, context);
    }
  };
}

/**
 * 기존 MySQL 에러 처리와 호환
 */
export function handleDatabaseError(error: unknown): NextResponse {
  const erpError = errorHandler.convertMySQLError(error);
  return errorHandler.handleError(erpError);
}

/**
 * 기존 검증 에러 처리와 호환
 */
export function handleValidationError(errors: string[]): NextResponse {
  return errorHandler.handleValidationError(errors);
}

/**
 * 기존 Not Found 에러 처리와 호환
 */
export function handleNotFoundError(resource: string): NextResponse {
  return errorHandler.handleNotFoundError(resource);
}

/**
 * 마이그레이션 도우미: 기존 try-catch 블록을 새로운 시스템으로 변환
 */
export function migrateErrorHandling(
  originalTryCatchBlock: () => Promise<NextResponse>,
  context?: {
    resource?: string;
    action?: string;
    userId?: string;
    requestId?: string;
  }
): Promise<NextResponse> {
  return withErrorHandler(async () => {
    return await originalTryCatchBlock();
  }, context);
}

/**
 * 개발자를 위한 마이그레이션 가이드 출력
 */
export function printMigrationGuide(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`
🔄 에러 핸들링 마이그레이션 가이드

기존 코드:
  try {
    // API 로직
    return createSuccessResponse(data);
  } catch (error) {
    return createErrorResponse('Failed', 500);
  }

새로운 코드:
  try {
    // API 로직
    return createSuccessResponse(data);
  } catch (error) {
    return handleError(error, { resource: 'items', action: 'create' });
  }

더 나은 방법:
  const context = { resource: 'items', action: 'create', userId: 'user123' };
  try {
    // API 로직
    return createSuccessResponse(data);
  } catch (error) {
    return handleError(error, context);
  }

특화된 에러:
  if (!item) {
    return handleNotFoundError('아이템', itemId, context);
  }

  if (stockInsufficient) {
    return handleInsufficientStockError(itemCode, requested, available, context);
  }
    `);
  }
}

// 개발 환경에서 가이드 출력
if (process.env.NODE_ENV === 'development') {
  // printMigrationGuide(); // 필요시 주석 해제
}