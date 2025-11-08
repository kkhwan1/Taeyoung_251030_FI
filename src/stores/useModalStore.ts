/**
 * Modal Store - Centralized modal/dialog state management
 * Manages all modal states across the application
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ModalData {
  [key: string]: any;
}

interface ModalState {
  // State
  modals: Record<string, boolean>;
  modalData: Record<string, ModalData>;

  // Actions
  openModal: (id: string, data?: ModalData) => void;
  closeModal: (id: string) => void;
  toggleModal: (id: string, data?: ModalData) => void;
  isOpen: (id: string) => boolean;
  getModalData: (id: string) => ModalData | undefined;
  setModalData: (id: string, data: ModalData) => void;
  closeAll: () => void;
}

export const useModalStore = create<ModalState>()(
  devtools(
    (set, get) => ({
      modals: {},
      modalData: {},

      openModal: (id, data) => {
        set(
          (state) => ({
            modals: { ...state.modals, [id]: true },
            modalData: data ? { ...state.modalData, [id]: data } : state.modalData,
          }),
          false,
          'openModal'
        );
      },

      closeModal: (id) => {
        set(
          (state) => {
            const newModals = { ...state.modals };
            const newModalData = { ...state.modalData };
            delete newModals[id];
            delete newModalData[id];
            return {
              modals: newModals,
              modalData: newModalData,
            };
          },
          false,
          'closeModal'
        );
      },

      toggleModal: (id, data) => {
        const isCurrentlyOpen = get().modals[id];
        if (isCurrentlyOpen) {
          get().closeModal(id);
        } else {
          get().openModal(id, data);
        }
      },

      isOpen: (id) => {
        return get().modals[id] ?? false;
      },

      getModalData: (id) => {
        return get().modalData[id];
      },

      setModalData: (id, data) => {
        set(
          (state) => ({
            modalData: { ...state.modalData, [id]: data },
          }),
          false,
          'setModalData'
        );
      },

      closeAll: () => {
        set(
          {
            modals: {},
            modalData: {},
          },
          false,
          'closeAll'
        );
      },
    }),
    {
      name: 'ModalStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Selectors
export const selectModals = (state: ModalState) => state.modals;
export const selectModalData = (state: ModalState) => state.modalData;
