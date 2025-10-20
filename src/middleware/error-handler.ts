import { NextRequest, NextResponse } from 'next/server';
import {
  ErrorCode,
  ERPError,
  createErrorResponse,
  convertMySQLError,
  isServerError
} from '@/lib/error-format';

/**
 * Error context for logging and debugging
 */
export interface ErrorContext {
  requestId?: string;
  userId?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  ip?: string;
  timestamp?: string;
  resource?: string;
  action?: string;
}

/**
 * Global error handler middleware for API routes
 */
export function withErrorHandler<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async function errorHandlerWrapper(
    request: NextRequest,
    ...args: T
  ): Promise<NextResponse> {
    const startTime = Date.now();
    let requestId: string | undefined;

    try {
      // Generate request ID for tracking
      requestId = generateRequestId();

      // Add request ID to headers for downstream handlers
      request.headers.set('x-request-id', requestId);

      // Execute the handler
      const response = await handler(request, ...args);

      // Add request ID and processing time to response headers
      response.headers.set('x-request-id', requestId);
      response.headers.set('x-processing-time', `${Date.now() - startTime}ms`);

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const context = createErrorContext(request, requestId, processingTime);

      return handleError(error, context);
    }
  };
}

/**
 * Handle different types of errors and return appropriate responses
 */
export function handleError(error: unknown, context: ErrorContext = {}): NextResponse {
  let erpError: ERPError;

  // Convert different error types to ERPError
  if (error instanceof ERPError) {
    erpError = error;
  } else if (error && typeof error === 'object' && 'code' in error) {
    // MySQL or database errors
    erpError = convertMySQLError(error);
  } else if (error instanceof Error) {
    // Generic JavaScript errors
    erpError = categorizeGenericError(error);
  } else {
    // Unknown error types
    erpError = new ERPError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      '알 수 없는 오류가 발생했습니다',
      { originalError: String(error) }
    );
  }

  // Log the error
  logError(erpError, context);

  // Create standardized error response
  const errorResponse = erpError.toErrorResponse({
    requestId: context.requestId,
    path: context.path,
  });

  // Add additional context in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = {
      ...errorResponse.error.details,
      stack: erpError.stack,
      context,
    };
  }

  return NextResponse.json(errorResponse, {
    status: erpError.statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'x-request-id': context.requestId || '',
      'x-error-code': erpError.code,
    },
  });
}

/**
 * Categorize generic JavaScript errors into appropriate ERP error codes
 */
function categorizeGenericError(error: Error): ERPError {
  const message = error.message.toLowerCase();

  // Timeout errors
  if (message.includes('timeout') || message.includes('etimedout')) {
    return new ERPError(
      ErrorCode.TIMEOUT_ERROR,
      '요청 시간이 초과되었습니다',
      { originalMessage: error.message }
    );
  }

  // Connection errors
  if (message.includes('connection') || message.includes('econnrefused')) {
    return new ERPError(
      ErrorCode.SERVICE_UNAVAILABLE,
      '서비스에 연결할 수 없습니다',
      { originalMessage: error.message }
    );
  }

  // Network errors
  if (message.includes('network') || message.includes('enotfound')) {
    return new ERPError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      '네트워크 오류가 발생했습니다',
      { originalMessage: error.message }
    );
  }

  // Permission errors
  if (message.includes('permission') || message.includes('access denied')) {
    return new ERPError(
      ErrorCode.FORBIDDEN,
      '접근 권한이 없습니다',
      { originalMessage: error.message }
    );
  }

  // Validation errors (from libraries)
  if (message.includes('invalid') || message.includes('validation')) {
    return new ERPError(
      ErrorCode.VALIDATION_ERROR,
      '입력값 검증에 실패했습니다',
      { originalMessage: error.message }
    );
  }

  // Default to internal server error
  return new ERPError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    '서버 내부 오류가 발생했습니다',
    { originalMessage: error.message }
  );
}

/**
 * Create error context from request information
 */
function createErrorContext(
  request: NextRequest,
  requestId?: string,
  processingTime?: number
): ErrorContext {
  return {
    requestId,
    userAgent: request.headers.get('user-agent') || undefined,
    path: request.nextUrl.pathname,
    method: request.method,
    ip: getClientIP(request),
    timestamp: new Date().toISOString(),
    userId: request.headers.get('x-user-id') || undefined,
  };
}

