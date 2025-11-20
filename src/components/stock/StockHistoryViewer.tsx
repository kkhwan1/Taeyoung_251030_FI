'use client';

import { useState, useEffect, useMemo } from 'react';
import { VirtualTable, VirtualTableColumn } from '@/components/ui/VirtualTable';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

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

interface CompanyOption {
  company_id: number;
  company_name: string;
  company_code: string | null;
  label: string;
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
  // Phase 4: 거래처 필터링 상태 추가
  const [companyFilter, setCompanyFilter] = useState<number | 'ALL'>('ALL');
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
    fetchCompanies();
  }, [itemId]);

  // Phase 4: 거래처 목록 조회
  const fetchCompanies = async () => {
    setCompaniesLoading(true);
    try {
      const res = await fetch('/api/companies/options');
      const json = await res.json();
      if (json.success) {
        setCompanyOptions(json.data || []);
      }
    } catch (error) {
      console.error('거래처 목록 불러오기 실패:', error);
    } finally {
      setCompaniesLoading(false);
    }
  };

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
      .filter(item => companyFilter === 'ALL' ? true : item.company_id === companyFilter)
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

  // Export to Excel (placeholder)
  const handleExport = () => {
    toast.success('엑셀 내보내기 기능 준비 중입니다');
    // TODO: Implement Excel export functionality
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 sm:p-6">
      {/* Header with filters */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          재고 이력
        </h2>

        {/* Filters */}
        <div className="space-y-4">
          {/* Movement type filter */}
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Phase 4: Company filter - Pill style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              거래처 필터
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCompanyFilter('ALL')}
                disabled={companiesLoading}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  companyFilter === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                전체 거래처
              </button>
              {companyOptions.map(option => (
                <button
                  key={option.company_id}
                  onClick={() => setCompanyFilter(option.company_id)}
                  disabled={companiesLoading}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    companyFilter === option.company_id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {option.label}
                </button>
              ))}
            </div>
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
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                title="엑셀 내보내기"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">내보내기</span>
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
