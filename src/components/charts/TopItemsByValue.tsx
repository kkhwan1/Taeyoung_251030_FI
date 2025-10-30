/**
 * Top Items by Value Chart Component
 * Displays top items ranked by value with horizontal bar chart
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
  Download,
  Printer,
  RefreshCcw,
  Crown,
  Filter
} from 'lucide-react';
import {
  formatKoreanNumber,
  getRechartsTheme,
  exportChartAsImage,
  printChart,
  debounce
} from '../../utils/chartUtils';

interface TopItemData {
  item_id: string;
  item_name: string;
  item_code: string;
  category: string;
  currentStock: number;
  unitPrice: number;
  totalValue: number;
  monthlyVolume: number;
  turnoverRate: number;
  lastTransactionDate: Date | null;
  supplier: string | null;
  stockStatus: 'low' | 'normal' | 'high' | 'overstock';
  rank: number;
}

interface TopItemsByValueProps {
  data: TopItemData[] | null;
  loading: boolean;
  error: string | null;
  isDark?: boolean;
  onRefresh?: () => void;
  showControls?: boolean;
  className?: string;
  onItemClick?: (itemId: string) => void;
  limit?: number;
}

type SortMetric = 'value' | 'volume' | 'turnover' | 'stock';
type CategoryFilter = 'all' | string;

export const TopItemsByValue: React.FC<TopItemsByValueProps> = ({
  data,
  loading,
  error,
  isDark = false,
  onRefresh,
  showControls = true,
  className = '',
  onItemClick,
  limit = 10
}) => {
  const [sortMetric, setSortMetric] = useState<SortMetric>('value');
  const [topCount, setTopCount] = useState(limit);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showStockStatus, setShowStockStatus] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const chartRef = useRef<any>(null);
  const theme = getRechartsTheme(isDark);

  // Get available categories
  const categories = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return [...new Set(data.map(item => item.category || item.카테고리).filter(Boolean))].sort();
  }, [data]);

  // Process and filter data
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    // Normalize data format (handle both TopItemData and StockChartDatum formats)
    const normalizedData = data.map(item => {
      // If already in TopItemData format, use as-is
      if (item.item_id && item.totalValue !== undefined) {
        return item as TopItemData;
      }
      
      // Otherwise, convert from StockChartDatum format
      const currentStock = item.current_stock ?? item.현재고 ?? item.현재재고 ?? 0;
      const safetyStock = item.safety_stock ?? item.안전재고 ?? item.최소재고 ?? 0;
      const unitPrice = item.unitPrice ?? item.price ?? item.단가 ?? 0;
      
      return {
        item_id: item.item_id || item.code || item.item_code || '',
        item_name: item.item_name || item.name || '',
        item_code: item.item_code || item.code || '',
        category: item.category || item.카테고리 || '',
        currentStock,
        unitPrice,
        totalValue: currentStock * unitPrice,
        monthlyVolume: item.monthlyVolume || item.월간거래량 || 0,
        turnoverRate: item.turnoverRate || item.회전율 || 0,
        lastTransactionDate: item.lastTransactionDate ? new Date(item.lastTransactionDate) : null,
        stockStatus: currentStock < safetyStock * 0.5 ? 'low' 
                    : currentStock < safetyStock ? 'normal'
                    : currentStock > safetyStock * 2 ? 'overstock'
                    : 'high' as 'low' | 'normal' | 'high' | 'overstock',
        rank: item.rank || 0
      } as TopItemData;
    });

    let filtered = normalizedData.filter(item => 
      item && 
      (item.item_id || item.item_code) &&
      (item.item_name || item.item_code)
    );

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => (item.category || '') === categoryFilter);
    }

    // Sort by selected metric
    filtered = filtered.sort((a, b) => {
      switch (sortMetric) {
        case 'value':
          return b.totalValue - a.totalValue;
        case 'volume':
          return b.monthlyVolume - a.monthlyVolume;
        case 'turnover':
          return b.turnoverRate - a.turnoverRate;
        case 'stock':
          return b.currentStock - a.currentStock;
        default:
          return b.totalValue - a.totalValue;
      }
    });

    // Take top N items
    const topItems = filtered.slice(0, topCount);

    // Add display value and colors
    return topItems.map((item, index) => ({
      ...item,
      displayName: (item.item_name && item.item_name.length > 15)
        ? `${item.item_name.substring(0, 12)}...`
        : (item.item_name || item.item_code || '알 수 없음'),
      displayValue: sortMetric === 'value' ? item.totalValue
                   : sortMetric === 'volume' ? item.monthlyVolume
                   : sortMetric === 'turnover' ? item.turnoverRate
                   : item.currentStock,
      color: getStatusColor(item.stockStatus),
      rank: index + 1
    }));
  }, [data, sortMetric, topCount, categoryFilter]);

  // Get stock status color
  function getStatusColor(status: string) {
    switch (status) {
      case 'low':
        return theme.colors[4]; // Red
      case 'normal':
        return theme.colors[1]; // Green
      case 'high':
        return theme.colors[0]; // Blue
      case 'overstock':
        return theme.colors[3]; // Orange
      default:
        return theme.colors[5]; // Gray
    }
  }

  // Calculate statistics
  const stats = useMemo(() => {
    if (!processedData.length) return null;

    const totalValue = processedData.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const totalVolume = processedData.reduce((sum, item) => sum + (item.monthlyVolume || 0), 0);
    const avgTurnover = processedData.length > 0
      ? processedData.reduce((sum, item) => sum + (item.turnoverRate || 0), 0) / processedData.length
      : 0;
    const topItem = processedData[0];
    const topItemPercentage = totalValue > 0 && topItem && topItem.totalValue !== undefined
      ? (topItem.totalValue / totalValue) * 100
      : 0;

    return {
      totalValue,
      totalVolume,
      avgTurnover,
      topItem: topItem.item_name,
      topItemValue: topItem.totalValue,
      topItemPercentage,
      lowStockCount: processedData.filter(item => item.stockStatus === 'low').length,
      overstockCount: processedData.filter(item => item.stockStatus === 'overstock').length
    };
  }, [processedData, data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div
          className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-600 rounded-lg min-w-[280px]"
          style={theme.tooltip.contentStyle}
        >
          <div className="flex items-center space-x-2 mb-3">
            <Crown className="w-4 h-4 text-gray-500" />
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              #{data.rank} {data.item_name}
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">품목코드</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.item_code}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">카테고리</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.category}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">재고가치</p>
                <p className="font-medium text-gray-600 text-sm">
                  ₩{formatKoreanNumber(data.totalValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">현재고</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {formatKoreanNumber(data.currentStock)}개
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">단가</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  ₩{formatKoreanNumber(data.unitPrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">월 거래량</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {formatKoreanNumber(data.monthlyVolume)}개
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">회전율:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.turnoverRate.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">재고상태:</span>
                <span className={`font-medium text-sm ${
                  data.stockStatus === 'low' ? 'text-gray-600'
                  : data.stockStatus === 'normal' ? 'text-gray-600'
                  : data.stockStatus === 'high' ? 'text-gray-600'
                  : 'text-gray-600'
                }`}>
                  {data.stockStatus === 'low' ? '부족'
                   : data.stockStatus === 'normal' ? '정상'
                   : data.stockStatus === 'high' ? '충분'
                   : '과재고'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">공급업체:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                  {data.supplier}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Handle bar click
  const handleBarClick = (data: any) => {
    if (onItemClick) {
      onItemClick(data.item_id);
    }

    const newSelected = new Set(selectedItems);
    if (newSelected.has(data.item_id)) {
      newSelected.delete(data.item_id);
    } else {
      newSelected.add(data.item_id);
    }
    setSelectedItems(newSelected);
  };

  // Handle refresh with debounce
  const debouncedRefresh = debounce(() => {
    onRefresh?.();
  }, 1000);

  // Get metric label
  const getMetricLabel = () => {
    switch (sortMetric) {
      case 'value': return '재고가치';
      case 'volume': return '월 거래량';
      case 'turnover': return '회전율';
      case 'stock': return '현재고';
      default: return '재고가치';
    }
  };

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            상위 품목 (가치별)
          </h3>
        </div>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            
            <p>차트 데이터 로드 실패</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
            {onRefresh && (
              <button
                onClick={debouncedRefresh}
                className="mt-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-300 rounded-lg font-medium transition-colors"
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
    <div className={`bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex flex-row flex-wrap items-center space-x-1.5">
          <Crown className="w-4 h-4 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            상위 품목 ({getMetricLabel()})
          </h3>
          {stats && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-lg">
              상위 {topCount}개 품목
            </span>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Top Count */}
            <select
              value={topCount}
              onChange={(e) => setTopCount(parseInt(e.target.value))}
              className="min-w-[100px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
            >
              <option value={5}>상위 5개</option>
              <option value={10}>상위 10개</option>
              <option value={20}>상위 20개</option>
            </select>

            {/* Sort Metric */}
            <select
              value={sortMetric}
              onChange={(e) => setSortMetric(e.target.value as SortMetric)}
              className="min-w-[120px] px-2 py-2 sm:py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
            >
              <option value="value">재고가치</option>
              <option value="volume">거래량</option>
              <option value="turnover">회전율</option>
            </select>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                onClick={debouncedRefresh}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                title="데이터 새로고침"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-64 sm:h-72 lg:h-80" ref={chartRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
          </div>
        ) : !processedData.length ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              
              <p>표시할 품목 데이터가 없습니다</p>
              {categoryFilter !== 'all' && (
                <p className="text-sm text-gray-400 mt-1">
                  선택한 카테고리: {categoryFilter}
                </p>
              )}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedData}
              layout="horizontal"
              margin={{ top: 10, right: 20, left: 110, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                type="number"
                tickFormatter={(value) =>
                  sortMetric === 'value'
                    ? `₩${formatKoreanNumber(value)}`
                    : sortMetric === 'turnover'
                    ? value.toFixed(1)
                    : formatKoreanNumber(value)
                }
                tick={theme.xAxis.tick}
                axisLine={theme.xAxis.axisLine}
              />
              <YAxis
                type="category"
                dataKey="displayName"
                tick={{ ...theme.yAxis.tick, fontSize: 11 }}
                axisLine={theme.yAxis.axisLine}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} />

              <Bar
                dataKey="displayValue"
                name={getMetricLabel()}
                onClick={handleBarClick}
                cursor="pointer"
                radius={[0, 2, 2, 0]}
              >
                {processedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={selectedItems.has(entry.item_id)
                      ? theme.colors[6]
                      : showStockStatus
                      ? entry.color
                      : theme.colors[0]
                    }
                    opacity={selectedItems.size === 0 || selectedItems.has(entry.item_id) ? 1 : 0.3}
                  />
                ))}
              </Bar>

              {/* Average line */}
              {stats && (
                <ReferenceLine
                  x={sortMetric === 'value' ? stats.totalValue / processedData.length
                     : sortMetric === 'volume' ? stats.totalVolume / processedData.length
                     : sortMetric === 'turnover' ? stats.avgTurnover
                     : processedData.reduce((sum, item) => sum + item.currentStock, 0) / processedData.length}
                  stroke={theme.colors[3]}
                  strokeDasharray="5 5"
                  label={{ value: "평균", position: "insideTopRight" }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Statistics Summary */}
      {!loading && processedData.length > 0 && stats && (
        <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">1위 품목</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {stats.topItem}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ({isNaN(stats.topItemPercentage) ? '0.0' : stats.topItemPercentage.toFixed(1)}%)
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 재고가치</p>
            <p className="text-base font-semibold text-gray-600">
              ₩{formatKoreanNumber(stats.totalValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">재고 이슈</p>
            <p className="text-base font-semibold text-gray-600">
              {stats.lowStockCount + stats.overstockCount}개
            </p>
          </div>
        </div>
      )}

      {/* Selected Items Info */}
      {selectedItems.size > 0 && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-800 dark:text-gray-300 font-medium">
                선택된 품목: {selectedItems.size}개
              </span>
            </div>
            <button
              onClick={() => setSelectedItems(new Set())}
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              선택 해제
            </button>
          </div>
        </div>
      )}
    </div>
  );
};