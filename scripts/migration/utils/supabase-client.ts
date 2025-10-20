/**
 * Supabase Client Utility for Migration
 *
 * Provides admin-level database access with batch operations support
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

/**
 * Create admin Supabase client (bypasses RLS)
 */
export function createAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: { schema: 'public' }
  });
}

/**
 * Test database connection
 */
export async function testConnection(client: SupabaseClient<Database>): Promise<boolean> {
  try {
    const { data, error } = await client.from('items').select('item_id').limit(1);

    if (error) {
      console.error('❌ Supabase 연결 실패:', error.message);
      return false;
    }

    console.log('✅ Supabase 연결 성공');
    return true;
  } catch (error) {
    console.error('❌ Supabase 연결 테스트 실패:', error);
    return false;
  }
}

/**
 * Batch insert with progress callback
 */
export async function batchInsert<T extends Record<string, any>>(
  client: SupabaseClient<Database>,
  tableName: string,
  records: T[],
  batchSize: number = 100,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; errors: any[] }> {
  const results = { success: 0, failed: 0, errors: [] as any[] };

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      const { data, error } = await client
        .from(tableName as any)
        .insert(batch)
        .select();

      if (error) {
        results.failed += batch.length;
        results.errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error.message,
          records: batch
        });
      } else {
        results.success += batch.length;
      }
    } catch (error: any) {
      results.failed += batch.length;
      results.errors.push({
        batch: Math.floor(i / batchSize) + 1,
        error: error.message,
        records: batch
      });
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, records.length), records.length);
    }
  }

  return results;
}

/**
 * Get table row count
 */
export async function getTableCount(
  client: SupabaseClient<Database>,
  tableName: string,
  filters?: Record<string, any>
): Promise<number> {
  try {
    let query = client.from(tableName as any).select('*', { count: 'exact', head: true });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { count, error } = await query;

    if (error) {
      console.error(`❌ ${tableName} 카운트 실패:`, error.message);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error(`❌ ${tableName} 카운트 실패:`, error);
    return 0;
  }
}

/**
 * Delete all records from table
 */
export async function deleteAllRecords(
  client: SupabaseClient<Database>,
  tableName: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Get count before deletion
    const countBefore = await getTableCount(client, tableName);

    if (countBefore === 0) {
      return { success: true, count: 0 };
    }

    // Delete all records
    const { error } = await client.from(tableName as any).delete().neq('created_at', '1970-01-01');

    if (error) {
      return {
        success: false,
        count: 0,
        error: error.message
      };
    }

    return {
      success: true,
      count: countBefore
    };
  } catch (error: any) {
    return {
      success: false,
      count: 0,
      error: error.message
    };
  }
}

/**
 * Check if record exists by unique field
 */
export async function recordExists(
  client: SupabaseClient<Database>,
  tableName: string,
  field: string,
  value: any
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from(tableName as any)
      .select(field)
      .eq(field, value)
      .limit(1);

    if (error) {
      return false;
    }

    return (data?.length || 0) > 0;
  } catch (error) {
    return false;
  }
}
