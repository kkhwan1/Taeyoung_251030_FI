/**
 * 구조화된 로깅 시스템
 */
export interface LogContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  correlationId?: string | null;
  context?: LogContext;
  error?: {
    message?: string;
    stack?: string;
  };
}

export class Logger {
  private static instance: Logger;
  private correlationId: string | null = null;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  clearCorrelationId(): void {
    this.correlationId = null;
  }

  private formatLog(level: LogEntry['level'], message: string, context?: LogContext, error?: Error): string {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      context
    };

    if (error) {
      logEntry.error = {
        message: error.message,
        stack: error.stack
      };
    }

    return JSON.stringify(logEntry);
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog('warn', message, context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    console.error(this.formatLog('error', message, context, error));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatLog('debug', message, context));
    }
  }

  /**
   * API 요청 로깅
   */
  logRequest(method: string, endpoint: string, duration: number, statusCode: number, context?: LogContext): void {
    this.info('API Request', {
      method,
      endpoint,
      duration,
      statusCode,
      ...context
    });
  }

  /**
   * API 에러 로깅
   */
  logAPIError(endpoint: string, error: Error, context?: LogContext): void {
    this.error('API Error', error, {
      endpoint,
      ...context
    });
  }

  /**
   * 데이터베이스 쿼리 로깅
   */
  logDBQuery(query: string, duration: number, context?: LogContext): void {
    this.debug('DB Query', {
      query: query.substring(0, 200), // 쿼리를 200자로 제한
      duration,
      ...context
    });
  }
}

export const logger = Logger.getInstance();
