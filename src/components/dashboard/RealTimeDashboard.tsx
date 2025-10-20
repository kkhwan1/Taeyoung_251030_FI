/**
 * Real-Time Dashboard Component
 * Main dashboard container with auto-refresh functionality
 */

import React from 'react';
import { RefreshControls } from './RefreshControls';
import { KPICards } from './KPICards';
import { StockChart } from './StockChart';
import { TransactionChart } from './TransactionChart';
import { AlertPanel } from './AlertPanel';
import { MonthlyInventoryTrends } from '../charts/MonthlyInventoryTrends';
import { StockLevelsByCategory } from '../charts/StockLevelsByCategory';
import { TransactionDistribution } from '../charts/TransactionDistribution';
import { TopItemsByValue } from '../charts/TopItemsByValue';
import { LowStockAlerts } from '../charts/LowStockAlerts';
import { QuickActions } from './QuickActions';
import { useDashboardData, type RefreshInterval } from '../../hooks/useDashboardData';
import { useTheme } from '../../contexts/ThemeContext';

interface RealTimeDashboardProps {
  className?: string;
  initialRefreshInterval?: RefreshInterval;
  autoStart?: boolean;
}

export const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({
  className = '',
  initialRefreshInterval = '수동',
  autoStart = false
}) => {
  const { isDark } = useTheme();

  const {
    data,
    loading,
    error,
    lastUpdated,
    refreshInterval,
    isAutoRefreshEnabled,
    retryCount,
    setRefreshInterval,
    setIsAutoRefreshEnabled,
    refresh
  } = useDashboardData(initialRefreshInterval, autoStart);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Refresh Controls */}
      <RefreshControls
        refreshInterval={refreshInterval}
        onRefreshIntervalChange={setRefreshInterval}
        isAutoRefreshEnabled={isAutoRefreshEnabled}
        onAutoRefreshToggle={setIsAutoRefreshEnabled}
        onManualRefresh={refresh}
        loading={loading}
        lastUpdated={lastUpdated}
        retryCount={retryCount}
      />

      {/* Global Error Message */}
      {error && !data && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-700 dark:text-red-300 font-medium">
              대시보드 데이터 로드 실패
            </span>
          </div>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">
            {error}
          </p>
          <button
            onClick={refresh}
            disabled={loading}
            className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-800 dark:text-red-300 text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '재시도 중...' : '다시 시도'}
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="mb-16">
        <KPICards
          stats={data?.stats || null}
          loading={loading}
          error={error}
        />
      </div>

      {/* Monthly Trends - Responsive Full Width */}
      <div className="w-full mb-16">
        <MonthlyInventoryTrends
          className="h-64 sm:h-80 lg:h-96"
          onRefresh={refresh}
          data={data?.charts.monthlyTrends || null}
          loading={loading}
          error={error}
        />
      </div>

      {/* Main Analytics Grid - Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-8 mb-16">
        {/* Stock Levels by Category */}
        <div className="min-h-80">
          <StockLevelsByCategory
            className="h-full"
            onRefresh={refresh}
            data={data?.charts.categoryStocks || null}
            loading={loading}
            error={error}
          />
        </div>

        {/* Transaction Distribution */}
        <div className="min-h-80">
          <TransactionDistribution
            className="h-full"
            onRefresh={refresh}
            data={data?.charts.transactions || null}
            loading={loading}
            error={error}
          />
        </div>

        {/* Top Items by Value */}
        <div className="min-h-80 lg:col-span-2">
          <TopItemsByValue
            className="h-full"
            onRefresh={refresh}
            data={data?.charts.stocks || null}
            loading={loading}
            error={error}
          />
        </div>
      </div>

      {/* Legacy Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-8 mb-16">
        {/* Stock Chart */}
        <StockChart
          data={data?.charts.stocks || null}
          loading={loading}
          error={error}
          isDark={isDark}
        />

        {/* Transaction Chart */}
        <TransactionChart
          data={data?.charts.transactions || null}
          monthlyData={data?.charts.monthlyTrends || null}
          loading={loading}
          error={error}
          isDark={isDark}
        />
      </div>

      {/* Alerts and Analytics - Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-8 mb-14">
        {/* Low Stock Alerts */}
        <div className="min-h-96">
          <LowStockAlerts
            className="h-full"
            onRefresh={refresh}
            onReorderClick={(itemId: string) => {
              console.log('Reorder requested for item:', itemId);
              // TODO: Implement reorder functionality
            }}
            data={data?.alerts.lowStockItems || null}
            loading={loading}
            error={error}
          />
        </div>

        {/* Alert Panel and Analytics */}
        <div className="space-y-12 md:space-y-16">
          <AlertPanel
            data={data?.alerts || null}
            loading={loading}
            error={error}
          />

          {/* Additional Analytics Panel */}
          <AnalyticsPanel
            data={data}
            loading={loading}
            error={error}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="mt-12">
        <QuickActions />
      </div>
    </div>
  );
};

