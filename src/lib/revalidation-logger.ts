/**
 * Revalidation Logger for ISR/SSG Performance Monitoring
 *
 * Purpose: Track when pages are revalidated to verify ISR is working
 * Usage: Call from API routes when data changes that should trigger revalidation
 *
 * Example:
 * ```typescript
 * import { logRevalidation } from '@/lib/revalidation-logger';
 *
 * // After data mutation
 * await db.items.create(newItem);
 * logRevalidation('/master/items', 'Item created');
 *
 * // With revalidatePath (Wave 2)
 * import { revalidatePath } from 'next/cache';
 * logRevalidation('/master/items', 'On-demand revalidation triggered');
 * revalidatePath('/master/items');
 * ```
 */

export interface RevalidationLogEntry {
  timestamp: string;
  path: string;
  reason: string;
  type: 'time-based' | 'on-demand' | 'manual';
}

class RevalidationLogger {
  private logs: RevalidationLogEntry[] = [];
  private readonly maxLogs = 100; // Keep last 100 entries

  /**
   * Log a revalidation event
   */
  log(path: string, reason: string, type: RevalidationLogEntry['type'] = 'time-based'): void {
    const entry: RevalidationLogEntry = {
      timestamp: new Date().toISOString(),
      path,
      reason,
      type
    };

    // Console log for immediate visibility
    console.log(`[Revalidation] ${entry.timestamp} - ${path} - ${reason} (${type})`);

    // Store in memory (limited buffer)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest
    }
  }

  /**
   * Get recent revalidation logs
   */
  getRecentLogs(count: number = 20): RevalidationLogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs for a specific path
   */
  getLogsForPath(path: string): RevalidationLogEntry[] {
    return this.logs.filter(log => log.path === path);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    console.log('[Revalidation] Logs cleared');
  }

  /**
   * Get log summary statistics
   */
  getStats(): {
    totalLogs: number;
    pathCounts: Record<string, number>;
    typeCounts: Record<string, number>;
  } {
    const pathCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    this.logs.forEach(log => {
      pathCounts[log.path] = (pathCounts[log.path] || 0) + 1;
      typeCounts[log.type] = (typeCounts[log.type] || 0) + 1;
    });

    return {
      totalLogs: this.logs.length,
      pathCounts,
      typeCounts
    };
  }
}

// Singleton instance
const logger = new RevalidationLogger();

/**
 * Primary function for logging revalidation events
 */
export function logRevalidation(path: string, reason: string, type?: RevalidationLogEntry['type']): void {
  logger.log(path, reason, type);
}

/**
 * Get recent revalidation logs (for monitoring/debugging)
 */
export function getRevalidationLogs(count?: number): RevalidationLogEntry[] {
  return logger.getRecentLogs(count);
}

/**
 * Get logs for specific path
 */
export function getPathRevalidationLogs(path: string): RevalidationLogEntry[] {
  return logger.getLogsForPath(path);
}

/**
 * Get revalidation statistics
 */
export function getRevalidationStats() {
  return logger.getStats();
}

/**
 * Clear revalidation logs
 */
export function clearRevalidationLogs(): void {
  logger.clear();
}

// Export logger instance for advanced use cases
export { logger as revalidationLogger };
