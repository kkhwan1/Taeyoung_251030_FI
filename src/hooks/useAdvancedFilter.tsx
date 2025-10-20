/**
 * 고급 필터링 훅
 * Advanced Filtering Hook with debounced search and localStorage persistence
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SearchQueryParams,
  buildSearchQuery,
  createDebouncedSearch,
  normalizeKoreanText,
  validateFilterCombination,
  trackSearch,
  prepareFilterStateForExport
} from '@/utils/searchUtils';

export interface FilterState {
  searchTerm: string;
  dateRange: {
    startDate?: string;
    endDate?: string;
  };
  filters: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UseAdvancedFilterOptions {
  persistKey?: string; // localStorage 키
  debounceMs?: number; // 디바운스 시간
  enableUrlSync?: boolean; // URL 동기화 여부
  maxSearchHistory?: number; // 최대 검색 기록 수
  onFilterChange?: (state: FilterState) => void; // 필터 변경 콜백
}

export interface UseAdvancedFilterReturn {
  // 상태
  filterState: FilterState;
  isFiltering: boolean;
  hasActiveFilters: boolean;

  // 액션
  setSearchTerm: (term: string) => void;
  setDateRange: (range: { startDate?: string; endDate?: string }) => void;
  setFilter: (key: string, value: unknown) => void;
  setFilters: (filters: Record<string, any>) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  clearAllFilters: () => void;
  clearFilter: (key: string) => void;

  // 필터 관리
  saveFilter: (name: string) => void;
  loadFilter: (name: string) => void;
  deleteSavedFilter: (name: string) => void;
  getSavedFilters: () => Array<{ name: string; filters: FilterState; createdAt: string }>;

  // 유틸리티
  buildQueryParams: () => URLSearchParams;
  exportFilterState: () => any;
  getFilteredData: <T>(data: T[], searchFields: string[]) => T[];
}

export const useAdvancedFilter = (
  options: UseAdvancedFilterOptions = {}
): UseAdvancedFilterReturn => {
  const {
    persistKey = 'advancedFilter',
    debounceMs = 300,
    enableUrlSync = true,
    maxSearchHistory = 50,
    onFilterChange
  } = options;

  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterState, setFilterState] = useState<FilterState>({
    searchTerm: '',
    dateRange: {},
    filters: {},
    sortBy: undefined,
    sortOrder: 'desc'
  });

  const [isFiltering, setIsFiltering] = useState(false);

  // URL에서 초기 상태 로드
  useEffect(() => {
    if (enableUrlSync && searchParams) {
      const initialState: FilterState = {
        searchTerm: searchParams.get('search') || '',
        dateRange: {
          startDate: searchParams.get('startDate') || undefined,
          endDate: searchParams.get('endDate') || undefined
        },
        filters: {},
        sortBy: searchParams.get('sortBy') || undefined,
        sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
      };

      // 다른 필터 파라미터들 로드
      searchParams.forEach((value, key) => {
        if (!['search', 'startDate', 'endDate', 'sortBy', 'sortOrder'].includes(key)) {
          try {
            initialState.filters[key] = JSON.parse(value);
          } catch {
            initialState.filters[key] = value;
          }
        }
      });

      setFilterState(initialState);
    } else {
      // localStorage에서 로드
      loadPersistedState();
    }
  }, [searchParams, enableUrlSync]);

  // localStorage 상태 로드
  const loadPersistedState = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved) {
          const parsedState = JSON.parse(saved);
          setFilterState(prev => ({ ...prev, ...parsedState }));
        }
      } catch (error) {
        console.warn('Failed to load persisted filter state:', error);
      }
    }
  }, [persistKey]);

  // localStorage에 상태 저장
  const persistState = useCallback((state: FilterState) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(persistKey, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to persist filter state:', error);
      }
    }
  }, [persistKey]);

  // URL 업데이트
  const updateUrl = useCallback((state: FilterState) => {
    if (!enableUrlSync) return;

    const queryParams = buildSearchQuery({
      searchText: state.searchTerm,
      dateRange: state.dateRange,
      filters: state.filters,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder
    });

    const url = `${window.location.pathname}?${queryParams.toString()}`;
    router.replace(url, { scroll: false });
  }, [enableUrlSync, router]);

  // 디바운스된 검색
  const debouncedSearch = useMemo(
    () => createDebouncedSearch((searchTerm: string) => {
      setFilterState(prev => {
        const newState = { ...prev, searchTerm };
        persistState(newState);
        updateUrl(newState);
        onFilterChange?.(newState);
        setIsFiltering(false);

        // 검색 분석 추적
        if (searchTerm) {
          trackSearch({
            searchTerm,
            resultCount: 0, // 실제 구현에서는 결과 수를 전달받아야 함
            timestamp: new Date(),
            filters: newState.filters
          });
        }

        return newState;
      });
    }, debounceMs),
    [debounceMs, persistState, updateUrl, onFilterChange]
  );

  // 활성 필터 여부 계산
  const hasActiveFilters = useMemo((): boolean => {
    return (
      filterState.searchTerm !== '' ||
      !!filterState.dateRange.startDate ||
      !!filterState.dateRange.endDate ||
      Object.values(filterState.filters).some(
        value => value !== '' && value !== null && value !== undefined
      )
    );
  }, [filterState]);

  // 액션 함수들
  const setSearchTerm = useCallback((term: string) => {
    setIsFiltering(true);
    debouncedSearch(term);
  }, [debouncedSearch]);

  const setDateRange = useCallback((range: { startDate?: string; endDate?: string }) => {
    setFilterState(prev => {
      const newState = { ...prev, dateRange: range };

      if (!validateFilterCombination({ ...newState.filters, ...range })) {
        console.warn('Invalid filter combination');
        return prev;
      }

      persistState(newState);
      updateUrl(newState);
      onFilterChange?.(newState);
      return newState;
    });
  }, [persistState, updateUrl, onFilterChange]);

  const setFilter = useCallback((key: string, value: unknown) => {
    setFilterState(prev => {
      const newFilters = { ...prev.filters, [key]: value };
      const newState = { ...prev, filters: newFilters };

      if (!validateFilterCombination({ ...newFilters, ...prev.dateRange })) {
        console.warn('Invalid filter combination');
        return prev;
      }

      persistState(newState);
      updateUrl(newState);
      onFilterChange?.(newState);
      return newState;
    });
  }, [persistState, updateUrl, onFilterChange]);

  const setFilters = useCallback((filters: Record<string, any>) => {
    setFilterState(prev => {
      const newState = { ...prev, filters };

      if (!validateFilterCombination({ ...filters, ...prev.dateRange })) {
        console.warn('Invalid filter combination');
        return prev;
      }

      persistState(newState);
      updateUrl(newState);
      onFilterChange?.(newState);
      return newState;
    });
  }, [persistState, updateUrl, onFilterChange]);

  const setSorting = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilterState(prev => {
      const newState = { ...prev, sortBy, sortOrder };
      persistState(newState);
      updateUrl(newState);
      onFilterChange?.(newState);
      return newState;
    });
  }, [persistState, updateUrl, onFilterChange]);

  const clearAllFilters = useCallback(() => {
    const clearedState: FilterState = {
      searchTerm: '',
      dateRange: {},
      filters: {},
      sortBy: undefined,
      sortOrder: 'desc'
    };

    setFilterState(clearedState);
    persistState(clearedState);
    updateUrl(clearedState);
    onFilterChange?.(clearedState);
  }, [persistState, updateUrl, onFilterChange]);

  const clearFilter = useCallback((key: string) => {
    setFilterState(prev => {
      if (key === 'searchTerm') {
        const newState = { ...prev, searchTerm: '' };
        persistState(newState);
        updateUrl(newState);
        onFilterChange?.(newState);
        return newState;
      } else if (key === 'dateRange') {
        const newState = { ...prev, dateRange: {} };
        persistState(newState);
        updateUrl(newState);
        onFilterChange?.(newState);
        return newState;
      } else {
        const newFilters = { ...prev.filters };
        delete newFilters[key];
        const newState = { ...prev, filters: newFilters };
        persistState(newState);
        updateUrl(newState);
        onFilterChange?.(newState);
        return newState;
      }
    });
  }, [persistState, updateUrl, onFilterChange]);

  // 저장된 필터 관리
  const saveFilter = useCallback((name: string) => {
    if (typeof window !== 'undefined') {
      try {
        const savedFilters = JSON.parse(localStorage.getItem(`${persistKey}_saved`) || '[]');
        const newFilter = {
          name,
          filters: filterState,
          createdAt: new Date().toISOString()
        };

        const existingIndex = savedFilters.findIndex((f: any) => f.name === name);
        if (existingIndex >= 0) {
          savedFilters[existingIndex] = newFilter;
        } else {
          savedFilters.push(newFilter);
        }

        // 최대 개수 제한
        if (savedFilters.length > maxSearchHistory) {
          savedFilters.splice(0, savedFilters.length - maxSearchHistory);
        }

        localStorage.setItem(`${persistKey}_saved`, JSON.stringify(savedFilters));
      } catch (error) {
        console.warn('Failed to save filter:', error);
      }
    }
  }, [filterState, persistKey, maxSearchHistory]);

  const loadFilter = useCallback((name: string) => {
    if (typeof window !== 'undefined') {
      try {
        const savedFilters = JSON.parse(localStorage.getItem(`${persistKey}_saved`) || '[]');
        const filter = savedFilters.find((f: any) => f.name === name);

        if (filter) {
          setFilterState(filter.filters);
          persistState(filter.filters);
          updateUrl(filter.filters);
          onFilterChange?.(filter.filters);
        }
      } catch (error) {
        console.warn('Failed to load filter:', error);
      }
    }
  }, [persistKey, persistState, updateUrl, onFilterChange]);

  const deleteSavedFilter = useCallback((name: string) => {
    if (typeof window !== 'undefined') {
      try {
        const savedFilters = JSON.parse(localStorage.getItem(`${persistKey}_saved`) || '[]');
        const filteredSaved = savedFilters.filter((f: any) => f.name !== name);
        localStorage.setItem(`${persistKey}_saved`, JSON.stringify(filteredSaved));
      } catch (error) {
        console.warn('Failed to delete saved filter:', error);
      }
    }
  }, [persistKey]);

  const getSavedFilters = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem(`${persistKey}_saved`) || '[]');
      } catch (error) {
        console.warn('Failed to get saved filters:', error);
        return [];
      }
    }
    return [];
  }, [persistKey]);

  // 유틸리티 함수들
  const buildQueryParams = useCallback(() => {
    return buildSearchQuery({
      searchText: filterState.searchTerm,
      dateRange: filterState.dateRange,
      filters: filterState.filters,
      sortBy: filterState.sortBy,
      sortOrder: filterState.sortOrder
    });
  }, [filterState]);

  const exportFilterState = useCallback(() => {
    return prepareFilterStateForExport(
      filterState.filters,
      filterState.searchTerm,
      filterState.dateRange
    );
  }, [filterState]);

  const getFilteredData = useCallback(<T,>(data: T[], searchFields: string[]): T[] => {
    if (!hasActiveFilters) return data;

    let filtered = [...data];

    // 텍스트 검색 적용
    if (filterState.searchTerm) {
      const normalizedTerm = normalizeKoreanText(filterState.searchTerm);
      filtered = filtered.filter(item =>
        searchFields.some(field => {
          const value = (item as any)[field];
          if (value && typeof value === 'string') {
            return normalizeKoreanText(value).includes(normalizedTerm);
          }
          return false;
        })
      );
    }

    // 기타 필터 적용
    Object.entries(filterState.filters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        filtered = filtered.filter(item => {
          const itemValue = (item as any)[key];
          if (Array.isArray(value)) {
            return value.includes(itemValue);
          }
          return itemValue === value;
        });
      }
    });

    // 날짜 범위 필터 적용 (필요시 구현)
    // 정렬 적용
    if (filterState.sortBy) {
      filtered.sort((a, b) => {
        const aValue = (a as any)[filterState.sortBy!];
        const bValue = (b as any)[filterState.sortBy!];

        if (aValue < bValue) return filterState.sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return filterState.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [filterState, hasActiveFilters]);

  return {
    // 상태
    filterState,
    isFiltering,
    hasActiveFilters,

    // 액션
    setSearchTerm,
    setDateRange,
    setFilter,
    setFilters,
    setSorting,
    clearAllFilters,
    clearFilter,

    // 필터 관리
    saveFilter,
    loadFilter,
    deleteSavedFilter,
    getSavedFilters,

    // 유틸리티
    buildQueryParams,
    exportFilterState,
    getFilteredData
  };
};