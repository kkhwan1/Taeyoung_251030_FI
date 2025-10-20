/**
 * KPICard Component
 *
 * Displays key performance indicators for accounting dashboard
 * Supports dark mode and optional trend indicators
 */

interface KPICardProps {
  /** Card title (e.g., "총 매출", "총 매입") */
  title: string;

  /** Formatted value with unit (e.g., "123,456,789원") */
  value: string;

  /** Icon component from lucide-react */
  icon: React.ComponentType<{ className?: string }>;

  /** Color theme for icon background */
  color: 'blue' | 'green' | 'red' | 'purple';

  /** Optional trend indicator with direction and percentage */
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

export default function KPICard({
  title,
  value,
  icon: Icon,
  color,
  trend
}: KPICardProps) {
  // Color mapping for icon backgrounds with dark mode support
  const colorClasses = {
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
    green: 'text-green-500 bg-green-50 dark:bg-green-900/20',
    red: 'text-red-500 bg-red-50 dark:bg-red-900/20',
    purple: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20'
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
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
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
}
