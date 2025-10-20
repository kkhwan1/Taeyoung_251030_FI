/**
 * Quick Actions Panel Component
 * Provides quick access to main ERP functions
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Box, BarChart3, Package } from 'lucide-react';

interface QuickActionsProps {
  className?: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ className = '' }) => {
  const router = useRouter();

  const actions = [
    {
      id: 'purchase',
      label: '입고 등록',
      icon: Truck,
      path: '/purchases',
      description: '새로운 입고 거래 등록'
    },
    {
      id: 'sales',
      label: '출고 등록',
      icon: Box,
      path: '/sales',
      description: '새로운 출고 거래 등록'
    },
    {
      id: 'inventory',
      label: '재고 조회',
      icon: BarChart3,
      path: '/inventory',
      description: '현재 재고 현황 조회'
    },
    {
      id: 'items',
      label: '품목 등록',
      icon: Package,
      path: '/items',
      description: '새로운 품목 등록'
    }
  ];

  const handleActionClick = (path: string) => {
    router.push(path);
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 min-w-fit">
        빠른 작업
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action) => {
          return (
            <button
              key={action.id}
              onClick={() => handleActionClick(action.path)}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
              title={action.description}
            >
              {action.id === 'purchase' && (
                <Truck className="w-8 h-8 text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" />
              )}
              {action.id === 'sales' && (
                <Box className="w-8 h-8 text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" />
              )}
              {action.id === 'inventory' && (
                <BarChart3 className="w-8 h-8 text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" />
              )}
              {action.id === 'items' && (
                <Package className="w-8 h-8 text-gray-400 mb-2 group-hover:text-blue-500 transition-colors" />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
