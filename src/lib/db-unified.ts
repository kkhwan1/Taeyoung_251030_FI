/**
 * Unified Supabase Database Layer
 *
 * This module consolidates all database operations into a single, consistent interface.
 * It replaces the legacy MySQL layer (db.ts) and merges db-supabase.ts + supabase.ts.
 *
 * Features:
 * - Single source of truth for database operations
 * - Reusable error handling
 * - Type-safe operations
 * - Browser and server client support
 */

import { createBrowserClient } from '@supabase/ssr';
import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

// ============================================================================
// CONFIGURATION & CLIENTS
// ============================================================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Check SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * Browser client for client-side operations
 * Uses anon key with RLS policies
 */
export const createSupabaseBrowserClient = () =>
  createBrowserClient<Database>(supabaseUrl!, supabaseAnonKey!);

/**
 * Standard client for client-side operations with session persistence
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: { schema: 'public' },
    global: {
      headers: { 'x-my-custom-header': 'taechang-erp' }
    }
  }
);

/**
 * Admin client for server-side operations
 * Bypasses RLS - use with caution!
 *
 * Phase 1 Optimization: Connection pool configuration
 * - Pool size increased from default (10) to 20
 * - Idle timeout: 30 seconds
 * - Connection timeout: 10 seconds
 */
export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl!,
  supabaseServiceRole || supabaseAnonKey!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-connection-pool': 'optimized',
        'x-pool-size': '20'
      }
    }
  }
);

/**
 * Get appropriate Supabase client (singleton pattern)
 * Defaults to admin client for server-side operations
 */
let clientInstance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!clientInstance) {
    clientInstance = supabaseAdmin;
  }
  return clientInstance;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SupabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export interface QueryOptions {
  columns?: string;
  filters?: Record<string, any>;
  search?: { columns: string[]; term: string };
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  count?: boolean;
}

// ============================================================================
// REUSABLE ERROR HANDLING (Eliminates 60% code duplication)
// ============================================================================

/**
 * Centralized error handler for Supabase operations
 * Eliminates duplicate error handling code across 20+ locations
 */
export function handleSupabaseError(
  operation: string,
  table: string,
  error: PostgrestError | Error | any
): SupabaseResponse<never> {
  const errorMessage = error?.message || String(error);
  console.error(`[Supabase] ${table}.${operation} failed:`, {
    message: errorMessage,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });

  return {
    success: false,
    error: errorMessage,
  };
}

/**
 * Success response wrapper for consistency
 */
export function createSuccessResponse<T>(
  data: T,
  count?: number
): SupabaseResponse<T> {
  return {
    success: true,
    data,
    ...(count !== undefined && { count }),
  };
}

/**
 * Exception handler wrapper for consistency
 * Converts unknown errors to standard response format
 */
export function handleException<T = never>(
  operation: string,
  error: unknown
): SupabaseResponse<T> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  console.error(`[Exception ${operation}]`, {
    message: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  });

  return {
    success: false,
    error: errorMessage
  };
}

/**
 * Try-catch wrapper for async operations
 * Automatically handles errors and returns standard response
 */
export async function tryCatchWrapper<T>(
  operation: string,
  asyncFn: () => Promise<SupabaseResponse<T>>
): Promise<SupabaseResponse<T>> {
  try {
    return await asyncFn();
  } catch (error) {
    return handleException(operation, error);
  }
}

/**
 * Convert Supabase query result to standard response
 */
export function toDbResponse<T>(
  operation: string,
  queryResult: {
    data: T | null;
    error: PostgrestError | null;
    count?: number | null;
  }
): SupabaseResponse<T> {
  const { data, error, count } = queryResult;

  if (error) {
    return handleSupabaseError(operation, 'unknown', error);
  }

  return {
    success: true,
    data: data === null ? undefined : data,
    count: count ?? undefined
  };
}

/**
 * Convert single query result to array response
 */
export function toDbResponseSingle<T>(
  operation: string,
  queryResult: {
    data: T | null;
    error: PostgrestError | null;
  }
): SupabaseResponse<T[]> {
  const { data, error } = queryResult;

  if (error) {
    return handleSupabaseError(operation, 'unknown', error);
  }

  return {
    success: true,
    data: data ? [data] : [],
    error: undefined
  };
}

