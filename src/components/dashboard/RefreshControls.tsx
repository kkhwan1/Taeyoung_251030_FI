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
    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Manual refresh button only */}
          <button
            onClick={onManualRefresh}
            disabled={loading}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              loading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                : 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? '데이터 로딩중...' : '데이터 새로고침'}</span>
          </button>
        </div>

        {/* Status information */}
        <div className="flex items-center space-x-4 text-sm">
          {/* Last updated */}
          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
            <span>마지막 업데이트:</span>
            <span className="font-medium">
              {formatLastUpdated(lastUpdated)}
            </span>
          </div>

          {/* Retry count indicator */}
          {retryCount > 0 && (
            <div className="flex items-center space-x-1 text-orange-600 dark:text-orange-400">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              <span>재시도 {retryCount}회</span>
            </div>
          )}

          {/* Connection status */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                loading
                  ? 'bg-yellow-500 animate-pulse'
                  : retryCount > 0
                  ? 'bg-orange-500'
                  : 'bg-green-500'
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