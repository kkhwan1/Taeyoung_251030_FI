/**
 * KPI Cards Component
 * Displays key performance indicators with Korean formatting
 */

import React from 'react';
import { Package, Users, TrendingUp, AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
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
        <div className="col-span-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-300 font-medium">데이터 로드 실패</span>
          </div>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const kpiData = [
    {
      title: '총 품목수',
      value: stats?.totalItems || 0,
      change: stats?.trends.items || 0,
      icon: <Package className="w-6 h-6" />,
      bgColor: 'bg-blue-500',
      unit: '개'
    },
    {
      title: '활성 거래처',
      value: stats?.activeCompanies || 0,
      change: stats?.trends.companies || 0,
      icon: <Users className="w-6 h-6" />,
      bgColor: 'bg-green-500',
      unit: '개사'
    },
    {
      title: '월 입출고량',
      value: stats?.monthlyVolume || 0,
      change: stats?.trends.volume || 0,
      icon: <TrendingUp className="w-6 h-6" />,
      bgColor: 'bg-purple-500',
      unit: '개',
      isPercentage: true
    },
    {
      title: '재고 부족 품목',
      value: stats?.lowStockItems || 0,
      change: stats?.trends.lowStock || 0,
      icon: <AlertCircle className="w-6 h-6" />,
      bgColor: 'bg-red-500',
      unit: '개'
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

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="w-4 h-4" />;
    if (change < 0) return <ArrowDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getChangeColor = (change: number, isAlert: boolean = false) => {
    if (change === 0) return 'text-gray-500';

    // For alert items (like low stock), decrease is good, increase is bad
    if (isAlert) {
      return change > 0 ? 'text-red-600' : 'text-green-600';
    }

    // For regular metrics, increase is good, decrease is bad
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiData.map((kpi, index) => (
        <KPICard
          key={index}
          title={kpi.title}
          value={kpi.value}
          change={kpi.change}
          icon={kpi.icon}
          bgColor={kpi.bgColor}
          unit={kpi.unit}
          isPercentage={kpi.isPercentage}
          isAlert={kpi.title.includes('부족')}
          loading={loading}
          formatChangeValue={formatChangeValue}
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
  icon: React.ReactNode;
  bgColor: string;
  unit: string;
  isPercentage?: boolean;
  isAlert?: boolean;
  loading: boolean;
  formatChangeValue: (change: number, isPercentage?: boolean) => string;
  getChangeIcon: (change: number) => React.ReactNode;
  getChangeColor: (change: number, isAlert?: boolean) => string;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  icon,
  bgColor,
  unit,
  isPercentage = false,
  isAlert = false,
  loading,
  formatChangeValue,
  getChangeIcon,
  getChangeColor
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>

          {loading ? (
            <div className="mt-2 space-y-2">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline mt-2">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatKoreanNumber(value)}
                </p>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  {unit}
                </span>
              </div>

              <div className="flex items-center mt-2">
                <div
                  className={`flex items-center space-x-1 ${getChangeColor(change, isAlert)}`}
                >
                  {getChangeIcon(change)}
                  <span className="text-sm font-medium">
                    {formatChangeValue(change, isPercentage)}
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  전월 대비
                </span>
              </div>
            </>
          )}
        </div>

        <div className={`${bgColor} p-3 rounded-lg text-white ${loading ? 'animate-pulse' : ''}`}>
          {icon}
        </div>
      </div>

      {/* Additional context for specific KPIs */}
      {!loading && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {title === '재고 부족 품목' && value > 0 && (
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-orange-600 dark:text-orange-400">
                즉시 확인 필요
              </span>
            </div>
          )}

          {title === '월 입출고량' && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              이번 달 총 거래량
            </div>
          )}

          {title === '총 품목수' && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              활성 품목 기준
            </div>
          )}

          {title === '활성 거래처' && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              거래 중인 업체
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Skeleton loader for KPI cards
export const KPICardsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse"></div>
            </div>
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  );
};