import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/stock/items
 * Get list of items for stock history dropdown
 * Returns: { item_id, item_code, item_name }
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build safe query using Supabase client
    const { data: items, error } = await supabase
      .from('items')
      .select('item_id, item_code, item_name')
      .eq('is_active', true)
      .order('item_code', { ascending: true })
      .order('item_name', { ascending: true });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: items || []
    });
  } catch (error) {
    console.error('Error fetching stock items:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stock items'
      },
      { status: 500 }
    );
  }
}
