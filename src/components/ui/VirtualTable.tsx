'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronUp, ChevronDown, Filter, Search } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { debounce } from '@/lib/utils';

// Column definition interface
export interface VirtualTableColumn<T = any> {
  key: string;
  title: string;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

// Sort configuration
interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Filter configuration
interface FilterConfig {
  [key: string]: string;
}

// Virtual table props
interface VirtualTableProps<T = any> {
  data: T[];
  columns: VirtualTableColumn<T>[];
  height?: number;
  rowHeight?: number;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  headerClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  overscan?: number;
  stickyHeader?: boolean;
}

export function VirtualTable<T extends Record<string, any>>({
  data,
  columns,
  height = 600,
  rowHeight = 48,
  loading = false,
  emptyMessage = '데이터가 없습니다',
  onRowClick,
  sortable = true,
  filterable = true,
  searchable = true,
  searchPlaceholder = '검색...',
  className = '',
  headerClassName = '',
  rowClassName = '',
  overscan = 5,
  stickyHeader = true
}: VirtualTableProps<T>) {
  // Local state
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search handler to prevent excessive re-renders
  const debouncedSetSearchTerm = useMemo(
    () => debounce((value: string) => setSearchTerm(value), 300),
    []
  );

  // Cleanup debounce on unmount to prevent memory leaks
  useEffect(() => {
    return () => debouncedSetSearchTerm.cancel();
  }, [debouncedSetSearchTerm]);

  // Create container ref for virtualizer
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchTerm) {
      result = result.filter(row =>
        columns.some(column => {
          const value = row[column.key];
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, filterValue]) => {
      if (filterValue) {
        result = result.filter(row => {
          const value = row[key];
          return value?.toString().toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, filters, sortConfig, columns]);

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: processedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan
  });

  // Handle sorting
  const handleSort = useCallback((key: string) => {
    if (!sortable) return;

    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  }, [sortable]);

  // Handle filter change
  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(current => ({
      ...current,
      [key]: value
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchTerm('');
  }, []);

  // Render cell content
  const renderCell = useCallback((column: VirtualTableColumn<T>, row: T, index: number) => {
    const value = row[column.key];

    if (column.render) {
      return column.render(value, row, index);
    }

    return value?.toString() || '-';
  }, []);

  // Get row class name
  const getRowClassName = useCallback((row: T, index: number) => {
    if (typeof rowClassName === 'function') {
      return rowClassName(row, index);
    }
    return rowClassName;
  }, [rowClassName]);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden ${className}`}>
      {/* Search and Filter Controls */}
      {(searchable || filterable) && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            {searchable && (
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    defaultValue={searchTerm}
                    onChange={(e) => debouncedSetSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                  />
                </div>
              </div>
            )}

            {/* Filter Toggle */}
            {filterable && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                    showFilters
                      ? 'bg-gray-100 border-gray-400 text-gray-800 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200'
                      : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  필터
                </button>
                {(Object.values(filters).some(v => v) || searchTerm) && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    초기화
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Column Filters */}
          {filterable && showFilters && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {columns.filter(col => col.filterable !== false).map(column => (
                <div key={column.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {column.title}
                  </label>
                  <input
                    type="text"
                    placeholder={`${column.title} 필터...`}
                    value={filters[column.key] || ''}
                    onChange={(e) => handleFilterChange(column.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Data Info */}
      <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
        전체 {data.length}개 항목 중 {processedData.length}개 표시
      </div>

      {/* Virtual Table */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: `${height}px` }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" text="데이터 로딩 중..." />
          </div>
        ) : processedData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {emptyMessage}
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {/* Sticky Header */}
            {stickyHeader && (
              <div
                className={`sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${headerClassName}`}
                style={{ height: `${rowHeight}px` }}
              >
                <div className="flex items-center h-full">
                  {columns.map((column, columnIndex) => (
                    <div
                      key={column.key}
                      className={`flex items-center justify-between px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider ${
                        column.className || ''
                      }`}
                      style={{
                        width: column.width || `${100 / columns.length}%`,
                        textAlign: column.align || 'left'
                      }}
                    >
                      <span className="truncate">{column.title}</span>
                      {sortable && column.sortable !== false && (
                        <button
                          onClick={() => handleSort(column.key)}
                          className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {sortConfig?.key === column.key ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )
                          ) : (
                            <div className="w-4 h-4 flex flex-col justify-center">
                              <ChevronUp className="w-4 h-2" />
                              <ChevronDown className="w-4 h-2" />
                            </div>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Virtual Rows */}
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = processedData[virtualRow.index];
              return (
                <div
                  key={virtualRow.index}
                  className={`absolute top-0 left-0 w-full flex items-center border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${getRowClassName(row, virtualRow.index)}`}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start + (stickyHeader ? rowHeight : 0)}px)`
                  }}
                  onClick={() => onRowClick?.(row, virtualRow.index)}
                >
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      className={`px-6 py-3 text-sm text-gray-800 dark:text-gray-200 ${
                        column.className || ''
                      }`}
                      style={{
                        width: column.width || `${100 / columns.length}%`,
                        textAlign: column.align || 'left'
                      }}
                    >
                      <div className="truncate">
                        {renderCell(column, row, virtualRow.index)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualTable;