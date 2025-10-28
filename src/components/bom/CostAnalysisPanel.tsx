/**
 * Cost Analysis Panel Component
 * Comprehensive BOM cost analysis with charts and breakdown tables
 *
 * Features:
 * - Cost breakdown by item type (internal vs external)
 * - Cost breakdown by level (level 1, 2, 3, etc.)
 * - Top 10 highest-cost items table
 * - Cost composition pie chart
 * - Real-time cost updates with configurable refresh
 * - Export cost analysis to Excel
 *
 * @component
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import {
  RefreshCw,
  Download
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

// ============================================================================
// Type Definitions
// ============================================================================

interface BOMEntry {
  bom_id: number;
  parent_item_id: number;
  parent_item_code: string;
  parent_item_name: string;
  child_item_id: number;
  child_item_code: string;
  child_item_name: string;
  quantity_required: number;
  level: number;
  item_type: 'internal_production' | 'external_purchase';
  material_cost?: number;
  scrap_revenue?: number;
  net_cost?: number;
  unit?: string;
}

interface CostBreakdown {
  by_item_type: {
    internal_production: {
      count: number;
      material_cost: number;
      scrap_revenue: number;
      net_cost: number;
    };
    external_purchase: {
      count: number;
      material_cost: number;
      net_cost: number;
    };
  };
  by_level: Array<{
    level: number;
    count: number;
    material_cost: number;
    scrap_revenue: number;
    net_cost: number;
  }>;
  top_cost_items: Array<{
    item_code: string;
    item_name: string;
    quantity: number;
    unit_cost: number;
    total_cost: number;
    percentage: number;
  }>;
  summary: {
    total_material_cost: number;
    total_scrap_revenue: number;
    total_net_cost: number;
    total_items: number;
    avg_cost_per_item: number;
  };
}

interface CostAnalysisPanelProps {
  parentItemId?: number;
  bomData: BOMEntry[];
  refreshInterval?: number;
  onExport?: () => void;
  className?: string;
}

// ============================================================================
// Cost Calculation Logic
// ============================================================================

/**
 * Calculate comprehensive cost breakdown from BOM data
 * Lines 1-150
 */
const calculateCostBreakdown = (bomData: BOMEntry[]): CostBreakdown => {
  // Initialize breakdown structure
  const breakdown: CostBreakdown = {
    by_item_type: {
      internal_production: {
        count: 0,
        material_cost: 0,
        scrap_revenue: 0,
        net_cost: 0
      },
      external_purchase: {
        count: 0,
        material_cost: 0,
        net_cost: 0
      }
    },
    by_level: [],
    top_cost_items: [],
    summary: {
      total_material_cost: 0,
      total_scrap_revenue: 0,
      total_net_cost: 0,
      total_items: bomData.length,
      avg_cost_per_item: 0
    }
  };

  if (!bomData || bomData.length === 0) {
    return breakdown;
  }

  // Aggregate by item type
  bomData.forEach(entry => {
    const materialCost = entry.material_cost || 0;
    const scrapRevenue = entry.scrap_revenue || 0;
    const netCost = entry.net_cost || 0;

    if (entry.item_type === 'internal_production') {
      breakdown.by_item_type.internal_production.count++;
      breakdown.by_item_type.internal_production.material_cost += materialCost;
      breakdown.by_item_type.internal_production.scrap_revenue += scrapRevenue;
      breakdown.by_item_type.internal_production.net_cost += netCost;
    } else {
      breakdown.by_item_type.external_purchase.count++;
      breakdown.by_item_type.external_purchase.material_cost += materialCost;
      breakdown.by_item_type.external_purchase.net_cost += netCost;
    }

    breakdown.summary.total_material_cost += materialCost;
    breakdown.summary.total_scrap_revenue += scrapRevenue;
    breakdown.summary.total_net_cost += netCost;
  });

  // Calculate average
  breakdown.summary.avg_cost_per_item =
    breakdown.summary.total_items > 0
      ? breakdown.summary.total_net_cost / breakdown.summary.total_items
      : 0;

  // Aggregate by level
  const levelMap = new Map<number, typeof breakdown.by_level[0]>();
  bomData.forEach(entry => {
    const level = entry.level;
    if (!levelMap.has(level)) {
      levelMap.set(level, {
        level,
        count: 0,
        material_cost: 0,
        scrap_revenue: 0,
        net_cost: 0
      });
    }
    const levelData = levelMap.get(level)!;
    levelData.count++;
    levelData.material_cost += entry.material_cost || 0;
    levelData.scrap_revenue += entry.scrap_revenue || 0;
    levelData.net_cost += entry.net_cost || 0;
  });
  breakdown.by_level = Array.from(levelMap.values()).sort((a, b) => a.level - b.level);

  // Get top 10 cost items
  breakdown.top_cost_items = bomData
    .map(entry => ({
      item_code: entry.child_item_code,
      item_name: entry.child_item_name,
      quantity: entry.quantity_required,
      unit_cost: entry.quantity_required > 0
        ? (entry.net_cost || 0) / entry.quantity_required
        : 0,
      total_cost: entry.net_cost || 0,
      percentage: breakdown.summary.total_net_cost > 0
        ? ((entry.net_cost || 0) / breakdown.summary.total_net_cost) * 100
        : 0
    }))
    .filter(item => item.total_cost > 0)
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10);

  return breakdown;
};

