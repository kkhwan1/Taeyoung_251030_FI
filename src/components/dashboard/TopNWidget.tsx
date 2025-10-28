'use client';

import { useState, useEffect } from 'react';
import {
  Award
} from 'lucide-react';

interface TopNItem {
  item_id: number;
  item_name: string;
  current_price: number;
  change_percent: number;
  change_amount: number;
}

interface TopNWidgetProps {
  type: 'gainers' | 'losers';
  count?: number;
  className?: string;
}

export default function TopNWidget({ type, count = 10, className = '' }: TopNWidgetProps) {
  const [items, setItems] = useState<TopNItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isGainers = type === 'gainers';

  useEffect(() => {
    fetchData();
  }, [type, count]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/price-analysis/trends?include_forecast=false');
      const result = await response.json();

      if (result.success && result.data) {
        // Process and sort data
        const processedItems: TopNItem[] = result.data.map((item: any) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          current_price: item.avg_price,
          change_percent: item.price_changes || 0,
          change_amount: item.avg_price * ((item.price_changes || 0) / 100)
        }));

        // Sort by absolute change percentage
        const sorted = processedItems.sort((a, b) => {
          if (isGainers) {
            return b.change_percent - a.change_percent;
          } else {
            return a.change_percent - b.change_percent;
          }
        });

        // Filter and limit
        const filtered = isGainers
          ? sorted.filter(item => item.change_percent > 0)
          : sorted.filter(item => item.change_percent < 0);

        setItems(filtered.slice(0, count));
      } else {
        setError('데이터를 불러올 수 없습니다');
      }
    } catch (err: any) {
      setError(err.message || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatChange = (percent: number, amount: number) => {
    const sign = percent >= 0 ? '+' : '';
    return {
      percent: `${sign}${percent.toFixed(2)}%`,
      amount: `${sign}${formatPrice(amount)}`
    };
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-6 ${className}`}>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300 mb-2 flex items-center gap-2 min-w-fit">
          {isGainers ?  : }
          {isGainers ? `상위 ${count}개 상승` : `상위 ${count}개 하락`}
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 min-w-fit">
          {isGainers ? (
            
          ) : (
            
          )}
          {isGainers ? `상위 ${count}개 상승` : `상위 ${count}개 하락`}
        </h3>
        <Award className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      </div>

      {/* Table - Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                순위
              </th>
              <th className="text-left py-2 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                품목명
              </th>
              <th className="text-right py-2 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                현재가
              </th>
              <th className="text-right py-2 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                변동률
              </th>
              <th className="text-right py-2 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                변동액
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  데이터가 없습니다
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const change = formatChange(item.change_percent, item.change_amount);
                const isPositive = item.change_percent >= 0;

                return (
                  <tr
                    key={item.item_id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${
                          index === 0 ? 'text-gray-900 dark:text-white' :
                          index === 1 ? 'text-gray-700 dark:text-gray-300' :
                          index === 2 ? 'text-gray-600 dark:text-gray-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`}>
                          {index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.item_name}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {formatPrice(item.current_price)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={`text-sm font-bold ${
                        isPositive
                          ? 'text-gray-800 dark:text-gray-300'
                          : 'text-gray-700 dark:text-gray-400'
                      }`}>
                        {change.percent}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={`text-sm ${
                        isPositive
                          ? 'text-gray-800 dark:text-gray-300'
                          : 'text-gray-700 dark:text-gray-400'
                      }`}>
                        {change.amount}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Stack Layout - Mobile */}
      <div className="sm:hidden space-y-3">
        {items.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            데이터가 없습니다
          </div>
        ) : (
          items.map((item, index) => {
            const change = formatChange(item.change_percent, item.change_amount);
            const isPositive = item.change_percent >= 0;

            return (
              <div
                key={item.item_id}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${
                      index === 0 ? 'text-gray-900 dark:text-white' :
                      index === 1 ? 'text-gray-700 dark:text-gray-300' :
                      index === 2 ? 'text-gray-600 dark:text-gray-400' :
                      'text-gray-600 dark:text-gray-400'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.item_name}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">현재가:</span>
                    <span className="ml-1 font-medium text-gray-900 dark:text-white">
                      {formatPrice(item.current_price)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`font-bold ${
                      isPositive
                        ? 'text-gray-800 dark:text-gray-300'
                        : 'text-gray-700 dark:text-gray-400'
                    }`}>
                      {change.percent}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
