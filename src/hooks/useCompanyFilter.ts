/**
 * useCompanyFilter Hook
 *
 * Shared hook for fetching and managing company filter options across pages.
 * Provides unified company dropdown data with error handling, loading states, and caching.
 *
 * Features:
 * - Automatic data fetching on mount
 * - Error handling with toast notifications
 * - Loading state management
 * - TypeScript type safety
 * - Reusable across all filter components
 *
 * Usage:
 * ```tsx
 * const { companies, loading, error } = useCompanyFilter();
 * ```
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { CompanyOptionsResponse, CompanyData } from '@/types/api';

/**
 * Company option type for dropdown selections
 */
export interface CompanyOption {
  value: number;
  label: string;
}

/**
 * Return type for useCompanyFilter hook
 */
interface UseCompanyFilterReturn {
  companies: CompanyOption[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching company filter options
 *
 * @returns {UseCompanyFilterReturn} Company options, loading state, error state, and refetch function
 */
export function useCompanyFilter(): UseCompanyFilterReturn {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/companies/options');

      if (!response.ok) {
        throw new Error(`거래처 목록 조회 실패: ${response.status}`);
      }

      const data = await response.json() as CompanyOptionsResponse;

      if (!data.success) {
        throw new Error(data.error || '거래처 목록 조회 실패');
      }

      // Transform API response to CompanyOption format
      const companyOptions: CompanyOption[] = data.data.map((company: CompanyData) => ({
        value: company.company_id,
        label: company.company_name,
      }));

      setCompanies(companyOptions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '거래처 목록 조회 중 오류가 발생했습니다';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Company filter fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  return {
    companies,
    loading,
    error,
    refetch: fetchCompanies,
  };
}