// ============================================================================
// Main Component
// ============================================================================

export const CostAnalysisPanel: React.FC<CostAnalysisPanelProps> = ({
  parentItemId,
  bomData,
  refreshInterval = 0,
  onExport,
  className = ''
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [breakdown, setBreakdown] = useState<CostBreakdown | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate breakdown on data change
  useEffect(() => {
    setIsRefreshing(true);
    const newBreakdown = calculateCostBreakdown(bomData);
    setBreakdown(newBreakdown);
    setLastUpdate(new Date());
    setTimeout(() => setIsRefreshing(false), 300);
  }, [bomData]);

  // Auto-refresh logic
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      const newBreakdown = calculateCostBreakdown(bomData);
      setBreakdown(newBreakdown);
      setLastUpdate(new Date());
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [bomData, refreshInterval]);

  // Handle manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    const newBreakdown = calculateCostBreakdown(bomData);
    setBreakdown(newBreakdown);
    setLastUpdate(new Date());
    setTimeout(() => setIsRefreshing(false), 300);
  };

  // Handle export
  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      // Default export behavior
      const params = new URLSearchParams();
      params.append('include_cost_analysis', 'true');
      if (parentItemId) {
        params.append('parent_item_id', parentItemId.toString());
      }

      window.location.href = `/api/bom/export?${params}`;
    }
  };

  if (!breakdown) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              원가 분석
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>

            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
            >
              <Download className="w-4 h-4" />
              <span>내보내기</span>
            </button>
          </div>
        </div>

        {/* Last Update */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          마지막 업데이트: {lastUpdate.toLocaleString('ko-KR')}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <SummaryCards summary={breakdown.summary} isDark={isDark} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Item Type Pie Chart */}
          <ItemTypePieChart byItemType={breakdown.by_item_type} isDark={isDark} />

          {/* Level Distribution */}
          <LevelDistribution byLevel={breakdown.by_level} isDark={isDark} />
        </div>

        {/* Level Breakdown Table */}
        <LevelBreakdownTable byLevel={breakdown.by_level} isDark={isDark} />

        {/* Top Cost Items Table */}
        <TopCostItemsTable topItems={breakdown.top_cost_items} isDark={isDark} />
      </div>
    </div>
  );
};

// ============================================================================
// Summary Cards Component (Lines 151-250)
// ============================================================================

interface SummaryCardsProps {
  summary: CostBreakdown['summary'];
  isDark: boolean;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, isDark }) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    {/* Total Material Cost */}
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          총 자재비
        </div>
        
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        ₩{summary.total_material_cost.toLocaleString('ko-KR')}
      </div>
      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        {summary.total_items}개 품목
      </div>
    </div>

    {/* Total Scrap Revenue */}
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          총 스크랩금액
        </div>
        
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        -₩{summary.total_scrap_revenue.toLocaleString('ko-KR')}
      </div>
      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        원가 절감
      </div>
    </div>

    {/* Net Cost */}
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          순원가
        </div>
        
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        ₩{summary.total_net_cost.toLocaleString('ko-KR')}
      </div>
      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        최종 원가
      </div>
    </div>

    {/* Average Cost Per Item */}
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          평균 품목당 원가
        </div>
        
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        ₩{Math.round(summary.avg_cost_per_item).toLocaleString('ko-KR')}
      </div>
      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        단위당 평균
      </div>
    </div>
  </div>
);

// ============================================================================
// Item Type Pie Chart Component (Lines 251-350)
// ============================================================================

interface ItemTypePieChartProps {
  byItemType: CostBreakdown['by_item_type'];
  isDark: boolean;
}

const ItemTypePieChart: React.FC<ItemTypePieChartProps> = ({ byItemType, isDark }) => {
  const chartData = {
    labels: ['내부생산', '외부구매'],
    datasets: [{
      data: [
        byItemType.internal_production.net_cost,
        byItemType.external_purchase.net_cost
      ],
      backgroundColor: [
        'rgba(38, 38, 38, 0.6)',  // Gray-800 for internal
        'rgba(82, 82, 82, 0.6)'   // Gray-600 for external
      ],
      borderColor: [
        '#262626',
        '#525252'
      ],
      borderWidth: 2
    }]
  };

  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: { size: 14, weight: 'bold' },
          padding: 15,
          color: isDark ? '#e5e7eb' : '#374151'
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#e5e7eb' : '#111827',
        bodyColor: isDark ? '#d1d5db' : '#374151',
        borderColor: isDark ? '#4b5563' : '#d1d5db',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `${label}: ₩${value.toLocaleString('ko-KR')} (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        품목구분별 원가 비중
      </h3>
      <div className="h-64">
        <Pie data={chartData} options={options} />
      </div>

      {/* Stats below chart */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-gray-100 dark:bg-gray-700 rounded">
          <div className="text-xs text-gray-600 dark:text-gray-400">내부생산</div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {byItemType.internal_production.count}개
          </div>
        </div>
        <div className="text-center p-2 bg-gray-100 dark:bg-gray-700 rounded">
          <div className="text-xs text-gray-600 dark:text-gray-400">외부구매</div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {byItemType.external_purchase.count}개
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Level Distribution Component
// ============================================================================

interface LevelDistributionProps {
  byLevel: CostBreakdown['by_level'];
  isDark: boolean;
}

const LevelDistribution: React.FC<LevelDistributionProps> = ({ byLevel, isDark }) => {
  const totalCost = byLevel.reduce((sum, level) => sum + level.net_cost, 0);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        레벨별 원가 분포
      </h3>

      <div className="space-y-3">
        {byLevel.map(level => {
          const percentage = totalCost > 0 ? (level.net_cost / totalCost) * 100 : 0;

          return (
            <div key={level.level} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Level {level.level}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    {level.count}개
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₩{level.net_cost.toLocaleString('ko-KR')}
                  </span>
                </div>
              </div>

              <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-gray-600 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                {percentage.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {byLevel.length === 0 && (
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          <p className="text-sm">레벨별 데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Level Breakdown Table Component (Lines 351-450)
// ============================================================================

interface LevelBreakdownTableProps {
  byLevel: CostBreakdown['by_level'];
  isDark: boolean;
}

const LevelBreakdownTable: React.FC<LevelBreakdownTableProps> = ({ byLevel, isDark }) => {
  const totalCost = byLevel.reduce((sum, level) => sum + level.net_cost, 0);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          레벨별 원가 상세 분석
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                레벨
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                품목 수
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                자재비
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                스크랩금액
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                순원가
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                비중
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {byLevel.map((level, index) => {
              const percentage = totalCost > 0 ? (level.net_cost / totalCost) * 100 : 0;

              return (
                <tr
                  key={level.level}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      Level {level.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                    {level.count}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                    ₩{level.material_cost.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                    -₩{level.scrap_revenue.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900 dark:text-white">
                    ₩{level.net_cost.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-600 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 dark:bg-gray-800 font-semibold">
            <tr>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white" colSpan={2}>
                합계
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                ₩{byLevel.reduce((s, l) => s + l.material_cost, 0).toLocaleString('ko-KR')}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                -₩{byLevel.reduce((s, l) => s + l.scrap_revenue, 0).toLocaleString('ko-KR')}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                ₩{totalCost.toLocaleString('ko-KR')}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {byLevel.length === 0 && (
        <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-sm">레벨별 데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Top Cost Items Table Component (Lines 451-550)
// ============================================================================

interface TopCostItemsTableProps {
  topItems: CostBreakdown['top_cost_items'];
  isDark: boolean;
}

const TopCostItemsTable: React.FC<TopCostItemsTableProps> = ({ topItems, isDark }) => (
  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        원가 상위 10개 품목
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        총 원가 기준 상위 품목 목록
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              순위
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              품목코드
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              품목명
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              수량
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              단가
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              총원가
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              비중
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {topItems.map((item, index) => (
            <tr
              key={item.item_code}
              className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'
              }`}
            >
              <td className="px-4 py-3 whitespace-nowrap text-center">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {index + 1}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                  {item.item_code}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                  {item.item_name}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-700 dark:text-gray-300">
                {item.quantity.toLocaleString('ko-KR')}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-700 dark:text-gray-300">
                ₩{Math.round(item.unit_cost).toLocaleString('ko-KR')}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900 dark:text-white">
                ₩{item.total_cost.toLocaleString('ko-KR')}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {item.percentage.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {topItems.length === 0 && (
      <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-sm">원가 데이터가 없습니다</p>
      </div>
    )}
  </div>
);

export default CostAnalysisPanel;
