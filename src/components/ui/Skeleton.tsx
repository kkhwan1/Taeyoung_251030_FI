import React from 'react';

interface SkeletonProps {
  className?: string;
}

// Base skeleton component
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      aria-label="로딩 중..."
    />
  );
};

// Table skeleton for data tables
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  showHeader = true
}) => {
  return (
    <div className="w-full">
      {/* Table header */}
      {showHeader && (
        <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={`header-${index}`} className="h-5 w-20" />
            ))}
          </div>
        </div>
      )}

      {/* Table rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-4 py-3 border-b border-gray-100 dark:border-gray-800"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className={`h-4 ${
                  colIndex === 0 ? 'w-24' :
                  colIndex === 1 ? 'w-32' :
                  colIndex === 2 ? 'w-20' : 'w-16'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Card skeleton for dashboard widgets
interface CardSkeletonProps {
  showTitle?: boolean;
  showContent?: boolean;
  contentLines?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  showTitle = true,
  showContent = true,
  contentLines = 3
}) => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Card title */}
      {showTitle && (
        <div className="mb-4">
          <Skeleton className="h-6 w-32" />
        </div>
      )}

      {/* Card content */}
      {showContent && (
        <div className="space-y-3">
          {Array.from({ length: contentLines }).map((_, index) => (
            <Skeleton
              key={`content-${index}`}
              className={`h-4 ${
                index === 0 ? 'w-full' :
                index === 1 ? 'w-3/4' : 'w-1/2'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Form skeleton for loading forms
interface FormSkeletonProps {
  fields?: number;
  showButtons?: boolean;
}

export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  fields = 4,
  showButtons = true
}) => {
  return (
    <div className="space-y-6">
      {/* Form fields */}
      {Array.from({ length: fields }).map((_, index) => (
        <div key={`field-${index}`} className="space-y-2">
          <Skeleton className="h-4 w-20" /> {/* Label */}
          <Skeleton className="h-10 w-full" /> {/* Input */}
        </div>
      ))}

      {/* Form buttons */}
      {showButtons && (
        <div className="flex justify-end space-x-3 pt-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
      )}
    </div>
  );
};

// List skeleton for simple lists
interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  items = 6,
  showAvatar = false
}) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={`item-${index}`} className="flex items-center space-x-4">
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Stats skeleton for dashboard metrics
export const StatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`stat-${index}`}
          className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" /> {/* Label */}
              <Skeleton className="h-8 w-20" /> {/* Value */}
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" /> {/* Icon */}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Skeleton;