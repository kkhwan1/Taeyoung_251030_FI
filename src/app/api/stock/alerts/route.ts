import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


// Note: Uses database views (low_stock_alert_view) - migrated to Supabase MCP
// Phase 5-2: Supabase execute_sql implementation

/**
 * GET /api/stock/alerts
 * Get low stock alert items using low_stock_alert_view
 * Query parameters:
 * - alert_level: Filter by alert level (OUT_OF_STOCK/CRITICAL/LOW)
 * - location: Filter by storage location
 * - limit: Number of records to return (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const alertLevel = searchParams.get('alert_level');
    const location = searchParams.get('location');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build safe query using Supabase client
    let query = supabase
      .from('low_stock_alert_view')
      .select(`
        item_id,
        item_code,
        item_name,
        spec,
        unit,
        current_stock,
        safety_stock,
        shortage_quantity,
        location,
        alert_level,
        items!inner(unit_price)
      `);

    // Apply filters safely
    if (alertLevel) {
      query = query.eq('alert_level', alertLevel);
    }

    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    // Apply ordering and pagination
    query = query
      .order('shortage_quantity', { ascending: false })
      .order('item_code', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: alerts, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Transform data to include calculated shortage_value
    const formattedAlerts = alerts?.map((alert: any) => ({
      item_id: alert.item_id,
      item_code: alert.item_code,
      item_name: alert.item_name,
      spec: alert.spec,
      unit: alert.unit,
      current_stock: alert.current_stock,
      safety_stock: alert.safety_stock,
      shortage_quantity: alert.shortage_quantity,
      location: alert.location,
      alert_level: alert.alert_level,
      unit_price: alert.items?.unit_price,
      shortage_value: alert.shortage_quantity * (alert.items?.unit_price || 0)
    })) || [];

    // Get summary statistics using safe query
    const { count: totalAlerts, error: statsError } = await supabase
      .from('low_stock_alert_view')
      .select('*', { count: 'exact', head: true });

    if (statsError) {
      throw new Error(`Statistics query failed: ${statsError.message}`);
    }

    // Get counts by alert level using safe queries
    const { count: outOfStockCount } = await supabase
      .from('low_stock_alert_view')
      .select('*', { count: 'exact', head: true })
      .eq('alert_level', 'OUT_OF_STOCK');

    const { count: criticalCount } = await supabase
      .from('low_stock_alert_view')
      .select('*', { count: 'exact', head: true })
      .eq('alert_level', 'CRITICAL');

    const { count: lowCount } = await supabase
      .from('low_stock_alert_view')
      .select('*', { count: 'exact', head: true })
      .eq('alert_level', 'LOW');

    // Calculate total shortage quantity
    const totalShortage = formattedAlerts.reduce((sum, alert) => sum + alert.shortage_quantity, 0);

    const stats = {
      total_alerts: totalAlerts || 0,
      out_of_stock: outOfStockCount || 0,
      critical: criticalCount || 0,
      low: lowCount || 0,
      total_shortage: totalShortage
    };

    // Get total count for pagination using safe query
    let countQuery = supabase
      .from('low_stock_alert_view')
      .select('*', { count: 'exact', head: true });

    if (alertLevel) {
      countQuery = countQuery.eq('alert_level', alertLevel);
    }

    if (location) {
      countQuery = countQuery.ilike('location', `%${location}%`);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: formattedAlerts,
      meta: {
        total: totalCount || 0,
        limit,
        offset,
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching stock alerts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stock alerts'
      },
      { status: 500 }
    );
  }
}