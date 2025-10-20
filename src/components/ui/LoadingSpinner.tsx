import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  text,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const colorClasses = {
    primary: 'text-blue-600 dark:text-blue-400',
    secondary: 'text-gray-600 dark:text-gray-400',
    white: 'text-white',
    gray: 'text-gray-500'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <svg
          className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-label="로딩 중"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {text && (
          <span className={`text-sm ${colorClasses[color]}`}>
            {text}
          </span>
        )}
      </div>
    </div>
  );
};

// Full screen loading overlay
interface LoadingOverlayProps {
  text?: string;
  isVisible?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  text = "로딩 중...",
  isVisible = true
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <LoadingSpinner size="lg" text={text} />
      </div>
    </div>
  );
};

// Inline loading for buttons
interface ButtonLoadingProps {
  isLoading?: boolean;
  text?: string;
  loadingText?: string;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ButtonLoading: React.FC<ButtonLoadingProps> = ({
  isLoading = false,
  text = "확인",
  loadingText = "처리 중...",
  disabled = false,
  onClick,
  variant = 'primary',
  size = 'md',
  className = ''
}) => {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center space-x-2 rounded-md font-medium
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {isLoading && (
        <LoadingSpinner
          size={size === 'lg' ? 'md' : 'sm'}
          color="white"
        />
      )}
      <span>{isLoading ? loadingText : text}</span>
    </button>
  );
};

// Content loading placeholder
interface ContentLoadingProps {
  title?: string;
  subtitle?: string;
}

export const ContentLoading: React.FC<ContentLoadingProps> = ({
  title = "데이터를 불러오는 중...",
  subtitle = "잠시만 기다려 주세요."
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <LoadingSpinner size="lg" />
      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  );
};

export default LoadingSpinner;