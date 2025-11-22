'use client';

import React from 'react';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';

/**
 * CompanyFilterSelect Props
 *
 * 공유 거래처 필터 드롭다운 컴포넌트
 */
export interface CompanyFilterSelectProps {
  /** 현재 선택된 값 ('ALL' 또는 company_id) */
  value: string | number | 'ALL';
  /** 값 변경 핸들러 */
  onChange: (value: string | number | 'ALL') => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 추가 클래스명 */
  className?: string;
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 라벨 표시 여부 */
  showLabel?: boolean;
  /** 라벨 텍스트 */
  label?: string;
  /** 로딩 메시지 표시 여부 */
  showLoadingMessage?: boolean;
  /** 너비 옵션 */
  width?: 'auto' | 'full' | 'w-64';
  /** 테스트 ID */
  testId?: string;
}

/**
 * CompanyFilterSelect
 *
 * 전사 통합 거래처 필터 드롭다운 컴포넌트
 * - useCompanyFilter 훅과 연동
 * - 다크모드 지원
 * - 반응형 디자인
 * - 로딩/에러 상태 처리
 */
export function CompanyFilterSelect({
  value,
  onChange,
  disabled,
  className = '',
  placeholder = '전체 거래처',
  showLabel = false,
  label = '거래처',
  showLoadingMessage = false,
  width = 'auto',
  testId = 'company-filter',
}: CompanyFilterSelectProps) {
  const { companies, loading, error } = useCompanyFilter();

  // 너비 클래스 결정
  const widthClass = {
    'auto': 'w-full sm:w-auto',
    'full': 'w-full',
    'w-64': 'w-full sm:w-64',
  }[width];

  // 현재 값을 select value로 변환
  const selectValue = value === 'ALL' ? '' : String(value);

  // 변경 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    if (newValue === '') {
      onChange('ALL');
    } else {
      // 숫자로 변환 가능하면 숫자로, 아니면 문자열로
      const numValue = parseInt(newValue, 10);
      onChange(isNaN(numValue) ? newValue : numValue);
    }
  };

  const isDisabled = disabled || loading;

  return (
    <div className={`flex-1 ${className}`}>
      {showLabel && (
        <label
          htmlFor={testId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {label}
        </label>
      )}

      <select
        id={testId}
        data-testid={testId}
        value={selectValue}
        onChange={handleChange}
        disabled={isDisabled}
        className={`
          ${widthClass}
          px-4 py-2
          border border-gray-300 dark:border-gray-700
          rounded-lg
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-white
          text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:bg-gray-100 dark:disabled:bg-gray-700
          disabled:cursor-not-allowed
        `}
      >
        <option value="">{placeholder}</option>
        {companies.map((company) => (
          <option key={company.value} value={company.value}>
            {company.label}
          </option>
        ))}
      </select>

      {/* 로딩 메시지 */}
      {showLoadingMessage && loading && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          거래처 불러오는 중...
        </p>
      )}

      {/* 에러 메시지 */}
      {error && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default CompanyFilterSelect;
