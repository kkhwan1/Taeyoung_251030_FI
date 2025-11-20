/**
 * CompanyFilterSearch Component
 *
 * Real-time search and filtering for companies with:
 * - Debounced search input (300ms)
 * - Fuzzy matching on company_name and company_code
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Accessible combobox pattern (ARIA)
 * - Loading and error states
 * - Dark mode support
 * - Highlight matching text
 *
 * Usage:
 * ```tsx
 * <CompanyFilterSearch
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   onSelect={(company) => handleCompanySelect(company)}
 *   placeholder="거래처 검색..."
 * />
 * ```
 */

'use client';

import React from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';

interface Company {
  value: string;
  label: string;
}

interface CompanyFilterSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (company: Company) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  maxResults?: number;
  showDropdown?: boolean;
  autoFocus?: boolean;
}

export function CompanyFilterSearch({
  value,
  onChange,
  onSelect,
  placeholder = '거래처 검색...',
  className = '',
  debounceMs = 300,
  maxResults = 10,
  showDropdown = true,
  autoFocus = false,
}: CompanyFilterSearchProps) {
  const { companies, loading: companiesLoading } = useCompanyFilter();
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [isDebouncing, setIsDebouncing] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Debounce search input
  React.useEffect(() => {
    if (value !== debouncedValue) {
      setIsDebouncing(true);
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
      setIsDebouncing(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, debounceMs, debouncedValue]);

  // Filter companies based on search
  const filteredCompanies = React.useMemo(() => {
    if (!debouncedValue.trim()) {
      return [];
    }

    const searchLower = debouncedValue.toLowerCase();

    return companies
      .filter(company => {
        const labelMatch = company.label.toLowerCase().includes(searchLower);
        const valueMatch = company.value.toLowerCase().includes(searchLower);
        return labelMatch || valueMatch;
      })
      .slice(0, maxResults);
  }, [debouncedValue, companies, maxResults]);

  // Show dropdown when there are results
  React.useEffect(() => {
    if (showDropdown && filteredCompanies.length > 0 && debouncedValue.trim()) {
      setIsOpen(true);
      setHighlightedIndex(0);
    } else {
      setIsOpen(false);
    }
  }, [filteredCompanies.length, debouncedValue, showDropdown]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredCompanies.length === 0) {
      if (e.key === 'Escape') {
        onChange('');
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredCompanies.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredCompanies.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (filteredCompanies[highlightedIndex]) {
          handleSelect(filteredCompanies[highlightedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        onChange('');
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (company: Company) => {
    onSelect?.(company);
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Highlight matching text
  const highlightMatch = (text: string, search: string) => {
    if (!search.trim()) return text;

    const index = text.toLowerCase().indexOf(search.toLowerCase());
    if (index === -1) return text;

    const before = text.slice(0, index);
    const match = text.slice(index, index + search.length);
    const after = text.slice(index + search.length);

    return (
      <>
        {before}
        <mark className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
          {match}
        </mark>
        {after}
      </>
    );
  };

  const isLoading = companiesLoading || isDebouncing;

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-gray-400" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (showDropdown && filteredCompanies.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="
            w-full
            pl-10 pr-10 py-2
            text-base
            border border-gray-300 dark:border-gray-600
            rounded-md
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            placeholder-gray-500 dark:placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
            focus:border-transparent
            transition-colors
          "
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="company-search-listbox"
          aria-activedescendant={
            isOpen && filteredCompanies[highlightedIndex]
              ? `company-option-${highlightedIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-label="거래처 검색"
        />

        {/* Clear Button */}
        {value && (
          <button
            onClick={handleClear}
            className="
              absolute inset-y-0 right-0 pr-3
              flex items-center
              text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
              focus:outline-none focus:text-gray-600
              transition-colors
            "
            aria-label="검색어 지우기"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && showDropdown && filteredCompanies.length > 0 && (
        <div
          ref={dropdownRef}
          id="company-search-listbox"
          role="listbox"
          aria-label="거래처 검색 결과"
          className="
            absolute z-50 mt-1 w-full
            max-h-60 overflow-auto
            bg-white dark:bg-gray-800
            border border-gray-300 dark:border-gray-600
            rounded-md shadow-lg
            py-1
          "
        >
          {filteredCompanies.map((company, index) => (
            <button
              key={company.value}
              id={`company-option-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onClick={() => handleSelect(company)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`
                w-full px-4 py-2 text-left
                transition-colors
                ${
                  index === highlightedIndex
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                    : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {highlightMatch(company.label, debouncedValue)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  {highlightMatch(company.value, debouncedValue)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {isOpen && showDropdown && debouncedValue.trim() && filteredCompanies.length === 0 && !isLoading && (
        <div
          className="
            absolute z-50 mt-1 w-full
            bg-white dark:bg-gray-800
            border border-gray-300 dark:border-gray-600
            rounded-md shadow-lg
            py-3 px-4
            text-center text-gray-500 dark:text-gray-400
          "
          role="status"
        >
          검색 결과가 없습니다
        </div>
      )}

      {/* Screen Reader Status */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isLoading && '검색 중...'}
        {!isLoading && filteredCompanies.length > 0 &&
          `${filteredCompanies.length}개의 거래처를 찾았습니다`}
        {!isLoading && debouncedValue.trim() && filteredCompanies.length === 0 &&
          '검색 결과가 없습니다'}
      </div>
    </div>
  );
}
