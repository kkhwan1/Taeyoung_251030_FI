import React from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { BOMStockStatus } from '@/types/inventory';

interface BOMStatusBadgeProps {
  status: BOMStockStatus;
  label?: string;
  className?: string;
}

/**
 * Status badge component for BOM material availability
 *
 * Displays color-coded badge with icon based on material stock status.
 * Used in BOM preview panel to show real-time material availability.
 *
 * @param status - Material stock status (sufficient | warning | insufficient)
 * @param label - Optional custom label text (defaults to Korean status text)
 * @param className - Optional additional CSS classes
 *
 * @example
 * <BOMStatusBadge status="sufficient" />
 * <BOMStatusBadge status="warning" label="재고 부족" />
 * <BOMStatusBadge status="insufficient" className="ml-2" />
 */
export default function BOMStatusBadge({
  status,
  label,
  className = ''
}: BOMStatusBadgeProps) {
  // Status configuration with colors and icons
  const statusConfig = {
    sufficient: {
      icon: CheckCircle,
      label: '충족',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      textColor: 'text-gray-700 dark:text-gray-400',
      borderColor: 'border-gray-200 dark:border-gray-800',
      iconColor: 'text-gray-600 dark:text-gray-500'
    },
    warning: {
      icon: AlertTriangle,
      label: '주의',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      textColor: 'text-gray-700 dark:text-gray-400',
      borderColor: 'border-gray-200 dark:border-gray-800',
      iconColor: 'text-gray-600 dark:text-gray-500'
    },
    insufficient: {
      icon: XCircle,
      label: '부족',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      textColor: 'text-gray-700 dark:text-gray-400',
      borderColor: 'border-gray-200 dark:border-gray-800',
      iconColor: 'text-gray-600 dark:text-gray-500'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;
  const displayLabel = label || config.label;

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        ${className}
      `}
    >
      <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
      <span>{displayLabel}</span>
    </span>
  );
}
