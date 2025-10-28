/**
 * 성능 메트릭 수집 시스템
 */
export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  lastReset: Date;
  endpoints: Record<string, EndpointMetrics>;
}

export interface EndpointMetrics {
  count: number;
  totalTime: number;
  errors: number;
  minTime: number;
  maxTime: number;
  lastRequestTime: number;
}

class MetricsCollector {
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    averageResponseTime: 0,
    errorRate: 0,
    lastReset: new Date(),
    endpoints: {}
  };

  /**
   * 요청 추적
   */
  trackRequest(endpoint: string, responseTime: number, isError: boolean = false): void {
    this.metrics.requestCount++;
    
    if (!this.metrics.endpoints[endpoint]) {
      this.metrics.endpoints[endpoint] = {
        count: 0,
        totalTime: 0,
        errors: 0,
        minTime: Infinity,
        maxTime: 0,
        lastRequestTime: 0
      };
    }

    const endpointMetrics = this.metrics.endpoints[endpoint];
    endpointMetrics.count++;
    endpointMetrics.totalTime += responseTime;
    endpointMetrics.minTime = Math.min(endpointMetrics.minTime, responseTime);
    endpointMetrics.maxTime = Math.max(endpointMetrics.maxTime, responseTime);
    endpointMetrics.lastRequestTime = Date.now();
    
    if (isError) {
      endpointMetrics.errors++;
    }

    // 전체 평균 응답 시간 계산
    const totalTime = Object.values(this.metrics.endpoints)
      .reduce((sum, ep) => sum + ep.totalTime, 0);
    this.metrics.averageResponseTime = totalTime / this.metrics.requestCount;

    // 에러율 계산
    const totalErrors = Object.values(this.metrics.endpoints)
      .reduce((sum, ep) => sum + ep.errors, 0);
    this.metrics.errorRate = (totalErrors / this.metrics.requestCount) * 100;
  }

  /**
   * 메트릭 조회
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 엔드포인트별 메트릭 조회
   */
  getEndpointMetrics(endpoint: string): EndpointMetrics | null {
    return this.metrics.endpoints[endpoint] ? { ...this.metrics.endpoints[endpoint] } : null;
  }

  /**
   * 상위 N개 느린 엔드포인트 조회
   */
  getSlowestEndpoints(limit: number = 10): Array<{ endpoint: string; avgTime: number }> {
    return Object.entries(this.metrics.endpoints)
      .map(([endpoint, metrics]) => ({
        endpoint,
        avgTime: metrics.totalTime / metrics.count
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }

  /**
   * 상위 N개 에러 많은 엔드포인트 조회
   */
  getMostErrorEndpoints(limit: number = 10): Array<{ endpoint: string; errorCount: number; errorRate: number }> {
    return Object.entries(this.metrics.endpoints)
      .filter(([, metrics]) => metrics.errors > 0)
      .map(([endpoint, metrics]) => ({
        endpoint,
        errorCount: metrics.errors,
        errorRate: (metrics.errors / metrics.count) * 100
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, limit);
  }

  /**
   * 메트릭 초기화
   */
  reset(): void {
    this.metrics = {
      requestCount: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastReset: new Date(),
      endpoints: {}
    };
  }

  /**
   * 메트릭 요약
   */
  getSummary() {
    const now = Date.now();
    const uptime = now - this.metrics.lastReset.getTime();

    return {
      uptime: Math.floor(uptime / 1000), // seconds
      totalRequests: this.metrics.requestCount,
      averageResponseTime: Math.round(this.metrics.averageResponseTime),
      errorRate: Math.round(this.metrics.errorRate * 100) / 100,
      endpointCount: Object.keys(this.metrics.endpoints).length,
      requestsPerSecond: this.metrics.requestCount / (uptime / 1000)
    };
  }
}

export const metricsCollector = new MetricsCollector();

/**
 * API 응답 시간 측정 헬퍼
 */
export function withMetrics<T>(
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  return fn()
    .then((result) => {
      const responseTime = Date.now() - startTime;
      metricsCollector.trackRequest(endpoint, responseTime, false);
      return result;
    })
    .catch((error) => {
      const responseTime = Date.now() - startTime;
      metricsCollector.trackRequest(endpoint, responseTime, true);
      throw error;
    });
}

