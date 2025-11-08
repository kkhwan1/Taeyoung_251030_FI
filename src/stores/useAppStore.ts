/**
 * App Store - Global application settings
 * Manages locale, theme, sidebar state with localStorage persistence
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type Locale = 'ko' | 'en';

interface AppState {
  // State
  locale: Locale;
  theme: Theme;
  sidebarCollapsed: boolean;

  // Actions
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  reset: () => void;
}

const initialState = {
  locale: 'ko' as Locale,
  theme: 'light' as Theme,
  sidebarCollapsed: false,
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setLocale: (locale) => {
          set({ locale }, false, 'setLocale');
        },

        setTheme: (theme) => {
          set({ theme }, false, 'setTheme');

          // Update DOM
          if (typeof window !== 'undefined') {
            if (theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
        },

        toggleTheme: () => {
          set(
            (state) => {
              const newTheme = state.theme === 'light' ? 'dark' : 'light';

              // Update DOM
              if (typeof window !== 'undefined') {
                if (newTheme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }

              return { theme: newTheme };
            },
            false,
            'toggleTheme'
          );
        },

        setSidebarCollapsed: (collapsed) => {
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed');
        },

        toggleSidebar: () => {
          set(
            (state) => ({ sidebarCollapsed: !state.sidebarCollapsed }),
            false,
            'toggleSidebar'
          );
        },

        reset: () => {
          set(initialState, false, 'reset');
        },
      }),
      {
        name: 'erp-app-storage',
        partialize: (state) => ({
          locale: state.locale,
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
        }),
      }
    ),
    {
      name: 'AppStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Selectors for optimized re-renders
export const selectLocale = (state: AppState) => state.locale;
export const selectTheme = (state: AppState) => state.theme;
export const selectSidebarCollapsed = (state: AppState) => state.sidebarCollapsed;
