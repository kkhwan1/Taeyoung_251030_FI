'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast, { ToastType, ToastAction } from '../components/Toast';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  showProgress?: boolean;
  persistent?: boolean;
  actions?: ToastAction[];
}

interface ToastContextType {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
  showToast: (title: string, type: ToastType, message?: string, duration?: number) => void;
  // Enhanced methods with actions
  successWithAction: (title: string, message?: string, actions?: ToastAction[], duration?: number) => void;
  errorWithAction: (title: string, message?: string, actions?: ToastAction[], duration?: number) => void;
  warningWithAction: (title: string, message?: string, actions?: ToastAction[], duration?: number) => void;
  infoWithAction: (title: string, message?: string, actions?: ToastAction[], duration?: number) => void;
  persistent: (type: ToastType, title: string, message?: string, actions?: ToastAction[]) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 5
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const generateId = () => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = generateId();
    const newToast = { ...toast, id };

    setToasts(prev => {
      // Remove oldest toast if we've reached the limit
      const updatedToasts = prev.length >= maxToasts ? prev.slice(1) : prev;
      return [...updatedToasts, newToast];
    });
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback((title: string, message?: string, duration: number = 3000) => {
    addToast({ type: 'success', title, message, duration });
  }, [addToast]);

  const error = useCallback((title: string, message?: string, duration: number = 5000) => {
    addToast({ type: 'error', title, message, duration });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string, duration: number = 4000) => {
    addToast({ type: 'warning', title, message, duration });
  }, [addToast]);

  const info = useCallback((title: string, message?: string, duration: number = 3000) => {
    addToast({ type: 'info', title, message, duration });
  }, [addToast]);

  // Enhanced methods with action support
  const successWithAction = useCallback((title: string, message?: string, actions?: ToastAction[], duration: number = 3000) => {
    addToast({ type: 'success', title, message, actions, duration });
  }, [addToast]);

  const errorWithAction = useCallback((title: string, message?: string, actions?: ToastAction[], duration: number = 5000) => {
    addToast({ type: 'error', title, message, actions, duration });
  }, [addToast]);

  const warningWithAction = useCallback((title: string, message?: string, actions?: ToastAction[], duration: number = 4000) => {
    addToast({ type: 'warning', title, message, actions, duration });
  }, [addToast]);

  const infoWithAction = useCallback((title: string, message?: string, actions?: ToastAction[], duration: number = 3000) => {
    addToast({ type: 'info', title, message, actions, duration });
  }, [addToast]);

  const persistent = useCallback((type: ToastType, title: string, message?: string, actions?: ToastAction[]) => {
    addToast({ type, title, message, actions, persistent: true, showProgress: false });
  }, [addToast]);

  const showToast = useCallback((title: string, type: ToastType, message?: string, duration?: number) => {
    addToast({ type, title, message, duration });
  }, [addToast]);

  const contextValue: ToastContextType = {
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
    showToast,
    successWithAction,
    errorWithAction,
    warningWithAction,
    infoWithAction,
    persistent,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast Container - Enhanced positioning and stacking */}
      <div
        aria-live="polite"
        aria-label="알림 메시지"
        className="fixed top-4 right-4 flex flex-col items-end pointer-events-none z-[10000] max-w-sm w-full"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {toasts.map((toast, index) => {
          const isTop = index === toasts.length - 1;
          const offset = Math.max(0, toasts.length - 1 - index);

          return (
            <div
              key={toast.id}
              style={{
                transform: `translateY(${offset * -8}px) scale(${1 - offset * 0.05})`,
                zIndex: 10000 - index,
                opacity: 1 - offset * 0.1,
                transformOrigin: 'top right',
              }}
              className={`
                pointer-events-auto transition-all duration-300 ease-out mb-3 w-full
                ${!isTop && offset > 0 ? 'hover:scale-100 hover:opacity-100 hover:translate-y-0' : ''}
                ${offset > 2 ? 'opacity-0 pointer-events-none' : ''}
              `}
            >
              <Toast
                id={toast.id}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                duration={toast.duration}
                showProgress={toast.showProgress}
                persistent={toast.persistent}
                actions={toast.actions}
                onClose={removeToast}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};