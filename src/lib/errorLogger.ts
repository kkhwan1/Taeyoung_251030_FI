import { ErrorInfo, ErrorSeverity } from './errorHandler';
import { query } from './db-unified';

/**
 * 에러 로그 데이터베이스 스키마 인터페이스
 */
export interface ErrorLog {
  log_id?: number;
  error_type: string;
  message: string;
  details?: string;
  severity: string;
  status_code: number;
  timestamp: string;
  request_id?: string;
  user_id?: string;
  resource?: string;
  action?: string;
  stack_trace?: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_at?: string;
}

/**
 * 에러 통계 인터페이스
 */
export interface ErrorStats {
  total_errors: number;
  critical_errors: number;
  high_errors: number;
  medium_errors: number;
  low_errors: number;
  unresolved_errors: number;
  today_errors: number;
  last_24h_errors: number;
  top_error_types: Array<{
    error_type: string;
    count: number;
    percentage: number;
  }>;
  error_trend: Array<{
    date: string;
    count: number;
    critical_count: number;
  }>;
}

/**
 * 데이터베이스 에러 로거
 */
export class DatabaseLogger {
  /**
   * 에러 로그를 데이터베이스에 저장
   */
  async logError(errorInfo: ErrorInfo): Promise<void> {
    try {
      const sql = `
        INSERT INTO error_logs (
          error_type, message, details, severity, status_code,
          timestamp, request_id, user_id, resource, action, stack_trace
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

      await query(sql, [
        errorInfo.type,
        errorInfo.message,
        errorInfo.details ? JSON.stringify(errorInfo.details) : null,
        errorInfo.severity,
        errorInfo.statusCode,
        errorInfo.timestamp,
        errorInfo.requestId || null,
        errorInfo.userId || null,
        errorInfo.resource || null,
        errorInfo.action || null,
        errorInfo.stackTrace || null
      ]);
    } catch (error) {
      // 로깅 자체에서 에러가 발생한 경우 콘솔에만 기록
      console.error('Failed to log error to database:', error);
      console.error('Original error info:', errorInfo);
    }
  }

  /**
   * 에러 통계 조회
   */
  async getErrorStats(days: number = 7): Promise<ErrorStats> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 전체 통계
      const totalStatsQuery = `
        SELECT
          COUNT(*) as total_errors,
          SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_errors,
          SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high_errors,
          SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium_errors,
          SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) as low_errors,
          SUM(CASE WHEN resolved = false THEN 1 ELSE 0 END) as unresolved_errors,
          SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) as today_errors,
          SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END) as last_24h_errors
        FROM error_logs
        WHERE created_at >= $1
      `;

      const totalStatsResult = await query<{total_errors: string, critical_errors: string, high_errors: string, medium_errors: string, low_errors: string, unresolved_errors: string, today_errors: string, last_24h_errors: string}>(totalStatsQuery, [startDate.toISOString()]);
      const totalStats = totalStatsResult[0];

      // 에러 유형별 통계
      const typeStatsQuery = `
        SELECT
          error_type,
          COUNT(*) as count,
          ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM error_logs WHERE created_at >= $1)), 2) as percentage
        FROM error_logs
        WHERE created_at >= $2
        GROUP BY error_type
        ORDER BY count DESC
        LIMIT 10
      `;

      const typeStats = await query<{error_type: string, count: string, percentage: string}>(typeStatsQuery, [startDate.toISOString(), startDate.toISOString()]);

      // 일별 에러 트렌드
      const trendQuery = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count
        FROM error_logs
        WHERE created_at >= $1
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const trendData = await query<{date: string, count: string, critical_count: string}>(trendQuery, [startDate.toISOString()]);

      return {
        total_errors: totalStats ? parseInt(totalStats.total_errors) || 0 : 0,
        critical_errors: totalStats ? parseInt(totalStats.critical_errors) || 0 : 0,
        high_errors: totalStats ? parseInt(totalStats.high_errors) || 0 : 0,
        medium_errors: totalStats ? parseInt(totalStats.medium_errors) || 0 : 0,
        low_errors: totalStats ? parseInt(totalStats.low_errors) || 0 : 0,
        unresolved_errors: totalStats ? parseInt(totalStats.unresolved_errors) || 0 : 0,
        today_errors: totalStats ? parseInt(totalStats.today_errors) || 0 : 0,
        last_24h_errors: totalStats ? parseInt(totalStats.last_24h_errors) || 0 : 0,
        top_error_types: typeStats.map((stat: {error_type: string, count: string, percentage: string}) => ({
          error_type: stat.error_type,
          count: parseInt(stat.count),
          percentage: parseFloat(stat.percentage)
        })),
        error_trend: trendData.map((trend: {date: string, count: string, critical_count: string}) => ({
          date: trend.date,
          count: parseInt(trend.count),
          critical_count: parseInt(trend.critical_count)
        }))
      };
    } catch (error) {
      console.error('Failed to get error stats:', error);
      // 기본값 반환
      return {
        total_errors: 0,
        critical_errors: 0,
        high_errors: 0,
        medium_errors: 0,
        low_errors: 0,
        unresolved_errors: 0,
        today_errors: 0,
        last_24h_errors: 0,
        top_error_types: [],
        error_trend: []
      };
    }
  }

  /**
   * 에러 로그 조회 (페이징)
   */
  async getErrorLogs(options: {
    page?: number;
    limit?: number;
    severity?: ErrorSeverity;
    errorType?: string;
    resolved?: boolean;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<{ logs: ErrorLog[]; total: number }> {
    const {
      page = 1,
      limit = 50,
      severity,
      errorType,
      resolved,
      startDate,
      endDate
    } = options;

    try {
      const whereConditions: string[] = [];
      const params: unknown[] = [];

      let paramIndex = 1;
      if (severity) {
        whereConditions.push(`severity = $${paramIndex++}`);
        params.push(severity);
      }

      if (errorType) {
        whereConditions.push(`error_type = $${paramIndex++}`);
        params.push(errorType);
      }

      if (resolved !== undefined) {
        whereConditions.push(`resolved = $${paramIndex++}`);
        params.push(resolved);
      }

      if (startDate) {
        whereConditions.push(`created_at >= $${paramIndex++}`);
        params.push(startDate.toISOString());
      }

      if (endDate) {
        whereConditions.push(`created_at <= $${paramIndex++}`);
        params.push(endDate.toISOString());
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // 총 개수 조회
      const countQuery = `SELECT COUNT(*) as total FROM error_logs ${whereClause}`;
      const countResult = await query<{total: string}>(countQuery, params);
      const total = parseInt(countResult[0]?.total || '0');

      // 로그 조회
      const offset = (page - 1) * limit;
      const logsQuery = `
        SELECT
          log_id, error_type, message, details, severity, status_code,
          timestamp, request_id, user_id, resource, action, stack_trace,
          resolved, resolved_at, resolved_by, created_at
        FROM error_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      const logs = await query<ErrorLog>(logsQuery, [...params, limit, offset]);

      return { logs: Array.isArray(logs) ? logs : [], total };
    } catch (error) {
      console.error('Failed to get error logs:', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * 에러 해결 표시
   */
  async resolveError(logId: number, resolvedBy: string): Promise<boolean> {
    try {
      const sql = `
        UPDATE error_logs
        SET resolved = true, resolved_at = NOW(), resolved_by = $1
        WHERE log_id = $2
      `;

      const result = await query(sql, [resolvedBy, logId]);
      return Array.isArray(result) ? result.length > 0 : false;
    } catch (error) {
      console.error('Failed to resolve error:', error);
      return false;
    }
  }

  /**
   * 에러 로그 정리 (오래된 로그 삭제)
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const sql = `
        DELETE FROM error_logs
        WHERE created_at < $1 AND resolved = true
      `;

      const result = await query(sql, [cutoffDate.toISOString()]);
      return Array.isArray(result) ? result.length : 0;
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
      return 0;
    }
  }
}

/**
 * 파일 로거 (개발 환경용)
 */
export class FileLogger {
  private logFilePath: string;

  constructor(logFilePath: string = './logs/error.log') {
    this.logFilePath = logFilePath;
  }

  async logError(errorInfo: ErrorInfo): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // 로그 디렉토리 생성
      const logDir = path.dirname(this.logFilePath);
      await fs.mkdir(logDir, { recursive: true }).catch(() => {});

      // 로그 엔트리 생성
      const logEntry = {
        timestamp: errorInfo.timestamp,
        level: errorInfo.severity,
        type: errorInfo.type,
        message: errorInfo.message,
        details: errorInfo.details,
        resource: errorInfo.resource,
        action: errorInfo.action,
        userId: errorInfo.userId,
        requestId: errorInfo.requestId
      };

      const logLine = JSON.stringify(logEntry) + '\n';

      // 파일에 추가
      await fs.appendFile(this.logFilePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}

/**
 * 콘솔 로거 (구조화된 출력)
 */
export class ConsoleLogger {
  private static readonly COLORS = {
    CRITICAL: '\x1b[41m\x1b[37m', // 빨간 배경, 흰 글자
    HIGH: '\x1b[31m',             // 빨간 글자
    MEDIUM: '\x1b[33m',           // 노란 글자
    LOW: '\x1b[36m',              // 시안 글자
    RESET: '\x1b[0m'              // 리셋
  };

  async logError(errorInfo: ErrorInfo): Promise<void> {
    const color = ConsoleLogger.COLORS[errorInfo.severity] || ConsoleLogger.COLORS.LOW;
    const reset = ConsoleLogger.COLORS.RESET;

    console.log(`\n${color}🚨 ERP 에러 발생${reset}`);
    console.log(`${color}┌─ 시간: ${errorInfo.timestamp}${reset}`);
    console.log(`${color}├─ 유형: ${errorInfo.type}${reset}`);
    console.log(`${color}├─ 심각도: ${errorInfo.severity}${reset}`);
    console.log(`${color}├─ 메시지: ${errorInfo.message}${reset}`);

    if (errorInfo.resource) {
      console.log(`${color}├─ 리소스: ${errorInfo.resource}${reset}`);
    }

    if (errorInfo.action) {
      console.log(`${color}├─ 액션: ${errorInfo.action}${reset}`);
    }

    if (errorInfo.userId) {
      console.log(`${color}├─ 사용자: ${errorInfo.userId}${reset}`);
    }

    if (errorInfo.requestId) {
      console.log(`${color}├─ 요청ID: ${errorInfo.requestId}${reset}`);
    }

    if (errorInfo.details) {
      console.log(`${color}├─ 상세정보:${reset}`);
      console.log(`${color}│  ${JSON.stringify(errorInfo.details, null, 2).replace(/\n/g, '\n│  ')}${reset}`);
    }

    if (errorInfo.stackTrace && process.env.NODE_ENV === 'development') {
      console.log(`${color}└─ 스택트레이스:${reset}`);
      console.log(`${color}   ${errorInfo.stackTrace.replace(/\n/g, '\n   ')}${reset}`);
    } else {
      console.log(`${color}└─ 상태코드: ${errorInfo.statusCode}${reset}`);
    }

    console.log(''); // 빈 줄
  }
}

/**
 * 에러 로깅 매니저
 */
export class ErrorLoggingManager {
  private loggers: Array<{ logError: (errorInfo: ErrorInfo) => Promise<void> }> = [];
  private static instance: ErrorLoggingManager;

  private constructor() {
    // 기본 로거들 등록
    this.addLogger(new ConsoleLogger());
    this.addLogger(new DatabaseLogger());

    if (process.env.NODE_ENV === 'development') {
      this.addLogger(new FileLogger('./logs/error.log'));
    }
  }

  public static getInstance(): ErrorLoggingManager {
    if (!ErrorLoggingManager.instance) {
      ErrorLoggingManager.instance = new ErrorLoggingManager();
    }
    return ErrorLoggingManager.instance;
  }

  public addLogger(logger: { logError: (errorInfo: ErrorInfo) => Promise<void> }): void {
    this.loggers.push(logger);
  }

  public async logError(errorInfo: ErrorInfo): Promise<void> {
    // 모든 로거에 병렬로 로깅
    const logPromises = this.loggers.map(logger =>
      logger.logError(errorInfo).catch(error =>
        console.error('Logger failed:', error)
      )
    );

    await Promise.all(logPromises);
  }

  public getDatabaseLogger(): DatabaseLogger {
    const dbLogger = this.loggers.find(logger => logger instanceof DatabaseLogger);
    return dbLogger as DatabaseLogger || new DatabaseLogger();
  }
}

// 싱글톤 인스턴스 내보내기
export const errorLoggingManager = ErrorLoggingManager.getInstance();