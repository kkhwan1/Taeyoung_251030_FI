/**
 * Query Optimization Type Definitions (extracted from query-optimizer.ts)
 * Reusable types for pagination and query results
 */

export interface QueryOptimizationOptions {
  useCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  enableExplain?: boolean;
  timeout?: number;
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
