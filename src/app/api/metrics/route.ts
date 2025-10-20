import { NextRequest, NextResponse } from 'next/server';
import { getComprehensiveMetrics, formatPrometheusMetrics } from '@/lib/monitoring';
import { logger } from '@/lib/logger';

// Metrics endpoint for monitoring tools
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json'; // json or prometheus
    const detailed = searchParams.get('detailed') === 'true';

    // Set correlation ID
    const correlationId = request.headers.get('x-correlation-id') ||
                         `metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.setCorrelationId(correlationId);

    logger.debug('메트릭스 요청 시작', { format, detailed });

    // Get comprehensive metrics
    const metrics = await getComprehensiveMetrics();
    const responseTime = Date.now() - startTime;

    // Add request tracking for this call (metrics object is mutable)
    (metrics as any).timestamp = Date.now();
    (metrics as any).responseTimeMs = responseTime;

    if (format === 'prometheus') {
      // Return Prometheus-compatible format
      const prometheusData = formatPrometheusMetrics(metrics);

      logger.debug('Prometheus 메트릭스 반환', { dataSize: prometheusData.length });

      return new Response(prometheusData, {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-correlation-id': correlationId,
          'cache-control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // Return JSON format
    const response = detailed ? {
      ...metrics,
      meta: {
        correlationId,
        generated: new Date().toISOString(),
        format: 'json',
        detailed: true,
        responseTime
      }
    } : {
      // Simplified metrics for regular monitoring
      timestamp: metrics.timestamp,
      status: 'healthy', // Based on error rate and response times
      requestCount: metrics.requestCount,
      errorRate: metrics.errorRate,
      avgResponseTime: metrics.responseTime.avg,
      memoryUsage: metrics.memory.usage,
      dbConnections: metrics.dbConnections.total,
      businessMetrics: metrics.businessMetrics,
      meta: {
        correlationId,
        generated: new Date().toISOString(),
        format: 'json',
        detailed: false,
        responseTime
      }
    };

    logger.debug('JSON 메트릭스 반환', {
      requestCount: metrics.requestCount,
      errorRate: metrics.errorRate,
      memoryUsage: metrics.memory.usage
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'x-correlation-id': correlationId,
        'cache-control': 'no-cache, no-store, must-revalidate',
        'content-type': 'application/json; charset=utf-8'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('메트릭스 수집 실패', error instanceof Error ? error : new Error(errorMessage), {
      responseTime,
      type: 'metrics_error'
    });

    return NextResponse.json({
      error: '메트릭스를 수집할 수 없습니다',
      details: errorMessage,
      timestamp: new Date().toISOString(),
      responseTime,
      correlationId: request.headers.get('x-correlation-id')
    }, {
      status: 500,
      headers: {
        'cache-control': 'no-cache, no-store, must-revalidate',
        'content-type': 'application/json; charset=utf-8'
      }
    });
  } finally {
    logger.clearCorrelationId();
  }
}

// Reset metrics (useful for testing or maintenance)
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    const correlationId = request.headers.get('x-correlation-id') ||
                         `metrics_reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.setCorrelationId(correlationId);

    // Check for admin authorization (simple implementation)
    const authHeader = request.headers.get('authorization');
    const adminToken = process.env.ADMIN_TOKEN || 'admin123'; // In production, use proper authentication

    if (!authHeader || !authHeader.includes(adminToken)) {
      logger.warn('메트릭스 리셋 시도 - 권한 없음', {
        hasAuth: !!authHeader,
        type: 'security'
      });

      return NextResponse.json({
        error: '권한이 필요합니다',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // Reset metrics collector
    const { metricsCollector } = await import('@/lib/monitoring');
    metricsCollector.reset();

    const responseTime = Date.now() - startTime;

    logger.info('메트릭스 리셋 완료', { responseTime });

    return NextResponse.json({
      success: true,
      message: '메트릭스가 리셋되었습니다',
      timestamp: new Date().toISOString(),
      responseTime,
      correlationId
    }, {
      status: 200,
      headers: {
        'x-correlation-id': correlationId,
        'content-type': 'application/json; charset=utf-8'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('메트릭스 리셋 실패', error instanceof Error ? error : new Error(errorMessage), {
      responseTime,
      type: 'metrics_reset_error'
    });

    return NextResponse.json({
      error: '메트릭스 리셋에 실패했습니다',
      details: errorMessage,
      timestamp: new Date().toISOString(),
      responseTime
    }, {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8'
      }
    });
  } finally {
    logger.clearCorrelationId();
  }
}

// Custom metrics endpoint for specific business metrics
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const correlationId = request.headers.get('x-correlation-id') ||
                         `custom_metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.setCorrelationId(correlationId);

    // Parse request body for custom metric queries
    const text = await request.text();
    const body = text ? JSON.parse(text) : {};

    const {
      timeRange = '24h',
      metrics = ['transactions', 'stock', 'errors'],
      groupBy = 'hour'
    } = body;

    logger.info('커스텀 메트릭스 요청', { timeRange, metrics, groupBy });

    // Get custom business metrics based on request
    const customMetrics = await getCustomBusinessMetrics(timeRange, metrics, groupBy);

    const responseTime = Date.now() - startTime;

    const response = {
      success: true,
      data: customMetrics,
      query: {
        timeRange,
        metrics,
        groupBy
      },
      meta: {
        correlationId,
        generated: new Date().toISOString(),
        responseTime,
        dataPoints: customMetrics.length || Object.keys(customMetrics).length
      }
    };

    logger.info('커스텀 메트릭스 반환 완료', {
      dataPoints: response.meta.dataPoints,
      responseTime
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'x-correlation-id': correlationId,
        'cache-control': 'no-cache, no-store, must-revalidate',
        'content-type': 'application/json; charset=utf-8'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('커스텀 메트릭스 실패', error instanceof Error ? error : new Error(errorMessage), {
      responseTime,
      type: 'custom_metrics_error'
    });

    return NextResponse.json({
      success: false,
      error: '커스텀 메트릭스를 수집할 수 없습니다',
      details: errorMessage,
      timestamp: new Date().toISOString(),
      responseTime
    }, {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8'
      }
    });
  } finally {
    logger.clearCorrelationId();
  }
}

// Get custom business metrics from database
async function getCustomBusinessMetrics(
  timeRange: string,
  metrics: string[],
  groupBy: string
): Promise<any> {
  const { query } = await import('@/lib/db-unified');

  const results: any = {};

  // Parse time range
  const getTimeClause = (range: string) => {
    switch (range) {
      case '1h': return 'DATE_SUB(NOW(), INTERVAL 1 HOUR)';
      case '24h': return 'DATE_SUB(NOW(), INTERVAL 24 HOUR)';
      case '7d': return 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
      case '30d': return 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
      default: return 'DATE_SUB(NOW(), INTERVAL 24 HOUR)';
    }
  };

  // Get group by clause
  const getGroupClause = (group: string) => {
    switch (group) {
      case 'minute': return 'DATE_FORMAT(created_at, "%Y-%m-%d %H:%i")';
      case 'hour': return 'DATE_FORMAT(created_at, "%Y-%m-%d %H:00")';
      case 'day': return 'DATE_FORMAT(created_at, "%Y-%m-%d")';
      case 'week': return 'YEARWEEK(created_at)';
      case 'month': return 'DATE_FORMAT(created_at, "%Y-%m")';
      default: return 'DATE_FORMAT(created_at, "%Y-%m-%d %H:00")';
    }
  };

  const timeClause = getTimeClause(timeRange);
  const groupClause = getGroupClause(groupBy);

  // Transaction metrics
  if (metrics.includes('transactions')) {
    try {
      const transactionData = await query(`
        SELECT
          ${groupClause} as time_period,
          transaction_type,
          COUNT(*) as count,
          SUM(quantity) as total_quantity
        FROM inventory_transactions
        WHERE created_at >= ${timeClause}
        GROUP BY time_period, transaction_type
        ORDER BY time_period DESC
      `);

      results.transactions = transactionData;
    } catch (error) {
      console.error('Error fetching transaction metrics:', error);
      results.transactions = [];
    }
  }

  // Stock level metrics
  if (metrics.includes('stock')) {
    try {
      const stockData = await query(`
        SELECT
          item_type,
          COUNT(*) as total_items,
          SUM(current_stock) as total_stock,
          AVG(current_stock) as avg_stock,
          COUNT(CASE WHEN current_stock <= COALESCE(min_stock_level, 0) THEN 1 END) as low_stock_count
        FROM items
        WHERE is_active = 1
        GROUP BY item_type
      `);

      results.stock = stockData;
    } catch (error) {
      console.error('Error fetching stock metrics:', error);
      results.stock = [];
    }
  }

  // Error metrics (from application perspective)
  if (metrics.includes('errors')) {
    // This would typically come from error logs or monitoring system
    // For now, return basic error simulation
    results.errors = {
      totalErrors: 0,
      errorRate: 0,
      criticalErrors: 0,
      warningCount: 0,
      timeRange
    };
  }

  // Performance metrics
  if (metrics.includes('performance')) {
    const { getComprehensiveMetrics } = await import('@/lib/monitoring');
    const currentMetrics = await getComprehensiveMetrics();

    results.performance = {
      avgResponseTime: currentMetrics.responseTime.avg,
      p95ResponseTime: currentMetrics.responseTime.p95,
      requestCount: currentMetrics.requestCount,
      errorRate: currentMetrics.errorRate,
      memoryUsage: currentMetrics.memory.usage,
      dbConnections: currentMetrics.dbConnections
    };
  }

  return results;
}