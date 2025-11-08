/**
 * API Type Definitions
 * Standard types for all API responses and handlers
 */

import { NextRequest } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

/**
 * Standard API Response Format
 * All API endpoints MUST return this format
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
  };
}

/**
 * Query parameters for list operations
 */
export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

/**
 * Context for error handling and logging
 */
export interface RequestContext {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'list';
  userId?: string;
  requestId?: string;
}

/**
 * Handler options for CRUD operations
 */
export interface HandlerOptions {
  tableName: string;
  idField?: string; // Default: 'id' or '{table}_id'
  activeField?: string; // Default: 'is_active'
  searchFields?: string[]; // Fields to search in
  selectFields?: string; // Supabase select query
  relationFields?: string; // Foreign key relations
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Base CRUD Handler Interface
 */
export interface ICRUDHandler<T = any> {
  getAll(request: NextRequest, context: RequestContext): Promise<APIResponse<T[]>>;
  getById(id: number | string, context: RequestContext): Promise<APIResponse<T>>;
  create(data: any, context: RequestContext): Promise<APIResponse<T>>;
  update(id: number | string, data: any, context: RequestContext): Promise<APIResponse<T>>;
  delete(id: number | string, context: RequestContext): Promise<APIResponse<{ deleted_id: number | string }>>;
}

/**
 * Supabase Client Type
 */
export type SupabaseClientType = SupabaseClient<Database>;
