/**
 * 간단한 메모리 캐시 구현 (LRU + TTL)
 */
interface CacheItem<T> {
  data: T;
  expiry: number;
  lastAccessed: number;
}

export class SimpleCache<T = any> {
  private cache = new Map<string, CacheItem<T>>();
  private maxSize: number;
  private defaultTTL: number; // seconds

  constructor(maxSize: number = 100, defaultTTL: number = 300) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * 캐시에 데이터 저장
   */
  set(key: string, data: T, ttl?: number): void {
    // LRU 방식으로 캐시 크기 관리
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const ttlSeconds = ttl ?? this.defaultTTL;
    const expiry = Date.now() + (ttlSeconds * 1000);

    this.cache.set(key, {
      data,
      expiry,
      lastAccessed: Date.now()
    });
  }

  /**
   * 캐시에서 데이터 가져오기
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // TTL 만료 확인
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    // 마지막 접근 시간 업데이트 (LRU)
    item.lastAccessed = Date.now();
    return item.data;
  }

  /**
   * 캐시에서 데이터 삭제
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 패턴에 맞는 모든 캐시 삭제
   */
  deletePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * 캐시 전체 삭제
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 캐시 통계
   */
  getStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    for (const [, item] of this.cache) {
      if (now > item.expiry) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
      maxSize: this.maxSize
    };
  }

  /**
   * LRU 방식으로 가장 오래된 항목 제거
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, item] of this.cache) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 만료된 항목 정리
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }
}

// 전역 캐시 인스턴스
export const dashboardCache = new SimpleCache(50, 300); // 50개 항목, 5분 TTL
export const apiCache = new SimpleCache(200, 60); // 200개 항목, 1분 TTL
export const dataCache = new SimpleCache(500, 600); // 500개 항목, 10분 TTL

// 주기적으로 만료된 캐시 정리 (5분마다)
if (typeof window === 'undefined') {
  // 서버 사이드에서만 실행
  setInterval(() => {
    const cleaned = dashboardCache.cleanup() + apiCache.cleanup() + dataCache.cleanup();
    if (cleaned > 0) {
      console.log(`[Cache Cleanup] Removed ${cleaned} expired items`);
    }
  }, 5 * 60 * 1000);
}

