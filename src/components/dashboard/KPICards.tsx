/**
 * KPI Cards Component
 * Displays key performance indicators with Korean formatting
 */

import React from 'react';
import {
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { formatKoreanNumber } from '../../utils/chartUtils';
import type { DashboardStats } from '../../hooks/useDashboardData';

interface KPICardsProps {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
}

export const KPICards: React.FC<KPICardsProps> = ({
  stats,
  loading,
  error
}) => {
  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-full bg-gray-100 dark:bg-gray-800/20 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-800 dark:text-gray-300 font-medium">데이터 로드 실패</span>
          </div>
          <p className="text-gray-700 dark:text-gray-400 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const kpiData = [
    {
      title: '총 재고 가치',
      value: stats?.totalStockValue || 0,
      change: stats?.trends.stockValue || 0,
      bgColor: 'bg-gray-700 dark:bg-gray-600',
      unit: '',
      isCurrency: true,
      isPercentage: true
    },
    {
      title: '월 거래 금액',
      value: stats?.monthlyTransactionAmount || 0,
      change: stats?.trends.transactionAmount || 0,
      bgColor: 'bg-gray-600 dark:bg-gray-700',
      unit: '',
      isCurrency: true,
      isPercentage: true
    },
    {
      title: '신규 등록',
      value: stats?.newRegistrations?.total || 0,
      change: stats?.trends.newRegistrations || 0,
      bgColor: 'bg-gray-500 dark:bg-gray-600',
      unit: '개',
      subtitle: stats?.newRegistrations ? `품목 ${stats.newRegistrations.items}개 / 거래처 ${stats.newRegistrations.companies}개` : undefined,
      isPercentage: true
    },
    {
      title: '재고 부족 품목',
      value: stats?.lowStockItems || 0,
      change: stats?.trends.lowStock || 0,
      bgColor: 'bg-gray-800 dark:bg-gray-700',
      unit: '개',
      isPercentage: true
    }
  ];

  const formatChangeValue = (change: number, isPercentage: boolean = false) => {
    if (change === 0) return '0';

    const absChange = Math.abs(change);
    if (isPercentage) {
      return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
    } else {
      return `${change > 0 ? '+' : ''}${formatKoreanNumber(absChange)}`;
    }
  };

  // Format currency value
  const formatCurrency = (value: number): string => {
    if (value >= 100000000) {
      return `₩${(value / 100000000).toFixed(1)}억`;
    } else if (value >= 10000) {
      return `₩${(value / 10000).toFixed(1)}만`;
    }
    return `₩${formatKoreanNumber(value)}`;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="w-4 h-4" />;
    if (change < 0) return <ArrowDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getChangeColor = (change: number, isAlert: boolean = false) => {
    if (change === 0) return 'text-gray-500';

    // For alert items (like low stock), decrease is good, increase is bad
    if (isAlert) {
      return change > 0 ? 'text-gray-800' : 'text-gray-600';
    }

    // For regular metrics, increase is good, decrease is bad
    return change > 0 ? 'text-gray-800' : 'text-gray-600';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiData.map((kpi, index) => (
        <KPICard
          key={index}
          title={kpi.title}
          value={kpi.value}
          change={kpi.change}
          bgColor={kpi.bgColor}
          unit={kpi.unit}
          isPercentage={kpi.isPercentage}
          isCurrency={kpi.isCurrency}
          subtitle={kpi.subtitle}
          isAlert={kpi.title.includes('부족')}
          loading={loading}
          formatChangeValue={formatChangeValue}
          formatCurrency={formatCurrency}
          getChangeIcon={getChangeIcon}
          getChangeColor={getChangeColor}
        />
      ))}
    </div>
  );
};

// Individual KPI Card Component
interface KPICardProps {
  title: string;
  value: number;
  change: number;
  bgColor: string;
  unit: string;
  isPercentage?: boolean;
  isCurrency?: boolean;
  subtitle?: string;
  isAlert?: boolean;
  loading: boolean;
  formatChangeValue: (change: number, isPercentage?: boolean) => string;
  formatCurrency: (value: number) => string;
  getChangeIcon: (change: number) => React.ReactNode;
  getChangeColor: (change: number, isAlert?: boolean) => string;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  bgColor,
  unit,
  isPercentage = false,
  isCurrency = false,
  subtitle,
  isAlert = false,
  loading,
  formatChangeValue,
  formatCurrency,
  getChangeIcon,
  getChangeColor
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700 min-h-[120px]">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>

          {loading ? (
            <div className="mt-2 space-y-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline mt-1.5">
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {isCurrency ? formatCurrency(value) : formatKoreanNumber(value)}
                </p>
                {unit && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                    {unit}
                  </span>
                )}
              </div>

              {subtitle && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}

              <div className="flex items-center mt-1.5">
                <div
                  className={`flex items-center space-x-1 ${getChangeColor(change, isAlert)}`}
                >
                  {getChangeIcon(change)}
                  <span className="text-[11px] font-medium">
                    {formatChangeValue(change, isPercentage)}
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-2">
                  전월 대비
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Skeleton loader for KPI cards
export const KPICardsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-3">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse"></div>
            </div>
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  );
};