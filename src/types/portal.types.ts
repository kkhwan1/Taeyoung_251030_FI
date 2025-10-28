/**
 * Portal-specific type definitions
 *
 * These types extend the database types for portal authentication and access control.
 */

import { Database } from './database.types';

// Portal table types from database
export type PortalUser = Database['public']['Tables']['portal_users']['Row'];
export type PortalUserInsert = Database['public']['Tables']['portal_users']['Insert'];
export type PortalUserUpdate = Database['public']['Tables']['portal_users']['Update'];

export type PortalSession = Database['public']['Tables']['portal_sessions']['Row'];
export type PortalSessionInsert = Database['public']['Tables']['portal_sessions']['Insert'];
export type PortalSessionUpdate = Database['public']['Tables']['portal_sessions']['Update'];

export type PortalAccessLog = Database['public']['Tables']['portal_access_logs']['Row'];
export type PortalAccessLogInsert = Database['public']['Tables']['portal_access_logs']['Insert'];

// Portal user roles
export type PortalRole = 'CUSTOMER' | 'SUPPLIER' | 'ADMIN';

// Portal session data structure (for application use)
export interface PortalSessionData {
  portalUserId: number;
  username: string;
  role: PortalRole;
  companyId: number;
  companyName: string;
  isLoggedIn: boolean;
}

// Portal user with company info (from JOIN queries)
export interface PortalUserWithCompany extends PortalUser {
  companies: {
    company_name: string;
    company_type: string;
  };
}

// Portal session with user info (from JOIN queries)
export interface PortalSessionWithUser extends PortalSession {
  portal_users: PortalUserWithCompany;
}

// Authentication response types
export interface AuthenticationResult {
  success: boolean;
  session?: PortalSessionData;
  sessionToken?: string;
  error?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: PortalSessionData;
  error?: string;
}

// Rate limiting
export interface RateLimitInfo {
  allowed: boolean;
  remainingAttempts: number;
}

// API response wrapper
export interface PortalApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Request body types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface SessionCheckRequest {
  sessionToken: string;
}
