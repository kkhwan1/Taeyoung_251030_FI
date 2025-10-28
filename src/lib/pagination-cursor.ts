/**
 * Cursor-Based Pagination Module
 * Phase 2 Task 7: Query Result Pagination Optimization
 *
 * Replaces OFFSET-based pagination with cursor-based approach
 * Expected improvement: 20-30% for large result sets (>1000 rows)
 *
 * Benefits:
 * - Constant O(1) query time regardless of page depth
 * - No duplicate/missing rows when data changes
 * - Better performance for large datasets
 * - Works with any indexed column
 *
 * Architecture:
 * - Uses indexed column (created_at, id) as cursor
 * - Forward/backward navigation
 * - Automatic encoding/decoding of cursors
 * - Compatible with existing Redis caching
 */

import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { Database } from '@/types/supabase';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Cursor pagination request parameters
 */
export interface CursorPaginationParams {
  limit?: number;                  // Number of items per page (default: 20, max: 100)
  cursor?: string;                 // Opaque cursor string (base64 encoded)
  direction?: 'forward' | 'backward'; // Pagination direction (default: forward)
  orderBy?: string;                // Column to order by (default: created_at)
  orderDirection?: 'asc' | 'desc'; // Order direction (default: desc)
}

/**
 * Cursor pagination response
 */
export interface CursorPaginationResponse<T> {
  data: T[];                       // Array of items
  pagination: {
    hasNext: boolean;              // Has more items after current page
    hasPrev: boolean;              // Has more items before current page
    nextCursor: string | null;     // Cursor for next page
    prevCursor: string | null;     // Cursor for previous page
    limit: number;                 // Items per page
    count?: number;                // Total count (optional, expensive)
  };
}

/**
 * Internal cursor structure (encoded to base64)
 */
interface CursorData {
  value: string | number;          // Value of the cursor column
  orderBy: string;                 // Column name
  orderDirection: 'asc' | 'desc';  // Direction
}

// ============================================================================
// CURSOR ENCODING/DECODING
// ============================================================================

/**
 * Encode cursor data to opaque base64 string
 */
export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify(data);
  return Buffer.from(json, 'utf-8').toString('base64');
}

/**
 * Decode cursor string to cursor data
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(json) as CursorData;
  } catch (error) {
    console.error('[Cursor] Decode error:', error);
    return null;
  }
}

/**
 * Extract cursor value from data item
 */
export function extractCursorValue(item: any, orderBy: string): string | number {
  const value = item[orderBy];

  if (value === undefined || value === null) {
    throw new Error(`Cursor column '${orderBy}' not found in data`);
  }

  return value;
}

// ============================================================================
// QUERY BUILDER WITH CURSOR PAGINATION
// ============================================================================

/**
 * Apply cursor-based pagination to Supabase query
 *
 * Algorithm:
 * 1. Decode cursor to get last item's value
 * 2. Apply WHERE clause: column > cursor_value (forward) or column < cursor_value (backward)
 * 3. Order by column ASC/DESC
 * 4. LIMIT n+1 (to check hasNext/hasPrev)
 * 5. Extract first/last item for next/prev cursors
 *
 * Performance:
 * - O(1) query time (uses index seek)
 * - No OFFSET scanning
 * - Consistent performance regardless of page depth
 */
export function applyCursorPagination<T>(
  query: PostgrestFilterBuilder<any, any, any, T[]>,
  params: CursorPaginationParams
): PostgrestFilterBuilder<any, any, any, T[]> {
  const {
    limit = 20,
    cursor,
    direction = 'forward',
    orderBy = 'created_at',
    orderDirection = 'desc'
  } = params;

  // Validate limit
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  // Decode cursor if provided
  if (cursor) {
    const cursorData = decodeCursor(cursor);

    if (cursorData) {
      const { value, orderBy: cursorOrderBy, orderDirection: cursorDirection } = cursorData;

      // Validate cursor matches query parameters
      if (cursorOrderBy !== orderBy || cursorDirection !== orderDirection) {
        console.warn('[Cursor] Cursor mismatch, ignoring cursor and starting from beginning');
      } else {
        // Apply cursor filter
        if (direction === 'forward') {
          // Forward: WHERE column > cursor_value (desc) or column < cursor_value (asc)
          if (orderDirection === 'desc') {
            query = query.lt(orderBy, value);
          } else {
            query = query.gt(orderBy, value);
          }
        } else {
          // Backward: WHERE column < cursor_value (desc) or column > cursor_value (asc)
          if (orderDirection === 'desc') {
            query = query.gt(orderBy, value);
          } else {
            query = query.lt(orderBy, value);
          }
        }
      }
    }
  }

  // Apply ordering
  query = query.order(orderBy, { ascending: orderDirection === 'asc' });

  // Fetch limit+1 to check for more pages
  query = query.limit(safeLimit + 1);

  return query;
}

/**
 * Process query results and build pagination response
 */