// Additional Analytics Panel Component
interface AnalyticsPanelProps {
  data: any;
  loading: boolean;
  error: string | null;
  isDark: boolean;
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  data,
  loading,
  error,
  isDark
}) => {
  if (error || !data) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 min-w-fit">
          분석 요약
        </h3>
        <div className="flex items-center justify-center h-32 text-gray-500">
          <p className="text-sm">분석 데이터를 불러올 수 없습니다</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 min-w-fit">
          분석 요약
        </h3>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate additional metrics
  const analytics = React.useMemo(() => {
    if (!data?.charts || !data?.stats) return null;

    const { stocks, transactions } = data.charts;
    const { stats } = data;

    // Stock turnover rate
    const totalStock = stocks?.reduce((sum: number, item: any) => sum + (item.currentStock || 0), 0) || 0;
    const monthlyOutbound = transactions?.reduce((sum: number, item: any) => sum + (item.volume || 0), 0) || 0;
    const turnoverRate = totalStock > 0 ? (monthlyOutbound / totalStock * 100) : 0;

    // Stock efficiency
    const lowStockCount = stocks?.filter((item: any) => (item.currentStock || 0) < (item.minimumStock || 0)).length || 0;
    const overStockCount = stocks?.filter((item: any) => (item.currentStock || 0) > (item.safetyStock || 0)).length || 0;
    const stockEfficiency = stocks?.length > 0 ? ((stocks.length - lowStockCount - overStockCount) / stocks.length * 100) : 0;

    return {
      turnoverRate,
      stockEfficiency,
      lowStockCount,
      overStockCount,
      totalItems: stocks?.length || 0
    };
  }, [data]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 min-w-fit">
        분석 요약
      </h3>

      {analytics && (
        <div className="space-y-4">
          {/* Stock Efficiency */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">재고 효율성</span>
            <div className="flex items-center space-x-2">
              <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    analytics.stockEfficiency >= 80
                      ? 'bg-green-500'
                      : analytics.stockEfficiency >= 60
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(analytics.stockEfficiency, 100)}%` }}
                ></div>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {analytics.stockEfficiency.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Turnover Rate */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">재고 회전율</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {analytics.turnoverRate.toFixed(1)}%
            </span>
          </div>

          {/* Stock Status Distribution */}
          <div className="space-y-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">재고 상태 분포</span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-red-600 font-medium">{analytics.lowStockCount}</div>
                <div className="text-gray-500">부족</div>
              </div>
              <div className="text-center">
                <div className="text-green-600 font-medium">
                  {analytics.totalItems - analytics.lowStockCount - analytics.overStockCount}
                </div>
                <div className="text-gray-500">적정</div>
              </div>
              <div className="text-center">
                <div className="text-blue-600 font-medium">{analytics.overStockCount}</div>
                <div className="text-gray-500">과재고</div>
              </div>
            </div>
          </div>

          {/* Quick Insights */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              {analytics.stockEfficiency < 70 && (
                <div className="flex items-center space-x-2 text-orange-600 dark:text-orange-400">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-xs">재고 관리 개선 필요</span>
                </div>
              )}
              {analytics.turnoverRate > 50 && (
                <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs">높은 재고 회전율</span>
                </div>
              )}
              {analytics.lowStockCount > 5 && (
                <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs">재고 보충 필요</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
