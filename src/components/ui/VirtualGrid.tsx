'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Filter, Grid, List } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

// Grid item render function type
export type GridItemRenderer<T = any> = (
  item: T,
  index: number,
  isSelected?: boolean
) => React.ReactNode;

// Grid configuration
interface GridConfig {
  columns: number;
  gap: number;
  itemHeight: number;
  itemWidth?: number;
}

// Filter configuration
interface FilterConfig {
  [key: string]: string;
}

// Virtual grid props
interface VirtualGridProps<T = any> {
  data: T[];
  renderItem: GridItemRenderer<T>;
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  searchable?: boolean;
  searchKeys?: string[];
  searchPlaceholder?: string;
  filterable?: boolean;
  filters?: { key: string; label: string; options?: string[] }[];
  className?: string;
  itemClassName?: string | ((item: T, index: number) => string);
  onItemClick?: (item: T, index: number) => void;
  selectable?: boolean;
  selectedItems?: T[];
  onSelectionChange?: (selectedItems: T[]) => void;
  getItemKey?: (item: T, index: number) => string | number;
  overscan?: number;
  // Responsive grid configuration
  gridConfig?: {
    sm?: GridConfig;
    md?: GridConfig;
    lg?: GridConfig;
    xl?: GridConfig;
    '2xl'?: GridConfig;
  };
  // Default grid config
  defaultGridConfig?: GridConfig;
}

// Default responsive grid configurations
const defaultResponsiveConfig = {
  sm: { columns: 1, gap: 16, itemHeight: 200 },
  md: { columns: 2, gap: 16, itemHeight: 200 },
  lg: { columns: 3, gap: 20, itemHeight: 220 },
  xl: { columns: 4, gap: 20, itemHeight: 220 },
  '2xl': { columns: 5, gap: 24, itemHeight: 240 }
};