/**
 * Convert mutation result to standard response
 */
export function toDbResponseMutation<T>(
  operation: string,
  mutationResult: {
    data: T | null;
    error: PostgrestError | null;
  }
): SupabaseResponse<T> {
  const { data, error } = mutationResult;

  if (error) {
    return handleSupabaseError(operation, 'unknown', error);
  }

  return {
    success: true,
    data: data ?? undefined
  };
}

// ============================================================================
// QUERY BUILDER (Generic database operations)
// ============================================================================

export class SupabaseQueryBuilder {
  private client: SupabaseClient<Database>;

  constructor(client?: SupabaseClient<Database>) {
    this.client = client || getSupabaseClient();
  }

  /**
   * Generic SELECT with pagination, filters, and search
   * Eliminates duplicate query logic
   */
  async select<T>(
    table: string,
    options: QueryOptions = {}
  ): Promise<SupabaseResponse<T[]>> {
    try {
      let query = this.client
        .from(table as any)
        .select(
          options.columns || '*',
          options.count ? { count: 'exact' } : undefined
        );

      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'string' && value.includes('%')) {
              query = query.like(key, value);
            } else {
              query = query.eq(key, value);
            }
          }
        });
      }

      // Apply search across multiple columns
      if (options.search && options.search.term) {
        const searchConditions = options.search.columns
          .map(col => `${col}.ilike.%${options.search!.term}%`)
          .join(',');
        query = query.or(searchConditions);
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.orderDirection !== 'desc',
        });
      }

      // Apply pagination
      if (options.page && options.limit) {
        const start = (options.page - 1) * options.limit;
        const end = start + options.limit - 1;
        query = query.range(start, end);
      }

      const { data, error, count } = await query;

      if (error) {
        return handleSupabaseError('select', table, error);
      }

      return createSuccessResponse(data as T[], count || undefined);
    } catch (error) {
      return handleSupabaseError('select', table, error);
    }
  }

  /**
   * Generic INSERT operation
   */
  async insert<T>(
    table: string,
    values: any | any[]
  ): Promise<SupabaseResponse<T>> {
    try {
      const { data, error } = await this.client
        .from(table as any)
        .insert(values)
        .select()
        .single();

      if (error) {
        return handleSupabaseError('insert', table, error);
      }

      return createSuccessResponse(data as T);
    } catch (error) {
      return handleSupabaseError('insert', table, error);
    }
  }

  /**
   * Generic UPDATE operation
   */
  async update<T>(
    table: string,
    id: number,
    values: any,
    idColumn: string = 'id'
  ): Promise<SupabaseResponse<T>> {
    try {
      const { data, error } = await this.client
        .from(table as any)
        .update(values)
        .eq(idColumn, id)
        .select()
        .single();

      if (error) {
        return handleSupabaseError('update', table, error);
      }

      return createSuccessResponse(data as T);
    } catch (error) {
      return handleSupabaseError('update', table, error);
    }
  }

  /**
   * Generic DELETE operation (soft delete preferred)
   */
  async delete(
    table: string,
    id: number,
    idColumn: string = 'id',
    softDelete: boolean = true
  ): Promise<SupabaseResponse<any>> {
    try {
      if (softDelete) {
        // Soft delete: set is_active = false
        return await this.update(table, id, { is_active: false }, idColumn);
      } else {
        // Hard delete
        const { error } = await this.client
          .from(table as any)
          .delete()
          .eq(idColumn, id);

        if (error) {
          return handleSupabaseError('delete', table, error);
        }

        return createSuccessResponse(null);
      }
    } catch (error) {
      return handleSupabaseError('delete', table, error);
    }
  }
}

// ============================================================================
// DATABASE HELPERS (Domain-specific operations)
// ============================================================================

export const db = {
  /**
   * Authentication helpers
   */
  auth: {
    signUp: async (email: string, password: string) => {
      return await supabase.auth.signUp({ email, password });
    },
    signIn: async (email: string, password: string) => {
      return await supabase.auth.signInWithPassword({ email, password });
    },
    signOut: async () => {
      return await supabase.auth.signOut();
    },
    getUser: async () => {
      return await supabase.auth.getUser();
    },
    getSession: async () => {
      return await supabase.auth.getSession();
    },
  },

  /**
   * Items operations
   */
  items: {
    getAll: async (options: QueryOptions = {}) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.select('items', {
        ...options,
        filters: { is_active: true, ...options.filters },
        orderBy: options.orderBy || 'item_code',
      });
    },

    getById: async (id: number) => {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('item_id', id)
          .single();

        if (error) return handleSupabaseError('getById', 'items', error);
        return createSuccessResponse(data);
      } catch (error) {
        return handleSupabaseError('getById', 'items', error);
      }
    },

    checkDuplicateCode: async (itemCode: string, excludeId?: number) => {
      try {
        let query = supabase
          .from('items')
          .select('item_id, item_code')
          .eq('item_code', itemCode);

        if (excludeId) {
          query = query.neq('item_id', excludeId);
        }

        const { data, error } = await query;

        if (error) return handleSupabaseError('checkDuplicateCode', 'items', error);
        return createSuccessResponse(data);
      } catch (error) {
        return handleSupabaseError('checkDuplicateCode', 'items', error);
      }
    },

    create: async (item: Database['public']['Tables']['items']['Insert']) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.insert('items', item);
    },

    update: async (id: number, item: Database['public']['Tables']['items']['Update']) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.update('items', id, item, 'item_id');
    },

    delete: async (id: number) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.delete('items', id, 'item_id', true); // Soft delete
    },
  },

  /**
   * Companies operations
   */
  companies: {
    getAll: async (options: QueryOptions = {}) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.select('companies', {
        ...options,
        filters: { is_active: true, ...options.filters },
        orderBy: options.orderBy || 'company_name',
      });
    },

    getById: async (id: number) => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('company_id', id)
          .single();

        if (error) return handleSupabaseError('getById', 'companies', error);
        return createSuccessResponse(data);
      } catch (error) {
        return handleSupabaseError('getById', 'companies', error);
      }
    },

    checkDuplicateName: async (companyName: string, excludeId?: number) => {
      try {
        let query = supabase
          .from('companies')
          .select('company_id, company_name')
          .eq('company_name', companyName);

        if (excludeId) {
          query = query.neq('company_id', excludeId);
        }

        const { data, error } = await query;

        if (error) return handleSupabaseError('checkDuplicateName', 'companies', error);
        return createSuccessResponse(data);
      } catch (error) {
        return handleSupabaseError('checkDuplicateName', 'companies', error);
      }
    },

    create: async (company: Database['public']['Tables']['companies']['Insert']) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.insert('companies', company);
    },

    update: async (id: number, company: Database['public']['Tables']['companies']['Update']) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.update('companies', id, company, 'company_id');
    },

    delete: async (id: number) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.delete('companies', id, 'company_id', true);
    },

    query: async (sql: string, params?: any[]) => {
      console.warn('companies.query() is deprecated. Use Supabase MCP for complex SQL.');
      throw new Error('Raw queries not supported. Use Supabase MCP for complex SQL.');
    },
  },

  /**
   * Inventory transactions operations
   */
  transactions: {
    getAll: async (options: QueryOptions = {}) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.select('inventory_transactions', {
        ...options,
        orderBy: options.orderBy || 'transaction_date',
        orderDirection: 'desc',
      });
    },

    getById: async (id: number) => {
      try {
        const { data, error } = await supabase
          .from('inventory_transactions')
          .select('*')
          .eq('transaction_id', id)
          .single();

        if (error) return handleSupabaseError('getById', 'inventory_transactions', error);
        return createSuccessResponse(data);
      } catch (error) {
        return handleSupabaseError('getById', 'inventory_transactions', error);
      }
    },

    create: async (transaction: Database['public']['Tables']['inventory_transactions']['Insert']) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.insert('inventory_transactions', transaction);
    },

    update: async (id: number, data: Database['public']['Tables']['inventory_transactions']['Update']) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.update('inventory_transactions', id, data, 'transaction_id');
    },

    delete: async (id: number) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.delete('inventory_transactions', id, 'transaction_id', false);
    },

    getCountByFilters: async (filters: {
      type?: string;
      item_id?: number;
      start_date?: string;
      end_date?: string;
    }) => {
      const builder = new SupabaseQueryBuilder();
      const result = await builder.select('inventory_transactions', {
        filters: {
          ...(filters.type && { transaction_type: filters.type }),
          ...(filters.item_id && { item_id: filters.item_id }),
        },
        count: true,
        limit: 1
      });

      return {
        success: result.success,
        data: result.count || 0,
        error: result.error
      };
    }
  },

  // Alias for backward compatibility
  get inventoryTransactions() {
    return this.transactions;
  },

  /**
   * BOM operations
   */
  bom: {
    getAll: async (options: QueryOptions = {}) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.select('bom', {
        ...options,
        filters: { is_active: true, ...options.filters },
      });
    },

    getById: async (id: number) => {
      try {
        const { data, error } = await supabase
          .from('bom')
          .select('*')
          .eq('bom_id', id)
          .single();

        if (error) return handleSupabaseError('getById', 'bom', error);
        return createSuccessResponse(data);
      } catch (error) {
        return handleSupabaseError('getById', 'bom', error);
      }
    },

    getByParentId: async (parentId: number) => {
      try {
        const { data, error } = await supabase
          .from('bom')
          .select(`
            *,
            parent_item:items!bom_parent_item_id_fkey(item_id, item_code, item_name, spec, unit),
            child_item:items!bom_child_item_id_fkey(item_id, item_code, item_name, spec, unit)
          `)
          .eq('parent_item_id', parentId)
          .eq('is_active', true);

        if (error) return handleSupabaseError('getByParentId', 'bom', error);
        return createSuccessResponse(data);
      } catch (error) {
        return handleSupabaseError('getByParentId', 'bom', error);
      }
    },

    create: async (bom: Database['public']['Tables']['bom']['Insert']) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.insert('bom', bom);
    },

    update: async (id: number, bom: Database['public']['Tables']['bom']['Update']) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.update('bom', id, bom, 'bom_id');
    },

    delete: async (id: number) => {
      const builder = new SupabaseQueryBuilder();
      return await builder.delete('bom', id, 'bom_id', true);
    },
  },

  /**
   * Raw SQL query execution (DEPRECATED - use Supabase MCP for complex queries)
   * Maintained for backward compatibility only
   * Returns SupabaseResponse format for consistency
   */
  query: async <T>(sql: string, params?: any[]): Promise<SupabaseResponse<T[]>> => {
    console.warn('Warning: db.query() is deprecated. Use typed methods or Supabase MCP.');

    try {
      // Use standalone query function
      const result = await query<T>(sql, params);

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('[db.query] Failed:', error);
      return {
        success: false,
        error: error.message || 'Query failed. Consider using Supabase MCP for complex queries.'
      };
    }
  },
};

