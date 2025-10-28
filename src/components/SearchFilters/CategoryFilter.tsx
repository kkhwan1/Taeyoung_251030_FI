/**
 * 카테고리/타입 드롭다운 필터 컴포넌트
 * Category/Type Dropdown Filter Component
 */

import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface CategoryFilterProps {
  options: FilterOption[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  label?: string;
  placeholder?: string;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
  showCount?: boolean;
  allowClear?: boolean;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = '선택하세요',
  multiple = false,
  className = '',
  disabled = false,
  showCount = true,
  allowClear = true
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedValues = multiple
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : value ? [value] : [];

  const getDisplayText = (): string => {
    if (selectedValues.length === 0) return placeholder;

    if (!multiple) {
      const option = options.find(opt => opt.value === selectedValues[0]);
      return option ? option.label : String(selectedValues[0]);
    }

    if (selectedValues.length === 1) {
      const option = options.find(opt => opt.value === selectedValues[0]);
      return option ? option.label : String(selectedValues[0]);
    }

    return `${selectedValues.length}개 선택됨`;
  };

  const handleOptionClick = (optionValue: string) => {
    if (disabled) return;

    if (!multiple) {
      onChange(optionValue);
      setIsOpen(false);
      return;
    }

    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue];

    onChange(newValues as string[]);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(multiple ? [] : '');
  };

  const hasValue = selectedValues.length > 0;

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={`truncate ${!hasValue ? 'text-gray-500 dark:text-gray-400' : ''}`}>
            {getDisplayText()}
          </span>

          <div className="flex items-center gap-1">
            {hasValue && allowClear && !disabled && (
              <button
                onClick={handleClear}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`} />
          </div>
        </button>

        {/* 드롭다운 옵션 */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm max-h-60 overflow-auto">
            {/* 전체 선택/해제 (다중 선택 시) */}
            {multiple && options.length > 1 && (
              <>
                <button
                  onClick={() => {
                    const allValues = options.filter(opt => !opt.disabled).map(opt => opt.value);
                    onChange(selectedValues.length === allValues.length ? [] : allValues);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
                >
                  {selectedValues.length === options.filter(opt => !opt.disabled).length ? '전체 해제' : '전체 선택'}
                </button>
              </>
            )}

            {/* 옵션 목록 */}
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionClick(option.value)}
                disabled={option.disabled}
                className={`w-full px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedValues.includes(option.value)
                    ? 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {multiple && (
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(option.value)}
                        onChange={() => {}} // 부모 onClick에서 처리
                        className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    )}
                    <span>{option.label}</span>
                  </div>
                  {showCount && option.count !== undefined && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({option.count})
                    </span>
                  )}
                </div>
              </button>
            ))}

            {/* 옵션이 없을 때 */}
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                선택할 수 있는 옵션이 없습니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 클릭 외부 영역 감지 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 선택된 값들 표시 (다중 선택 시) */}
      {multiple && selectedValues.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedValues.map((val) => {
            const option = options.find(opt => opt.value === val);
            const label = option ? option.label : String(val);

            return (
              <span
                key={String(val)}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300 text-xs rounded-full"
              >
                {label}
                {!disabled && (
                  <button
                    onClick={() => handleOptionClick(String(val))}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryFilter;