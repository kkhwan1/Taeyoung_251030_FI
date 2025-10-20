/**
 * In-Memory Caching Layer
 *
 * Phase 1 Performance Optimization
 * Replaces counter-productive caching with efficient NodeCache implementation
 *
 * Features:
 * - 60-second TTL for automatic expiration
 * - Pattern-based cache invalidation
 * - Type-safe cache operations
 * - Automatic cleanup on memory pressure
 */

import NodeCache from 'node-cache';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const cache = new NodeCache({
  stdTTL: 60,                // 60 seconds default TTL
  checkperiod: 120,          // Check for expired keys every 2 minutes
  useClones: false,          // Don't clone objects (performance optimization)
  deleteOnExpire: true,      // Auto-delete expired keys
  maxKeys: 1000,             // Limit cache size to prevent memory issues
});

// ============================================================================
// CACHE KEY PATTERNS
// ============================================================================

export const CacheKeys = {
  // Notifications
  NOTIFICATIONS_LIST: (userId: number) => `notifications:list:${userId}`,
  NOTIFICATION_DETAIL: (notificationId: number) => `notification:detail:${notificationId}`,
  NOTIFICATION_PREFERENCES: (userId: number) => `notification:preferences:${userId}`,

  // Trends
  PRICE_TRENDS: (itemId: number, days: number) => `trends:price:${itemId}:${days}`,
  SALES_TRENDS: (days: number) => `trends:sales:${days}`,

  // Dashboard
  DASHBOARD_OVERVIEW: () => 'dashboard:overview',
  DASHBOARD_STATS: (period: string) => `dashboard:stats:${period}`,
};

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get value from cache
 */
export function cacheGet<T>(key: string): T | undefined {
  try {
    return cache.get<T>(key);
  } catch (error) {
    console.error('[Cache] Get failed:', key, error);
    return undefined;
  }
}

/**
 * Set value in cache with optional TTL
 */
export function cacheSet<T>(
  key: string,
  value: T,
  ttl?: number
): boolean {
  try {
    return cache.set(key, value, ttl || 60);
  } catch (error) {
    console.error('[Cache] Set failed:', key, error);
    return false;
  }
}

/**
 * Delete single key from cache
 */
export function cacheDel(key: string): number {
  try {
    return cache.del(key);
  } catch (error) {
    console.error('[Cache] Delete failed:', key, error);
    return 0;
  }
}

/**
 * Delete multiple keys by pattern
 * Example: cacheDelPattern('notifications:list:*')
 */
export function cacheDelPattern(pattern: string): number {
  try {
    const keys = cache.keys();
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*') + '$'
    );

    const matchingKeys = keys.filter(key => regex.test(key));
    return cache.del(matchingKeys);
  } catch (error) {
    console.error('[Cache] Delete pattern failed:', pattern, error);
    return 0;
  }
}

/**
 * Flush all cache
 */
export function cacheFlush(): void {
  try {
    cache.flushAll();
  } catch (error) {
    console.error('[Cache] Flush failed:', error);
  }
}

/**
 * Get cache statistics
 */
export function cacheStats() {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    ksize: cache.getStats().ksize,
    vsize: cache.getStats().vsize,
  };
}

// ============================================================================
// CACHE INVALIDATION HELPERS
// ============================================================================

/**
 * Invalidate all notification-related cache for a user
 */
export function invalidateUserNotifications(userId: number): void {
  cacheDelPattern(`notifications:*:${userId}`);
  cacheDelPattern(`notification:preferences:${userId}`);
}

/**
 * Invalidate all trend-related cache for an item
 */
export function invalidateItemTrends(itemId: number): void {
  cacheDelPattern(`trends:price:${itemId}:*`);
}

/**
 * Invalidate all dashboard cache
 */
export function invalidateDashboard(): void {
  cacheDelPattern('dashboard:*');
}

// ============================================================================
// CACHE WRAPPER FUNCTION
// ============================================================================

/**
 * Generic cache-or-fetch wrapper
 *
 * Usage:
 * ```ts
 * const data = await cacheOrFetch(
 *   CacheKeys.NOTIFICATIONS_LIST(userId),
 *   async () => {
 *     const { data } = await supabase.from('notifications').select('*');
 *     return data;
 *   },
 *   60 // optional TTL
 * );
 * ```
 */
export async function cacheOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache
  const cached = cacheGet<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  // Fetch from source
  const data = await fetchFn();

  // Store in cache
  cacheSet(key, data, ttl);

  return data;
}

// ============================================================================
// MONITORING & HEALTH CHECK
// ============================================================================

/**
 * Log cache statistics (for debugging)
 */
export function logCacheStats(): void {
  const stats = cacheStats();
  const hitRate = stats.hits + stats.misses > 0
    ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2)
    : '0.00';

  console.log('[Cache Stats]', {
    keys: stats.keys,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: `${hitRate}%`,
    keySize: `${(stats.ksize / 1024).toFixed(2)} KB`,
    valueSize: `${(stats.vsize / 1024).toFixed(2)} KB`,
  });
}

/**
 * Health check for cache
 */
export function cacheHealthCheck(): {
  healthy: boolean;
  message: string;
  stats: ReturnType<typeof cacheStats>;
} {
  const stats = cacheStats();

  // Check if cache is too full
  if (stats.keys > 900) { // 90% of maxKeys
    return {
      healthy: false,
      message: 'Cache nearly full',
      stats,
    };
  }

  return {
    healthy: true,
    message: 'Cache healthy',
    stats,
  };
}

// Export default cache instance for advanced usage
export default cache;
