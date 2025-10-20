// ERP 시스템 쿼리 최적화 유틸리티
// 페이징 최적화, 배치 처리, 캐싱 지원

import { query } from './db-unified';

// =============================================================================
// 1. 쿼리 최적화 유틸리티
// =============================================================================

export interface QueryOptimizationOptions {
  useCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number; // seconds
  enableExplain?: boolean;
  timeout?: number; // milliseconds
  readPreference?: 'primary' | 'secondary';
}

export interface PaginationConfig {
  page: number;
  limit: number;
  orderBy?: string;
  direction?: 'ASC' | 'DESC';
  offset?: number;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  executionTime: number;
  fromCache: boolean;
}

export interface ExplainResult {
  id: number;
  select_type: string;
  table: string;
  partitions?: string;
  type: string;
  possible_keys?: string;
  key?: string;
  key_len?: string;
  ref?: string;
  rows: number;
  filtered: number;
  Extra?: string;
}

// 메모리 캐시 (프로덕션에서는 Redis 사용 권장)
class QueryCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  private maxSize = 1000;

  set(key: string, data: any, ttl: number = 300): void {
    // LRU 방식으로 캐시 크기 관리
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value as string | undefined;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const expiry = Date.now() + (ttl * 1000);
    this.cache.set(key, { data, expiry });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // 만료된 캐시 정리
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

const queryCache = new QueryCache();

// 캐시 정리 작업 (5분마다)
setInterval(() => {
  queryCache.cleanup();
}, 5 * 60 * 1000);

// =============================================================================
// 2. 최적화된 페이징 쿼리
// =============================================================================

export class OptimizedPagination {
  /**
   * 커서 기반 페이징 (대용량 데이터에 적합)
   */
  static async cursorPaginate<T>(
    baseQuery: string,
    countQuery: string,
    params: unknown[],
    config: {
      cursorColumn: string;
      cursorValue?: any;
      limit: number;
      direction?: 'next' | 'prev';
    },
    options: QueryOptimizationOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const cacheKey = options.cacheKey ||
      `cursor_${Buffer.from(baseQuery + JSON.stringify(params) + JSON.stringify(config)).toString('base64')}`;

    // 캐시 확인
    if (options.useCache) {
      const cached = queryCache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          executionTime: Date.now() - startTime,
          fromCache: true
        };
      }
    }

    const { cursorColumn, cursorValue, limit, direction = 'next' } = config;
    let modifiedQuery = baseQuery;
    const modifiedParams = [...params];

    // 커서 조건 추가
    if (cursorValue !== undefined) {
      const operator = direction === 'next' ? '>' : '<';
      const orderDirection = direction === 'next' ? 'ASC' : 'DESC';

      modifiedQuery += ` AND ${cursorColumn} ${operator} ?`;
      modifiedParams.push(cursorValue);

      modifiedQuery += ` ORDER BY ${cursorColumn} ${orderDirection}`;
    } else {
      modifiedQuery += ` ORDER BY ${cursorColumn} ASC`;
    }

    modifiedQuery += ` LIMIT ${limit + 1}`; // +1로 다음 페이지 존재 여부 확인

    const [data, totalResult] = await Promise.all([
      query<T>(modifiedQuery, modifiedParams),
      query<{ total: number }>(countQuery, params)
    ]);

    const total = totalResult[0]?.total || 0;
    const hasMore = data.length > limit;
    const actualData = hasMore ? data.slice(0, limit) : data;

    const result: QueryResult<T> = {
      data: actualData,
      total,
      page: 0, // 커서 기반에서는 page 개념이 다름
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: hasMore && direction === 'next',
      hasPrevPage: cursorValue !== undefined && direction === 'prev',
      executionTime: Date.now() - startTime,
      fromCache: false
    };

    // 캐시 저장
    if (options.useCache) {
      queryCache.set(cacheKey, result, options.cacheTTL || 300);
    }

    return result;
  }

  /**
   * 오프셋 기반 페이징 최적화 (작은 오프셋에 적합)
   */
  static async offsetPaginate<T>(
    baseQuery: string,
    countQuery: string,
    params: unknown[],
    config: PaginationConfig,
    options: QueryOptimizationOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const { page, limit, orderBy, direction = 'ASC' } = config;
    const offset = (page - 1) * limit;

    const cacheKey = options.cacheKey ||
      `offset_${Buffer.from(baseQuery + JSON.stringify(params) + JSON.stringify(config)).toString('base64')}`;

    // 캐시 확인
    if (options.useCache) {
      const cached = queryCache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          executionTime: Date.now() - startTime,
          fromCache: true
        };
      }
    }

    // 큰 오프셋 최적화
    let optimizedQuery = baseQuery;
    const optimizedParams = [...params];

    if (offset > 10000 && orderBy) {
      // 서브쿼리를 사용한 오프셋 최적화
      optimizedQuery = `
        SELECT * FROM (${baseQuery}) AS t1
        WHERE t1.${orderBy} >= (
          SELECT ${orderBy} FROM (${baseQuery}) AS t2
          ORDER BY ${orderBy} ${direction}
          LIMIT 1 OFFSET ${offset}
        )
        ORDER BY t1.${orderBy} ${direction}
        LIMIT ${limit}
      `;
    } else {
      if (orderBy) {
        optimizedQuery += ` ORDER BY ${orderBy} ${direction}`;
      }
      optimizedQuery += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const [data, totalResult] = await Promise.all([
      query<T>(optimizedQuery, optimizedParams),
      query<{ total: number }>(countQuery, params)
    ]);

    const total = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const result: QueryResult<T> = {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      executionTime: Date.now() - startTime,
      fromCache: false
    };

    // 캐시 저장
    if (options.useCache) {
      queryCache.set(cacheKey, result, options.cacheTTL || 300);
    }

    return result;
  }
}

