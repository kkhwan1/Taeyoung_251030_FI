import { NextRequest } from 'next/server';
import { errorLoggingManager } from '@/lib/errorLogger';
import { createSuccessResponse, handleError, handleValidationError } from '@/lib/errorHandler';

/**
 * 에러 통계 조회 API
 * GET /api/admin/errors/stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    // 유효성 검사
    if (days < 1 || days > 365) {
      return handleValidationError(['일수는 1일에서 365일 사이여야 합니다']);
    }

    const dbLogger = errorLoggingManager.getDatabaseLogger();
    const stats = await dbLogger.getErrorStats(days);

    return createSuccessResponse(stats, `최근 ${days}일간의 에러 통계`);
  } catch (error) {
    return handleError(error, {
      resource: 'error_stats',
      action: 'read'
    });
  }
}