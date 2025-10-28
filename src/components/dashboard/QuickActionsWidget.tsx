'use client';

import React from 'react';
import {
  Settings,
  Plus
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  hoverColor: string;
  onClick: () => void;
}

interface QuickActionsProps {
  onReceivingClick?: () => void;
  onShippingClick?: () => void;
  onAdjustmentClick?: () => void;
  onProductionClick?: () => void;
  onNewItemClick?: () => void;
  onReportsClick?: () => void;
}

const QuickActionsWidget: React.FC<QuickActionsProps> = ({
  onReceivingClick,
  onShippingClick,
  onAdjustmentClick,
  onProductionClick,
  onNewItemClick,
  onReportsClick
}) => {
  const quickActions: QuickAction[] = [
    {
      id: 'receiving',
      label: '입고 등록',
      description: '새로운 입고 내역을 등록합니다',
      icon: ,
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      hoverColor: 'hover:bg-gray-200',
      onClick: onReceivingClick || (() => console.log('입고 등록 클릭'))
    },
    {
      id: 'shipping',
      label: '출고 등록',
      description: '새로운 출고 내역을 등록합니다',
      icon: ,
      color: 'text-gray-800',
      bgColor: 'bg-gray-200',
      hoverColor: 'hover:bg-gray-300',
      onClick: onShippingClick || (() => console.log('출고 등록 클릭'))
    },
    {
      id: 'production',
      label: '생산 등록',
      description: '생산 입고/출고를 등록합니다',
      icon: ,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      hoverColor: 'hover:bg-gray-100',
      onClick: onProductionClick || (() => console.log('생산 등록 클릭'))
    },
    {
      id: 'adjustment',
      label: '재고 조정',
      description: '재고 수량을 조정합니다',
      icon: <Settings className="w-6 h-6" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      hoverColor: 'hover:bg-gray-100',
      onClick: onAdjustmentClick || (() => console.log('재고 조정 클릭'))
    },
    {
      id: 'new-item',
      label: '품목 등록',
      description: '새로운 품목을 등록합니다',
      icon: <Plus className="w-6 h-6" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      hoverColor: 'hover:bg-gray-100',
      onClick: onNewItemClick || (() => console.log('품목 등록 클릭'))
    },
    {
      id: 'reports',
      label: '보고서',
      description: '재고 현황 보고서를 확인합니다',
      icon: ,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      hoverColor: 'hover:bg-gray-100',
      onClick: onReportsClick || (() => console.log('보고서 클릭'))
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900 flex items-center min-w-fit">
          <Plus className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
          빠른 작업
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          자주 사용하는 기능들을 빠르게 실행할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`
              p-4 rounded-lg border-2 border-transparent
              ${action.bgColor} ${action.hoverColor}
              hover:border-gray-300
              focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
              group
            `}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <div className={`
                p-3 rounded-full
                ${action.bgColor} ${action.color}
              `}>
                {action.icon}
              </div>

              <div>
                <h4 className={`font-semibold text-sm ${action.color}`}>
                  {action.label}
                </h4>
                <p className="text-xs text-gray-600 mt-1 leading-4">
                  {action.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            모든 작업은 실시간으로 재고에 반영됩니다.
          </span>
          <span className="text-xs text-gray-400">
            권한에 따라 일부 기능이 제한될 수 있습니다.
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuickActionsWidget;