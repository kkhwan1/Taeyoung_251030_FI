/**
 * KPICard Component
 *
 * Displays key performance indicators for accounting dashboard
 * Supports dark mode and optional trend indicators
 * Optimized with React.memo to prevent unnecessary re-renders
 */

import { memo } from 'react';

interface KPICardProps {
  /** Card title (e.g., "총 매출", "총 매입") */
  title: string;

  /** Formatted value with unit (e.g., "123,456,789원") */
  value: string;

  /** Icon component from lucide-react */
  icon: React.ComponentType<{ className?: string }>;

  /** Color theme for icon background */
  color: 'blue' | 'green' | 'red' | 'purple' | 'gray';

  /** Optional trend indicator with direction and percentage */
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

/**
 * Shallow comparison for KPICard props
 * Compares primitives directly and trend object shallowly
 */
function arePropsEqual(prevProps: KPICardProps, nextProps: KPICardProps): boolean {
  // Compare primitive props
  if (
    prevProps.title !== nextProps.title ||
    prevProps.value !== nextProps.value ||
    prevProps.icon !== nextProps.icon ||
    prevProps.color !== nextProps.color
  ) {
    return false;
  }

  // Compare trend object shallowly
  if (prevProps.trend && nextProps.trend) {
    return (
      prevProps.trend.value === nextProps.trend.value &&
      prevProps.trend.direction === nextProps.trend.direction
    );
  }

  // Both undefined or one changed
  return prevProps.trend === nextProps.trend;
}

const KPICard = memo(function KPICard({
  title,
  value,
  icon: Icon,
  color,
  trend
}: KPICardProps) {
  // Color mapping for icon backgrounds with dark mode support
  const colorClasses = {
    blue: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20',
    green: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20',
    red: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20',
    purple: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20',
    gray: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20'
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        {/* Left: Title, Value, and optional Trend */}
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {title}
          </p>

          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>

          {/* Trend indicator */}
          {trend && (
            <div className={`flex items-center mt-2 text-sm font-medium ${
              trend.direction === 'up'
                ? 'text-gray-600 dark:text-gray-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              <span className="mr-1">
                {trend.direction === 'up' ? '↑' : '↓'}
              </span>
              <span>
                {Math.abs(trend.value).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Right: Icon in colored circle */}
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}, arePropsEqual);

export default KPICard;
