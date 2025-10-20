/**
 * 빠른 필터 버튼 컴포넌트
 * Quick Filter Buttons Component with presets
 */

import React from 'react';
import { Calendar, Clock, Zap, Globe } from 'lucide-react';
import { getQuickFilters, QuickFilter } from '@/utils/searchUtils';

interface QuickFiltersProps {
  onFilterSelect: (filter: QuickFilter) => void;
  activeFilter?: string;
  className?: string;
  disabled?: boolean;
  customFilters?: QuickFilter[];
  showIcons?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const QuickFilterIcon: React.FC<{ filterId: string; className?: string }> = ({
  filterId,
  className = 'w-4 h-4'
}) => {
  switch (filterId) {
    case 'today':
      return <Clock className={className} />;
    case 'thisWeek':
      return <Calendar className={className} />;
    case 'thisMonth':
      return <Calendar className={className} />;
    case 'thisYear':
      return <Calendar className={className} />;
    case 'all':
      return <Globe className={className} />;
    default:
      return <Zap className={className} />;
  }
};

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  onFilterSelect,
  activeFilter,
  className = '',
  disabled = false,
  customFilters,
  showIcons = true,
  size = 'md'
}) => {
  const defaultFilters = getQuickFilters();
  const filters = customFilters || defaultFilters;

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-3 text-base';
      default:
        return 'px-3 py-2 text-sm';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-3 h-3';
      case 'lg':
        return 'w-5 h-5';
      default:
        return 'w-4 h-4';
    }
  };

  const getButtonClasses = (filter: QuickFilter) => {
    const baseClasses = `
      inline-flex items-center gap-1.5 font-medium rounded-lg
      transition-all duration-200 border
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
      disabled:opacity-50 disabled:cursor-not-allowed
      ${getSizeClasses()}
    `;

    if (activeFilter === filter.id) {
      return `${baseClasses}
        bg-blue-500 text-white border-blue-500
        shadow-md transform scale-105`;
    }

    return `${baseClasses}
      bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
      border-gray-300 dark:border-gray-600
      hover:bg-gray-50 dark:hover:bg-gray-700
      hover:border-gray-400 dark:hover:border-gray-500
      hover:shadow-sm`;
  };

  const formatDateRange = (filter: QuickFilter): string => {
    if (!filter.dateRange) return '';

    const { startDate, endDate } = filter.dateRange;
    if (!startDate || !endDate) return '';

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start.toDateString() === end.toDateString()) {
        return start.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric'
        });
      }

      return `${start.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
      })} ~ ${end.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
      })}`;
    } catch {
      return '';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          빠른 필터:
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterSelect(filter)}
            disabled={disabled}
            className={getButtonClasses(filter)}
            title={formatDateRange(filter)}
          >
            {showIcons && (
              <QuickFilterIcon
                filterId={filter.id}
                className={getIconSize()}
              />
            )}
            <span>{filter.label}</span>

            {/* 날짜 범위 표시 (작은 텍스트로) */}
            {filter.dateRange && size !== 'sm' && (
              <span className="text-xs opacity-75 ml-1">
                {formatDateRange(filter)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 선택된 필터 정보 */}
      {activeFilter && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {(() => {
            const active = filters.find(f => f.id === activeFilter);
            if (!active) return null;

            const parts = [];
            if (active.dateRange) {
              const range = formatDateRange(active);
              if (range) parts.push(`기간: ${range}`);
            }

            const filterCount = Object.keys(active.filters).length;
            if (filterCount > 0) {
              parts.push(`추가 필터: ${filterCount}개`);
            }

            return parts.length > 0 ? `적용됨 - ${parts.join(', ')}` : '적용됨';
          })()}
        </div>
      )}
    </div>
  );
};

// 도메인별 커스텀 빠른 필터들
export const itemQuickFilters: QuickFilter[] = [
  ...getQuickFilters(),
  {
    id: 'lowStock',
    label: '재고부족',
    filters: { stockStatus: 'low' }
  },
  {
    id: 'products',
    label: '완제품',
    filters: { category: '제품' }
  },
  {
    id: 'materials',
    label: '원자재',
    filters: { category: '원자재' }
  }
];

export const companyQuickFilters: QuickFilter[] = [
  ...getQuickFilters(),
  {
    id: 'customers',
    label: '고객사',
    filters: { company_type: 'CUSTOMER' }
  },
  {
    id: 'suppliers',
    label: '공급사',
    filters: { company_type: 'SUPPLIER' }
  }
];

export const inventoryQuickFilters: QuickFilter[] = [
  ...getQuickFilters().slice(0, 4), // 올해 제외
  {
    id: 'receiving',
    label: '입고',
    filters: { transaction_type: '입고' }
  },
  {
    id: 'production',
    label: '생산',
    filters: { transaction_type: '생산입고' }
  },
  {
    id: 'shipping',
    label: '출고',
    filters: { transaction_type: '출고' }
  },
  {
    id: 'lastMonth',
    label: '지난달',
    filters: {},
    dateRange: (() => {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: lastMonth.toISOString().split('T')[0],
        endDate: lastMonthEnd.toISOString().split('T')[0]
      };
    })()
  }
];

export default QuickFilters;