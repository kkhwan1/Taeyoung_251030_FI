/**
 * User Store - User authentication and permissions
 * Manages current user info and permissions
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
  avatar?: string;
  department?: string;
}

export type Permission =
  | 'items.read'
  | 'items.write'
  | 'items.delete'
  | 'companies.read'
  | 'companies.write'
  | 'companies.delete'
  | 'bom.read'
  | 'bom.write'
  | 'bom.delete'
  | 'transactions.read'
  | 'transactions.write'
  | 'transactions.delete'
  | 'inventory.read'
  | 'inventory.write'
  | 'inventory.adjust'
  | 'accounting.read'
  | 'accounting.write'
  | 'production.read'
  | 'production.write'
  | 'settings.read'
  | 'settings.write';

interface UserState {
  // State
  user: User | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  loading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setPermissions: (permissions: Permission[]) => void;
  login: (user: User, permissions: Permission[]) => void;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  setLoading: (loading: boolean) => void;
}

const initialState = {
  user: null,
  permissions: [] as Permission[],
  isAuthenticated: false,
  loading: false,
};

export const useUserStore = create<UserState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setUser: (user) => {
        set(
          {
            user,
            isAuthenticated: user !== null,
          },
          false,
          'setUser'
        );
      },

      setPermissions: (permissions) => {
        set({ permissions }, false, 'setPermissions');
      },

      login: (user, permissions) => {
        set(
          {
            user,
            permissions,
            isAuthenticated: true,
            loading: false,
          },
          false,
          'login'
        );
      },

      logout: () => {
        set(
          {
            ...initialState,
          },
          false,
          'logout'
        );
      },

      hasPermission: (permission) => {
        const state = get();
        if (!state.isAuthenticated) return false;
        if (state.user?.role === 'admin') return true; // Admin has all permissions
        return state.permissions.includes(permission);
      },

      hasAnyPermission: (permissions) => {
        const state = get();
        if (!state.isAuthenticated) return false;
        if (state.user?.role === 'admin') return true;
        return permissions.some((p) => state.permissions.includes(p));
      },

      hasAllPermissions: (permissions) => {
        const state = get();
        if (!state.isAuthenticated) return false;
        if (state.user?.role === 'admin') return true;
        return permissions.every((p) => state.permissions.includes(p));
      },

      setLoading: (loading) => {
        set({ loading }, false, 'setLoading');
      },
    }),
    {
      name: 'UserStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Selectors
export const selectUser = (state: UserState) => state.user;
export const selectIsAuthenticated = (state: UserState) => state.isAuthenticated;
export const selectPermissions = (state: UserState) => state.permissions;
export const selectLoading = (state: UserState) => state.loading;
