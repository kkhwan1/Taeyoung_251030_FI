import { NextRequest, NextResponse } from 'next/server';
import { errorLoggingManager } from '@/lib/errorLogger';
import { createSuccessResponse, handleError, handleValidationError } from '@/lib/errorHandler';
import { ErrorSeverity } from '@/lib/errorHandler';

export const dynamic = 'force-dynamic';


/**
 * 에러 로그 조회 API
 * GET /api/admin/errors
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터 파싱
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const severity = searchParams.get('severity') as ErrorSeverity | null;
    const errorType = searchParams.get('error_type');
    const resolved = searchParams.get('resolved');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // 유효성 검사
    if (page < 1 || limit < 1 || limit > 100) {
      return handleValidationError(['페이지와 제한값은 유효한 범위여야 합니다']);
    }

    const options: Record<string, unknown> = { page, limit };

    if (severity && Object.values(ErrorSeverity).includes(severity)) {
      options.severity = severity;
    }

    if (errorType) {
      options.errorType = errorType;
    }

    if (resolved !== null && (resolved === 'true' || resolved === 'false')) {
      options.resolved = resolved === 'true';
    }

    if (startDate) {
      const parsedStartDate = new Date(startDate);
      if (!isNaN(parsedStartDate.getTime())) {
        options.startDate = parsedStartDate;
      }
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (!isNaN(parsedEndDate.getTime())) {
        options.endDate = parsedEndDate;
      }
    }

    const dbLogger = errorLoggingManager.getDatabaseLogger();
    const result = await dbLogger.getErrorLogs(options);

    return createSuccessResponse(result.logs, undefined, {
      total: result.total,
      page,
      limit,
      hasMore: page * limit < result.total
    });
  } catch (error) {
    return handleError(error, {
      resource: 'error_logs',
      action: 'read'
    });
  }
}

/**
 * 에러 해결 처리 API
 * PUT /api/admin/errors
 */
export async function PUT(request: NextRequest) {
  try {
    const text = await request.text();
    const data = JSON.parse(text);

    // 유효성 검사
    if (!data.log_id || !data.resolved_by) {
      return handleValidationError(['log_id와 resolved_by는 필수입니다']);
    }

    const logId = parseInt(data.log_id);
    if (isNaN(logId)) {
      return handleValidationError(['log_id는 유효한 숫자여야 합니다']);
    }

    const dbLogger = errorLoggingManager.getDatabaseLogger();
    const success = await dbLogger.resolveError(logId, data.resolved_by);

    if (!success) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'NOT_FOUND',
          message: '해당 에러 로그를 찾을 수 없습니다',
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }

    return createSuccessResponse({ resolved: true }, '에러가 해결로 표시되었습니다');
  } catch (error) {
    return handleError(error, {
      resource: 'error_logs',
      action: 'update'
    });
  }
}