import { NextRequest, NextResponse } from 'next/server';
import { getHealthStatus, checkDatabaseHealth, getConnectionPoolStatus } from '@/lib/monitoring';
import { logger } from '@/lib/logger';

// Basic health check endpoint
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Set correlation ID from headers
    const correlationId = request.headers.get('x-correlation-id') ||
                         `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.setCorrelationId(correlationId);

    logger.info('헬스체크 요청 시작');

    // Get comprehensive health status
    const healthStatus = await getHealthStatus();

    // Additional system information
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // Database connection pool details
    const poolStatus = await getConnectionPoolStatus();

    const responseTime = Date.now() - startTime;

    const response = {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      uptime: healthStatus.uptime,
      version: healthStatus.version,
      responseTime: responseTime,
      checks: {
        database: {
          status: healthStatus.database.status,
          responseTime: healthStatus.database.responseTime,
          connectionPool: {
            active: poolStatus.active,
            idle: poolStatus.idle,
            total: poolStatus.total,
            limit: poolStatus.limit,
            utilizationPercent: Math.round((poolStatus.total / poolStatus.limit) * 100)
          },
          error: healthStatus.database.error
        },
        memory: {
          status: healthStatus.memory.usage < 500 ? 'healthy' : 'warning', // 500MB threshold
          usage: healthStatus.memory.usage,
          heap: healthStatus.memory.heap,
          external: healthStatus.memory.external,
          limit: 1024 // 1GB soft limit
        },
        system: {
          status: 'healthy',
          ...systemInfo
        }
      },
      correlationId
    };

    // Determine HTTP status code based on health
    const httpStatus = healthStatus.status === 'healthy' ? 200 :
                      healthStatus.status === 'degraded' ? 200 : 503;

    logger.info(`헬스체크 완료: ${healthStatus.status}`, {
      status: healthStatus.status,
      responseTime,
      dbStatus: healthStatus.database.status,
      memoryUsage: healthStatus.memory.usage
    });

    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        'x-correlation-id': correlationId,
        'cache-control': 'no-cache, no-store, must-revalidate',
        'content-type': 'application/json; charset=utf-8'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('헬스체크 실패', error instanceof Error ? error : new Error(errorMessage), {
      responseTime,
      type: 'health_check_error'
    });

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: '헬스체크를 수행할 수 없습니다',
      details: errorMessage,
      responseTime,
      correlationId: request.headers.get('x-correlation-id')
    }, {
      status: 503,
      headers: {
        'cache-control': 'no-cache, no-store, must-revalidate',
        'content-type': 'application/json; charset=utf-8'
      }
    });
  } finally {
    logger.clearCorrelationId();
  }
}

// Detailed health check with more comprehensive checks
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const correlationId = request.headers.get('x-correlation-id') ||
                         `health_detailed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.setCorrelationId(correlationId);

    logger.info('상세 헬스체크 요청 시작');

    // Get basic health status
    const healthStatus = await getHealthStatus();

    // Perform additional detailed checks
    const detailedChecks = await performDetailedChecks();

    const responseTime = Date.now() - startTime;

    const response = {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      uptime: healthStatus.uptime,
      version: healthStatus.version,
      responseTime: responseTime,
      basicChecks: {
        database: healthStatus.database,
        memory: healthStatus.memory
      },
      detailedChecks,
      correlationId
    };

    // Overall status based on all checks
    const hasFailures = Object.values(detailedChecks).some(check => check.status !== 'healthy');
    const overallStatus = hasFailures ? 'degraded' : healthStatus.status;

    const httpStatus = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    logger.info(`상세 헬스체크 완료: ${overallStatus}`, {
      status: overallStatus,
      responseTime,
      checksPerformed: Object.keys(detailedChecks).length
    });

    return NextResponse.json({
      ...response,
      status: overallStatus
    }, {
      status: httpStatus,
      headers: {
        'x-correlation-id': correlationId,
        'cache-control': 'no-cache, no-store, must-revalidate',
        'content-type': 'application/json; charset=utf-8'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('상세 헬스체크 실패', error instanceof Error ? error : new Error(errorMessage), {
      responseTime,
      type: 'detailed_health_check_error'
    });

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: '상세 헬스체크를 수행할 수 없습니다',
      details: errorMessage,
      responseTime,
      correlationId: request.headers.get('x-correlation-id')
    }, {
      status: 503,
      headers: {
        'cache-control': 'no-cache, no-store, must-revalidate',
        'content-type': 'application/json; charset=utf-8'
      }
    });
  } finally {
    logger.clearCorrelationId();
  }
}

// Perform detailed system checks
async function performDetailedChecks() {
  const checks: Record<string, any> = {};

  // Database table accessibility check (Supabase)
  try {
    const dbCheck = await checkDatabaseHealth();
    const { db } = await import('@/lib/db-unified');

    // Test key tables using Supabase client
    const tableChecks = await Promise.allSettled([
      db.query('SELECT COUNT(*) as count FROM items LIMIT 1'),
      db.query('SELECT COUNT(*) as count FROM companies LIMIT 1'),
      db.query('SELECT COUNT(*) as count FROM inventory_transactions LIMIT 1'),
      db.query('SELECT COUNT(*) as count FROM boms LIMIT 1')
    ]);

    const failedTables = tableChecks.filter(result => 
      result.status === 'rejected' || 
      (result.status === 'fulfilled' && !result.value.success)
    ).length;

    checks.databaseTables = {
      status: failedTables === 0 ? 'healthy' : 'unhealthy',
      tablesChecked: tableChecks.length,
      failedTables,
      responseTime: dbCheck.responseTime || 0
    };
  } catch (error) {
    checks.databaseTables = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // File system check (logs directory)
  try {
    const fs = await import('fs');
    const path = await import('path');
    const logsDir = path.join(process.cwd(), 'logs');

    const canWrite = fs.existsSync(logsDir) || (() => {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
        return true;
      } catch {
        return false;
      }
    })();

    checks.filesystem = {
      status: canWrite ? 'healthy' : 'unhealthy',
      logsDirectory: logsDir,
      writable: canWrite
    };
  } catch (error) {
    checks.filesystem = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Environment variables check (Supabase)
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

  checks.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    requiredVariables: requiredEnvVars.length,
    missingVariables: missingEnvVars,
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseType: 'supabase'
  };

  return checks;
}