import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


/**
 * Debug version of stock history API to identify the error
 */
export async function GET() {
  try {
    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: Simple query without complex joins
    const { data: simpleResult, error: simpleError } = await supabase
      .from('inventory_transactions')
      .select('transaction_id, transaction_type')
      .limit(5);

    if (simpleError) {
      throw new Error(`Simple query failed: ${simpleError.message}`);
    }

    // Test 2: With item join
    const { data: joinResult, error: joinError } = await supabase
      .from('inventory_transactions')
      .select(`
        transaction_id,
        transaction_type,
        items!inner(item_name)
      `)
      .limit(3);

    if (joinError) {
      throw new Error(`Join query failed: ${joinError.message}`);
    }

    // Test 3: Check for problematic NULL values
    const { count: totalCount, error: countError } = await supabase
      .from('inventory_transactions')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`);
    }

    // Check items existence
    const { count: itemsCount, error: itemsError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });

    if (itemsError) {
      throw new Error(`Items count query failed: ${itemsError.message}`);
    }

    // Check users existence
    const { count: usersCount, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      throw new Error(`Users count query failed: ${usersError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        simple: simpleResult || [],
        join: joinResult?.map((item: any) => ({
          transaction_id: item.transaction_id,
          transaction_type: item.transaction_type,
          item_name: item.items?.item_name
        })) || [],
        nullCheck: {
          total: totalCount || 0,
          items_exist: itemsCount || 0,
          users_exist: usersCount || 0
        }
      }
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Debug failed',
      details: error instanceof Error ? error.stack : 'No details'
    }, { status: 500 });
  }
}