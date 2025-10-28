/**
 * Refresh Controls Component
 * Auto-refresh settings and manual refresh controls
 */

import React from 'react';
import { RefreshCw, Clock, Pause, Play } from 'lucide-react';
import type { RefreshInterval } from '../../hooks/useDashboardData';
import { REFRESH_INTERVALS } from '../../hooks/useDashboardData';

interface RefreshControlsProps {
  refreshInterval: RefreshInterval;
  onRefreshIntervalChange: (interval: RefreshInterval) => void;
  isAutoRefreshEnabled: boolean;
  onAutoRefreshToggle: (enabled: boolean) => void;
  onManualRefresh: () => void;
  loading: boolean;
  lastUpdated: Date | null;
  retryCount?: number;
}

export const RefreshControls: React.FC<RefreshControlsProps> = ({
  refreshInterval,
  onRefreshIntervalChange,
  isAutoRefreshEnabled,
  onAutoRefreshToggle,
  onManualRefresh,
  loading,
  lastUpdated,
  retryCount = 0
}) => {
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return '업데이트 없음';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}분 ${seconds}초 전`;
    }
    return `${seconds}초 전`;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Manual refresh button only */}
          <button
            onClick={onManualRefresh}
            disabled={loading}
            className={`flex items-center space-x-1.5 px-3 py-2 sm:py-1.5 rounded-lg font-medium text-xs ${
              loading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                : 'bg-gray-600 text-white hover:bg-gray-700 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? '데이터 로딩중...' : '데이터 새로고침'}</span>
          </button>
        </div>

        {/* Status information */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Last updated */}
          <div className="flex items-center space-x-1.5 text-gray-600 dark:text-gray-400">
            <span>마지막 업데이트:</span>
            <span className="font-medium">
              {formatLastUpdated(lastUpdated)}
            </span>
          </div>

          {/* Connection status */}
          <div className="flex items-center space-x-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full border-2 ${
                loading
                  ? 'bg-gray-400 dark:bg-gray-500 animate-pulse border-gray-500 dark:border-gray-400'
                  : retryCount > 0
                  ? 'bg-gray-500 dark:bg-gray-400 border-gray-500 dark:border-gray-500'
                  : 'bg-gray-600 dark:bg-gray-300 border-gray-400 dark:border-gray-600'
              }`}
            ></div>
            <span className="text-gray-600 dark:text-gray-400">
              {loading
                ? '데이터 로딩중'
                : retryCount > 0
                ? '연결 재시도중'
                : '연결됨'
              }
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};