/**
 * Extract client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || (request as any).ip || 'unknown';
  return ip;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Log error with appropriate level and context
 */
function logError(error: ERPError, context: ErrorContext): void {
  const logLevel = isServerError(error.code) ? 'error' : 'warn';

  const logData = {
    level: logLevel,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    details: error.details,
    context,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  };

  // Use console for now, can be replaced with proper logging service
  if (logLevel === 'error') {
    console.error('ERP Error:', JSON.stringify(logData, null, 2));
  } else {
    console.warn('ERP Warning:', JSON.stringify(logData, null, 2));
  }

  // Send to external logging service in production
  if (process.env.NODE_ENV === 'production' && isServerError(error.code)) {
    // TODO: Integrate with external logging service (e.g., Winston, DataDog, etc.)
    sendToLoggingService(logData);
  }
}

/**
 * Send error to external logging service (placeholder)
 */
function sendToLoggingService(logData: any): void {
  // TODO: Implement external logging service integration
  // Examples:
  // - Winston with file transport
  // - DataDog logs API
  // - CloudWatch logs
  // - Custom logging endpoint

  if (process.env.LOGGING_ENDPOINT) {
    fetch(process.env.LOGGING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(logData),
    }).catch(err => {
      console.error('Failed to send log to external service:', err);
    });
  }
}

/**
 * Error boundary for async route handlers
 */
export function asyncErrorBoundary<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async function boundaryWrapper(...args: T): Promise<NextResponse> {
    try {
      return await handler(...args);
    } catch (error) {
      const context = createErrorContext(
        args[0] as NextRequest, // First argument should be NextRequest
        generateRequestId()
      );
      return handleError(error, context);
    }
  };
}

/**
 * Create validation error handler
 */
export function handleValidationError(
  errors: string[] | Record<string, string[]>,
  context: ErrorContext = {}
): NextResponse {
  let details: unknown;
  let message = '입력값 검증에 실패했습니다';

  if (Array.isArray(errors)) {
    details = { errors };
    if (errors.length === 1) {
      message = errors[0];
    }
  } else {
    details = { fieldErrors: errors };
    const errorCount = Object.keys(errors).length;
    message = `${errorCount}개 필드에서 검증 오류가 발생했습니다`;
  }

  const erpError = new ERPError(
    ErrorCode.VALIDATION_ERROR,
    message,
    details
  );

  return handleError(erpError, context);
}

/**
 * Create business rule violation error handler
 */
export function handleBusinessError(
  message: string,
  details?: any,
  context: ErrorContext = {}
): NextResponse {
  const erpError = new ERPError(
    ErrorCode.BUSINESS_RULE_VIOLATION,
    message,
    details
  );

  return handleError(erpError, context);
}

/**
 * Create not found error handler
 */
export function handleNotFoundError(
  resource: string,
  id?: string | number,
  context: ErrorContext = {}
): NextResponse {
  const erpError = ERPError.notFound(resource, id, context.action);
  return handleError(erpError, context);
}

/**
 * Create unauthorized error handler
 */
export function handleUnauthorizedError(
  message = '인증이 필요합니다',
  context: ErrorContext = {}
): NextResponse {
  const erpError = new ERPError(
    ErrorCode.UNAUTHORIZED,
    message
  );

  return handleError(erpError, context);
}

/**
 * Create forbidden error handler
 */
export function handleForbiddenError(
  message = '접근 권한이 없습니다',
  context: ErrorContext = {}
): NextResponse {
  const erpError = new ERPError(
    ErrorCode.FORBIDDEN,
    message,
    { action: context.action, resource: context.resource }
  );

  return handleError(erpError, context);
}

/**
 * Database error handler with retry logic
 */
export function handleDatabaseError(
  error: any,
  context: ErrorContext = {},
  retryCount = 0
): NextResponse {
  const erpError = convertMySQLError(error);

  // Add retry information to context
  const enrichedContext = {
    ...context,
    retryCount,
    canRetry: retryCount < 3 && ['ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK'].includes(error.code),
  };

  return handleError(erpError, enrichedContext);
}

/**
 * Rate limit error handler
 */
export function handleRateLimitError(
  limit: number,
  windowMs: number,
  retryAfter: number,
  context: ErrorContext = {}
): NextResponse {
  const erpError = new ERPError(
    ErrorCode.RATE_LIMIT_EXCEEDED,
    '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요',
    { limit, windowMs, retryAfter }
  );

  return handleError(erpError, context);
}