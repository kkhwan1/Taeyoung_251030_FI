'use client';

import { Undo2, ExternalLink, RotateCcw } from 'lucide-react';
import { useToast as useToastHook, ToastProvider } from '../contexts/ToastContext';

// Re-export with original names for easier imports
export { ToastProvider };
export { useToastHook as useToast };

// Convenience hook that returns toast methods as an object
export const useToastNotification = () => {
  const context = useToastHook();

  return {
    // Standard methods
    success: context.success,
    error: context.error,
    warning: context.warning,
    info: context.info,

    // Utility methods
    clear: context.clearToasts,

    // Enhanced methods with actions
    successWithAction: context.successWithAction,
    errorWithAction: context.errorWithAction,
    warningWithAction: context.warningWithAction,
    infoWithAction: context.infoWithAction,
    persistent: context.persistent,

    // Korean-specific convenience methods
    저장완료: (message?: string) => context.success('저장 완료', message),
    삭제완료: (message?: string) => context.success('삭제 완료', message),
    저장실패: (message?: string) => context.error('저장 실패', message),
    삭제실패: (message?: string) => context.error('삭제 실패', message),
    입력오류: (message?: string) => context.error('입력 오류', message),
    경고: (message?: string) => context.warning('경고', message),
    알림: (message?: string) => context.info('알림', message),

    // Common business operations
    업로드완료: (message?: string) => context.success('업로드 완료', message),
    업로드실패: (message?: string) => context.error('업로드 실패', message),
    연결오류: (message?: string) => context.error('연결 오류', message),
    권한없음: (message?: string) => context.warning('권한 없음', message),
    데이터없음: (message?: string) => context.info('데이터 없음', message),

    // Enhanced Korean methods with undo functionality
    삭제완료_실행취소: (message?: string, onUndo?: () => void) => {
      const actions = onUndo ? [{
        label: '실행 취소',
        onClick: onUndo,
        style: 'secondary' as const,
        icon: Undo2
      }] : undefined;
      return context.successWithAction('삭제 완료', message, actions, 5000);
    },

    저장완료_상세보기: (message?: string, onViewDetails?: () => void) => {
      const actions = onViewDetails ? [{
        label: '상세 보기',
        onClick: onViewDetails,
        style: 'primary' as const,
        icon: ExternalLink
      }] : undefined;
      return context.successWithAction('저장 완료', message, actions);
    },

    업로드완료_결과보기: (message?: string, onViewResults?: () => void) => {
      const actions = onViewResults ? [{
        label: '결과 보기',
        onClick: onViewResults,
        style: 'primary' as const,
        icon: ExternalLink
      }] : undefined;
      return context.successWithAction('업로드 완료', message, actions);
    },

    오류발생_재시도: (message?: string, onRetry?: () => void) => {
      const actions = onRetry ? [{
        label: '다시 시도',
        onClick: onRetry,
        style: 'primary' as const,
        icon: RotateCcw
      }] : undefined;
      return context.errorWithAction('오류 발생', message, actions, 8000);
    },

    // Persistent notifications for critical operations
    중요알림: (message?: string, actions?: any[]) => context.persistent('warning', '중요 알림', message, actions),
    시스템오류: (message?: string, actions?: any[]) => context.persistent('error', '시스템 오류', message, actions),
  };
};