/**
 * CompanyFilterChips Component
 *
 * Displays selected companies as removable chips with:
 * - Visual chip representation of selected filters
 * - Individual chip removal
 * - Bulk "Clear All" action
 * - Accessible keyboard navigation
 * - Dark mode support
 * - Responsive layout with wrapping
 *
 * Usage:
 * ```tsx
 * <CompanyFilterChips
 *   selectedCompanies={['1', '2', '3']}
 *   onRemove={(companyId) => handleRemove(companyId)}
 *   onClearAll={() => setSelectedCompanies([])}
 * />
 * ```
 */

'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';

interface CompanyFilterChipsProps {
  selectedCompanies: string[];
  onRemove: (companyId: string) => void;
  onClearAll?: () => void;
  className?: string;
  maxVisible?: number;
  showCount?: boolean;
}

export function CompanyFilterChips({
  selectedCompanies,
  onRemove,
  onClearAll,
  className = '',
  maxVisible = 5,
  showCount = true,
}: CompanyFilterChipsProps) {
  const { companies } = useCompanyFilter();

  // Build company ID to name mapping
  const companyMap = React.useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach(company => {
      map.set(company.value, company.label);
    });
    return map;
  }, [companies]);

  // Get visible and overflow chips
  const visibleChips = selectedCompanies.slice(0, maxVisible);
  const overflowCount = selectedCompanies.length - maxVisible;
  const hasOverflow = overflowCount > 0;

  // Don't render if no selections
  if (selectedCompanies.length === 0) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent, companyId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRemove(companyId);
    }
  };

  const handleClearAllKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClearAll?.();
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="group"
      aria-label="선택된 거래처 필터"
    >
      {/* Selected Company Chips */}
      {visibleChips.map((companyId) => {
        const companyName = companyMap.get(companyId) || `ID: ${companyId}`;

        return (
          <div
            key={companyId}
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5
              bg-blue-100 dark:bg-blue-900/30
              text-blue-800 dark:text-blue-200
              text-sm font-medium
              rounded-full
              border border-blue-200 dark:border-blue-800
              transition-colors
              group
            "
            role="status"
            aria-label={`선택된 거래처: ${companyName}`}
          >
            <span className="max-w-[150px] truncate" title={companyName}>
              {companyName}
            </span>
            <button
              onClick={() => onRemove(companyId)}
              onKeyDown={(e) => handleKeyDown(e, companyId)}
              className="
                inline-flex items-center justify-center
                w-4 h-4
                rounded-full
                text-blue-600 dark:text-blue-300
                hover:bg-blue-200 dark:hover:bg-blue-800
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-colors
              "
              aria-label={`${companyName} 필터 제거`}
              type="button"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {/* Overflow Indicator */}
      {hasOverflow && showCount && (
        <div
          className="
            inline-flex items-center
            px-3 py-1.5
            bg-gray-100 dark:bg-gray-800
            text-gray-700 dark:text-gray-300
            text-sm font-medium
            rounded-full
            border border-gray-300 dark:border-gray-600
          "
          role="status"
          aria-label={`${overflowCount}개 추가 거래처 선택됨`}
        >
          +{overflowCount}
        </div>
      )}

      {/* Clear All Button */}
      {onClearAll && selectedCompanies.length > 1 && (
        <button
          onClick={onClearAll}
          onKeyDown={handleClearAllKeyDown}
          className="
            inline-flex items-center gap-1.5
            px-3 py-1.5
            text-sm font-medium
            text-red-600 dark:text-red-400
            hover:text-red-800 dark:hover:text-red-300
            hover:bg-red-50 dark:hover:bg-red-900/20
            rounded-full
            border border-red-300 dark:border-red-800
            focus:outline-none focus:ring-2 focus:ring-red-500
            transition-colors
          "
          aria-label="모든 거래처 필터 제거"
          type="button"
        >
          <X className="w-3 h-3" />
          <span>전체 해제</span>
        </button>
      )}

      {/* Screen Reader Summary */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedCompanies.length}개의 거래처가 선택되었습니다
      </div>
    </div>
  );
}

/**
 * Compact variant with minimal styling
 */
export function CompanyFilterChipsCompact({
  selectedCompanies,
  onRemove,
  onClearAll,
  className = '',
}: Omit<CompanyFilterChipsProps, 'maxVisible' | 'showCount'>) {
  return (
    <CompanyFilterChips
      selectedCompanies={selectedCompanies}
      onRemove={onRemove}
      onClearAll={onClearAll}
      className={className}
      maxVisible={3}
      showCount={false}
    />
  );
}
