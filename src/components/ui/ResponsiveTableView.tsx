'use client';

import React, { useState, ReactNode } from 'react';
import { Grid, List } from 'lucide-react';

interface ResponsiveTableViewProps {
  children: ReactNode;
  renderCard?: (data: any, index: number) => ReactNode;
  data?: any[];
  className?: string;
}

export const ResponsiveTableView: React.FC<ResponsiveTableViewProps> = ({
  children,
  renderCard,
  data = [],
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const showCardView = renderCard && data.length > 0;

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* 뷰 전환 토글 (모바일만, 카드 뷰가 있는 경우만) */}
      {showCardView && (
        <div className="sm:hidden flex items-center justify-end gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <List className="w-3 h-3" />
            테이블
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'card'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Grid className="w-3 h-3" />
            카드
          </button>
        </div>
      )}

      {/* 테이블 뷰 */}
      <div className={showCardView && viewMode === 'card' ? 'hidden' : 'block'}>
        {children}
      </div>

      {/* 카드 뷰 (모바일만, 카드 뷰가 있는 경우만) */}
      {showCardView && viewMode === 'card' && (
        <div className="sm:hidden p-3 space-y-3">
          {data.map((item, index) => renderCard!(item, index))}
        </div>
      )}
    </div>
  );
};
