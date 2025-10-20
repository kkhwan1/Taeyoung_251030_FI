import { testConnection } from './db-unified';

// Performance metrics collection
export interface PerformanceMetrics {
  timestamp: number;
  requestCount: number;
  responseTime: {
    avg: number;
    min: number;
    max: number;
    p95: number;
  };
  errorRate: number;
  dbConnections: {
    active: number;
    idle: number;
    total: number;
  };
  memory: {
    usage: number;
    heap: number;
    external: number;
  };
  businessMetrics: {
    totalItems: number;
    totalCompanies: number;
    totalTransactions: number;
    lowStockItems: number;
  };
}

// In-memory storage for metrics (in production, use Redis or similar)
class MetricsCollector {
  private requestTimes: number[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  // Track request performance
  trackRequest(responseTime: number, isError: boolean = false): void {
    this.requestCount++;
    this.requestTimes.push(responseTime);

    if (isError) {
      this.errorCount++;
    }

    // Keep only last 1000 requests to avoid memory issues
    if (this.requestTimes.length > 1000) {
      this.requestTimes.shift();
    }
  }

  // Get current metrics
  getMetrics(): Omit<PerformanceMetrics, 'dbConnections' | 'businessMetrics'> {
    const times = this.requestTimes.slice();
    times.sort((a, b) => a - b);

    return {
      timestamp: Date.now(),
      requestCount: this.requestCount,
      responseTime: {
        avg: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        min: times.length > 0 ? times[0] : 0,
        max: times.length > 0 ? times[times.length - 1] : 0,
        p95: times.length > 0 ? times[Math.floor(times.length * 0.95)] : 0,
      },
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      memory: {
        usage: process.memoryUsage().rss / 1024 / 1024, // MB
        heap: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        external: process.memoryUsage().external / 1024 / 1024, // MB
      },
    };
  }

  // Reset metrics (useful for testing)
  reset(): void {
    this.requestTimes = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }

  // Get uptime
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Global metrics collector instance
const metricsCollector = new MetricsCollector();

// Database health check
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  connectionCount: number;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Test Supabase connection
    const connectionResult = await testConnection();
    const isHealthy = connectionResult.success;
    const responseTime = Date.now() - startTime;

    return {
      isHealthy,
      connectionCount: 1, // Supabase uses managed connections
      responseTime,
    };
  } catch (error) {
    return {
      isHealthy: false,
      connectionCount: 0,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

// Get database connection pool status
// Note: Supabase uses managed connections, so this returns mock data
export async function getConnectionPoolStatus(): Promise<{
  active: number;
  idle: number;
  total: number;
  limit: number;
}> {
  // Supabase manages connections internally
  return {
    active: 1,
    idle: 0,
    total: 1,
    limit: 100, // Supabase connection limit
  };
}

// Get business metrics from database (Supabase)
export async function getBusinessMetrics(): Promise<{
  totalItems: number;
  totalCompanies: number;
  totalTransactions: number;
  lowStockItems: number;
}> {
  try {
    const { mcp__supabase__execute_sql } = await import('./supabase-mcp');
    const projectId = process.env.SUPABASE_PROJECT_ID || '';

    // Get total items
    const itemsResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: 'SELECT COUNT(*) as count FROM items WHERE is_active = true'
    });

    // Get total companies
    const companiesResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: 'SELECT COUNT(*) as count FROM companies WHERE is_active = true'
    });

    // Get total transactions (last 30 days)
    const transactionsResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: "SELECT COUNT(*) as count FROM inventory_transactions WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'"
    });

    // Get low stock items (items where current stock is below safety stock)
    const lowStockResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: 'SELECT COUNT(*) as count FROM items WHERE is_active = true AND current_stock < safety_stock'
    });

    // Parse results with proper type assertions
    const items = itemsResult.rows as Array<{count: string}> | undefined;
    const companies = companiesResult.rows as Array<{count: string}> | undefined;
    const transactions = transactionsResult.rows as Array<{count: string}> | undefined;
    const lowStock = lowStockResult.rows as Array<{count: string}> | undefined;

    return {
      totalItems: items?.[0] ? parseInt(items[0].count) : 0,
      totalCompanies: companies?.[0] ? parseInt(companies[0].count) : 0,
      totalTransactions: transactions?.[0] ? parseInt(transactions[0].count) : 0,
      lowStockItems: lowStock?.[0] ? parseInt(lowStock[0].count) : 0,
    };
  } catch (error) {
    console.error('Error getting business metrics:', error);
    return {
      totalItems: 0,
      totalCompanies: 0,
      totalTransactions: 0,
      lowStockItems: 0,
    };
  }
}

// Get comprehensive metrics
export async function getComprehensiveMetrics(): Promise<PerformanceMetrics> {
  const basicMetrics = metricsCollector.getMetrics();
  const dbConnections = await getConnectionPoolStatus();
  const businessMetrics = await getBusinessMetrics();

  return {
    ...basicMetrics,
    dbConnections,
    businessMetrics,
  };
}

