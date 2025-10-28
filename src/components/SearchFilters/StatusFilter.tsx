/**
 * 상태 기반 필터 컴포넌트
 * Status-based Filter Component with visual indicators
 */

import React from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { CategoryFilter, FilterOption } from './CategoryFilter';

export interface StatusOption extends FilterOption {
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  icon?: 'check' | 'alert' | 'clock' | 'x' | 'package';
  description?: string;
}

interface StatusFilterProps {
  options: StatusOption[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  label?: string;
  placeholder?: string;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
  showCount?: boolean;
  allowClear?: boolean;
  showVisualIndicators?: boolean;
}

const StatusIcon: React.FC<{ type?: string; className?: string }> = ({ type, className = 'w-4 h-4' }) => {
  switch (type) {
    case 'check':
      return <CheckCircle className={className} />;
    case 'alert':
      return <AlertCircle className={className} />;
    case 'clock':
      return <Clock className={className} />;
    case 'x':
      return <XCircle className={className} />;
    case 'package':
      return <Package className={className} />;
    default:
      return <CheckCircle className={className} />;
  }
};

const getColorClasses = (color?: string) => {
  switch (color) {
    case 'green':
      return {
        bg: 'bg-gray-100 dark:bg-gray-900/20',
        text: 'text-gray-800 dark:text-gray-300',
        icon: 'text-gray-600 dark:text-gray-400'
      };
    case 'yellow':
      return {
        bg: 'bg-gray-100 dark:bg-gray-900/20',
        text: 'text-gray-800 dark:text-gray-300',
        icon: 'text-gray-600 dark:text-gray-400'
      };
    case 'red':
      return {
        bg: 'bg-gray-100 dark:bg-gray-900/20',
        text: 'text-gray-800 dark:text-gray-300',
        icon: 'text-gray-600 dark:text-gray-400'
      };
    case 'blue':
      return {
        bg: 'bg-gray-100 dark:bg-gray-900/20',
        text: 'text-gray-800 dark:text-gray-300',
        icon: 'text-gray-600 dark:text-gray-400'
      };
    default:
      return {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-800 dark:text-gray-300',
        icon: 'text-gray-600 dark:text-gray-400'
      };
  }
};

export const StatusFilter: React.FC<StatusFilterProps> = ({
  options,
  value,
  onChange,
  label = '상태',
  placeholder = '상태 선택',
  multiple = false,
  className = '',
  disabled = false,
  showCount = true,
  allowClear = true,
  showVisualIndicators = true
}) => {
  // 시각적 인디케이터와 함께 옵션 렌더링
  const renderCustomOption = (option: StatusOption, isSelected: boolean) => {
    const colorClasses = getColorClasses(option.color);

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {multiple && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}} // 부모에서 처리
              className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-blue-500"
            />
          )}

          {showVisualIndicators && (
            <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${colorClasses.bg}`}>
              <StatusIcon
                type={option.icon}
                className={`w-3 h-3 ${colorClasses.icon}`}
              />
              <span className={`text-xs font-medium ${colorClasses.text}`}>
                {option.label}
              </span>
            </div>
          )}

          {!showVisualIndicators && (
            <span>{option.label}</span>
          )}

          {option.description && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {option.description}
            </span>
          )}
        </div>

        {showCount && option.count !== undefined && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({option.count})
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <CategoryFilter
        options={options}
        value={value}
        onChange={onChange}
        label={label}
        placeholder={placeholder}
        multiple={multiple}
        disabled={disabled}
        showCount={false} // 커스텀 렌더링에서 처리
        allowClear={allowClear}
      />

      {/* 선택된 상태들을 시각적으로 표시 (단일 선택일 때도) */}
      {showVisualIndicators && value && (
        <div className="mt-2">
          {(Array.isArray(value) ? value : [value]).map((val) => {
            const option = options.find(opt => opt.value === val);
            if (!option) return null;

            const colorClasses = getColorClasses(option.color);

            return (
              <div
                key={val}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${colorClasses.bg} mr-2 mb-1`}
              >
                <StatusIcon
                  type={option.icon}
                  className={`w-3 h-3 ${colorClasses.icon}`}
                />
                <span className={`text-sm font-medium ${colorClasses.text}`}>
                  {option.label}
                </span>
                {showCount && option.count !== undefined && (
                  <span className={`text-xs ${colorClasses.text} opacity-75`}>
                    ({option.count})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// 미리 정의된 상태 옵션들
export const stockStatusOptions: StatusOption[] = [
  {
    value: 'normal',
    label: '정상',
    color: 'green',
    icon: 'check',
    description: '충분한 재고'
  },
  {
    value: 'low',
    label: '부족',
    color: 'yellow',
    icon: 'alert',
    description: '최소 재고 이하'
  },
  {
    value: 'empty',
    label: '재고없음',
    color: 'red',
    icon: 'x',
    description: '재고 0개'
  },
  {
    value: 'excess',
    label: '과다',
    color: 'blue',
    icon: 'package',
    description: '과다 재고'
  }
];

export const transactionStatusOptions: StatusOption[] = [
  {
    value: 'pending',
    label: '대기중',
    color: 'yellow',
    icon: 'clock',
    description: '처리 대기'
  },
  {
    value: 'completed',
    label: '완료',
    color: 'green',
    icon: 'check',
    description: '처리 완료'
  },
  {
    value: 'cancelled',
    label: '취소',
    color: 'red',
    icon: 'x',
    description: '처리 취소'
  }
];

export const itemStatusOptions: StatusOption[] = [
  {
    value: 'active',
    label: '활성',
    color: 'green',
    icon: 'check',
    description: '사용 중인 품목'
  },
  {
    value: 'inactive',
    label: '비활성',
    color: 'gray',
    icon: 'x',
    description: '사용 중지된 품목'
  }
];

export default StatusFilter;