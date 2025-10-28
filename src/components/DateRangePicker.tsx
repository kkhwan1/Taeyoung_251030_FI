'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxDate?: Date;
  minDate?: Date;
}

interface QuickPreset {
  label: string;
  getValue: () => DateRange;
}

// Korean months and day names
const KOREAN_MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

const KOREAN_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// Quick date presets
const QUICK_PRESETS: QuickPreset[] = [
  {
    label: '오늘',
    getValue: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: today, endDate: endOfDay };
    }
  },
  {
    label: '어제',
    getValue: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const endOfDay = new Date(yesterday);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: yesterday, endDate: endOfDay };
    }
  },
  {
    label: '이번 주',
    getValue: () => {
      const today = new Date();
      const day = today.getDay();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  },
  {
    label: '지난 주',
    getValue: () => {
      const today = new Date();
      const day = today.getDay();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - day - 7);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  },
  {
    label: '이번 달',
    getValue: () => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  },
  {
    label: '지난 달',
    getValue: () => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  },
  {
    label: '최근 3개월',
    getValue: () => {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  },
  {
    label: '최근 6개월',
    getValue: () => {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 6);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  },
  {
    label: '올해',
    getValue: () => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(today.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  }
];

export default function DateRangePicker({
  value,
  onChange,
  placeholder = '날짜 범위 선택',
  className = '',
  disabled = false,
  maxDate,
  minDate
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date for Korean locale
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  // Format date range display
  const formatDateRange = (): string => {
    if (!value.startDate && !value.endDate) return placeholder;
    if (value.startDate && !value.endDate) {
      return `${formatDate(value.startDate)} ~`;
    }
    if (!value.startDate && value.endDate) {
      return `~ ${formatDate(value.endDate)}`;
    }
    if (value.startDate && value.endDate) {
      return `${formatDate(value.startDate)} ~ ${formatDate(value.endDate)}`;
    }
    return placeholder;
  };

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }

    return days;
  };

  // Check if a date is in the current month
  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth() &&
           date.getFullYear() === currentMonth.getFullYear();
  };

  // Check if a date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if a date is selected (start or end)
  const isSelected = (date: Date): boolean => {
    if (!value.startDate && !value.endDate) return false;

    const dateStr = date.toDateString();
    const startStr = value.startDate?.toDateString();
    const endStr = value.endDate?.toDateString();

    return dateStr === startStr || dateStr === endStr;
  };

  // Check if a date is in the selected range
  const isInRange = (date: Date): boolean => {
    if (!value.startDate || !value.endDate) return false;
    return date >= value.startDate && date <= value.endDate;
  };

  // Check if a date is disabled
  const isDisabled = (date: Date): boolean => {
    if (disabled) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    if (isDisabled(date)) return;

    if (selectingStart || !value.startDate) {
      onChange({ startDate: date, endDate: null });
      setSelectingStart(false);
    } else {
      if (date < value.startDate) {
        onChange({ startDate: date, endDate: value.startDate });
      } else {
        onChange({ startDate: value.startDate, endDate: date });
      }
      setSelectingStart(true);
    }
  };

  // Handle preset selection
  const handlePresetSelect = (preset: QuickPreset) => {
    const range = preset.getValue();
    onChange(range);
    setSelectingStart(true);
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // Clear selection
  const clearSelection = () => {
    onChange({ startDate: null, endDate: null });
    setSelectingStart(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Display */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors
          ${disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'
            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          }
          ${isOpen ? 'ring-2 ring-blue-500 border-gray-500' : ''}
        `}
      >
        <Calendar className="w-5 h-5 text-gray-400" />
        <span className={`flex-1 text-sm ${!value.startDate && !value.endDate ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}>
          {formatDateRange()}
        </span>
        {(value.startDate || value.endDate) && !disabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearSelection();
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Calendar */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm z-50 p-4 min-w-80">
          {/* Quick Presets */}
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">빠른 선택</div>
            <div className="grid grid-cols-3 gap-1">
              {QUICK_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => handlePresetSelect(preset)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {currentMonth.getFullYear()}년 {KOREAN_MONTHS[currentMonth.getMonth()]}
            </div>
            <button
              onClick={goToNextMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 mb-2">
            {KOREAN_DAYS.map((day, index) => (
              <div key={index} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {generateCalendarDays().map((date, index) => {
              const isCurrentMonthDay = isCurrentMonth(date);
              const isTodayDay = isToday(date);
              const isSelectedDay = isSelected(date);
              const isInRangeDay = isInRange(date);
              const isDisabledDay = isDisabled(date);

              return (
                <button
                  key={index}
                  onClick={() => handleDateSelect(date)}
                  disabled={isDisabledDay}
                  className={`
                    w-8 h-8 text-sm rounded flex items-center justify-center transition-colors
                    ${!isCurrentMonthDay
                      ? 'text-gray-300 dark:text-gray-600'
                      : 'text-gray-900 dark:text-white'
                    }
                    ${isDisabledDay
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                    ${isTodayDay && !isSelectedDay
                      ? 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300'
                      : ''
                    }
                    ${isSelectedDay
                      ? 'bg-gray-500 text-white'
                      : ''
                    }
                    ${isInRangeDay && !isSelectedDay
                      ? 'bg-gray-100 dark:bg-gray-900'
                      : ''
                    }
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Selection Info */}
          {(value.startDate || value.endDate) && (
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <div>시작일: {value.startDate ? formatDate(value.startDate) : '선택 안됨'}</div>
                <div>종료일: {value.endDate ? formatDate(value.endDate) : '선택 안됨'}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}