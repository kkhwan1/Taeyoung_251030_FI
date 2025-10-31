/**
 * Accounting Summary Page - Complete Implementation
 *
 * Phase 2: Monthly accounting summary dashboard with real API integration
 * Day 2 - Agent 2: Complete Dashboard Implementation
 *
 * Features:
 * - Real-time KPI cards with API data
 * - Category summary table with sortable columns
 * - Company detail table with search/filter/pagination
 * - Excel export functionality
 * - Loading states and error handling
 * - Virtual scrolling for large datasets (>100 rows)
 * - Responsive design with dark mode support
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Download,
  AlertCircle,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users
} from 'lucide-react';
import KPICard from '@/components/accounting/KPICard';
import { VirtualTable } from '@/components/ui/VirtualTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/hooks/useToast';
import { CompanyCategory, type MonthlyAccounting, type CategoryMonthlySummary } from '@/types/accounting.types';
import type { VirtualTableColumn } from '@/components/ui/VirtualTable';

// API response type
interface AccountingSummaryData {
  month: string;
  summary: {
    total_sales: number;
    total_purchases: number;
    net_amount: number;
    company_count: number;
    categories: Record<string, {
      sales: number;
      purchases: number;
      net_amount: number;
      count: number;
      avg_sales: number;
      avg_purchases: number;
      sales_percentage: number;
      purchase_percentage: number;
    }>;
  };
  by_category: CategoryMonthlySummary[];
  by_company: MonthlyAccounting[];
}

export default function AccountingSummaryPage() {
  // State management
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // Format: YYYY-MM
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [data, setData] = useState<AccountingSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { showToast } = useToast();

  // Fetch data from API
  useEffect(() => {
    // 초기 로딩 지연: 페이지 로드 직후 네트워크 준비 시간 확보 (100ms)
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          month: selectedMonth,
          ...(selectedCategory && { category: selectedCategory })
        });

        const { safeFetchJson } = await import('@/lib/fetch-utils');
        const result = await safeFetchJson(
          `/api/accounting/monthly-summary?${queryParams}`,
          {},
          {
            timeout: 30000, // 30초 타임아웃 (대량 데이터 처리)
            maxRetries: 3,
            retryDelay: 1000
          }
        );

        if (result.success) {
          setData(result.data);
        } else {
          const errorMsg = result.error || '데이터를 불러오는데 실패했습니다.';
          setError(errorMsg);
          showToast('로딩 실패', 'error', errorMsg);
        }
      } catch (err) {
        const errorMessage = '서버 연결에 실패했습니다.';
        setError(errorMessage);
        showToast('연결 오류', 'error', errorMessage);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [selectedMonth, selectedCategory, showToast]);

  // Handle Excel export
  async function handleExport() {
    setExporting(true);
    try {
      const queryParams = new URLSearchParams({
        month: selectedMonth,
        ...(selectedCategory && { category: selectedCategory })
      });

      const response = await fetch(
        `/api/accounting/export?${queryParams}`
      );

      if (!response.ok) {
        throw new Error('내보내기에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accounting_summary_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('내보내기 완료', 'success', 'Excel 파일이 다운로드되었습니다.');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('내보내기 실패', 'error', '내보내기에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  }

  // Format month for display (YYYY년 MM월)
  const formatMonthDisplay = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    return `${year}년 ${month}월`;
  };

  // Format currency
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '0원';
    }
    return `${amount.toLocaleString('ko-KR')}원`;
  };

  // Format percentage
  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.0%';
    }
    return `${value.toFixed(1)}%`;
  };

  // Category display mapping
  const categoryDisplayMap: Record<string, string> = {
    [CompanyCategory.RAW_MATERIALS]: '협력업체 (원자재)',
    [CompanyCategory.OUTSOURCING]: '협력업체 (외주)',
    [CompanyCategory.CONSUMABLES]: '소모품업체',
    [CompanyCategory.OTHER]: '기타'
  };

  // Category summary table columns
  const categoryColumns: VirtualTableColumn<CategoryMonthlySummary>[] = [
    {
      key: 'company_category',
      title: '분류',
      render: (value) => (categoryDisplayMap[value as string] || value) as string,
      sortable: true,
      width: '20%',
      align: 'left'
    },
    {
      key: 'total_sales',
      title: '매출액',
      render: (value) => formatCurrency(Number(value)),
      sortable: true,
      width: '15%',
      align: 'right'
    },
    {
      key: 'total_purchases',
      title: '매입액',
      render: (value) => formatCurrency(Number(value)),
      sortable: true,
      width: '15%',
      align: 'right'
    },
    {
      key: 'net_amount',
      title: '순이익',
      render: (value) => {
        const amount = Number(value);
        return (
          <span className={amount >= 0 ? 'text-gray-600 dark:text-gray-400' : 'text-gray-600 dark:text-gray-400'}>
            {formatCurrency(amount)}
          </span>
        );
      },
      sortable: true,
      width: '15%',
      align: 'right'
    },
    {
      key: 'company_count',
      title: '거래처 수',
      render: (value) => `${value}개`,
      sortable: true,
      width: '12%',
      align: 'center'
    },
    {
      key: 'sales_percentage',
      title: '매출 비중',
      render: (value) => formatPercentage(Number(value)),
      sortable: true,
      width: '12%',
      align: 'right'
    },
    {
      key: 'purchase_percentage',
      title: '매입 비중',
      render: (value) => formatPercentage(Number(value)),
      sortable: true,
      width: '12%',
      align: 'right'
    }
  ];

  // Company detail table columns
  const companyColumns: VirtualTableColumn<MonthlyAccounting>[] = [
    {
      key: 'company_name',
      title: '거래처명',
      sortable: true,
      filterable: true,
      width: '15%',
      align: 'left'
    },
    {
      key: 'company_code',
      title: '거래처코드',
      sortable: true,
      filterable: true,
      width: '10%',
      align: 'left'
    },
    {
      key: 'company_category',
      title: '분류',
      render: (value) => (categoryDisplayMap[value as string] || value) as string,
      sortable: true,
      filterable: true,
      width: '12%',
      align: 'left'
    },
    {
      key: 'business_info',
      title: '업태',
      render: (value) => {
        if (!value || typeof value !== 'object') return '-';
        const info = value as any;
        return info.business_type || info.business_item || '-';
      },
      sortable: false,
      filterable: false,
      width: '10%',
      align: 'left'
    },
    {
      key: 'representative',
      title: '대표자',
      sortable: true,
      filterable: true,
      width: '10%',
      align: 'left'
    },
    {
      key: 'sales_amount',
      title: '매출액',
      render: (value) => formatCurrency(Number(value)),
      sortable: true,
      width: '12%',
      align: 'right'
    },
    {
      key: 'purchase_amount',
      title: '매입액',
      render: (value) => formatCurrency(Number(value)),
      sortable: true,
      width: '12%',
      align: 'right'
    },
    {
      key: 'net_amount',
      title: '순이익',
      render: (value) => {
        const amount = Number(value);
        return (
          <span className={amount >= 0 ? 'text-gray-600 dark:text-gray-400' : 'text-gray-600 dark:text-gray-400'}>
            {formatCurrency(amount)}
          </span>
        );
      },
      sortable: true,
      width: '12%',
      align: 'right'
    }
  ];

  // Use virtual scrolling for large datasets
  const useVirtualScrolling = useMemo(() => {
    return data && data.by_company.length > 100;
  }, [data]);

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          회계 요약
        </h1>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="month-selector"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              조회 월:
            </label>
            <input
              id="month-selector"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500
                         focus:border-transparent transition-all"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
              ({formatMonthDisplay(selectedMonth)})
            </span>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={exporting || loading || !data}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg
                       hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors"
          >
            {exporting ? (
              <>
                <LoadingSpinner size="sm" />
                <span>내보내는 중...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Excel 내보내기</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" text="데이터 로딩 중..." />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                데이터 로딩 실패
              </h3>
              <p className="text-gray-700 dark:text-gray-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Data Display */}
      {!loading && !error && data && (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
            {/* Total Sales Card */}
            <KPICard
              title="총 매출"
              value={formatCurrency(data.summary.total_sales)}
              icon={DollarSign}
              color="gray"
            />

            {/* Total Purchases Card */}
            <KPICard
              title="총 매입"
              value={formatCurrency(data.summary.total_purchases)}
              icon={ShoppingCart}
              color="green"
            />

            {/* Net Profit Card */}
            <KPICard
              title="순이익"
              value={formatCurrency(data.summary.net_amount)}
              icon={TrendingUp}
              color={data.summary.net_amount >= 0 ? 'green' : 'red'}
            />

            {/* Company Count Card */}
            <KPICard
              title="거래처 수"
              value={`${data.summary.company_count}개`}
              icon={Users}
              color="gray"
            />
          </div>

          {/* Filter Bar */}
          <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label
                htmlFor="category-filter"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                업체 구분:
              </label>
              <select
                id="category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg
                           bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500
                           focus:border-transparent transition-all"
              >
                <option value="">전체 분류</option>
                <option value={CompanyCategory.RAW_MATERIALS}>
                  협력업체 (원자재)
                </option>
                <option value={CompanyCategory.OUTSOURCING}>
                  협력업체 (외주)
                </option>
                <option value={CompanyCategory.CONSUMABLES}>
                  소모품업체
                </option>
                <option value={CompanyCategory.OTHER}>
                  기타
                </option>
              </select>

              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory('')}
                  className="text-sm text-gray-700 dark:text-gray-300 hover:underline"
                >
                  필터 초기화
                </button>
              )}
            </div>
          </div>

          {/* Category Summary Table */}
          {data.by_category.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                분류별 요약
              </h2>
              <VirtualTable
                data={data.by_category}
                columns={categoryColumns}
                height={300}
                rowHeight={48}
                searchable={false}
                filterable={false}
                stickyHeader={true}
                emptyMessage="분류별 데이터가 없습니다."
              />
            </div>
          )}

          {/* Company Detail Table */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              거래처별 상세
            </h2>
            <VirtualTable
              data={data.by_company}
              columns={companyColumns}
              height={useVirtualScrolling ? 600 : 500}
              rowHeight={48}
              searchable={true}
              searchPlaceholder="거래처명으로 검색..."
              filterable={true}
              stickyHeader={true}
              overscan={useVirtualScrolling ? 10 : 5}
              emptyMessage="거래처 데이터가 없습니다."
            />
          </div>
        </>
      )}
    </div>
  );
}