// =============================================================================
// 3. 배치 처리 유틸리티
// =============================================================================

export class BatchProcessor {
  /**
   * 배치 INSERT 최적화
   */
  static async batchInsert<T>(
    tableName: string,
    columns: string[],
    data: T[][],
    options: {
      batchSize?: number;
      onProgress?: (processed: number, total: number) => void;
      ignoreDuplicates?: boolean;
    } = {}
  ): Promise<{ inserted: number; errors: any[] }> {
    const { batchSize = 1000, onProgress, ignoreDuplicates = false } = options;
    const insertType = ignoreDuplicates ? 'INSERT IGNORE' : 'INSERT';

    let totalInserted = 0;
    const errors: any[] = [];
    const placeholders = `(${columns.map(() => '?').join(', ')})`;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchPlaceholders = batch.map(() => placeholders).join(', ');
      const flatValues = batch.flat();

      const sql = `${insertType} INTO ${tableName} (${columns.join(', ')}) VALUES ${batchPlaceholders}`;

      try {
        const result = await query(sql, flatValues) as any;
        totalInserted += result.affectedRows || batch.length;

        if (onProgress) {
          onProgress(Math.min(i + batchSize, data.length), data.length);
        }
      } catch (error) {
        errors.push({
          batch: i / batchSize + 1,
          error: error instanceof Error ? error.message : error,
          data: batch
        });
      }
    }

    return { inserted: totalInserted, errors };
  }

  /**
   * 배치 UPDATE 최적화
   */
  static async batchUpdate<T extends Record<string, any>>(
    tableName: string,
    updates: T[],
    keyColumn: string,
    options: {
      batchSize?: number;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<{ updated: number; errors: any[] }> {
    const { batchSize = 500, onProgress } = options;

    let totalUpdated = 0;
    const errors: any[] = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      try {
        // CASE WHEN 구문을 사용한 배치 업데이트
        const updateColumns = Object.keys(batch[0]).filter(col => col !== keyColumn);
        const keyValues = batch.map(item => item[keyColumn]);

        // Simple SQL escaping for values (basic implementation)
        const escapeValue = (val: any): string => {
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return String(val);
          return `'${String(val).replace(/'/g, "''")}'`;
        };

        const setClauses = updateColumns.map(column => {
          const cases = batch.map(item =>
            `WHEN ${keyColumn} = ${escapeValue(item[keyColumn])} THEN ${escapeValue(item[column])}`
          ).join(' ');
          return `${column} = CASE ${cases} ELSE ${column} END`;
        });

        const sql = `
          UPDATE ${tableName}
          SET ${setClauses.join(', ')}
          WHERE ${keyColumn} IN (${keyValues.map(v => escapeValue(v)).join(', ')})
        `;

        const result = await query(sql) as any;
        totalUpdated += result.affectedRows || 0;

        if (onProgress) {
          onProgress(Math.min(i + batchSize, updates.length), updates.length);
        }
      } catch (error) {
        errors.push({
          batch: i / batchSize + 1,
          error: error instanceof Error ? error.message : error,
          data: batch
        });
      }
    }

    return { updated: totalUpdated, errors };
  }
}

// =============================================================================
// 4. 쿼리 분석 및 최적화 도구
// =============================================================================

