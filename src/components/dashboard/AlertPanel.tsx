/**
 * Alert Panel Component
 * Low stock alerts and system notifications
 */

import React from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { formatKoreanNumber, formatKoreanDate } from '../../utils/chartUtils';
import type { AlertData } from '../../hooks/useDashboardData';

interface AlertPanelProps {
  data: AlertData | null;
  loading: boolean;
  error: string | null;
}


export const AlertPanel: React.FC<AlertPanelProps> = ({
  data,
  loading,
  error
}) => {
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            최근 거래
          </h3>
        </div>
        <div className="flex items-center justify-center h-32 text-gray-600 dark:text-gray-400">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">거래 데이터 로드 실패</p>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            최근 거래
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({data?.recentTransactions?.length || 0})
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <TransactionAlertsTab
          transactions={data?.recentTransactions || []}
          loading={loading}
        />
      </div>
    </div>
  );
};

// Transaction Alerts Component
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
            className="flex items-center space-x-3 p-3 rounded-lg"
          >
            {/* Type Badge */}
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border ${
              transaction.transaction_type === '입고'
                ? 'border-gray-400 dark:border-gray-600'
                : transaction.transaction_type === '출고'
                ? 'border-gray-500 dark:border-gray-500'
                : 'border-gray-400 dark:border-gray-600'
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
            <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border ${
              transaction.status === '완료'
                ? 'border-gray-400 dark:border-gray-600'
                : 'border-gray-500 dark:border-gray-500'
            }`}>
              {transaction.status}
            </span>
          </div>
        ))
      )}
    </div>
  );
};