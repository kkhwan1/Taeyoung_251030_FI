/**
 * 고급 검색 및 필터링 유틸리티
 * Advanced Search and Filtering Utilities for Korean ERP System
 */

// 한글 텍스트 정규화 함수 (검색 성능 향상)
export const normalizeKoreanText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[\s\-_]/g, '') // 공백, 하이픈, 언더스코어 제거
    .normalize('NFD') // 한글 자모 분리
    .replace(/[\u0300-\u036f]/g, ''); // 결합 문자 제거
};

// 검색 쿼리 빌더
export interface SearchQueryParams {
  searchText?: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const buildSearchQuery = (params: SearchQueryParams): URLSearchParams => {
  const query = new URLSearchParams();

  if (params.searchText) {
    query.append('search', params.searchText);
  }

  if (params.dateRange?.startDate) {
    query.append('startDate', params.dateRange.startDate);
  }

  if (params.dateRange?.endDate) {
    query.append('endDate', params.dateRange.endDate);
  }

  if (params.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        query.append(key, value.toString());
      }
    });
  }

  if (params.sortBy) {
    query.append('sortBy', params.sortBy);
  }

  if (params.sortOrder) {
    query.append('sortOrder', params.sortOrder);
  }

  if (params.page) {
    query.append('page', params.page.toString());
  }

  if (params.limit) {
    query.append('limit', params.limit.toString());
  }

  return query;
};

// 필터 URL 인코딩/디코딩
export const encodeFiltersToUrl = (filters: Record<string, any>): string => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      params.append(key, JSON.stringify(value));
    }
  });

  return params.toString();
};

export const decodeFiltersFromUrl = (urlParams: URLSearchParams): Record<string, any> => {
  const filters: Record<string, any> = {};

  urlParams.forEach((value, key) => {
    try {
      filters[key] = JSON.parse(value);
    } catch {
      filters[key] = value;
    }
  });

  return filters;
};

// 검색 결과 하이라이팅
export const highlightSearchTerm = (text: string, searchTerm: string): string => {
  if (!searchTerm || !text) return text;

  const normalizedText = normalizeKoreanText(text);
  const normalizedTerm = normalizeKoreanText(searchTerm);

  if (!normalizedText.includes(normalizedTerm)) return text;

  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
};

// 자동완성 데이터 준비
export const prepareAutocompleteData = (
  items: any[],
  fields: string[]
): string[] => {
  const suggestions = new Set<string>();

  items.forEach(item => {
    fields.forEach(field => {
      const value = item[field];
      if (value && typeof value === 'string') {
        suggestions.add(value);
        // 부분 문자열도 추가 (2글자 이상)
        if (value.length >= 2) {
          for (let i = 0; i <= value.length - 2; i++) {
            const substring = value.substring(i, i + 2);
            if (substring.trim().length === 2) {
              suggestions.add(substring);
            }
          }
        }
      }
    });
  });

  return Array.from(suggestions).sort();
};

// 디바운스된 검색 함수
export const createDebouncedSearch = (
  searchFn: (query: string) => void,
  delay: number = 300
) => {
  let timeoutId: NodeJS.Timeout;

  return (query: string) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => searchFn(query), delay);
  };
};

// 빠른 필터 프리셋
export interface QuickFilter {
  id: string;
  label: string;
  filters: Record<string, any>;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export const getQuickFilters = (): QuickFilter[] => {
  const today = new Date();
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  return [
    {
      id: 'today',
      label: '오늘',
      filters: {},
      dateRange: {
        startDate: formatDate(new Date()),
        endDate: formatDate(new Date())
      }
    },
    {
      id: 'thisWeek',
      label: '이번주',
      filters: {},
      dateRange: {
        startDate: formatDate(startOfWeek),
        endDate: formatDate(new Date())
      }
    },
    {
      id: 'thisMonth',
      label: '이번달',
      filters: {},
      dateRange: {
        startDate: formatDate(startOfMonth),
        endDate: formatDate(new Date())
      }
    },
    {
      id: 'thisYear',
      label: '올해',
      filters: {},
      dateRange: {
        startDate: formatDate(startOfYear),
        endDate: formatDate(new Date())
      }
    },
    {
      id: 'all',
      label: '전체',
      filters: {},
      dateRange: undefined
    }
  ];
};

// 검색 성능 최적화
export const optimizeSearchPerformance = <T>(
  items: T[],
  searchTerm: string,
  searchFields: string[],
  maxResults: number = 100
): T[] => {
  if (!searchTerm) return items.slice(0, maxResults);

  const normalizedTerm = normalizeKoreanText(searchTerm);
  const results: T[] = [];

  for (let i = 0; i < items.length && results.length < maxResults; i++) {
    const item = items[i];
    const matched = searchFields.some(field => {
      const value = (item as any)[field];
      if (value && typeof value === 'string') {
        return normalizeKoreanText(value).includes(normalizedTerm);
      }
      return false;
    });

    if (matched) {
      results.push(item);
    }
  }

  return results;
};

// 검색 분석 데이터
export interface SearchAnalytics {
  searchTerm: string;
  resultCount: number;
  timestamp: Date;
  filters: Record<string, any>;
}

export const trackSearch = (analytics: SearchAnalytics): void => {
  try {
    const searches = JSON.parse(localStorage.getItem('searchAnalytics') || '[]');
    searches.push({
      ...analytics,
      timestamp: analytics.timestamp.toISOString()
    });

    // 최근 100개만 유지
    if (searches.length > 100) {
      searches.splice(0, searches.length - 100);
    }

    localStorage.setItem('searchAnalytics', JSON.stringify(searches));
  } catch (error) {
    console.warn('Failed to track search analytics:', error);
  }
};

export const getPopularSearches = (limit: number = 10): string[] => {
  try {
    const searches = JSON.parse(localStorage.getItem('searchAnalytics') || '[]');
    const searchCounts: Record<string, number> = {};

    searches.forEach((search: any) => {
      if (search.searchTerm) {
        searchCounts[search.searchTerm] = (searchCounts[search.searchTerm] || 0) + 1;
      }
    });

    return Object.entries(searchCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([term]) => term);
  } catch (error) {
    console.warn('Failed to get popular searches:', error);
    return [];
  }
};

// 필터 조합 유효성 검사
export const validateFilterCombination = (filters: Record<string, any>): boolean => {
  // 비즈니스 로직에 따른 필터 조합 검증
  if (filters.startDate && filters.endDate) {
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);

    if (startDate > endDate) {
      return false;
    }

    // 최대 1년 범위 제한
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - startDate.getTime() > oneYearInMs) {
      return false;
    }
  }

  return true;
};

// 내보내기용 필터 상태 준비
export const prepareFilterStateForExport = (
  filters: Record<string, any>,
  searchTerm: string,
  dateRange?: { startDate?: string; endDate?: string }
) => {
  return {
    appliedFilters: Object.entries(filters)
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
    searchTerm: searchTerm || '',
    dateRange: dateRange || {},
    exportTimestamp: new Date().toISOString(),
    totalFilterCount: Object.keys(filters).length
  };
};