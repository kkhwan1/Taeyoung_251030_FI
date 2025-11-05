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
    label: '대기중',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-600'
  },
  IN_PROGRESS: {
    label: '진행중',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-600'
  },
  COMPLETED: {
    label: '완료',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-300 dark:border-green-600'
  },
  CANCELLED: {
    label: '취소됨',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-300 dark:border-red-600'
  }
};

export default function ProcessStatusBadge({ status, className = '' }: ProcessStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
    >
      {config.label}
    </span>
  );
}
