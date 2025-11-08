/**
 * Modal Context - React Context wrapper for useModalStore
 * Provides backward compatibility and easy integration
 */

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useModalStore, type ModalData } from '@/stores/useModalStore';

interface ModalContextValue {
  modals: Record<string, boolean>;
  modalData: Record<string, ModalData>;
  openModal: (id: string, data?: ModalData) => void;
  closeModal: (id: string) => void;
  toggleModal: (id: string, data?: ModalData) => void;
  isOpen: (id: string) => boolean;
  getModalData: (id: string) => ModalData | undefined;
  setModalData: (id: string, data: ModalData) => void;
  closeAll: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  // Get all values from Zustand store
  const modals = useModalStore((state) => state.modals);
  const modalData = useModalStore((state) => state.modalData);
  const openModal = useModalStore((state) => state.openModal);
  const closeModal = useModalStore((state) => state.closeModal);
  const toggleModal = useModalStore((state) => state.toggleModal);
  const isOpen = useModalStore((state) => state.isOpen);
  const getModalData = useModalStore((state) => state.getModalData);
  const setModalData = useModalStore((state) => state.setModalData);
  const closeAll = useModalStore((state) => state.closeAll);

  const value: ModalContextValue = {
    modals,
    modalData,
    openModal,
    closeModal,
    toggleModal,
    isOpen,
    getModalData,
    setModalData,
    closeAll,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

// Re-export types
export type { ModalData };
