/**
 * Low Stock Summary Component
 * Displays simplified statistics for low stock items
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { formatKoreanNumber } from '../../utils/chartUtils';

interface LowStockAlertData {
  item_id: string;
  item_name: string;
  item_code: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  safetyStock: number;
  averageConsumption: number;
  stockoutRisk: number;
  daysUntilStockout: number;
  lastRestockDate: Date;
  supplier: string;
  leadTime: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  alertCreatedAt: Date;
  autoReorderEnabled: boolean;
  estimatedCost: number;
}

interface LowStockAlertsProps {
  data: LowStockAlertData[] | null;
  loading: boolean;
  error: string | null;
  isDark?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export const LowStockAlerts: React.FC<LowStockAlertsProps> = ({
  data,
  loading,
  error,
  isDark = false,
  onRefresh,
  className = ''
}) => {
  // Calculate summary statistics
  const summary = React.useMemo(() => {
    if (!data || data.length === 0) {
      return {
        total: 0,
        critical: 0,
        urgent: 0,
        autoReorder: 0,
        totalCost: 0
      };
    }

    const critical = data.filter(item => item.priority === 'critical').length;
    const urgent = data.filter(item => item.daysUntilStockout <= 7).length;
    const autoReorder = data.filter(item => item.autoReorderEnabled).length;
    const totalCost = data.reduce((sum, item) => sum + item.estimatedCost, 0);

    return {
      total: data.length,
      critical,
      urgent,
      autoReorder,
      totalCost
    };
  }, [data]);

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">데이터를 불러올 수 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 ${className}`}>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          재고 부족 현황
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center space-x-2 mb-4">
        <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          재고 부족 현황
        </h3>
        {summary.total > 0 && (
          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            {summary.total}개 알림
          </span>
        )}
      </div>

      {summary.total === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              재고 부족 알림이 없습니다
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              모든 품목이 안전 재고 수준을 유지하고 있습니다
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              긴급 알림
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {summary.critical}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              개
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              7일 내 소진
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {summary.urgent}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              개
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              자동 재주문
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {summary.autoReorder}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              개
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              예상 발주비용
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              ₩{formatKoreanNumber(summary.totalCost)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
