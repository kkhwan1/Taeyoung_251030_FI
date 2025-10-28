/**
 * Quick Actions Panel Component
 * Provides quick access to main ERP functions
 */

import React from 'react';
import { useRouter } from 'next/navigation';

interface QuickActionsProps {
  className?: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ className = '' }) => {
  const router = useRouter();

  const actions = [
    {
      id: 'purchase',
      label: '입고 등록',
      path: '/purchases',
      description: '새로운 입고 거래 등록'
    },
    {
      id: 'sales',
      label: '출고 등록',
      path: '/sales',
      description: '새로운 출고 거래 등록'
    },
    {
      id: 'inventory',
      label: '재고 조회',
      path: '/inventory',
      description: '현재 재고 현황 조회'
    },
    {
      id: 'items',
      label: '품목 등록',
      path: '/items',
      description: '새로운 품목 등록'
    }
  ];

  const handleActionClick = (path: string) => {
    router.push(path);
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700 ${className}`}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3 min-w-fit">
        빠른 작업
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((action) => {
          return (
            <button
              key={action.id}
              onClick={() => handleActionClick(action.path)}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 group"
              title={action.description}
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
