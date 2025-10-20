'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { ko } from 'date-fns/locale';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend
);

interface PriceHistoryItem {
  history_id: number;
  item_id: number;
  item_name: string;
  item_code: string;
  previous_price: number | null;
  new_price: number;
  price_change: number;
  price_change_percent: number | null;
  effective_date: string;
  notes: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
}

export default function PriceHistoryPage() {
  const [history, setHistory] = useState<PriceHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<PriceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    totalPages: 1,
    totalCount: 0
  });

  // 필터 상태
  const [filters, setFilters] = useState({
    item_id: '',
    start_date: '',
    end_date: '',
    search: ''
  });

  // 차트 표시 상태
  const [showChart, setShowChart] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // 데이터 로드
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.item_id) params.append('item_id', filters.item_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/price-history?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setHistory(result.data);
        setFilteredHistory(result.data);
        setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch price history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [pagination.page, pagination.limit]);

  // 검색 필터링 (클라이언트 사이드)
  useEffect(() => {
    if (filters.search) {
      const filtered = history.filter(item =>
        item.item_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.item_code.toLowerCase().includes(filters.search.toLowerCase())
      );
      setFilteredHistory(filtered);
    } else {
      setFilteredHistory(history);
    }
  }, [filters.search, history]);

  // 필터 적용
  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setFilters({
      item_id: '',
      start_date: '',
      end_date: '',
      search: ''
    });
    setPagination({ ...pagination, page: 1 });
  };

  // 차트 데이터 생성
  const getChartData = (itemId: number) => {
    const itemHistory = history.filter(h => h.item_id === itemId);
    const sortedHistory = [...itemHistory].sort((a, b) =>
      new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
    );

    return {
      labels: sortedHistory.map(h => h.effective_date),
      datasets: [
        {
          label: '단가 추이',
          data: sortedHistory.map(h => h.new_price),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '단가 변동 추이'
      }
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'month' as const,
          displayFormats: {
            month: 'yyyy-MM'
          }
        },
        adapters: {
          date: {
            locale: ko
          }
        }
      },
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value: any) => `₩${value.toLocaleString('ko-KR')}`
        }
      }
    }
  };

  // 단가 변동률 색상
  const getPriceChangeColor = (percent: number | null) => {
    if (percent === null || percent === 0) return 'text-gray-600';
    return percent > 0 ? 'text-red-600' : 'text-blue-600';
  };

  // 단가 변동 아이콘
  const getPriceChangeIcon = (percent: number | null) => {
    if (percent === null || percent === 0) return '─';
    return percent > 0 ? '▲' : '▼';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">단가 이력 조회</h1>
        <Link
          href="/price-master"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          단가 마스터로 돌아가기
        </Link>
      </div>

      {/* 필터 섹션 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <form onSubmit={handleFilterSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">품목 ID</label>
              <input
                type="number"
                value={filters.item_id}
                onChange={(e) => setFilters({ ...filters, item_id: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="품목 ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">시작일</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">종료일</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">검색</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="품목명/코드 검색"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              조회
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              초기화
            </button>
          </div>
        </form>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">총 이력 건수</div>
          <div className="text-2xl font-bold">{pagination.totalCount.toLocaleString('ko-KR')}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">최근 변동 품목</div>
          <div className="text-2xl font-bold">
            {new Set(filteredHistory.map(h => h.item_id)).size}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">평균 변동률</div>
          <div className="text-2xl font-bold">
            {filteredHistory.length > 0
              ? (filteredHistory.reduce((sum, h) => sum + (h.price_change_percent || 0), 0) /
                 filteredHistory.filter(h => h.price_change_percent !== null).length).toFixed(2)
              : '0.00'}%
          </div>
        </div>
      </div>

      {/* 데이터 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  품목 코드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  품목명
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  이전 단가
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  신규 단가
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  변동액
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  변동률
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  적용일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  비고
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  차트
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    데이터가 없습니다
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.history_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.item_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {item.item_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {item.previous_price !== null
                        ? `₩${item.previous_price.toLocaleString('ko-KR')}`
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                      ₩{item.new_price.toLocaleString('ko-KR')}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${getPriceChangeColor(item.price_change_percent)}`}>
                      {item.price_change !== 0
                        ? `${getPriceChangeIcon(item.price_change_percent)} ₩${Math.abs(item.price_change).toLocaleString('ko-KR')}`
                        : '-'
                      }
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${getPriceChangeColor(item.price_change_percent)}`}>
                      {item.price_change_percent !== null && item.price_change_percent !== 0
                        ? `${item.price_change_percent > 0 ? '+' : ''}${item.price_change_percent.toFixed(2)}%`
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(item.effective_date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => {
                          setSelectedItemId(item.item_id);
                          setShowChart(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        📊
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-700">
            전체 {pagination.totalCount.toLocaleString('ko-KR')}건 중{' '}
            {((pagination.page - 1) * pagination.limit) + 1} -{' '}
            {Math.min(pagination.page * pagination.limit, pagination.totalCount)}건 표시
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              이전
            </button>
            <span className="px-3 py-1">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              다음
            </button>
          </div>
        </div>
      </div>

      {/* 차트 모달 */}
      {showChart && selectedItemId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {history.find(h => h.item_id === selectedItemId)?.item_name} 단가 추이
              </h2>
              <button
                onClick={() => setShowChart(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div style={{ height: '400px' }}>
              <Line data={getChartData(selectedItemId)} options={chartOptions} />
            </div>
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-semibold mb-2">이력 상세</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history
                  .filter(h => h.item_id === selectedItemId)
                  .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
                  .map(item => (
                    <div key={item.history_id} className="flex justify-between text-sm border-b pb-2">
                      <span>{new Date(item.effective_date).toLocaleDateString('ko-KR')}</span>
                      <span className="font-medium">₩{item.new_price.toLocaleString('ko-KR')}</span>
                      <span className={getPriceChangeColor(item.price_change_percent)}>
                        {item.price_change_percent !== null && item.price_change_percent !== 0
                          ? `${item.price_change_percent > 0 ? '+' : ''}${item.price_change_percent.toFixed(2)}%`
                          : '-'
                        }
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