export class QueryAnalyzer {
  /**
   * 쿼리 실행 계획 분석
   */
  static async explainQuery(sql: string, params: unknown[] = []): Promise<ExplainResult[]> {
    const explainSql = `EXPLAIN ${sql}`;
    return await query<ExplainResult>(explainSql, params);
  }

  /**
   * 쿼리 성능 분석
   */
  static async analyzeQueryPerformance(
    sql: string,
    params: unknown[] = [],
    iterations: number = 5
  ): Promise<{
    avgExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    explainPlan: ExplainResult[];
    recommendations: string[];
  }> {
    const executionTimes: number[] = [];

    // 여러 번 실행하여 평균 성능 측정
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await query(sql, params);
      executionTimes.push(Date.now() - startTime);
    }

    const explainPlan = await this.explainQuery(sql, params);
    const recommendations = this.generateRecommendations(explainPlan);

    return {
      avgExecutionTime: executionTimes.reduce((a, b) => a + b, 0) / iterations,
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      explainPlan,
      recommendations
    };
  }

  /**
   * 쿼리 최적화 제안 생성
   */
  private static generateRecommendations(explainPlan: ExplainResult[]): string[] {
    const recommendations: string[] = [];

    for (const step of explainPlan) {
      // 풀 테이블 스캔 감지
      if (step.type === 'ALL') {
        recommendations.push(`테이블 '${step.table}'에서 풀 스캔이 발생합니다. 인덱스 추가를 고려하세요.`);
      }

      // 높은 행 수 감지
      if (step.rows > 10000) {
        recommendations.push(`테이블 '${step.table}'에서 ${step.rows}행을 검사합니다. WHERE 조건을 추가하거나 인덱스를 최적화하세요.`);
      }

      // 임시 테이블 사용 감지
      if (step.Extra?.includes('Using temporary')) {
        recommendations.push(`임시 테이블이 사용됩니다. GROUP BY나 ORDER BY 절을 최적화하세요.`);
      }

      // 파일 정렬 감지
      if (step.Extra?.includes('Using filesort')) {
        recommendations.push(`파일 정렬이 발생합니다. ORDER BY에 적절한 인덱스를 추가하세요.`);
      }

      // 인덱스 조건 미사용 감지
      if (step.key === null && step.possible_keys) {
        recommendations.push(`가능한 인덱스가 있지만 사용되지 않습니다. 쿼리 조건을 검토하세요.`);
      }
    }

    return recommendations;
  }

  /**
   * 슬로우 쿼리 탐지
   */
  static async detectSlowQueries(thresholdMs: number = 1000): Promise<any[]> {
    const sql = `
      SELECT
        sql_text,
        exec_count,
        avg_timer_wait / 1000000000 as avg_time_ms,
        max_timer_wait / 1000000000 as max_time_ms,
        sum_timer_wait / 1000000000 as total_time_ms,
        sum_rows_examined,
        sum_rows_sent,
        digest
      FROM performance_schema.events_statements_summary_by_digest
      WHERE avg_timer_wait / 1000000000 > ?
      ORDER BY avg_timer_wait DESC
      LIMIT 20
    `;

    try {
      return await query(sql, [thresholdMs]);
    } catch (error) {
      console.warn('Performance schema를 사용할 수 없습니다:', error);
      return [];
    }
  }
}

// =============================================================================
// 5. ERP 특화 쿼리 최적화
// =============================================================================

