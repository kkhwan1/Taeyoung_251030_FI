'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, Download, Search, RefreshCw, Filter } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

/**
 * Daily Stock Calendar Page
 *
 * Provides daily stock tracking with:
 * - Date range filtering
 * - Item filtering
 * - Stock value filtering
 * - Excel export
 * - Virtualized grid for large datasets
 */

interface DailyStockRow {
  calendar_date: string;
  item_id: number;
  item_code: string;
  item_name: string;
  opening_stock: number;
  receiving_qty: number;
  shipping_qty: number;
  adjustment_qty: number;
  closing_stock: number;
  stock_value: number;
  updated_at: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function DailyStockCalendarPage() {
  // State management
  const [stockData, setStockData] = useState<DailyStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 100,
    totalCount: 0,
    totalPages: 0
  });

  // Filter states
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [itemSearch, setItemSearch] = useState('');
  const [minStockValue, setMinStockValue] = useState<string>('');

  // Date validation state
  const [dateError, setDateError] = useState<string>('');

  // Refs for direct DOM access to get current input values
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  /**
   * Fetch daily stock calendar data
   */
  const fetchStockData = async (page: number = 1) => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        page: page.toString(),
        limit: pagination.limit.toString(),
        format: 'json'
      });

      if (minStockValue) {
        params.append('min_stock_value', minStockValue);
      }

      const response = await fetch(`/api/stock/daily-calendar?${params}`);
      const result = await response.json();

      if (result.success) {
        setStockData(result.data || []);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        alert(`일일재고 조회 실패: ${result.error}`);
        setStockData([]);
      }
    } catch (error) {
      console.error('일일재고 조회 오류:', error);
      alert('일일재고 조회 중 오류가 발생했습니다.');
      setStockData([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Export to Excel
   */
  const handleExcelExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        format: 'excel'
      });

      if (minStockValue) {
        params.append('min_stock_value', minStockValue);
      }

      const response = await fetch(`/api/stock/daily-calendar?${params}`);

      if (!response.ok) {
        throw new Error('Excel 내보내기 실패');
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `일일재고캘린더_${startDate}_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel 내보내기 오류:', error);
      alert('Excel 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  /**
   * Validate date range using current DOM values (fixes React state timing bug)
   */
  const validateDateRange = (): boolean => {
    // Get CURRENT values from DOM to avoid React state timing issues
    const currentStartDate = startDateRef.current?.value || '';
    const currentEndDate = endDateRef.current?.value || '';

    // Clear previous error
    setDateError('');

    // Check if dates are provided
    if (!currentStartDate || !currentEndDate) {
      setDateError('시작일과 종료일을 모두 입력해주세요.');
      return false;
    }

    // Validate date range
    if (currentStartDate > currentEndDate) {
      setDateError('시작일은 종료일보다 빠르거나 같아야 합니다.');
      return false;
    }

    return true;
  };

  /**
   * Apply filters with proper validation
   */
  const handleApplyFilters = () => {
    // Validate using current DOM values (not stale React state)
    if (!validateDateRange()) {
      return;
    }

    // Sync React state with current DOM values before fetching
    const currentStartDate = startDateRef.current?.value || '';
    const currentEndDate = endDateRef.current?.value || '';

    setStartDate(currentStartDate);
    setEndDate(currentEndDate);

    fetchStockData(1);
  };

  /**
   * Reset filters
   */
  const handleResetFilters = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setItemSearch('');
    setMinStockValue('');
    setDateError(''); // Clear any date errors
  };

  /**
   * Client-side item filtering
   */
  const filteredData = stockData.filter(row => {
    if (!itemSearch) return true;
    const searchLower = itemSearch.toLowerCase();
    return (
      row.item_code.toLowerCase().includes(searchLower) ||
      row.item_name.toLowerCase().includes(searchLower)
    );
  });

  /**
   * Initial data load
   */
  useEffect(() => {
    fetchStockData();
  }, []);

  // Calculate summary statistics
  const totalStockValue = filteredData.reduce((sum, row) => sum + (row.stock_value || 0), 0);
  const totalReceiving = filteredData.reduce((sum, row) => sum + (row.receiving_qty || 0), 0);
  const totalShipping = filteredData.reduce((sum, row) => sum + (row.shipping_qty || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Calendar className="w-7 h-7" />
            일일 재고 캘린더
          </h1>
          <p className="text-gray-600 dark:text-gray-400">일자별 재고 변동 추이 조회</p>
        </div>

        <button
          onClick={handleExcelExport}
          disabled={exporting || filteredData.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {exporting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              내보내는 중...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Excel 내보내기
            </>
          )}
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">총 재고금액</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            ₩{totalStockValue.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">총 입고수량</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {totalReceiving.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">총 출고수량</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {totalShipping.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">필터 설정</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              시작일
            </label>
            <input
              ref={startDateRef}
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDateError(''); // Clear error on change
              }}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                dateError
                  ? 'border-gray-500 dark:border-gray-500 focus:ring-gray-500'
                  : 'border-gray-300 dark:border-gray-700 focus:ring-gray-500'
              }`}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              종료일
            </label>
            <input
              ref={endDateRef}
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDateError(''); // Clear error on change
              }}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                dateError
                  ? 'border-gray-500 dark:border-gray-500 focus:ring-gray-500'
                  : 'border-gray-300 dark:border-gray-700 focus:ring-gray-500'
              }`}
            />
          </div>

          {/* Item Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              품목 검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="품번 또는 품명"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>
          </div>

          {/* Min Stock Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              최소 재고금액
            </label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={minStockValue}
              onChange={(e) => setMinStockValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>
        </div>

        {/* Date Error Message */}
        {dateError && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {dateError}
            </p>
          </div>
        )}

        {/* Filter Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleApplyFilters}
            disabled={loading || !!dateError}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Search className="w-4 h-4" />
            조회
          </button>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            초기화
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  품목코드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  품목명
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  기초재고
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  입고
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  출고
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  조정
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  기말재고
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  재고금액
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, index) => (
                  <tr key={`${row.item_id}-${row.calendar_date}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      {new Date(row.calendar_date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {row.item_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {row.item_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      {(row.opening_stock || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-800 dark:text-gray-100">
                      {(row.receiving_qty || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-800 dark:text-gray-100">
                      {(row.shipping_qty || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      {(row.adjustment_qty || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                      {(row.closing_stock || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      ₩{(row.stock_value || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredData.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              총 <span className="font-medium">{pagination.totalCount}</span>건
              (페이지 <span className="font-medium">{pagination.page}</span> / {pagination.totalPages})
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => fetchStockData(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <button
                onClick={() => fetchStockData(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
