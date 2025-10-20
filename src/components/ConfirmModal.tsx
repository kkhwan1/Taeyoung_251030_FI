'use client';

import { useEffect, useRef } from 'react';
import { X, AlertTriangle, Trash2, AlertCircle } from 'lucide-react';

export type ConfirmType = 'delete' | 'warning' | 'danger';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  type?: ConfirmType;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  children?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  type = 'warning',
  title,
  message,
  confirmText,
  cancelText = '취소',
  loading = false,
  children
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';

      // Focus management - focus cancel button by default for safety
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, loading, onCancel]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onCancel();
    }
  };

  // Handle confirm action
  const handleConfirm = () => {
    if (!loading) {
      onConfirm();
    }
  };

  // Handle cancel action
  const handleCancel = () => {
    if (!loading) {
      onCancel();
    }
  };

  // Get configuration based on type
  const getTypeConfig = () => {
    switch (type) {
      case 'delete':
        return {
          icon: <Trash2 className="w-6 h-6" />,
          iconBgColor: 'bg-red-100 dark:bg-red-900/20',
          iconTextColor: 'text-red-600 dark:text-red-400',
          buttonBgColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
          defaultTitle: '삭제 확인',
          defaultMessage: '정말 삭제하시겠습니까?',
          defaultConfirmText: '삭제'
        };
      case 'danger':
        return {
          icon: <AlertCircle className="w-6 h-6" />,
          iconBgColor: 'bg-red-100 dark:bg-red-900/20',
          iconTextColor: 'text-red-600 dark:text-red-400',
          buttonBgColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
          defaultTitle: '위험한 작업',
          defaultMessage: '이 작업을 계속하시겠습니까?',
          defaultConfirmText: '계속'
        };
      case 'warning':
      default:
        return {
          icon: <AlertTriangle className="w-6 h-6" />,
          iconBgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
          iconTextColor: 'text-yellow-600 dark:text-yellow-400',
          buttonBgColor: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
          defaultTitle: '확인 필요',
          defaultMessage: '이 작업을 진행하시겠습니까?',
          defaultConfirmText: '확인'
        };
    }
  };

  if (!isOpen) return null;

  const config = getTypeConfig();
  const finalTitle = title || config.defaultTitle;
  const finalMessage = message || config.defaultMessage;
  const finalConfirmText = confirmText || config.defaultConfirmText;

  return (
    <div
      className="fixed inset-0 z-[10001] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.iconBgColor}`}>
                <span className={config.iconTextColor}>
                  {config.icon}
                </span>
              </div>
              <h2
                id="confirm-modal-title"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                {finalTitle}
              </h2>
            </div>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="모달 닫기"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {children ? (
              children
            ) : (
              <div>
                <p
                  id="confirm-modal-description"
                  className="text-gray-700 dark:text-gray-300 mb-4"
                >
                  {finalMessage}
                </p>
                {type === 'delete' && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    이 작업은 되돌릴 수 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 p-6 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
            <button
              ref={cancelButtonRef}
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {cancelText}
            </button>
            <button
              ref={confirmButtonRef}
              onClick={handleConfirm}
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${config.buttonBgColor} ${loading ? 'cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  처리중...
                </div>
              ) : (
                finalConfirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;