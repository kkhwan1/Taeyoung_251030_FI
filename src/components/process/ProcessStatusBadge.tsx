'use client';

/**
 * ProcessStatusBadge Component
 *
 * Displays process operation status with color-coded badges
 * Status types: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
 */

interface ProcessStatusBadgeProps {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  className?: string;
}

const STATUS_CONFIG = {
  PENDING: {
    label: '대기',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    textColor: 'text-gray-800 dark:text-gray-200',
    borderColor: 'border-2 border-gray-400 dark:border-gray-500'
  },
  IN_PROGRESS: {
    label: '진행중',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    textColor: 'text-blue-800 dark:text-blue-200',
    borderColor: 'border-2 border-blue-500 dark:border-blue-400'
  },
  COMPLETED: {
    label: '완료',
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    textColor: 'text-green-800 dark:text-green-200',
    borderColor: 'border-2 border-green-500 dark:border-green-400'
  },
  CANCELLED: {
    label: '취소됨',
    bgColor: 'bg-red-50 dark:bg-red-900/30',
    textColor: 'text-red-800 dark:text-red-200',
    borderColor: 'border-2 border-red-500 dark:border-red-400'
  }
};

export default function ProcessStatusBadge({ status, className = '' }: ProcessStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
      title={`상태: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