export function VirtualGrid<T extends Record<string, any>>({
  data,
  renderItem,
  height = 600,
  loading = false,
  emptyMessage = '데이터가 없습니다',
  searchable = true,
  searchKeys = [],
  searchPlaceholder = '검색...',
  filterable = true,
  filters = [],
  className = '',
  itemClassName = '',
  onItemClick,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  getItemKey,
  overscan = 5,
  gridConfig,
  defaultGridConfig = defaultResponsiveConfig.lg
}: VirtualGridProps<T>) {
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterConfig>({});
  const [showFilters, setShowFilters] = useState(false);
  const [currentGridConfig, setCurrentGridConfig] = useState<GridConfig>(defaultGridConfig);

  // Container ref for virtualizer
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Responsive grid handling
  React.useEffect(() => {
    if (!gridConfig) return;

    const handleResize = () => {
      const width = window.innerWidth;
      let config: GridConfig;

      if (width >= 1536 && gridConfig['2xl']) {
        config = gridConfig['2xl'];
      } else if (width >= 1280 && gridConfig.xl) {
        config = gridConfig.xl;
      } else if (width >= 1024 && gridConfig.lg) {
        config = gridConfig.lg;
      } else if (width >= 768 && gridConfig.md) {
        config = gridConfig.md;
      } else if (gridConfig.sm) {
        config = gridConfig.sm;
      } else {
        config = defaultGridConfig;
      }

      setCurrentGridConfig(config);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridConfig, defaultGridConfig]);

  // Process data (filter and search)
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchTerm && searchKeys.length > 0) {
      result = result.filter(item =>
        searchKeys.some(key => {
          const value = item[key];
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    } else if (searchTerm) {
      // Search all string properties if no specific keys provided
      result = result.filter(item =>
        Object.values(item).some(value =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply filters
    Object.entries(activeFilters).forEach(([key, filterValue]) => {
      if (filterValue) {
        result = result.filter(item => {
          const value = item[key];
          return value?.toString().toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });

    return result;
  }, [data, searchTerm, searchKeys, activeFilters]);

  // Calculate grid layout
  const gridLayout = useMemo(() => {
    const { columns, gap, itemHeight, itemWidth } = currentGridConfig;
    const totalRows = Math.ceil(processedData.length / columns);
    const rowHeight = itemHeight + gap;

    return {
      columns,
      totalRows,
      rowHeight,
      itemHeight,
      itemWidth,
      gap
    };
  }, [currentGridConfig, processedData.length]);

  // Create virtualizer for rows
  const virtualizer = useVirtualizer({
    count: gridLayout.totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => gridLayout.rowHeight,
    overscan
  });

  // Handle filter change
  const handleFilterChange = useCallback((key: string, value: string) => {
    setActiveFilters(current => ({
      ...current,
      [key]: value
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters({});
    setSearchTerm('');
  }, []);

  // Handle item selection
  const handleItemSelect = useCallback((item: T, index: number) => {
    if (!selectable || !onSelectionChange) return;

    const itemKey = getItemKey ? getItemKey(item, index) : index;
    const isSelected = selectedItems.some((selected, idx) => {
      const selectedKey = getItemKey ? getItemKey(selected, idx) : idx;
      return selectedKey === itemKey;
    });

    if (isSelected) {
      onSelectionChange(selectedItems.filter((selected, idx) => {
        const selectedKey = getItemKey ? getItemKey(selected, idx) : idx;
        return selectedKey !== itemKey;
      }));
    } else {
      onSelectionChange([...selectedItems, item]);
    }
  }, [selectable, selectedItems, onSelectionChange, getItemKey]);

  // Get item class name
  const getItemClassName = useCallback((item: T, index: number) => {
    if (typeof itemClassName === 'function') {
      return itemClassName(item, index);
    }
    return itemClassName;
  }, [itemClassName]);

  // Check if item is selected
  const isItemSelected = useCallback((item: T, index: number) => {
    if (!selectable) return false;
    const itemKey = getItemKey ? getItemKey(item, index) : index;
    return selectedItems.some((selected, idx) => {
      const selectedKey = getItemKey ? getItemKey(selected, idx) : idx;
      return selectedKey === itemKey;
    });
  }, [selectable, selectedItems, getItemKey]);

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
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                  />
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {/* Grid Config Display */}
              <div className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Grid className="w-4 h-4 mr-2" />
                {gridLayout.columns}열
              </div>

              {/* Filter Toggle */}
              {filterable && filters.length > 0 && (
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
              )}

              {/* Clear Filters */}
              {(Object.values(activeFilters).some(v => v) || searchTerm) && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  초기화
                </button>
              )}
            </div>
          </div>

          {/* Filter Inputs */}
          {filterable && showFilters && filters.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filters.map(filter => (
                <div key={filter.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {filter.label}
                  </label>
                  {filter.options ? (
                    <select
                      value={activeFilters[filter.key] || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
                    >
                      <option value="">전체</option>
                      {filter.options.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={`${filter.label} 필터...`}
                      value={activeFilters[filter.key] || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Data Info */}
      <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <span>전체 {data.length}개 항목 중 {processedData.length}개 표시</span>
        {selectable && selectedItems.length > 0 && (
          <span className="text-gray-800 dark:text-gray-200 font-medium">
            {selectedItems.length}개 선택됨
          </span>
        )}
      </div>

      {/* Virtual Grid */}
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
              position: 'relative',
              padding: `${gridLayout.gap}px`
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const startIndex = virtualRow.index * gridLayout.columns;
              const endIndex = Math.min(startIndex + gridLayout.columns, processedData.length);
              const rowItems = processedData.slice(startIndex, endIndex);

              return (
                <div
                  key={virtualRow.index}
                  className="absolute top-0 left-0 w-full"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  <div
                    className="grid h-full"
                    style={{
                      gridTemplateColumns: `repeat(${gridLayout.columns}, 1fr)`,
                      gap: `${gridLayout.gap}px`,
                      padding: `0 ${gridLayout.gap}px`
                    }}
                  >
                    {rowItems.map((item, columnIndex) => {
                      const itemIndex = startIndex + columnIndex;
                      const isSelected = isItemSelected(item, itemIndex);

                      return (
                        <div
                          key={getItemKey ? getItemKey(item, itemIndex) : itemIndex}
                          className={`relative transition-all duration-200 ${
                            onItemClick || selectable ? 'cursor-pointer' : ''
                          } ${isSelected ? 'ring-2 ring-gray-400 dark:ring-gray-500 ring-opacity-50' : ''} ${
                            getItemClassName(item, itemIndex)
                          }`}
                          style={{
                            height: `${gridLayout.itemHeight}px`,
                            width: gridLayout.itemWidth || '100%'
                          }}
                          onClick={() => {
                            if (selectable) {
                              handleItemSelect(item, itemIndex);
                            }
                            onItemClick?.(item, itemIndex);
                          }}
                        >
                          {renderItem(item, itemIndex, isSelected)}

                          {/* Selection indicator */}
                          {selectable && isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualGrid;