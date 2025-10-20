import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db-unified';

/**
 * POST /api/migrate/add-safety-stock
 * Add safety_stock column to items table
 * One-time migration to fix missing column issue
 *
 * NOTE: For PostgreSQL/Supabase, this migration should be done via Supabase Dashboard or CLI
 * This endpoint checks if column exists and updates default values only
 */
export async function POST() {
  try {
    // Check if column already exists by attempting to query it
    const { data: columnCheck, error: checkError } = await supabaseAdmin
      .from('items')
      .select('safety_stock')
      .limit(1);

    if (checkError) {
      // Column doesn't exist - need to add via Supabase Dashboard
      return NextResponse.json({
        success: false,
        message: 'safety_stock column does not exist. Please add it via Supabase Dashboard:',
        instructions: [
          '1. Go to Supabase Dashboard > Table Editor > items',
          '2. Add column: safety_stock, type: numeric (10,2), default: 0',
          '3. Run this migration again to set default values'
        ],
        error: checkError.message
      }, { status: 400 });
    }

    // Column exists - update default safety stock values for existing items
    const itemTypes = [
      { type: '원자재', value: 100 },
      { type: '부품', value: 50 },
      { type: '제품', value: 20 }
    ];

    let updatedCount = 0;
    for (const { type, value } of itemTypes) {
      const { error } = await supabaseAdmin
        .from('items')
        .update({ safety_stock: value })
        .eq('item_type', type)
        .eq('is_active', true);

      // Get count separately
      const { count } = await supabaseAdmin
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('item_type', type)
        .eq('is_active', true)
        .eq('safety_stock', value);

      if (error) {
        console.error(`Error updating ${type}:`, error);
      } else {
        updatedCount += count || 0;
      }
    }

    // Set default for other types
    const { error: otherError } = await supabaseAdmin
      .from('items')
      .update({ safety_stock: 10 })
      .not('item_type', 'in', '("원자재","부품","제품")')
      .eq('is_active', true);

    // Get count separately
    const { count: otherCount } = await supabaseAdmin
      .from('items')
      .select('*', { count: 'exact', head: true })
      .not('item_type', 'in', '("원자재","부품","제품")')
      .eq('is_active', true)
      .eq('safety_stock', 10);

    if (otherError) {
      console.error('Error updating other types:', otherError);
    }

    updatedCount += otherCount || 0;

    return NextResponse.json({
      success: true,
      message: 'safety_stock default values set successfully',
      migration: 'add_safety_stock_column',
      timestamp: new Date().toISOString(),
      updatedCount
    });
  } catch (error) {
    console.error('Error in safety_stock migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process safety_stock migration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/migrate/add-safety-stock
 * Check if safety_stock column exists
 */
export async function GET() {
  try {
    // Attempt to query safety_stock column
    const { data, error } = await supabaseAdmin
      .from('items')
      .select('safety_stock')
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: true,
        exists: false,
        message: 'safety_stock column does not exist',
        error: error.message
      });
    }

    return NextResponse.json({
      success: true,
      exists: true,
      message: 'safety_stock column exists',
      sampleData: data
    });
  } catch (error) {
    console.error('Error checking safety_stock column:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check safety_stock column'
      },
      { status: 500 }
    );
  }
}