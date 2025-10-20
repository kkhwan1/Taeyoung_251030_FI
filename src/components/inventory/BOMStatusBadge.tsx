import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
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
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-800',
      iconColor: 'text-green-600 dark:text-green-500'
    },
    warning: {
      icon: AlertTriangle,
      label: '주의',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      iconColor: 'text-yellow-600 dark:text-yellow-500'
    },
    insufficient: {
      icon: XCircle,
      label: '부족',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-400',
      borderColor: 'border-red-200 dark:border-red-800',
      iconColor: 'text-red-600 dark:text-red-500'
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
