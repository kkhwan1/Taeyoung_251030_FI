import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  userId?: number;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logDirectory: string;
  maxFileSize: number; // MB
  correlationHeader: string;
}

class Logger {
  private config: LoggerConfig;
  private correlationId: string | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: true,
      logDirectory: join(process.cwd(), 'logs'),
      maxFileSize: 10, // 10MB
      correlationHeader: 'x-correlation-id',
      ...config
    };

    // Ensure log directory exists
    if (this.config.enableFile && !existsSync(this.config.logDirectory)) {
      mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  // Set correlation ID for request tracking
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  // Clear correlation ID
  clearCorrelationId(): void {
    this.correlationId = null;
  }

  // Create log entry
  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      correlationId: this.correlationId || undefined,
      metadata
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return entry;
  }

  // Format log entry for console
  private formatConsoleLog(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleString('ko-KR');
    const correlation = entry.correlationId ? ` [${entry.correlationId}]` : '';
    const duration = entry.duration ? ` (${entry.duration}ms)` : '';

    let logString = `${timestamp} [${entry.level}]${correlation} ${entry.message}${duration}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      logString += ` | ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      logString += `\nError: ${entry.error.message}`;
      if (entry.error.stack) {
        logString += `\nStack: ${entry.error.stack}`;
      }
    }

    return logString;
  }

  // Format log entry for file (JSON)
  private formatFileLog(entry: LogEntry): string {
    return JSON.stringify(entry) + '\n';
  }

  // Get log file path
  private getLogFilePath(level: string): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return join(this.config.logDirectory, `${level.toLowerCase()}-${date}.log`);
  }

  // Write to file
  private writeToFile(entry: LogEntry): void {
    if (!this.config.enableFile) return;

    try {
      const filePath = this.getLogFilePath(entry.level);
      const logLine = this.formatFileLog(entry);

      // Check if file exists and create if not
      if (!existsSync(filePath)) {
        writeFileSync(filePath, logLine);
      } else {
        appendFileSync(filePath, logLine);
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // Main logging method
  private log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (level < this.config.level) return;

    const entry = this.createLogEntry(level, message, metadata, error);

    // Console output
    if (this.config.enableConsole) {
      const formattedLog = this.formatConsoleLog(entry);

      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedLog);
          break;
        case LogLevel.INFO:
          console.info(formattedLog);
          break;
        case LogLevel.WARN:
          console.warn(formattedLog);
          break;
        case LogLevel.ERROR:
          console.error(formattedLog);
          break;
      }
    }

    // File output
    this.writeToFile(entry);
  }

  // Public logging methods
  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  // Request logging
  logRequest(method: string, url: string, statusCode: number, duration: number, userId?: number): void {
    const message = `${method} ${url} ${statusCode}`;
    const metadata = {
      method,
      url,
      statusCode,
      duration,
      userId,
      type: 'request'
    };

    if (statusCode >= 400) {
      this.warn(message, metadata);
    } else {
      this.info(message, metadata);
    }
  }

  // Database operation logging
  logDbOperation(operation: string, table: string, duration: number, rowsAffected?: number): void {
    const message = `DB ${operation} on ${table}`;
    const metadata = {
      operation,
      table,
      duration,
      rowsAffected,
      type: 'database'
    };

    if (duration > 1000) {
      this.warn(`Slow ${message} (${duration}ms)`, metadata);
    } else {
      this.debug(message, metadata);
    }
  }

  // Business operation logging (Korean support)
  logBusinessOperation(operation: string, entity: string, entityId: number, userId?: number, details?: Record<string, any>): void {
    const message = `비즈니스 작업: ${operation} - ${entity} (ID: ${entityId})`;
    const metadata = {
      operation,
      entity,
      entityId,
      userId,
      details,
      type: 'business'
    };

    this.info(message, metadata);
  }

  // Security event logging
  logSecurityEvent(event: string, userId?: number, ipAddress?: string, details?: Record<string, any>): void {
    const message = `보안 이벤트: ${event}`;
    const metadata = {
      event,
      userId,
      ipAddress,
      details,
      type: 'security'
    };

    this.warn(message, metadata);
  }

  // Performance logging
  logPerformance(operation: string, duration: number, threshold: number = 1000): void {
    const message = `성능 측정: ${operation} (${duration}ms)`;
    const metadata = {
      operation,
      duration,
      threshold,
      type: 'performance'
    };

    if (duration > threshold) {
      this.warn(`성능 임계값 초과: ${message}`, metadata);
    } else {
      this.debug(message, metadata);
    }
  }

  // Error with context
  logErrorWithContext(message: string, error: Error, context: Record<string, any>): void {
    this.error(message, error, { ...context, type: 'error' });
  }

  // Critical system events
  logCritical(message: string, metadata?: Record<string, any>): void {
    const criticalMetadata = {
      ...metadata,
      type: 'critical',
      severity: 'critical'
    };

    this.error(`[CRITICAL] ${message}`, undefined, criticalMetadata);

    // Also log to console regardless of settings
    console.error(`🚨 CRITICAL: ${message}`, criticalMetadata);
  }
}

// Create default logger instance
const defaultLogger = new Logger();

// Export logger instance and utilities
export { Logger, defaultLogger as logger };

// Request correlation middleware
export function createCorrelationMiddleware() {
  return (req: any, res: any, next: any) => {
    // Generate or extract correlation ID
    const correlationId = req.headers['x-correlation-id'] ||
                         req.headers['x-request-id'] ||
                         `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Set correlation ID in logger
    defaultLogger.setCorrelationId(correlationId);

    // Add to response headers
    res.setHeader('x-correlation-id', correlationId);

    // Store in request for access in routes
    req.correlationId = correlationId;

    // Clear correlation ID after request
    res.on('finish', () => {
      defaultLogger.clearCorrelationId();
    });

    next();
  };
}

// Performance monitoring wrapper with logging
export function withLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationName: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();

    try {
      defaultLogger.debug(`Starting operation: ${operationName}`);
      const result = await fn(...args);
      const duration = Date.now() - startTime;

      defaultLogger.logPerformance(operationName, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      defaultLogger.logErrorWithContext(
        `Operation failed: ${operationName}`,
        error instanceof Error ? error : new Error(String(error)),
        { operationName, duration, args: args.map((arg, i) => `arg${i}`) }
      );
      throw error;
    }
  }) as T;
}

// API logging helper
export function logApiCall(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: number,
  error?: Error
): void {
  if (error) {
    defaultLogger.error(
      `API Error: ${method} ${path} ${statusCode}`,
      error,
      { method, path, statusCode, duration, userId, type: 'api' }
    );
  } else {
    defaultLogger.logRequest(method, path, statusCode, duration, userId);
  }
}

// Database logging helper
export function logDbQuery(
  query: string,
  duration: number,
  rowsAffected?: number,
  error?: Error
): void {
  const truncatedQuery = query.length > 100 ? query.substring(0, 100) + '...' : query;

  if (error) {
    defaultLogger.error(
      `DB Query Failed: ${truncatedQuery}`,
      error,
      { query: truncatedQuery, duration, rowsAffected, type: 'database' }
    );
  } else {
    defaultLogger.logDbOperation('QUERY', truncatedQuery, duration, rowsAffected);
  }
}

// Business event logging
export function logBusinessEvent(
  event: string,
  entityType: string,
  entityId: number,
  userId?: number,
  changes?: Record<string, any>
): void {
  defaultLogger.logBusinessOperation(event, entityType, entityId, userId, changes);
}

// System health logging
export function logSystemHealth(metrics: Record<string, any>): void {
  defaultLogger.info('시스템 헬스체크', { ...metrics, type: 'health' });
}

// LogLevel already exported above

// Create logger with custom config
export function createLogger(config: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}