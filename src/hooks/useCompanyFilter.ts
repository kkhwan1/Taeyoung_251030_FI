/**
 * useCompanyFilter Hook
 *
 * Re-exported from CompanyFilterContext for backward compatibility.
 * All pages should use the Context-based implementation for caching benefits.
 *
 * Features (from CompanyFilterContext):
 * - Single source of truth for company data
 * - Request deduplication (prevents multiple simultaneous fetches)
 * - Automatic caching (data persists across component remounts)
 * - Stale-while-revalidate strategy (5분 캐시, 10분 stale)
 * - Error handling with retry capability
 * - ETag support for 304 Not Modified responses
 *
 * Migration Note:
 * This file was previously a standalone hook that fetched on every mount.
 * It's now a re-export wrapper for CompanyFilterContext to maintain
 * backward compatibility while gaining caching benefits.
 *
 * Usage:
 * ```tsx
 * import { useCompanyFilter } from '@/hooks/useCompanyFilter';
 * const { companies, loading, error, refetch } = useCompanyFilter();
 * ```
 *
 * @author Claude (Frontend Developer)
 * @date 2025-11-21
 */

export { useCompanyFilter, type CompanyOption } from '@/contexts/CompanyFilterContext';
