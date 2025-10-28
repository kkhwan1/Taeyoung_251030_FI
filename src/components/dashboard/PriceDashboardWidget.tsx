'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCcw
} from 'lucide-react';

interface PriceStats {
  total_items: number;
  avg_price_change: number;
  top_increases: Array<{
    item_name: string;
    change_percent: number;
    change_amount: number;
  }>;
  top_decreases: Array<{
    item_name: string;
    change_percent: number;
    change_amount: number;
  }>;
}

interface PriceDashboardWidgetProps {
  className?: string;
}

export default function PriceDashboardWidget({ className = '' }: PriceDashboardWidgetProps) {
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/price-analysis?type=trends&months=1');
      const result = await response.json();

      if (result.success && result.data) {
        // Calculate statistics from trend data
        const trendData = result.data;
        const itemChanges = new Map<string, { change_percent: number; change_amount: number }>();

        // Group by item and calculate changes
        trendData.forEach((item: any) => {
          if (!itemChanges.has(item.item_name)) {
            const changePercent = item.price_changes || 0;
            const changeAmount = item.avg_price * (changePercent / 100);
            itemChanges.set(item.item_name, {
              change_percent: changePercent,
              change_amount: changeAmount
            });
          }
        });

        // Convert to arrays and sort
        const changes = Array.from(itemChanges.entries()).map(([name, data]) => ({
          item_name: name,
          ...data
        }));

        const increases = changes
          .filter(item => item.change_percent > 0)
          .sort((a, b) => b.change_percent - a.change_percent)
          .slice(0, 3);

        const decreases = changes
          .filter(item => item.change_percent < 0)
          .sort((a, b) => a.change_percent - b.change_percent)
          .slice(0, 3);

        const avgChange = changes.length > 0
          ? changes.reduce((sum, item) => sum + item.change_percent, 0) / changes.length
          : 0;

        setStats({
          total_items: changes.length,
          avg_price_change: avgChange,
          top_increases: increases,
          top_decreases: decreases
        });
        setLastUpdated(new Date());
      } else {
        setError('데이터를 불러올 수 없습니다');
      }
    } catch (err: any) {
      setError(err.message || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchData();
  };

  if (loading && !stats) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300 flex items-center gap-2 min-w-fit">
            
            가격 현황
          </h3>
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 min-w-fit">
          
          가격 현황
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Statistics - 2x2 Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Total Items */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">추적 품목</span>
            
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats?.total_items || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">개 품목</div>
        </div>

        {/* Average Change */}
        <div className={`rounded-lg p-4 ${
          (stats?.avg_price_change || 0) >= 0
            ? 'bg-gray-200 dark:bg-gray-700'
            : 'bg-gray-100 dark:bg-gray-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">평균 변동</span>
            {(stats?.avg_price_change || 0) >= 0 ? (
              
            ) : (
              
            )}
          </div>
          <div className={`text-2xl font-bold ${
            (stats?.avg_price_change || 0) >= 0
              ? 'text-gray-800 dark:text-gray-300'
              : 'text-gray-700 dark:text-gray-400'
          }`}>
            {(stats?.avg_price_change || 0) >= 0 ? '+' : ''}
            {(stats?.avg_price_change || 0).toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">최근 1개월</div>
        </div>

        {/* Top Increase */}
        <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">최대 상승</span>
            
          </div>
          {stats?.top_increases && stats.top_increases.length > 0 ? (
            <>
              <div className="text-base font-bold text-gray-800 dark:text-gray-300">
                +{stats.top_increases[0].change_percent.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                {stats.top_increases[0].item_name}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">데이터 없음</div>
          )}
        </div>

        {/* Top Decrease */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">최대 하락</span>
            
          </div>
          {stats?.top_decreases && stats.top_decreases.length > 0 ? (
            <>
              <div className="text-base font-bold text-gray-700 dark:text-gray-400">
                {stats.top_decreases[0].change_percent.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                {stats.top_decreases[0].item_name}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">데이터 없음</div>
          )}
        </div>
      </div>

      {/* Top 3 Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Increases */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
            
            상위 상승 (Top 3)
          </h4>
          <div className="space-y-2">
            {stats?.top_increases && stats.top_increases.length > 0 ? (
              stats.top_increases.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {index + 1}. {item.item_name}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-300 ml-2">
                    +{item.change_percent.toFixed(1)}%
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                데이터가 없습니다
              </div>
            )}
          </div>
        </div>

        {/* Top Decreases */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
            
            상위 하락 (Top 3)
          </h4>
          <div className="space-y-2">
            {stats?.top_decreases && stats.top_decreases.length > 0 ? (
              stats.top_decreases.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {index + 1}. {item.item_name}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-400 ml-2">
                    {item.change_percent.toFixed(1)}%
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                데이터가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
