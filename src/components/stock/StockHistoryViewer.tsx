'use client';

import { useState, useEffect, useMemo } from 'react';
import { VirtualTable, VirtualTableColumn } from '@/components/ui/VirtualTable';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

interface StockHistory {
  history_id: number;
  item_id: number;
  movement_type: 'RECEIVING' | 'SHIPPING' | 'PRODUCTION' | 'ADJUSTMENT';
  quantity_change: number;
  stock_quantity: number;
  reference_type: string;
  reference_id: number;
  created_at: string;
  // Phase 1: 거래처 정보 추가
  company_id?: number | null;
  company_name?: string | null;
  company_code?: string | null;
}

interface Props {
  itemId: number;
}

const MOVEMENT_TYPE_MAP: Record<string, string> = {
  'RECEIVING': '입고',
  'SHIPPING': '출고',
  'PRODUCTION': '생산',
  'ADJUSTMENT': '조정'
};

const FILTER_OPTIONS = [
  { value: 'ALL', label: '전체' },
  { value: 'RECEIVING', label: '입고' },
  { value: 'SHIPPING', label: '출고' },
  { value: 'PRODUCTION', label: '생산' },
  { value: 'ADJUSTMENT', label: '조정' }
];

export default function StockHistoryViewer({ itemId }: Props) {
  const [data, setData] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  // Phase 4: 거래처 필터링 상태 추가 - useCompanyFilter hook 사용
  const [companyFilter, setCompanyFilter] = useState<number | 'ALL'>('ALL');
  const { companies: companyOptions, loading: companiesLoading } = useCompanyFilter();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [itemId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stock-history/${itemId}`);
      const text = await response.text();
      const result = JSON.parse(text);

      if (result.success) {
        setData(result.data.history || []);
      } else {
        console.error('데이터 로드 실패:', result.error || '알 수 없는 오류');
        setData([]);
      }
    } catch (error) {
      console.error('Failed to fetch stock history:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter data by movement type, company, and date range
  const filteredData = useMemo(() => {
    return data
      .filter(item => filter === 'ALL' ? true : item.movement_type === filter)
      .filter(item => {
        if (companyFilter === 'ALL') return true;
        return item.company_id === companyFilter;
      })
      .filter(item => {
        if (!startDate && !endDate) return true;

        const itemDate = new Date(item.created_at);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (start && end) {
          return itemDate >= start && itemDate <= end;
        } else if (start) {
          return itemDate >= start;
        } else if (end) {
          return itemDate <= end;
        }
        return true;
      });
  }, [data, filter, companyFilter, startDate, endDate]);

  // Phase 3: VirtualTable columns (6 columns with redistributed widths)
  const columns: VirtualTableColumn<StockHistory>[] = [
    {
      key: 'created_at',
      title: '날짜',
      width: '18%',
      sortable: true,
      render: (value: unknown) => {
        const date = new Date(value as string);
        return (
          <div className="text-sm">
            <div>{date.toLocaleDateString('ko-KR')}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      }
    },
    {
      key: 'movement_type',
      title: '유형',
      width: '12%',
      sortable: true,
      filterable: true,
      render: (value: unknown) => {
        const type = value as string;
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {MOVEMENT_TYPE_MAP[type] || type}
          </span>
        );
      }
    },
    {
      key: 'company_code',
      title: '거래처 코드',
      width: '14%',
      sortable: true,
      render: (value: unknown) => {
        const code = value as string | null;
        return (
          <span className="text-sm text-gray-900 dark:text-white">
            {code && code !== '-' ? code : '미지정'}
          </span>
        );
      }
    },
    {
      key: 'company_name',
      title: '거래처 명',
      width: '22%',
      sortable: true,
      filterable: true,
      render: (_: unknown, row: StockHistory) => {
        return (
          <div className="text-sm text-gray-900 dark:text-white">
            <p>{row.company_name ?? '미지정 거래처'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {row.reference_type ? `${row.reference_type} #${row.reference_id ?? '-'}` : '연결 문서 없음'}
            </p>
          </div>
        );
      }
    },
    {
      key: 'quantity_change',
      title: '수량 변화',
      width: '14%',
      align: 'right',
      sortable: true,
      render: (value: unknown) => {
        const change = value as number;
        const color = change > 0
          ? 'text-green-600 dark:text-green-400'
          : change < 0
          ? 'text-red-600 dark:text-red-400'
          : 'text-gray-600 dark:text-gray-400';

        return (
          <span className={`font-medium ${color}`}>
            {change > 0 ? '+' : ''}{change.toLocaleString('ko-KR')}
          </span>
        );
      }
    },
    {
      key: 'stock_quantity',
      title: '재고 수량',
      width: '20%',
      align: 'right',
      sortable: true,
      render: (value: unknown) => {
        const quantity = value as number;
        return (
          <span className="font-medium text-gray-900 dark:text-white">
            {quantity.toLocaleString('ko-KR')}
          </span>
        );
      }
    }
  ];

  // Export to Excel
  const handleExport = async () => {
    setExporting(true);

    try {
      // Build query parameters from current filter state
      const params = new URLSearchParams({
        item_id: itemId.toString()
      });

      // Add optional filters only if not 'ALL'
      if (filter !== 'ALL') {
        params.append('movement_type', filter);
      }

      if (companyFilter !== 'ALL') {
        params.append('company_id', companyFilter.toString());
      }

      if (startDate) {
        params.append('start_date', startDate);
      }

      if (endDate) {
        params.append('end_date', endDate);
      }

      // Fetch from export API
      const response = await fetch(`/api/stock-history/export?${params}`);

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '내보내기 실패');
      }

      // Get blob and trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ''; // Filename from Content-Disposition header
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('엑셀 파일 내보내기 완료');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : '내보내기 중 오류 발생');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 sm:p-6">
      {/* Header with filters */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          상세 재고이력
        </h2>

        {/* Filters */}
        <div className="space-y-4">
          {/* Movement type filter - Dropdown */}
          <div>
            <label htmlFor="movement-type-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              이동 유형
            </label>
            <select
              id="movement-type-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Company filter - Unified dropdown style */}
          <div>
            <label htmlFor="company-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              거래처
            </label>
            <select
              id="company-filter"
              value={companyFilter === 'ALL' ? 'ALL' : companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              disabled={companiesLoading}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              <option value="ALL">전체 거래처</option>
              {companyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {companiesLoading && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">거래처 불러오는 중...</p>
            )}
          </div>

          {/* Date range filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleExport}
                disabled={exporting}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${
                  exporting
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
                title="엑셀 내보내기"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {exporting ? '내보내는 중...' : '내보내기'}
                </span>
              </button>
            </div>
          </div>

          {/* Summary */}
          {filteredData.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              총 <span className="font-semibold text-gray-900 dark:text-white">{filteredData.length}</span>개의 이력
            </div>
          )}
        </div>
      </div>

      {/* Virtual Table */}
      <VirtualTable
        data={filteredData}
        columns={columns}
        height={600}
        rowHeight={64}
        loading={loading}
        emptyMessage="재고 이력이 없습니다"
        sortable={true}
        filterable={false}
        searchable={false}
        stickyHeader={true}
      />
    </div>
  );
}