export class ERPQueryOptimizer {
  /**
   * 재고 계산 최적화 (뷰 사용 권장)
   */
  static async getOptimizedStockLevels(
    itemIds?: number[],
    categories?: string[],
    options: QueryOptimizationOptions = {}
  ): Promise<any[]> {
    const whereConditions: string[] = [];
    const params: unknown[] = [];

    if (itemIds && itemIds.length > 0) {
      whereConditions.push(`item_id IN (${itemIds.map(() => '?').join(', ')})`);
      params.push(...itemIds);
    }

    if (categories && categories.length > 0) {
      whereConditions.push(`category IN (${categories.map(() => '?').join(', ')})`);
      params.push(...categories);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 최적화된 뷰 사용
    const sql = `
      SELECT *
      FROM current_stock
      ${whereClause}
      ORDER BY stock_status DESC, item_code
    `;

    const result = await query(sql, params);
    return result as any[];
  }

  /**
   * 대시보드 KPI 최적화
   */
  static async getDashboardKPIs(options: QueryOptimizationOptions = {}): Promise<any> {
    const cacheKey = 'dashboard_kpis';

    if (options.useCache) {
      const cached = queryCache.get(cacheKey);
      if (cached) return cached;
    }

    // 최적화된 뷰 사용
    const result = await query('SELECT * FROM dashboard_kpi');
    const kpis = result[0] as any;

    if (options.useCache) {
      queryCache.set(cacheKey, kpis, options.cacheTTL || 60); // 1분 캐시
    }

    return kpis;
  }

  /**
   * 거래 이력 페이징 최적화
   */
  static async getOptimizedTransactionHistory(
    filters: {
      itemId?: number;
      companyId?: number;
      transactionType?: string;
      startDate?: string;
      endDate?: string;
    },
    pagination: PaginationConfig,
    options: QueryOptimizationOptions = {}
  ): Promise<QueryResult<any>> {
    let baseQuery = `
      SELECT
        it.*,
        i.item_code,
        i.item_name,
        c.company_name
      FROM inventory_transactions it
      USE INDEX (idx_inventory_date_item_type)
      JOIN items i ON it.item_id = i.item_id
      LEFT JOIN companies c ON it.company_id = c.company_id
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM inventory_transactions it
      USE INDEX (idx_inventory_date_item_type)
      WHERE 1=1
    `;

    const params: unknown[] = [];

    // 필터 조건 추가
    if (filters.itemId) {
      const condition = ' AND it.item_id = ?';
      baseQuery += condition;
      countQuery += condition;
      params.push(filters.itemId);
    }

    if (filters.companyId) {
      const condition = ' AND it.company_id = ?';
      baseQuery += condition;
      countQuery += condition;
      params.push(filters.companyId);
    }

    if (filters.transactionType) {
      const condition = ' AND it.transaction_type = ?';
      baseQuery += condition;
      countQuery += condition;
      params.push(filters.transactionType);
    }

    if (filters.startDate) {
      const condition = ' AND it.transaction_date >= ?';
      baseQuery += condition;
      countQuery += condition;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      const condition = ' AND it.transaction_date <= ?';
      baseQuery += condition;
      countQuery += condition;
      params.push(filters.endDate);
    }

    // 최적화된 페이징 사용
    return await OptimizedPagination.offsetPaginate(
      baseQuery,
      countQuery,
      params,
      { ...pagination, orderBy: 'it.transaction_date' },
      { ...options, cacheKey: `transactions_${JSON.stringify(filters)}_${JSON.stringify(pagination)}` }
    );
  }
}

// =============================================================================
// 6. 모니터링 및 통계
// =============================================================================

export class QueryMonitor {
  private static queryStats = new Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    lastExecuted: Date;
  }>();

  /**
   * 쿼리 실행 통계 수집
   */
  static recordQuery(queryHash: string, executionTime: number): void {
    const existing = this.queryStats.get(queryHash) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      lastExecuted: new Date()
    };

    existing.count += 1;
    existing.totalTime += executionTime;
    existing.avgTime = existing.totalTime / existing.count;
    existing.lastExecuted = new Date();

    this.queryStats.set(queryHash, existing);
  }

  /**
   * 쿼리 통계 조회
   */
  static getQueryStats(): Array<{
    queryHash: string;
    count: number;
    totalTime: number;
    avgTime: number;
    lastExecuted: Date;
  }> {
    return Array.from(this.queryStats.entries()).map(([queryHash, stats]) => ({
      queryHash,
      ...stats
    }));
  }

  /**
   * 캐시 통계 조회
   */
  static getCacheStats(): {
    size: number;
    hitRate?: number;
  } {
    return {
      size: queryCache.size()
    };
  }

  /**
   * 성능 리포트 생성
   */
  static generatePerformanceReport(): {
    slowQueries: any[];
    cacheStats: any;
    queryStats: any[];
    recommendations: string[];
  } {
    const queryStats = this.getQueryStats();
    const slowQueries = queryStats
      .filter(q => q.avgTime > 1000)
      .sort((a, b) => b.avgTime - a.avgTime);

    const recommendations: string[] = [];

    if (slowQueries.length > 0) {
      recommendations.push(`${slowQueries.length}개의 느린 쿼리가 감지되었습니다.`);
    }

    const highFrequencyQueries = queryStats
      .filter(q => q.count > 100)
      .sort((a, b) => b.count - a.count);

    if (highFrequencyQueries.length > 0) {
      recommendations.push('자주 실행되는 쿼리에 대해 캐싱을 고려하세요.');
    }

    return {
      slowQueries,
      cacheStats: this.getCacheStats(),
      queryStats: queryStats.slice(0, 20), // 상위 20개만
      recommendations
    };
  }
}

// 모듈 내보내기
export {
  queryCache
};

// Types are already exported as interfaces above, no need to re-export