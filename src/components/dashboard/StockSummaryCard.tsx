'use client';

import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, CheckCircle, TrendingUp, RefreshCw } from 'lucide-react';

interface StockSummaryData {
  total_items: number;
  low_stock_items: number;
  total_value: number;
  normal_items?: number;
  warning_items?: number;
  critical_items?: number;
}

interface SummaryCard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  change?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ko-KR').format(num);
};

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000000) {
    return `₩${(amount / 1000000000).toFixed(1)}십억`;
  } else if (amount >= 100000000) {
    return `₩${(amount / 100000000).toFixed(1)}억`;
  } else if (amount >= 10000000) {
    return `₩${(amount / 10000000).toFixed(1)}천만`;
  } else if (amount >= 1000000) {
    return `₩${(amount / 1000000).toFixed(1)}백만`;
  } else if (amount >= 10000) {
    return `₩${(amount / 10000).toFixed(0)}만`;
  } else {
    return `₩${formatNumber(amount)}`;
  }
};

const StockSummaryCard: React.FC = () => {
  const [summaryData, setSummaryData] = useState<StockSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummaryData();
  }, []);

  const fetchSummaryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/stock/current?limit=1000&offset=0');
      const result = await response.json();

      if (result.success) {
        const data = result.data;
        setSummaryData({
          total_items: data.statistics?.total_items || 0,
          low_stock_items: data.statistics?.low_stock_items || 0,
          total_value: data.statistics?.total_value || 0
        });
      } else {
        throw new Error(result.error || '요약 데이터를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Error fetching summary data:', err);
      setError(err instanceof Error ? err.message : '요약 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchSummaryData();
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
              </div>
              <div className="w-16 h-8 bg-gray-200 rounded mb-2"></div>
              <div className="w-24 h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!summaryData) {
    return null;
  }

  const normalItems = summaryData.total_items - summaryData.low_stock_items;
  const lowStockPercentage = summaryData.total_items > 0
    ? Math.round((summaryData.low_stock_items / summaryData.total_items) * 100)
    : 0;

  const summaryCards: SummaryCard[] = [
    {
      title: '전체 품목',
      value: formatNumber(summaryData.total_items),
      subtitle: '등록된 전체 품목 수',
      icon: <Package className="w-6 h-6" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: '정상 재고',
      value: formatNumber(normalItems),
      subtitle: `전체의 ${100 - lowStockPercentage}%`,
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      change: {
        value: 100 - lowStockPercentage,
        label: '정상 비율',
        isPositive: lowStockPercentage < 20
      }
    },
    {
      title: '부족/경고',
      value: formatNumber(summaryData.low_stock_items),
      subtitle: `전체의 ${lowStockPercentage}%`,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      change: {
        value: lowStockPercentage,
        label: '부족 비율',
        isPositive: false
      }
    },
    {
      title: '총 재고 가치',
      value: formatCurrency(summaryData.total_value),
      subtitle: '현재 재고의 총 가치',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">재고 현황 요약</h2>
        <button
          onClick={handleRefresh}
          className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          <span>새로고침</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <div className={card.color}>
                  {card.icon}
                </div>
              </div>
              {card.change && (
                <div className={`flex items-center text-xs font-medium ${
                  card.change.isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendingUp className={`w-3 h-3 mr-1 ${
                    !card.change.isPositive ? 'rotate-180' : ''
                  }`} />
                  {card.change.value}%
                </div>
              )}
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {card.value}
              </h3>
              <p className="text-sm font-medium text-gray-600 mb-2">
                {card.title}
              </p>
              <p className="text-xs text-gray-500">
                {card.subtitle}
              </p>
              {card.change && (
                <p className="text-xs text-gray-400 mt-1">
                  {card.change.label}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Additional insights */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">정상: {formatNumber(normalItems)}개</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-600">부족/경고: {formatNumber(summaryData.low_stock_items)}개</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            재고 관리 상태: {lowStockPercentage < 10 ? '우수' : lowStockPercentage < 20 ? '양호' : '주의 필요'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockSummaryCard;