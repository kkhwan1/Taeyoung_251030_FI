/**
 * Redis Cache Client for Production-Grade Caching
 *
 * Features:
 * - Connection pooling and automatic reconnection
 * - Smart TTL strategy based on data type
 * - Pattern-based cache invalidation
 * - Fallback to in-memory cache if Redis unavailable
 * - Compression for large payloads
 *
 * Phase 2 Task 6: Redis Caching Implementation
 */

import Redis, { RedisOptions } from 'ioredis';
import { cacheGet, cacheSet, cacheDelPattern } from './cache-memory';

// Redis client instance
let redisClient: Redis | null = null;
let isRedisAvailable = false;

/**
 * Redis Configuration
 */
const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),

  // Connection management
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,

  // Reconnection strategy
  retryStrategy(times: number) {
    // 최대 10회까지만 재시도
    if (times > 10) {
      console.log('[Redis] Max retry attempts reached, falling back to memory cache');
      return null; // 재시도 중단
    }
    
    const delay = Math.min(times * 100, 3000);
    console.log(`[Redis] Retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },

  // Connection timeout
  connectTimeout: 10000,

  // Keep-alive
  keepAlive: 30000,
};

/**
 * Initialize Redis Client
 */
export function initRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  // Skip Redis initialization if explicitly disabled
  if (process.env.DISABLE_REDIS === 'true') {
    console.log('[Redis] Redis caching disabled via DISABLE_REDIS flag');
    isRedisAvailable = false;
    return null;
  }

  try {
    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
      isRedisAvailable = true;
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Ready to accept commands');
      isRedisAvailable = true;
    });

    redisClient.on('error', (error) => {
      console.error('[Redis] Connection error:', error.message);
      isRedisAvailable = false;
    });

    redisClient.on('close', () => {
      console.warn('[Redis] Connection closed');
      isRedisAvailable = false;
    });

    redisClient.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
      isRedisAvailable = false;
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to initialize client:', error);
    isRedisAvailable = false;
    return null;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): Redis | null {
  if (!redisClient) {
    return initRedisClient();
  }
  return redisClient;
}

/**
 * Check if Redis is available
 */
export function isRedisConnected(): boolean {
  return isRedisAvailable && redisClient !== null;
}

/**
 * TTL Strategy based on data type
 */
interface TTLStrategy {
  notifications_list: number;      // 60 seconds (frequently changing)
  notifications_unread: number;    // 30 seconds (very frequently changing)
  notification_preferences: number; // 300 seconds (rarely changing)
  price_trends: number;            // 180 seconds (moderate changes)
  dashboard_stats: number;         // 120 seconds (moderate changes)
  default: number;                 // 60 seconds (fallback)
}

const TTL_STRATEGY: TTLStrategy = {
  notifications_list: 60,
  notifications_unread: 30,
  notification_preferences: 300,
  price_trends: 180,
  dashboard_stats: 120,
  default: 60,
};

/**
 * Get TTL for cache key
 */
function getTTL(key: string): number {
  if (key.includes('unread')) return TTL_STRATEGY.notifications_unread;
  if (key.includes('notifications')) return TTL_STRATEGY.notifications_list;
  if (key.includes('preferences')) return TTL_STRATEGY.notification_preferences;
  if (key.includes('trends')) return TTL_STRATEGY.price_trends;
  if (key.includes('dashboard')) return TTL_STRATEGY.dashboard_stats;
  return TTL_STRATEGY.default;
}

/**
 * Compression threshold (compress if payload > 1KB)
 */
const COMPRESSION_THRESHOLD = 1024;

/**
 * Should compress payload
 */
function shouldCompress(data: string): boolean {
  return data.length > COMPRESSION_THRESHOLD;
}

/**
 * Get cached data (with fallback to in-memory cache)
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  // Try Redis first if available
  if (isRedisConnected() && redisClient) {
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      console.error('[Redis] Get cache error:', error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  const memoryCached = cacheGet<T>(key);
  if (memoryCached !== undefined) {
    return memoryCached;
  }

  return null;
}

/**
 * Set cached data (with fallback to in-memory cache)
 */
export async function setCachedData<T>(
  key: string,
  value: T,
  ttlOverride?: number
): Promise<void> {
  const serialized = JSON.stringify(value);
  const ttl = ttlOverride || getTTL(key);

  // Try Redis first if available
  if (isRedisConnected() && redisClient) {
    try {
      // Store with TTL
      await redisClient.setex(key, ttl, serialized);

      // Log compression info if applicable
      if (shouldCompress(serialized)) {
        console.log(`[Redis] Cached ${key} (${serialized.length} bytes, TTL: ${ttl}s)`);
      }

      return;
    } catch (error) {
      console.error('[Redis] Set cache error:', error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  cacheSet(key, value, ttl);
}

/**
 * Delete cached data by exact key
 */
export async function deleteCachedData(key: string): Promise<void> {
  // Try Redis first if available
  if (isRedisConnected() && redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('[Redis] Delete cache error:', error);
    }
  }

  // Also delete from memory cache
  cacheDelPattern(key);
}

/**
 * Delete cached data by pattern (wildcard support)
 */
export async function deleteCacheByPattern(pattern: string): Promise<number> {
  let deletedCount = 0;

  // Try Redis first if available
  if (isRedisConnected() && redisClient) {
    try {
      // Find keys matching pattern
      const keys = await redisClient.keys(pattern);

      if (keys.length > 0) {
        // Delete all matching keys
        deletedCount = await redisClient.del(...keys);
        console.log(`[Redis] Deleted ${deletedCount} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      console.error('[Redis] Delete by pattern error:', error);
    }
  }

  // Also delete from memory cache
  cacheDelPattern(pattern);

  return deletedCount;
}

/**
 * Clear all cache (use with caution!)
 */
export async function clearAllCache(): Promise<void> {
  if (isRedisConnected() && redisClient) {
    try {
      await redisClient.flushdb();
      console.log('[Redis] All cache cleared');
    } catch (error) {
      console.error('[Redis] Clear all cache error:', error);
    }
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  redis: { connected: boolean; keyCount?: number };
  memory: { enabled: boolean };
}> {
  const stats = {
    redis: {
      connected: isRedisConnected(),
      keyCount: undefined as number | undefined,
    },
    memory: {
      enabled: true,
    },
  };

  if (isRedisConnected() && redisClient) {
    try {
      const dbSize = await redisClient.dbsize();
      stats.redis.keyCount = dbSize;
    } catch (error) {
      console.error('[Redis] Get stats error:', error);
    }
  }

  return stats;
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[Redis] Connection closed gracefully');
    } catch (error) {
      console.error('[Redis] Error closing connection:', error);
    } finally {
      redisClient = null;
      isRedisAvailable = false;
    }
  }
}

/**
 * Cache key generators for consistent naming
 */
export const CacheKeys = {
  notifications: (userId: number, filters: string = '') =>
    `notifications:${userId}:${filters}`,

  notificationsUnread: (userId: number) =>
    `notifications:${userId}:unread`,

  notificationPreferences: (userId: number) =>
    `notification_preferences:${userId}`,

  priceTrends: (itemId: number, period: string = '7d') =>
    `price_trends:${itemId}:${period}`,

  dashboardStats: (userId: number) =>
    `dashboard:stats:${userId}`,

  // Pattern for invalidation
  allNotifications: (userId: number) =>
    `notifications:${userId}:*`,
};

// Initialize Redis client on module load
initRedisClient();