// Request tracking middleware function
export function createRequestTracker() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Track response
    const originalSend = res.send;
    res.send = function(data: any) {
      const responseTime = Date.now() - startTime;
      const isError = res.statusCode >= 400;

      metricsCollector.trackRequest(responseTime, isError);

      return originalSend.call(this, data);
    };

    next();
  };
}

// Manual request tracking for API routes
export function trackApiRequest(responseTime: number, isError: boolean = false): void {
  metricsCollector.trackRequest(responseTime, isError);
}

// Performance monitoring wrapper
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationName: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    let isError = false;

    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      isError = true;
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      metricsCollector.trackRequest(responseTime, isError);

      // Log slow operations
      if (responseTime > 1000) {
        console.warn(`Slow operation detected: ${operationName} took ${responseTime}ms`);
      }
    }
  }) as T;
}

// Database query performance tracking
export async function trackDbQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let isError = false;

  try {
    const result = await queryFn();
    return result;
  } catch (error) {
    isError = true;
    throw error;
  } finally {
    const queryTime = Date.now() - startTime;

    // Log slow queries
    if (queryTime > 500) {
      console.warn(`Slow database query: ${queryName} took ${queryTime}ms`);
    }

    // Track as request for metrics
    metricsCollector.trackRequest(queryTime, isError);
  }
}

// Health check status
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  database: {
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    connections: number;
    error?: string;
  };
  memory: {
    usage: number;
    heap: number;
    external: number;
  };
  lastCheck: number;
}

// Comprehensive health check
export async function getHealthStatus(): Promise<HealthStatus> {
  const dbHealth = await checkDatabaseHealth();
  const metrics = metricsCollector.getMetrics();

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (!dbHealth.isHealthy) {
    status = 'unhealthy';
  } else if (dbHealth.responseTime > 1000 || metrics.errorRate > 5) {
    status = 'degraded';
  }

  return {
    status,
    uptime: metricsCollector.getUptime(),
    version: process.env.npm_package_version || '0.1.0',
    database: {
      status: dbHealth.isHealthy ? 'healthy' : 'unhealthy',
      responseTime: dbHealth.responseTime,
      connections: dbHealth.connectionCount,
      error: dbHealth.error,
    },
    memory: metrics.memory,
    lastCheck: Date.now(),
  };
}

// Export the metrics collector for external use
export { metricsCollector };

// Prometheus-style metrics formatter
export function formatPrometheusMetrics(metrics: PerformanceMetrics): string {
  const lines: string[] = [];

  // Request metrics
  lines.push(`# HELP http_requests_total Total number of HTTP requests`);
  lines.push(`# TYPE http_requests_total counter`);
  lines.push(`http_requests_total ${metrics.requestCount}`);

  lines.push(`# HELP http_request_duration_seconds HTTP request duration in seconds`);
  lines.push(`# TYPE http_request_duration_seconds summary`);
  lines.push(`http_request_duration_seconds{quantile="0.95"} ${metrics.responseTime.p95 / 1000}`);
  lines.push(`http_request_duration_seconds_sum ${(metrics.responseTime.avg * metrics.requestCount) / 1000}`);
  lines.push(`http_request_duration_seconds_count ${metrics.requestCount}`);

  // Error rate
  lines.push(`# HELP http_error_rate HTTP error rate percentage`);
  lines.push(`# TYPE http_error_rate gauge`);
  lines.push(`http_error_rate ${metrics.errorRate}`);

  // Memory metrics
  lines.push(`# HELP nodejs_memory_usage_bytes Node.js memory usage in bytes`);
  lines.push(`# TYPE nodejs_memory_usage_bytes gauge`);
  lines.push(`nodejs_memory_usage_bytes{type="rss"} ${metrics.memory.usage * 1024 * 1024}`);
  lines.push(`nodejs_memory_usage_bytes{type="heap"} ${metrics.memory.heap * 1024 * 1024}`);
  lines.push(`nodejs_memory_usage_bytes{type="external"} ${metrics.memory.external * 1024 * 1024}`);

  // Database metrics
  lines.push(`# HELP mysql_connections MySQL connection pool status`);
  lines.push(`# TYPE mysql_connections gauge`);
  lines.push(`mysql_connections{state="active"} ${metrics.dbConnections.active}`);
  lines.push(`mysql_connections{state="idle"} ${metrics.dbConnections.idle}`);
  lines.push(`mysql_connections{state="total"} ${metrics.dbConnections.total}`);

  // Business metrics
  lines.push(`# HELP erp_business_metrics ERP business metrics`);
  lines.push(`# TYPE erp_business_metrics gauge`);
  lines.push(`erp_business_metrics{type="items"} ${metrics.businessMetrics.totalItems}`);
  lines.push(`erp_business_metrics{type="companies"} ${metrics.businessMetrics.totalCompanies}`);
  lines.push(`erp_business_metrics{type="transactions"} ${metrics.businessMetrics.totalTransactions}`);
  lines.push(`erp_business_metrics{type="low_stock_items"} ${metrics.businessMetrics.lowStockItems}`);

  return lines.join('\n') + '\n';
}