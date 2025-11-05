'use client';

import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

export interface CategoryFilterConfig {
  id: string;
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}

export interface CategoryFilterProps {
  title: string;
  categories: CategoryFilterConfig[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  showCount?: boolean;
  counts?: Record<string, number>;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export default function CategoryFilter({
  title,
  categories,
  selectedCategory,
  onCategoryChange,
  showCount = false,
  counts = {},
  className = '',
  collapsible = false,
  defaultExpanded = true
}: CategoryFilterProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleCategoryClick = (categoryId: string) => {
    onCategoryChange(categoryId);
  };

  const handleClearFilter = () => {
    onCategoryChange('all');
  };

  const selectedCategoryConfig = categories.find(cat => cat.id === selectedCategory);
  const isFiltered = selectedCategory !== 'all';

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            {isFiltered && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {selectedCategoryConfig?.label || selectedCategory}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isFiltered && (
              <button
                onClick={handleClearFilter}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="필터 초기화"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {collapsible && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title={isExpanded ? '접기' : '펼치기'}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Buttons */}
      {isExpanded && (
        <div className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {categories.map((category) => {
              const isSelected = selectedCategory === category.id;
              const count = counts[category.id] || 0;
              const showCountBadge = showCount && count > 0;

              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={`
                    relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    flex items-center justify-center gap-1.5
                    ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }
                    ${category.color && !isSelected ? category.color : ''}
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    dark:focus:ring-offset-gray-800
                  `}
                  style={
                    category.color && isSelected
                      ? {
                          backgroundColor: category.color,
                          color: 'white'
                        }
                      : undefined
                  }
                >
                  {category.icon && (
                    <span className="flex-shrink-0">{category.icon}</span>
                  )}
                  <span className="truncate">{category.label}</span>
                  {showCountBadge && (
                    <span
                      className={`
                        ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold
                        ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }
                      `}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
