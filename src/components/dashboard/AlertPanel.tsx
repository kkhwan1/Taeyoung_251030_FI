/**
 * Alert Panel Component
 * Low stock alerts and system notifications
 */

import React, { useState } from 'react';
import { AlertCircle, Package, Clock, ChevronRight, Search, Bell, AlertTriangle } from 'lucide-react';
import { formatKoreanNumber, formatKoreanDate } from '../../utils/chartUtils';
import type { AlertData } from '../../hooks/useDashboardData';

interface AlertPanelProps {
  data: AlertData | null;
  loading: boolean;
  error: string | null;
}

type AlertFilter = 'all' | '위험' | '주의';
type AlertSort = 'status' | 'name' | 'ratio' | 'date';

export const AlertPanel: React.FC<AlertPanelProps> = ({
  data,
  loading,
  error
}) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'transactions'>('stock');
  const [stockFilter, setStockFilter] = useState<AlertFilter>('all');
  const [stockSort, setStockSort] = useState<AlertSort>('status');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and sort low stock items
  const filteredStockItems = React.useMemo(() => {
    if (!data?.lowStockItems) return [];

    let items = [...data.lowStockItems];

    // Apply status filter - map Korean values to English priority values
    if (stockFilter !== 'all') {
      const priorityMap: Record<string, string> = {
        '위험': 'critical',
        '주의': 'high'
      };
      const targetPriority = priorityMap[stockFilter];
      items = items.filter(item => item.priority === targetPriority);
    }

    // Apply search filter
    if (searchTerm) {
      items = items.filter(item =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    items.sort((a, b) => {
      switch (stockSort) {
        case 'status':
          if (a.priority === b.priority) {
            const ratioA = a.minimumStock > 0 ? a.currentStock / a.minimumStock : 0;
            const ratioB = b.minimumStock > 0 ? b.currentStock / b.minimumStock : 0;
            return ratioA - ratioB;
          }
          return a.priority === 'critical' ? -1 : 1;

        case 'name':
          return a.item_name.localeCompare(b.item_name);

        case 'ratio':
          const ratioA = a.minimumStock > 0 ? a.currentStock / a.minimumStock : 0;
          const ratioB = b.minimumStock > 0 ? b.currentStock / b.minimumStock : 0;
          return ratioA - ratioB;

        default:
          return 0;
      }
    });

    return items;
  }, [data?.lowStockItems, stockFilter, stockSort, searchTerm]);

  // Get alert counts
  const alertCounts = React.useMemo(() => {
    if (!data?.lowStockItems) return { total: 0, critical: 0, warning: 0 };

    const critical = data.lowStockItems.filter(item => item.priority === 'critical').length;
    const warning = data.lowStockItems.filter(item => item.priority === 'high').length;

    return {
      total: data.lowStockItems.length,
      critical,
      warning
    };
  }, [data?.lowStockItems]);

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            알림 패널
          </h3>
        </div>
        <div className="flex items-center justify-center h-32 text-red-500">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">알림 데이터 로드 실패</p>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              알림 패널
            </h3>
            {alertCounts.total > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 text-xs font-medium rounded-full">
                {alertCounts.total}
              </span>
            )}
          </div>

          {/* Alert Summary */}
          <div className="flex items-center space-x-4">
            {alertCounts.critical > 0 && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">{alertCounts.critical}</span>
              </div>
            )}
            {alertCounts.warning > 0 && (
              <div className="flex items-center space-x-1 text-orange-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{alertCounts.warning}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mt-4 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'stock'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            재고 부족 ({alertCounts.total})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'transactions'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            최근 거래 ({data?.recentTransactions?.length || 0})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'stock' ? (
          <StockAlertsTab
            items={filteredStockItems}
            loading={loading}
            filter={stockFilter}
            sort={stockSort}
            searchTerm={searchTerm}
            onFilterChange={setStockFilter}
            onSortChange={setStockSort}
            onSearchChange={setSearchTerm}
          />
        ) : (
          <TransactionAlertsTab
            transactions={data?.recentTransactions || []}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

// Stock Alerts Tab Component
interface StockAlertsTabProps {
  items: AlertData['lowStockItems'];
  loading: boolean;
  filter: AlertFilter;
  sort: AlertSort;
  searchTerm: string;
  onFilterChange: (filter: AlertFilter) => void;
  onSortChange: (sort: AlertSort) => void;
  onSearchChange: (term: string) => void;
}

const StockAlertsTab: React.FC<StockAlertsTabProps> = ({
  items,
  loading,
  filter,
  sort,
  searchTerm,
  onFilterChange,
  onSortChange,
  onSearchChange
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="품명 또는 품번 검색..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm w-full sm:w-64"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as AlertFilter)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="all">전체</option>
            <option value="위험">위험</option>
            <option value="주의">주의</option>
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as AlertSort)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="status">상태순</option>
            <option value="ratio">재고율순</option>
            <option value="name">품명순</option>
          </select>
        </div>
      </div>

      {/* Stock Items */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <div className="text-center">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchTerm ? '검색 결과가 없습니다' : '재고 부족 품목이 없습니다'}
              </p>
            </div>
          </div>
        ) : (
          items.map((item) => {
            const ratio = item.minimumStock > 0 ? (item.currentStock / item.minimumStock) : 0;

            return (
              <div
                key={item.item_id}
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  item.priority === 'critical'
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                    : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
                }`}
              >
                {/* Status Icon */}
                <div className={`p-2 rounded-full ${
                  item.priority === 'critical'
                    ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                    : 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400'
                }`}>
                  {item.priority === 'critical' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </div>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.item_name}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.item_code}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      현재: <span className="font-medium">{formatKoreanNumber(item.currentStock)}</span>
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      최소: <span className="font-medium">{formatKoreanNumber(item.minimumStock)}</span>
                    </span>
                    <span className={`text-xs font-medium ${
                      ratio < 0.5 ? 'text-red-600' : 'text-orange-600'
                    }`}>
                      {(ratio * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  item.priority === 'critical'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                }`}>
                  {item.priority === 'critical' ? '위험' : item.priority === 'high' ? '주의' : item.priority === 'medium' ? '경고' : '정상'}
                </span>

                {/* Action */}
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Transaction Alerts Tab Component
interface TransactionAlertsTabProps {
  transactions: AlertData['recentTransactions'];
  loading: boolean;
}

const TransactionAlertsTab: React.FC<TransactionAlertsTabProps> = ({
  transactions,
  loading
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {transactions.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <div className="text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">최근 거래 내역이 없습니다</p>
          </div>
        </div>
      ) : (
        transactions.map((transaction) => (
          <div
            key={transaction.transaction_id}
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {/* Type Badge */}
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              transaction.transaction_type === '입고'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                : transaction.transaction_type === '출고'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
            }`}>
              {transaction.transaction_type}
            </span>

            {/* Transaction Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {transaction.item_name}
              </p>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  수량: <span className="font-medium">{formatKoreanNumber(transaction.quantity)}</span>
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {formatKoreanDate(transaction.transaction_date)}
                </span>
              </div>
            </div>

            {/* Status */}
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              transaction.status === '완료'
                ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
            }`}>
              {transaction.status}
            </span>
          </div>
        ))
      )}
    </div>
  );
};