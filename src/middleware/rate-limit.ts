import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limiting configuration interface
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

/**
 * Rate limit store interface
 */
export interface RateLimitStore {
  increment(key: string): Promise<{ totalHits: number; timeToExpire?: number }>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
}

/**
 * In-memory rate limit store for development
 */
class MemoryStore implements RateLimitStore {
  private hits: Map<string, { count: number; resetTime: number }> = new Map();

  async increment(key: string): Promise<{ totalHits: number; timeToExpire?: number }> {
    const now = Date.now();
    const hit = this.hits.get(key);

    if (!hit || now > hit.resetTime) {
      // Reset or create new entry
      this.hits.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
      return { totalHits: 1, timeToExpire: 60000 };
    }

    hit.count++;
    this.hits.set(key, hit);
    return {
      totalHits: hit.count,
      timeToExpire: hit.resetTime - now
    };
  }

  async decrement(key: string): Promise<void> {
    const hit = this.hits.get(key);
    if (hit && hit.count > 0) {
      hit.count--;
      this.hits.set(key, hit);
    }
  }

  async resetKey(key: string): Promise<void> {
    this.hits.delete(key);
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, hit] of this.hits.entries()) {
      if (now > hit.resetTime) {
        this.hits.delete(key);
      }
    }
  }
}

/**
 * Redis rate limit store for production
 */
class RedisStore implements RateLimitStore {
  private redis: any;

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async increment(key: string): Promise<{ totalHits: number; timeToExpire?: number }> {
    const pipeline = this.redis.pipeline();
    const windowMs = 60000; // 1 minute

    pipeline.incr(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    pipeline.ttl(key);

    const results = await pipeline.exec();

    const totalHits = results[0][1];
    const ttl = results[2][1];
    const timeToExpire = ttl > 0 ? ttl * 1000 : windowMs;

    return { totalHits, timeToExpire };
  }

  async decrement(key: string): Promise<void> {
    const current = await this.redis.get(key);
    if (current && parseInt(current) > 0) {
      await this.redis.decr(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

/**
 * Default rate limit configurations for different API routes
 */
export const RATE_LIMIT_CONFIGS = {
  // Authentication routes - stricter limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.',
  },

  // Standard API routes
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  },

  // Upload routes - more restrictive
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
    message: '파일 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  },

  // Export routes
  export: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 exports per minute
    message: '파일 다운로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  },

  // Dashboard and analytics
  dashboard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: '대시보드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  },

  // Health check - very permissive
  health: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000, // 1000 requests per minute
    message: '헬스체크 요청이 너무 많습니다.',
  },
} as const;

// Global memory store instance
const memoryStore = new MemoryStore();

// Cleanup expired entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    memoryStore.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * Create rate limiter middleware
 */
export function createRateLimit(config: RateLimitConfig, store?: RateLimitStore) {
  const rateLimitStore = store || memoryStore;

  const {
    windowMs,
    maxRequests,
    keyGenerator = (request: NextRequest) => getClientIdentifier(request),
    message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    standardHeaders = true,
    legacyHeaders = false,
  } = config;

  return async function rateLimitMiddleware(
    request: NextRequest
  ): Promise<NextResponse | null> {
    try {
      const key = keyGenerator(request);
      const { totalHits, timeToExpire } = await rateLimitStore.increment(key);

      const headers = new Headers();

      if (standardHeaders) {
        headers.set('RateLimit-Limit', maxRequests.toString());
        headers.set('RateLimit-Remaining', Math.max(0, maxRequests - totalHits).toString());
        if (timeToExpire) {
          headers.set('RateLimit-Reset', new Date(Date.now() + timeToExpire).toISOString());
        }
      }

      if (legacyHeaders) {
        headers.set('X-RateLimit-Limit', maxRequests.toString());
        headers.set('X-RateLimit-Remaining', Math.max(0, maxRequests - totalHits).toString());
        if (timeToExpire) {
          headers.set('X-RateLimit-Reset', Math.ceil((Date.now() + timeToExpire) / 1000).toString());
        }
      }

      if (totalHits > maxRequests) {
        const retryAfter = timeToExpire ? Math.ceil(timeToExpire / 1000) : Math.ceil(windowMs / 1000);
        headers.set('Retry-After', retryAfter.toString());

        return NextResponse.json(
          {
            success: false,
            error: message,
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
              limit: maxRequests,
              windowMs,
              retryAfter,
            },
            timestamp: new Date().toISOString(),
          },
          {
            status: 429,
            headers,
          }
        );
      }

      // Add rate limit headers to successful responses
      const response = NextResponse.next();
      headers.forEach((value, key) => {
        response.headers.set(key, value);
      });

      return null; // Continue to next middleware
    } catch (error) {
      console.error('Rate limiting error:', error);
      // If rate limiting fails, allow the request to proceed
      return null;
    }
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from headers (if authenticated)
  const userId = request.headers.get('x-user-id');
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || (request as any).ip || 'unknown';

  return `ip:${ip}`;
}

/**
 * Create rate limiter with user-based key generation
 */
export function createUserRateLimit(config: RateLimitConfig, store?: RateLimitStore) {
  return createRateLimit({
    ...config,
    keyGenerator: (request: NextRequest) => {
      const userId = request.headers.get('x-user-id');
      const pathname = request.nextUrl.pathname;
      return userId ? `user:${userId}:${pathname}` : `ip:${getClientIdentifier(request)}:${pathname}`;
    },
  }, store);
}

/**
 * Create rate limiter with IP-based key generation
 */
export function createIPRateLimit(config: RateLimitConfig, store?: RateLimitStore) {
  return createRateLimit({
    ...config,
    keyGenerator: (request: NextRequest) => {
      const pathname = request.nextUrl.pathname;
      return `${getClientIdentifier(request)}:${pathname}`;
    },
  }, store);
}

/**
 * Apply rate limiting based on route patterns
 */
export function applyRouteBasedRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;

  // Authentication routes
  if (pathname.includes('/api/auth/')) {
    return createRateLimit(RATE_LIMIT_CONFIGS.auth)(request);
  }

  // Upload routes
  if (pathname.includes('/api/upload/')) {
    return createRateLimit(RATE_LIMIT_CONFIGS.upload)(request);
  }

  // Export routes
  if (pathname.includes('/api/export/') || pathname.includes('/api/download/')) {
    return createRateLimit(RATE_LIMIT_CONFIGS.export)(request);
  }

  // Dashboard routes
  if (pathname.includes('/api/dashboard/')) {
    return createRateLimit(RATE_LIMIT_CONFIGS.dashboard)(request);
  }

  // Health check routes
  if (pathname.includes('/api/health')) {
    return createRateLimit(RATE_LIMIT_CONFIGS.health)(request);
  }

  // Default API rate limiting
  if (pathname.startsWith('/api/')) {
    return createRateLimit(RATE_LIMIT_CONFIGS.api)(request);
  }

  // No rate limiting for non-API routes
  return Promise.resolve(null);
}

/**
 * Initialize Redis store (for production)
 */
export function createRedisStore(redisClient: any): RedisStore {
  return new RedisStore(redisClient);
}

/**
 * Get memory store instance (for development)
 */
export function getMemoryStore(): MemoryStore {
  return memoryStore;
}