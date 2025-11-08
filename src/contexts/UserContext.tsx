/**
 * User Context - React Context wrapper for useUserStore
 * Provides backward compatibility and easy integration
 */

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useUserStore, type User, type Permission } from '@/stores/useUserStore';

interface UserContextValue {
  user: User | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  loading: boolean;
  setUser: (user: User | null) => void;
  setPermissions: (permissions: Permission[]) => void;
  login: (user: User, permissions: Permission[]) => void;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  setLoading: (loading: boolean) => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  // Get all values from Zustand store
  const user = useUserStore((state) => state.user);
  const permissions = useUserStore((state) => state.permissions);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const loading = useUserStore((state) => state.loading);
  const setUser = useUserStore((state) => state.setUser);
  const setPermissions = useUserStore((state) => state.setPermissions);
  const login = useUserStore((state) => state.login);
  const logout = useUserStore((state) => state.logout);
  const hasPermission = useUserStore((state) => state.hasPermission);
  const hasAnyPermission = useUserStore((state) => state.hasAnyPermission);
  const hasAllPermissions = useUserStore((state) => state.hasAllPermissions);
  const setLoading = useUserStore((state) => state.setLoading);

  const value: UserContextValue = {
    user,
    permissions,
    isAuthenticated,
    loading,
    setUser,
    setPermissions,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    setLoading,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// Re-export types
export type { User, Permission };
