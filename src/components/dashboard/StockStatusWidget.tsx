'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Package2 } from 'lucide-react';

interface StockItem {
  item_id: number;
  item_code: string;
  item_name: string;
  current_stock: number;
  safety_stock: number;
  unit: string;
  stock_value: number;
  is_low_stock: number;
}

interface StockStatusProps {
  limit?: number;
  showValue?: boolean;
}

interface StockStatusInfo {
  status: 'critical' | 'warning' | 'normal';
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  label: string;
}

const getStockStatus = (currentStock: number, safetyStock: number): StockStatusInfo => {
  if (currentStock === 0) {
    return {
      status: 'critical',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      icon: <XCircle className="w-4 h-4 text-red-500" />,
      label: '재고없음'
    };
  } else if (currentStock <= safetyStock) {
    return {
      status: 'warning',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
      label: '부족'
    };
  } else {
    return {
      status: 'normal',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      icon: <CheckCircle className="w-4 h-4 text-green-500" />,
      label: '정상'
    };
  }
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ko-KR').format(num);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const StockStatusWidget: React.FC<StockStatusProps> = ({
  limit = 10,
  showValue = false
}) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStockStatus();
  }, [limit]);

  const fetchStockStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/stock/current?limit=${limit}&offset=0`);
      const result = await response.json();

      if (result.success) {
        setStockItems(result.data.items || []);
      } else {
        throw new Error(result.error || '재고 현황을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Error fetching stock status:', err);
      setError(err instanceof Error ? err.message : '재고 현황을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchStockStatus();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center min-w-fit">
            <Package2 className="w-5 h-5 mr-2 text-blue-600" />
            재고 현황
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div>
                    <div className="w-24 h-4 bg-gray-200 rounded mb-1"></div>
                    <div className="w-16 h-3 bg-gray-200 rounded"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-12 h-4 bg-gray-200 rounded mb-1"></div>
                  <div className="w-8 h-3 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center min-w-fit">
            <Package2 className="w-5 h-5 mr-2 text-blue-600" />
            재고 현황
          </h3>
          <button
            onClick={handleRefresh}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            새로고침
          </button>
        </div>
        <div className="text-center py-8">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center min-w-fit">
          <Package2 className="w-5 h-5 mr-2 text-blue-600" />
          재고 현황
        </h3>
        <button
          onClick={handleRefresh}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          새로고침
        </button>
      </div>

      {stockItems.length === 0 ? (
        <div className="text-center py-8">
          <Package2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">표시할 재고 정보가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {stockItems.map((item) => {
            const stockStatus = getStockStatus(item.current_stock, item.safety_stock);

            return (
              <div
                key={item.item_id}
                className={`p-3 rounded-lg border transition-colors ${stockStatus.bgColor} border-gray-200 hover:shadow-sm`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {stockStatus.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.item_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.item_code}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${stockStatus.color}`}>
                          {formatNumber(item.current_stock)} {item.unit}
                        </p>
                        <p className="text-xs text-gray-500">
                          안전재고: {formatNumber(item.safety_stock)}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.bgColor} ${stockStatus.color}`}>
                        {stockStatus.label}
                      </div>
                    </div>

                    {showValue && item.stock_value > 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        {formatCurrency(item.stock_value)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StockStatusWidget;