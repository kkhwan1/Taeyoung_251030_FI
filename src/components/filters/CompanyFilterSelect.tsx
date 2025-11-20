/**
 * CompanyFilterSelect Component
 *
 * Reusable company filter dropdown with:
 * - Consistent styling across the app
 * - Full accessibility (ARIA labels, keyboard navigation)
 * - Loading and error states
 * - Dark mode support
 * - Retry on error
 *
 * Usage:
 * ```tsx
 * <CompanyFilterSelect
 *   value={selectedCompany}
 *   onChange={setSelectedCompany}
 *   label="거래처 선택"
 * />
 * ```
 */

'use client';

import React from 'react';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';
import { Loader2, RefreshCw } from 'lucide-react';

interface CompanyFilterSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  showAllOption?: boolean;
  id?: string;
}

export function CompanyFilterSelect({
  value,
  onChange,
  label = '거래처',
  placeholder = '전체',
  className = '',
  disabled = false,
  required = false,
  showAllOption = true,
  id = 'company-filter',
}: CompanyFilterSelectProps) {
  const { companies, loading, error, refetch, isStale, lastFetchTime } = useCompanyFilter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault();
    refetch();
  };

  // 키보드 단축키: Ctrl+R로 refetch
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && document.activeElement?.id === id) {
        e.preventDefault();
        refetch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [id, refetch]);

  // 캐시 상태 포맷팅
  const getCacheStatus = () => {
    if (!lastFetchTime) return null;
    const elapsed = Date.now() - lastFetchTime;
    const minutes = Math.floor(elapsed / 60000);

    if (minutes < 1) return '방금 전';
    if (minutes < 5) return `${minutes}분 전`;
    if (isStale) return '업데이트 필요';
    return null;
  };

  const cacheStatus = getCacheStatus();

  return (
    <div className="flex flex-col gap-2">
      {/* Label with cache status */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {/* Cache status indicator */}
        {cacheStatus && !loading && (
          <span
            className={`text-xs ${
              isStale
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            title={`마지막 업데이트: ${new Date(lastFetchTime!).toLocaleString('ko-KR')}`}
          >
            {cacheStatus}
          </span>
        )}
      </div>

      {/* Select with loading/error states */}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={handleChange}
          disabled={disabled || loading}
          required={required}
          className={`
            w-full px-3 py-2 pr-10
            text-base
            border border-gray-300 dark:border-gray-600
            rounded-md shadow-sm
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
            focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            ${className}
          `}
          aria-label={label}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? 'true' : 'false'}
          aria-busy={loading ? 'true' : 'false'}
        >
          {/* Default "All" option */}
          {showAllOption && (
            <option value="">{placeholder}</option>
          )}

          {/* Loading state */}
          {loading && (
            <option value="" disabled>
              로딩 중...
            </option>
          )}

          {/* Company options */}
          {!loading && !error && companies.map((company) => (
            <option key={company.value} value={company.value}>
              {company.label}
            </option>
          ))}

          {/* Error state */}
          {error && (
            <option value="" disabled>
              오류 발생 - 다시 시도해주세요
            </option>
          )}
        </select>

        {/* Loading spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Error message with retry button */}
      {error && (
        <div
          id={`${id}-error`}
          className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
          role="alert"
          aria-live="polite"
        >
          <span>{error}</span>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            aria-label="거래처 목록 다시 불러오기"
          >
            <RefreshCw className="w-3 h-3" />
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
