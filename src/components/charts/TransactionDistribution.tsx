/**
 * Transaction Distribution Chart Component
 * Displays transaction type distribution with interactive pie and donut charts
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { PieChart as PieChartIcon, BarChart3, Download, Printer, RefreshCcw, Activity } from 'lucide-react';
import {
  formatKoreanNumber,
  getRechartsTheme,
  exportChartAsImage,
  printChart,
  debounce,
  getTransactionTypeColor
} from '../../utils/chartUtils';

interface TransactionDistributionData {
  type: string;
  count: number;
  volume: number;
  value: number;
  percentage: number;
  items: number;
  avgPerTransaction: number;
  companies: number;
}

interface TransactionDistributionProps {
  data: TransactionDistributionData[] | null;
  loading: boolean;
  error: string | null;
  isDark?: boolean;
  onRefresh?: () => void;
  showControls?: boolean;
  className?: string;
  onTypeClick?: (type: string) => void;
}

type ChartType = 'pie' | 'donut' | 'bar';
type MetricType = 'count' | 'volume' | 'value';
type TimeRange = 'today' | 'week' | 'month' | 'quarter';

export const TransactionDistribution: React.FC<TransactionDistributionProps> = ({
  data,
  loading,
  error,
  isDark = false,
  onRefresh,
  showControls = true,
  className = '',
  onTypeClick
}) => {
  const [chartType, setChartType] = useState<ChartType>('donut');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('volume');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const chartRef = useRef<any>(null);
  const theme = getRechartsTheme(isDark);

  // Process data for display
  const processedData = useMemo(() => {
    if (!data) return [];

    return data.map((item, index) => ({
      ...item,
      displayValue: selectedMetric === 'count' ? item.count
                   : selectedMetric === 'volume' ? item.volume
                   : item.value,
      color: getTransactionTypeColor(item.type, isDark),
      id: `${item.type}-${index}`
    })).sort((a, b) => b.displayValue - a.displayValue);
  }, [data, selectedMetric, isDark]);

  // Calculate total and percentages
  const totals = useMemo(() => {
    if (!processedData.length) return null;

    const total = processedData.reduce((sum, item) => sum + item.displayValue, 0);
    const totalCount = processedData.reduce((sum, item) => sum + item.count, 0);
    const totalVolume = processedData.reduce((sum, item) => sum + item.volume, 0);
    const totalValue = processedData.reduce((sum, item) => sum + item.value, 0);

    return {
      total,
      totalCount,
      totalVolume,
      totalValue,
      avgTransaction: totalCount > 0 ? totalVolume / totalCount : 0,
      topType: processedData[0]?.type || '',
      topPercentage: total > 0 ? (processedData[0]?.displayValue || 0) / total * 100 : 0
    };
  }, [processedData]);

  // Custom tooltip for pie charts
  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = totals && totals.total > 0 ? (data.value / totals.total * 100) : 0;

      return (
        <div
          className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg min-w-[200px]"
          style={theme.tooltip.contentStyle}
        >
          <div className="flex items-center space-x-2 mb-3">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: data.payload.color }}
            />
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {data.payload.type}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">거래 건수:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatKoreanNumber(data.payload.count)}건
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">거래량:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatKoreanNumber(data.payload.volume)}개
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">거래금액:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                ₩{formatKoreanNumber(data.payload.value)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-600 dark:text-gray-400 text-sm">비율:</span>
              <span className="font-medium text-blue-600">
                {percentage.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">평균 거래량:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatKoreanNumber(data.payload.avgPerTransaction)}개
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">거래처 수:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {data.payload.companies}개
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom label function
  const renderCustomLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent, name
  }: any) => {
    if (!showLabels || percent < 0.05) return null; // Don't show labels for slices < 5%

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill={isDark ? '#F9FAFB' : '#1F2937'}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="500"
      >
        {`${name} ${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  // Handle sector click
  const handleSectorClick = (data: any) => {
    if (onTypeClick) {
      onTypeClick(data.type);
    }

    const newSelected = new Set(selectedTypes);
    if (newSelected.has(data.type)) {
      newSelected.delete(data.type);
    } else {
      newSelected.add(data.type);
    }
    setSelectedTypes(newSelected);
  };

  // Handle refresh with debounce
  const debouncedRefresh = debounce(() => {
    onRefresh?.();
  }, 1000);

  // Get metric label
  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'count': return '거래 건수';
      case 'volume': return '거래량';
      case 'value': return '거래금액';
      default: return '거래량';
    }
  };

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            거래 유형 분포
          </h3>
        </div>
        <div className="flex items-center justify-center h-64 text-red-500">
          <div className="text-center">
            <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>차트 데이터 로드 실패</p>
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
          <Activity className="w-4 h-4 text-purple-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            거래 유형 분포
          </h3>
          {totals && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-lg">
              총 {formatKoreanNumber(totals.totalCount)}건
            </span>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex items-center space-x-1">
            {/* Time Range - Hidden on small screens */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="hidden md:block px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="today">오늘</option>
              <option value="week">이번 주</option>
              <option value="month">이번 달</option>
              <option value="quarter">이번 분기</option>
            </select>

            {/* Metric Type */}
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="count">건수</option>
              <option value="volume">수량</option>
              <option value="value">금액</option>
            </select>

            {/* Chart Type */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setChartType('pie')}
                className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                  chartType === 'pie'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                파이
              </button>
              <button
                onClick={() => setChartType('donut')}
                className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                  chartType === 'donut'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                도넛
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                  chartType === 'bar'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                막대
              </button>
            </div>

            {/* Options */}
            {chartType !== 'bar' && (
              <>
                <button
                  onClick={() => setShowLabels(!showLabels)}
                  className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    showLabels
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  레이블
                </button>

                <button
                  onClick={() => setShowLegend(!showLegend)}
                  className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    showLegend
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  범례
                </button>
              </>
            )}

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

            {/* Export buttons */}
            <button
              onClick={() => exportChartAsImage(chartRef, '거래유형분포.png')}
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

      {/* Chart */}
      <div className="h-96" ref={chartRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : !processedData.length ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>표시할 거래 데이터가 없습니다</p>
            </div>
          </div>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.cartesianGrid.stroke} />
              <XAxis
                dataKey="type"
                tick={theme.xAxis.tick}
                axisLine={theme.xAxis.axisLine}
                angle={0}
                textAnchor="middle"
                height={60}
                interval={0}
              />
              <YAxis
                tickFormatter={(value) =>
                  selectedMetric === 'value'
                    ? `₩${formatKoreanNumber(value)}`
                    : formatKoreanNumber(value)
                }
                tick={theme.yAxis.tick}
                axisLine={theme.yAxis.axisLine}
              />
              <Tooltip content={<PieTooltip />} />

              <Bar
                dataKey="displayValue"
                name={getMetricLabel()}
                onClick={handleSectorClick}
                cursor="pointer"
                radius={[2, 2, 0, 0]}
              >
                {processedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={selectedTypes.has(entry.type)
                      ? theme.colors[6]
                      : entry.color
                    }
                    opacity={selectedTypes.size === 0 || selectedTypes.has(entry.type) ? 1 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={384}>
                <PieChart>
                  <Pie
                    data={processedData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={showLabels ? renderCustomLabel : false}
                    outerRadius={chartType === 'donut' ? 120 : 140}
                    innerRadius={chartType === 'donut' ? 60 : 0}
                    fill="#8884d8"
                    dataKey="displayValue"
                    onClick={handleSectorClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {processedData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={selectedTypes.has(entry.type)
                          ? theme.colors[6]
                          : entry.color
                        }
                        opacity={selectedTypes.size === 0 || selectedTypes.has(entry.type) ? 1 : 0.3}
                        stroke={selectedTypes.has(entry.type) ? theme.colors[7] : 'none'}
                        strokeWidth={selectedTypes.has(entry.type) ? 2 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  {showLegend && (
                    <Legend
                      verticalAlign="middle"
                      align="right"
                      layout="vertical"
                      iconType="circle"
                      wrapperStyle={{
                        paddingLeft: '20px',
                        fontSize: '14px',
                        color: isDark ? '#F9FAFB' : '#1F2937'
                      }}
                    />
                  )}
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Center label for donut chart */}
            {chartType === 'donut' && totals && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedMetric === 'value'
                      ? `₩${formatKoreanNumber(totals.total)}`
                      : formatKoreanNumber(totals.total)
                    }
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    총 {getMetricLabel()}
                  </p>
                  {totals.topType && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      최다: {totals.topType} ({totals.topPercentage.toFixed(1)}%)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Statistics Summary */}
      {!loading && processedData.length > 0 && totals && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 거래건수</p>
            <p className="text-lg font-semibold text-blue-600">
              {formatKoreanNumber(totals.totalCount)}건
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 거래량</p>
            <p className="text-lg font-semibold text-green-600">
              {formatKoreanNumber(totals.totalVolume)}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">총 거래금액</p>
            <p className="text-lg font-semibold text-purple-600">
              ₩{formatKoreanNumber(totals.totalValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">평균 거래량</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatKoreanNumber(totals.avgTransaction)}개
            </p>
          </div>
        </div>
      )}

      {/* Selected Types Info */}
      {selectedTypes.size > 0 && (
        <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-800 dark:text-purple-300 font-medium">
                선택된 유형: {Array.from(selectedTypes).join(', ')}
              </span>
            </div>
            <button
              onClick={() => setSelectedTypes(new Set())}
              className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200"
            >
              선택 해제
            </button>
          </div>
        </div>
      )}
    </div>
  );
};