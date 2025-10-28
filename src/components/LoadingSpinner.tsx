/**
 * LoadingSpinner Component
 *
 * Simple, reusable loading spinner with optional size and message
 * Used in reports pages, forms, and data loading states
 */

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4'
};

export default function LoadingSpinner({
  size = 'md',
  message
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`
          ${sizeClasses[size]}
          border-gray-300 border-t-gray-800
          rounded-full animate-spin
        `}
        role="status"
        aria-label={message || 'Loading'}
      />
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {message}
        </p>
      )}
      <span className="sr-only">{message || 'Loading...'}</span>
    </div>
  );
}
