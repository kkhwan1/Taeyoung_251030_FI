'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';

interface Action {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'secondary';
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  primaryAction: Action;
  secondaryActions?: Action[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon,
  primaryAction,
  secondaryActions = [],
  className = '',
}) => {
  const hasSecondaryActions = secondaryActions.length > 0;

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{title}</h1>
            {description && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">{description}</p>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* 데스크톱: 모든 버튼 표시 */}
          {hasSecondaryActions && (
            <div className="hidden sm:flex sm:flex-wrap sm:gap-2">
              {secondaryActions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors text-sm sm:text-base ${
                    action.variant === 'secondary'
                      ? 'bg-gray-700 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500'
                      : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* 데스크톱: Primary Action */}
          <button
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="hidden sm:flex sm:items-center sm:gap-2 px-3 sm:px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {primaryAction.icon}
            <span>{primaryAction.label}</span>
          </button>

          {/* 모바일: 더보기 메뉴 + Primary Action */}
          <div className="flex items-center gap-2 sm:hidden">
            {hasSecondaryActions && (
              <DropdownMenu>
                <DropdownMenuTrigger className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <MoreVertical className="w-5 h-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {secondaryActions.map((action, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="flex items-center gap-2"
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {primaryAction.icon}
              <span>{primaryAction.label}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
