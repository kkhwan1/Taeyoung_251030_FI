/**
 * 날짜 범위 필터 컴포넌트
 * Date Range Filter Component with Korean Calendar Support
 */

import React, { useState } from 'react';
import { Calendar, X } from 'lucide-react';

interface DateRangeFilterProps {
  startDate?: string;
  endDate?: string;
  onChange: (range: { startDate?: string; endDate?: string }) => void;
  label?: string;
  placeholder?: {
    start?: string;
    end?: string;
  };
  className?: string;
  disabled?: boolean;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onChange,
  label = '기간 선택',
  placeholder = {
    start: '시작일',
    end: '종료일'
  },
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatDateForDisplay = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const handleStartDateChange = (value: string) => {
    onChange({ startDate: value, endDate });
  };

  const handleEndDateChange = (value: string) => {
    onChange({ startDate, endDate: value });
  };

  const handleClear = () => {
    onChange({ startDate: undefined, endDate: undefined });
  };

  const hasValue = startDate || endDate;

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      <div className="space-y-2">
        {/* 시작일 입력 */}
        <div className="relative">
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => handleStartDateChange(e.target.value)}
            disabled={disabled}
            max={endDate}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={placeholder.start}
          />
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          {startDate && (
            <button
              onClick={() => handleStartDateChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={disabled}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 구분자 */}
        <div className="text-center text-gray-400 text-sm">~</div>

        {/* 종료일 입력 */}
        <div className="relative">
          <input
            type="date"
            value={endDate || ''}
            onChange={(e) => handleEndDateChange(e.target.value)}
            disabled={disabled}
            min={startDate}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={placeholder.end}
          />
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          {endDate && (
            <button
              onClick={() => handleEndDateChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={disabled}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 전체 초기화 버튼 */}
        {hasValue && (
          <button
            onClick={handleClear}
            disabled={disabled}
            className="w-full py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            날짜 범위 초기화
          </button>
        )}
      </div>

      {/* 선택된 범위 표시 */}
      {hasValue && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/20 rounded text-sm text-gray-700 dark:text-gray-300">
          {startDate && formatDateForDisplay(startDate)}
          {startDate && endDate && ' ~ '}
          {endDate && formatDateForDisplay(endDate)}
        </div>
      )}

      {/* 유효성 검사 메시지 */}
      {startDate && endDate && new Date(startDate) > new Date(endDate) && (
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          시작일은 종료일보다 이전이어야 합니다.
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;