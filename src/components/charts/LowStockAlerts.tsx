/**
 * Low Stock Alerts Chart Component
 * Displays low stock alerts with warning indicators and priority levels
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  AlertTriangle,
  AlertCircle,
  Bell,
  Clock,
  Download,
  Printer,
  RefreshCcw,
  Filter,
  CheckCircle
} from 'lucide-react';
import {
  formatKoreanNumber,
  formatKoreanDate,
  getRechartsTheme,
  exportChartAsImage,
  printChart,
  debounce
} from '../../utils/chartUtils';

interface LowStockAlertData {
  item_id: string;
  item_name: string;
  item_code: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  safetyStock: number;
  averageConsumption: number;
  stockoutRisk: number; // 0-100 percentage
  daysUntilStockout: number;
  lastRestockDate: Date;
  supplier: string;
  leadTime: number; // days
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
  showControls?: boolean;
  className?: string;
  onItemClick?: (itemId: string) => void;
  onReorderClick?: (itemId: string) => void;
}

type ViewMode = 'chart' | 'list' | 'grid';
type SortBy = 'priority' | 'days' | 'risk' | 'stock' | 'cost';
type PriorityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

export const LowStockAlerts: React.FC<LowStockAlertsProps> = ({
  data,
  loading,
  error,
  isDark = false,
  onRefresh,
  showControls = true,
  className = '',
  onItemClick,
  onReorderClick
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [sortBy, setSortBy] = useState<SortBy>('priority');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [showOnlyActionable, setShowOnlyActionable] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const chartRef = useRef<any>(null);
  const theme = getRechartsTheme(isDark);

  // Priority colors and weights
  const priorityConfig = {
    critical: { color: '#DC2626', weight: 4, bgColor: 'bg-red-100 dark:bg-red-900/20', textColor: 'text-red-800 dark:text-red-200' },
    high: { color: '#EA580C', weight: 3, bgColor: 'bg-orange-100 dark:bg-orange-900/20', textColor: 'text-orange-800 dark:text-orange-200' },
    medium: { color: '#D97706', weight: 2, bgColor: 'bg-amber-100 dark:bg-amber-900/20', textColor: 'text-amber-800 dark:text-amber-200' },
    low: { color: '#65A30D', weight: 1, bgColor: 'bg-lime-100 dark:bg-lime-900/20', textColor: 'text-lime-800 dark:text-lime-200' }
  };

  // Process and filter data
  const processedData = useMemo(() => {
    if (!data) return [];

    let filtered = data;

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(item => item.priority === priorityFilter);
    }

    // Apply actionable filter
    if (showOnlyActionable) {
      filtered = filtered.filter(item => item.daysUntilStockout <= 30);
    }

    // Sort data
    filtered = filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return priorityConfig[b.priority].weight - priorityConfig[a.priority].weight;
        case 'days':
          return a.daysUntilStockout - b.daysUntilStockout;
        case 'risk':
          return b.stockoutRisk - a.stockoutRisk;
        case 'stock':
          return (a.currentStock / a.minimumStock) - (b.currentStock / b.minimumStock);
        case 'cost':
          return b.estimatedCost - a.estimatedCost;
        default:
          return priorityConfig[b.priority].weight - priorityConfig[a.priority].weight;
      }
    });

    return filtered.map(item => ({
      ...item,
      displayName: item.item_name.length > 25 ? `${item.item_name.substring(0, 22)}...` : item.item_name,
      stockRatio: item.minimumStock > 0 ? (item.currentStock / item.minimumStock) : 0,
      urgencyScore: Math.min(100, (100 - item.daysUntilStockout) + item.stockoutRisk),
      color: priorityConfig[item.priority].color
    }));
  }, [data, priorityFilter, showOnlyActionable, sortBy]);

  // Calculate summary statistics
  const alertSummary = useMemo(() => {
    if (!processedData.length) return null;

    const critical = processedData.filter(item => item.priority === 'critical').length;
    const high = processedData.filter(item => item.priority === 'high').length;
    const medium = processedData.filter(item => item.priority === 'medium').length;
    const low = processedData.filter(item => item.priority === 'low').length;
    const immediate = processedData.filter(item => item.daysUntilStockout <= 7).length;
    const shortTerm = processedData.filter(item => item.daysUntilStockout <= 30).length;
    const autoReorderEnabled = processedData.filter(item => item.autoReorderEnabled).length;
    const totalCost = processedData.reduce((sum, item) => sum + item.estimatedCost, 0);

    return {
      total: processedData.length,
      critical,
      high,
      medium,
      low,
      immediate,
      shortTerm,
      autoReorderEnabled,
      totalCost,
      avgDaysUntilStockout: processedData.reduce((sum, item) => sum + item.daysUntilStockout, 0) / processedData.length
    };
  }, [processedData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div
          className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg min-w-[300px]"
          style={theme.tooltip.contentStyle}
        >
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle
              className={`w-5 h-5 ${
                data.priority === 'critical' ? 'text-red-500'
                : data.priority === 'high' ? 'text-orange-500'
                : data.priority === 'medium' ? 'text-amber-500'
                : 'text-lime-500'
              }`}
            />
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {data.item_name}
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">현재고</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {formatKoreanNumber(data.currentStock)}개
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">최소재고</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {formatKoreanNumber(data.minimumStock)}개
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">재고부족 위험도</p>
                <p className={`font-medium ${
                  data.stockoutRisk >= 80 ? 'text-red-600'
                  : data.stockoutRisk >= 60 ? 'text-orange-600'
                  : data.stockoutRisk >= 40 ? 'text-amber-600'
                  : 'text-green-600'
                }`}>
                  {data.stockoutRisk}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">재고 소진까지</p>
                <p className={`font-medium ${
                  data.daysUntilStockout <= 7 ? 'text-red-600'
                  : data.daysUntilStockout <= 30 ? 'text-orange-600'
                  : 'text-green-600'
                }`}>
                  {data.daysUntilStockout}일
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">공급업체:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.supplier}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">리드타임:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.leadTime}일
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">예상 발주비용:</span>
                <span className="font-medium text-green-600 text-sm">
                  ₩{formatKoreanNumber(data.estimatedCost)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">자동 재주문:</span>
                <span className={`font-medium text-sm ${
                  data.autoReorderEnabled ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {data.autoReorderEnabled ? '활성화' : '비활성화'}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Handle item selection
  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Handle bar click
  const handleBarClick = (data: any) => {
    if (onItemClick) {
      onItemClick(data.item_id);
    }
    toggleItemSelection(data.item_id);
  };

  // Handle refresh with debounce
  const debouncedRefresh = debounce(() => {
    onRefresh?.();
  }, 1000);

  // Get priority icon
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <Bell className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-lime-500" />;
    }
  };

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            재고 부족 알림
          </h3>
        </div>
        <div className="flex items-center justify-center h-64 text-red-500">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>알림 데이터 로드 실패</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
            {onRefresh && (
              <button
                onClick={debouncedRefresh}
                className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-800 dark:text-red-300 rounded-lg font-medium transition-colors"
              >
                다시 시도
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-1.5">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            재고 부족 알림
          </h3>
          {alertSummary && (
            <span className={`ml-2 px-1.5 py-0.5 rounded-lg text-xs font-medium ${
              alertSummary.critical > 0
                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                : alertSummary.high > 0
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {alertSummary.total}개 알림
            </span>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center space-x-1 flex-wrap gap-y-1">
            {/* View Mode */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                차트
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                목록
              </button>
            </div>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">모든 우선순위</option>
              <option value="critical">긴급</option>
              <option value="high">높음</option>
              <option value="medium">보통</option>
              <option value="low">낮음</option>
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="priority">우선순위</option>
              <option value="days">소진일수</option>
              <option value="risk">위험도</option>
              <option value="stock">재고비율</option>
              <option value="cost">발주비용</option>
            </select>

            {/* Actionable Filter */}
            <button
              onClick={() => setShowOnlyActionable(!showOnlyActionable)}
              className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showOnlyActionable
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              긴급 조치 필요
            </button>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                onClick={debouncedRefresh}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                title="알림 새로고침"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Export buttons */}
            <button
              onClick={() => exportChartAsImage(chartRef, '재고부족알림.png')}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="이미지로 내보내기"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => printChart(chartRef)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="인쇄"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={chartRef}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          </div>
        ) : !processedData.length ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
              <p className="text-lg font-medium text-green-600">재고 부족 알림이 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">
                모든 품목이 안전 재고 수준을 유지하고 있습니다
              </p>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {processedData.map((item) => (
              <div
                key={item.item_id}
                className={`p-4 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer transition-colors ${
                  selectedItems.has(item.item_id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                } ${priorityConfig[item.priority].bgColor}`}
                onClick={() => handleBarClick(item)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getPriorityIcon(item.priority)}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.item_name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.item_code} • {item.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">현재고</p>
                      <p className="font-medium">{formatKoreanNumber(item.currentStock)}개</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">소진까지</p>
                      <p className={`font-medium ${
                        item.daysUntilStockout <= 7 ? 'text-red-600'
                        : item.daysUntilStockout <= 30 ? 'text-orange-600'
                        : 'text-green-600'
                      }`}>
                        {item.daysUntilStockout}일
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">위험도</p>
                      <p className={`font-medium ${
                        item.stockoutRisk >= 80 ? 'text-red-600'
                        : item.stockoutRisk >= 60 ? 'text-orange-600'
                        : 'text-amber-600'
                      }`}>
                        {item.stockoutRisk}%
                      </p>
                    </div>
                    {onReorderClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderClick(item.item_id);
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        재주문
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
                <XAxis
                  dataKey="displayName"
                  tick={{ ...theme.xAxis.tick, fontSize: 11 }}
                  axisLine={theme.xAxis.axisLine}
                  angle={0}
                  textAnchor="middle"
                  height={60}
                  interval={0}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={theme.yAxis.tick}
                  axisLine={theme.yAxis.axisLine}
                  label={{ value: '위험도 (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />

                <Bar
                  dataKey="stockoutRisk"
                  name="재고부족 위험도"
                  onClick={handleBarClick}
                  cursor="pointer"
                  radius={[2, 2, 0, 0]}
                >
                  {processedData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={selectedItems.has(entry.item_id)
                        ? theme.colors[6]
                        : entry.color
                      }
                      opacity={selectedItems.size === 0 || selectedItems.has(entry.item_id) ? 1 : 0.3}
                    />
                  ))}
                </Bar>

                {/* Reference lines */}
                <ReferenceLine
                  y={80}
                  stroke="#DC2626"
                  strokeDasharray="5 5"
                  label={{ value: "긴급 (80%)", position: "insideTopLeft" }}
                />
                <ReferenceLine
                  y={60}
                  stroke="#EA580C"
                  strokeDasharray="3 3"
                  label={{ value: "높음 (60%)", position: "insideTopLeft" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Alert Summary */}
      {!loading && alertSummary && alertSummary.total > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">긴급 알림</p>
            <p className="text-lg font-semibold text-red-600">
              {alertSummary.critical}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">7일 내 소진</p>
            <p className="text-lg font-semibold text-orange-600">
              {alertSummary.immediate}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">자동 재주문</p>
            <p className="text-lg font-semibold text-green-600">
              {alertSummary.autoReorderEnabled}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">예상 발주비용</p>
            <p className="text-lg font-semibold text-blue-600">
              ₩{formatKoreanNumber(alertSummary.totalCost)}
            </p>
          </div>
        </div>
      )}

      {/* Selected Items Actions */}
      {selectedItems.size > 0 && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                {selectedItems.size}개 품목 선택됨
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {onReorderClick && (
                <button
                  onClick={() => {
                    selectedItems.forEach(itemId => onReorderClick(itemId));
                    setSelectedItems(new Set());
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  일괄 재주문
                </button>
              )}
              <button
                onClick={() => setSelectedItems(new Set())}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                선택 해제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};