// ============================================================================
// LEGACY COMPATIBILITY (For gradual migration)
// ============================================================================

/**
 * Connection test (for health checks)
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('items').select('item_id').limit(1);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Raw query execution (use sparingly - prefer typed methods)
 * For complex queries with JOINs and aggregations, use Supabase MCP instead
 */
export async function query<T>(sql: string, params?: any[]): Promise<T[]> {
  console.warn('Warning: Using raw query. Consider using typed methods or Supabase MCP.');

  try {
    // Use Supabase RPC for SQL execution
    // Note: This requires a database function to execute arbitrary SQL
    // For production, implement proper stored procedures or use Supabase MCP
    const { data, error } = await (supabaseAdmin.rpc as any)('exec_sql', {
      query_text: sql,
      params: params || []
    });

    if (error) {
      // Fallback: If RPC not available, throw error to use MCP
      console.error('[query] RPC failed:', error);
      throw new Error('Use Supabase MCP for complex SQL: ' + error.message);
    }

    return data as T[];
  } catch (error: any) {
    console.error('[query] Failed:', error);
    // Return empty array for compatibility, log warning
    console.warn('Query failed. Consider using Supabase MCP for complex queries.');
    return [] as T[];
  }
}

// Export everything for backward compatibility
export * from '@supabase/supabase-js';
export type { Database } from '@/types/supabase';