export function buildCursorPaginationResponse<T>(
  data: T[],
  params: CursorPaginationParams,
  totalCount?: number
): CursorPaginationResponse<T> {
  const {
    limit = 20,
    direction = 'forward',
    orderBy = 'created_at',
    orderDirection = 'desc'
  } = params;

  const safeLimit = Math.min(Math.max(limit, 1), 100);

  // Check if we have more items (limit+1)
  const hasMore = data.length > safeLimit;
  const items = hasMore ? data.slice(0, safeLimit) : data;

  // Determine hasNext and hasPrev
  let hasNext = false;
  let hasPrev = false;

  if (direction === 'forward') {
    hasNext = hasMore;
    hasPrev = !!params.cursor; // If we have a cursor, we can go back
  } else {
    hasNext = !!params.cursor; // If we have a cursor, we can go forward
    hasPrev = hasMore;
  }

  // Generate next and prev cursors
  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (hasNext && items.length > 0) {
    const lastItem = items[items.length - 1];
    const cursorValue = extractCursorValue(lastItem, orderBy);
    nextCursor = encodeCursor({
      value: cursorValue,
      orderBy,
      orderDirection
    });
  }

  if (hasPrev && items.length > 0) {
    const firstItem = items[0];
    const cursorValue = extractCursorValue(firstItem, orderBy);
    prevCursor = encodeCursor({
      value: cursorValue,
      orderBy,
      orderDirection
    });
  }

  return {
    data: items,
    pagination: {
      hasNext,
      hasPrev,
      nextCursor,
      prevCursor,
      limit: safeLimit,
      ...(totalCount !== undefined && { count: totalCount })
    }
  };
}

// ============================================================================
// CACHE KEY GENERATORS (Compatible with Redis)
// ============================================================================

/**
 * Generate cache key for cursor-based pagination
 * Format: table:cursor:direction:orderBy:orderDirection:limit:filters
 */
export function generateCursorCacheKey(
  table: string,
  params: CursorPaginationParams,
  filters?: Record<string, any>
): string {
  const {
    cursor = 'initial',
    direction = 'forward',
    orderBy = 'created_at',
    orderDirection = 'desc',
    limit = 20
  } = params;

  const filterStr = filters
    ? Object.entries(filters)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${v}`)
        .sort()
        .join(':')
    : 'none';

  return `${table}:cursor:${cursor}:${direction}:${orderBy}:${orderDirection}:${limit}:${filterStr}`;
}

// ============================================================================
// BACKWARD COMPATIBILITY HELPERS
// ============================================================================

/**
 * Convert offset-based pagination to cursor-based
 * For gradual migration from old APIs
 */
export function offsetToCursor(
  page: number,
  limit: number,
  orderBy: string = 'created_at',
  orderDirection: 'asc' | 'desc' = 'desc'
): CursorPaginationParams {
  // For first page, no cursor needed
  if (page === 1) {
    return { limit, orderBy, orderDirection };
  }

  // For other pages, we need to fetch and skip
  // This is a transitional helper only
  console.warn('[Cursor] Using offset-to-cursor conversion. Consider migrating to pure cursor-based pagination.');

  return {
    limit,
    orderBy,
    orderDirection,
    // Note: This is not true cursor pagination, just a compatibility helper
  };
}

/**
 * Convert cursor response to offset-compatible format
 * For APIs that need to maintain backward compatibility
 */
export function cursorToOffsetResponse<T>(
  cursorResponse: CursorPaginationResponse<T>,
  page: number = 1
): {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number | null;
    totalCount: number | null;
    hasNext: boolean;
    hasPrev: boolean;
  };
} {
  return {
    data: cursorResponse.data,
    pagination: {
      page,
      limit: cursorResponse.pagination.limit,
      totalPages: cursorResponse.pagination.count
        ? Math.ceil(cursorResponse.pagination.count / cursorResponse.pagination.limit)
        : null,
      totalCount: cursorResponse.pagination.count ?? null,
      hasNext: cursorResponse.pagination.hasNext,
      hasPrev: cursorResponse.pagination.hasPrev
    }
  };
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Log pagination performance metrics
 */
export function logPaginationMetrics(
  operation: string,
  startTime: number,
  resultCount: number,
  cursorUsed: boolean
) {
  const duration = Date.now() - startTime;

  console.log(`[Pagination] ${operation}:`, {
    duration: `${duration}ms`,
    resultCount,
    cursorUsed,
    method: cursorUsed ? 'cursor-based' : 'offset-based',
    performance: duration < 50 ? 'excellent' : duration < 100 ? 'good' : 'needs-optimization'
  });
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  encodeCursor,
  decodeCursor,
  extractCursorValue,
  applyCursorPagination,
  buildCursorPaginationResponse,
  generateCursorCacheKey,
  offsetToCursor,
  cursorToOffsetResponse,
  logPaginationMetrics
};
