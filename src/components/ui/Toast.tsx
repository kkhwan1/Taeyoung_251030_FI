'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info, Undo2, ExternalLink } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
  style?: 'primary' | 'secondary';
  icon?: React.ComponentType<{ className?: string }>;
}

export interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  showProgress?: boolean;
  persistent?: boolean;
  actions?: ToastAction[];
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 3000,
  showProgress = true,
  persistent = false,
  actions = [],
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 300);
  }, [id, onClose]);

  useEffect(() => {
    // Trigger entrance animation immediately after mount
    const enterTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss logic (only if not persistent)
    let dismissTimer: NodeJS.Timeout;
    let progressTimer: NodeJS.Timeout;

    if (!persistent && duration > 0) {
      // Progress bar animation
      const startTime = Date.now();
      const updateProgress = () => {
        if (isPaused) {
          progressTimer = setTimeout(updateProgress, 50);
          return;
        }

        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, duration - elapsed);
        const progressPercent = (remaining / duration) * 100;

        setProgress(progressPercent);

        if (remaining <= 0) {
          handleClose();
        } else {
          progressTimer = setTimeout(updateProgress, 50);
        }
      };

      // Start progress animation after entrance
      setTimeout(() => {
        updateProgress();
      }, 300);

      // Fallback dismiss timer
      dismissTimer = setTimeout(() => {
        handleClose();
      }, duration + 300);
    }

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(dismissTimer);
      clearTimeout(progressTimer);
    };
  }, [duration, persistent, isPaused, handleClose]);

  const handleMouseEnter = () => {
    if (!persistent) {
      setIsPaused(true);
    }
  };

  const handleMouseLeave = () => {
    if (!persistent) {
      setIsPaused(false);
    }
  };

  const getIcon = () => {
    const iconClass = "w-5 h-5 flex-shrink-0";

    switch (type) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'error':
        return <XCircle className={`${iconClass} text-red-500`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-yellow-500`} />;
      case 'info':
        return <Info className={`${iconClass} text-blue-500`} />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-white dark:bg-gray-800 border-l-4 border-l-green-500',
          text: 'text-gray-900 dark:text-white',
          progress: 'bg-green-500'
        };
      case 'error':
        return {
          container: 'bg-white dark:bg-gray-800 border-l-4 border-l-red-500',
          text: 'text-gray-900 dark:text-white',
          progress: 'bg-red-500'
        };
      case 'warning':
        return {
          container: 'bg-white dark:bg-gray-800 border-l-4 border-l-yellow-500',
          text: 'text-gray-900 dark:text-white',
          progress: 'bg-yellow-500'
        };
      case 'info':
        return {
          container: 'bg-white dark:bg-gray-800 border-l-4 border-l-blue-500',
          text: 'text-gray-900 dark:text-white',
          progress: 'bg-blue-500'
        };
    }
  };

  const colorClasses = getColorClasses();

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative max-w-sm w-full shadow-lg rounded-lg pointer-events-auto
        ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 overflow-hidden
        transform transition-all duration-300 ease-out backdrop-blur-sm
        ${isVisible && !isExiting
          ? 'translate-x-0 opacity-100 scale-100'
          : 'translate-x-full opacity-0 scale-95'
        }
        ${colorClasses.container}
      `}
    >
      {/* Progress bar */}
      {showProgress && !persistent && duration > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full transition-all duration-75 ease-linear ${colorClasses.progress}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className={`text-sm font-semibold leading-tight ${colorClasses.text}`}>
              {title}
            </p>
            {message && (
              <p className={`mt-1 text-sm opacity-80 leading-relaxed ${colorClasses.text}`}>
                {message}
              </p>
            )}

            {/* Action buttons */}
            {actions.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={action.onClick}
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                      transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
                      focus:ring-blue-500 dark:focus:ring-offset-gray-800
                      ${action.style === 'primary'
                        ? `bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`
                        : `bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600`
                      }
                    `}
                  >
                    {action.icon && <action.icon className="w-3 h-3" />}
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              type="button"
              className="inline-flex rounded-md p-1.5 text-gray-400 dark:text-gray-500
                hover:text-gray-600 dark:hover:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-700
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                dark:focus:ring-offset-gray-800 transition-colors"
              onClick={handleClose}
              aria-label="토스트 알림 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;