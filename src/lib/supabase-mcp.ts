/**
 * Supabase MCP Integration Library
 *
 * This module provides a wrapper around the Supabase MCP server's execute_sql function.
 * It's used to execute raw SQL queries against the Supabase PostgreSQL database.
 *
 * Usage:
 * ```typescript
 * import { mcp__supabase__execute_sql } from '@/lib/supabase-mcp';
 *
 * const result = await mcp__supabase__execute_sql({
 *   project_id: process.env.SUPABASE_PROJECT_ID!,
 *   query: 'SELECT * FROM items WHERE is_active = true'
 * });
 *
 * const rows = result?.rows || [];
 * ```
 *
 * Migration from MySQL to PostgreSQL:
 * - `= 1` → `= true`, `= 0` → `= false`
 * - `?` parameters → string interpolation (MCP doesn't support parameterized queries yet)
 * - `NOW()` → `CURRENT_TIMESTAMP`
 * - `IFNULL()` → `COALESCE()`
 *
 * Important Notes:
 * - This is a temporary wrapper during Phase 5-2 migration
 * - SQL injection prevention: Sanitize inputs before string interpolation
 * - Error handling: Always wrap in try-catch blocks
 * - Environment variable SUPABASE_PROJECT_ID must be configured
 */

import { getSupabaseClient } from './db-unified';

interface ExecuteSqlParams {
  project_id: string;
  query: string;
}

interface ExecuteSqlResult {
  rows?: Record<string, unknown>[];
  error?: string;
}

/**
 * Execute SQL query using Supabase MCP server
 *
 * @param params - Object containing project_id and SQL query
 * @returns Promise resolving to query results or error
 * @throws Error if SUPABASE_PROJECT_ID is not configured or query execution fails
 */
export async function mcp__supabase__execute_sql(
  params: ExecuteSqlParams
): Promise<ExecuteSqlResult> {
  try {
    const { project_id, query } = params;

    if (!project_id) {
      throw new Error('SUPABASE_PROJECT_ID is required');
    }

    if (!query) {
      throw new Error('SQL query is required');
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('execute_sql', {
      query_text: query,
      params: null
    });

    if (error) {
      console.error('[Supabase MCP] execute_sql error:', error);
      return {
        rows: undefined,
        error: error.message || 'Supabase execute_sql failed'
      };
    }

    const rows = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : data
        ? [data as Record<string, unknown>]
        : [];

    return {
      rows,
      error: undefined
    };
  } catch (error) {
    console.error('[Supabase MCP] Query execution error:', error);
    return {
      rows: undefined,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper function to sanitize string values for SQL interpolation
 * Prevents SQL injection by escaping single quotes
 *
 * @param value - String value to sanitize
 * @returns Sanitized string safe for SQL interpolation
 */
export function sanitizeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Helper function to build WHERE clause from filters
 *
 * @param filters - Object containing filter key-value pairs
 * @returns SQL WHERE clause string
 */
export function buildWhereClause(filters: Record<string, unknown>): string {
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string') {
      conditions.push(`${key} = '${sanitizeSqlString(value)}'`);
    } else if (typeof value === 'boolean') {
      conditions.push(`${key} = ${value}`);
    } else if (typeof value === 'number') {
      conditions.push(`${key} = ${value}`);
    } else if (Array.isArray(value)) {
      const values = value
        .map(v => (typeof v === 'string' ? `'${sanitizeSqlString(v)}'` : `${v}`))
        .join(', ');
      conditions.push(`${key} IN (${values})`);
    }
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * Helper function to convert MySQL syntax to PostgreSQL
 *
 * @param mysqlQuery - SQL query in MySQL syntax
 * @returns SQL query converted to PostgreSQL syntax
 */
export function convertMySqlToPostgreSql(mysqlQuery: string): string {
  let pgQuery = mysqlQuery;

  // Replace backticks with double quotes (for identifiers)
  pgQuery = pgQuery.replace(/`([^`]+)`/g, '"$1"');

  // Replace MySQL boolean values
  pgQuery = pgQuery.replace(/\s*=\s*1\s/g, ' = true ');
  pgQuery = pgQuery.replace(/\s*=\s*0\s/g, ' = false ');

  // Replace MySQL functions
  pgQuery = pgQuery.replace(/NOW\(\)/g, 'CURRENT_TIMESTAMP');
  pgQuery = pgQuery.replace(/IFNULL\(/g, 'COALESCE(');

  // Replace LIMIT syntax (MySQL allows LIMIT offset, count)
  pgQuery = pgQuery.replace(/LIMIT\s+(\d+)\s*,\s*(\d+)/gi, 'LIMIT $2 OFFSET $1');

  return pgQuery;
}
