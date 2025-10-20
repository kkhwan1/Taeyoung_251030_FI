'use client';

import { useState, useCallback } from 'react';
import ConfirmModal, { ConfirmType } from '@/components/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';

interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
  loading: boolean;
}

export const useConfirm = () => {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    options: {},
    resolve: null,
    loading: false
  });
  const { success, error } = useToast();

  const confirm = useCallback(async (options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options,
        resolve,
        loading: false
      });
    });
  }, []);

  // Korean convenience methods
  const deleteConfirm = useCallback(async (
    title: string = '삭제 확인',
    message: string = '정말 삭제하시겠습니까?'
  ): Promise<boolean> => {
    return confirm({
      title,
      message,
      type: 'delete',
      confirmText: '삭제',
      cancelText: '취소'
    });
  }, [confirm]);

  const warningConfirm = useCallback(async (
    title: string = '확인 필요',
    message: string = '이 작업을 진행하시겠습니까?'
  ): Promise<boolean> => {
    return confirm({
      title,
      message,
      type: 'warning',
      confirmText: '확인',
      cancelText: '취소'
    });
  }, [confirm]);

  const dangerConfirm = useCallback(async (
    title: string = '위험한 작업',
    message: string = '이 작업을 계속하시겠습니까?'
  ): Promise<boolean> => {
    return confirm({
      title,
      message,
      type: 'danger',
      confirmText: '계속',
      cancelText: '취소'
    });
  }, [confirm]);

  // Enhanced delete confirm with automatic toast notifications
  const deleteWithToast = useCallback(async (
    deleteAction: () => Promise<void>,
    options: {
      title?: string;
      message?: string;
      itemName?: string;
      successMessage?: string;
      errorMessage?: string;
    } = {}
  ): Promise<boolean> => {
    const {
      title = '삭제 확인',
      message = options.itemName
        ? `"${options.itemName}"을(를) 정말 삭제하시겠습니까?`
        : '정말 삭제하시겠습니까?',
      successMessage = '성공적으로 삭제되었습니다.',
      errorMessage = '삭제에 실패했습니다.'
    } = options;

    try {
      const confirmed = await deleteConfirm(title, message);

      if (!confirmed) {
        return false;
      }

      setState(prev => ({ ...prev, loading: true }));

      await deleteAction();

      setState(prev => ({ ...prev, loading: false, isOpen: false }));
      success('삭제 완료', successMessage);

      return true;
    } catch (err) {
      setState(prev => ({ ...prev, loading: false }));
      console.error('Delete action failed:', err);
      error('삭제 실패', errorMessage);
      return false;
    }
  }, [deleteConfirm, success, error]);

  const handleConfirm = useCallback(() => {
    if (state.resolve && !state.loading) {
      state.resolve(true);
      setState({
        isOpen: false,
        options: {},
        resolve: null,
        loading: false
      });
    }
  }, [state.resolve, state.loading]);

  const handleCancel = useCallback(() => {
    if (state.resolve && !state.loading) {
      state.resolve(false);
      setState({
        isOpen: false,
        options: {},
        resolve: null,
        loading: false
      });
    }
  }, [state.resolve, state.loading]);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const ConfirmDialog = useCallback(() => (
    <ConfirmModal
      isOpen={state.isOpen}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      type={state.options.type}
      title={state.options.title}
      message={state.options.message}
      confirmText={state.options.confirmText}
      cancelText={state.options.cancelText}
      loading={state.loading}
    />
  ), [state, handleConfirm, handleCancel]);

  return {
    confirm,
    deleteConfirm,
    warningConfirm,
    dangerConfirm,
    deleteWithToast,
    setLoading,
    ConfirmDialog
  };
};

export default useConfirm;