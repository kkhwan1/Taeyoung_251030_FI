import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

/**
 * GET /api/process/lot/dashboard
 *
 * LOT 대시보드 데이터 조회
 * Returns recent and active LOT operations for dashboard display
 *
 * Query Parameters:
 * - limit: number (default: 10) - Number of recent operations to fetch
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Fetch recent process operations with LOT numbers
    const { data: operations, error: operationsError } = await supabase
      .from('process_operations')
      .select(`
        operation_id,
        lot_number,
        operation_type,
        status,
        input_quantity,
        output_quantity,
        efficiency,
        started_at,
        completed_at,
        quality_status,
        chain_id,
        chain_sequence,
        input_item:items!process_operations_input_item_id_fkey(
          item_id,
          item_code,
          item_name,
          unit
        ),
        output_item:items!process_operations_output_item_id_fkey(
          item_id,
          item_code,
          item_name,
          unit
        )
      `)
      .not('lot_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (operationsError) {
      console.error('[LOT Dashboard API] Operations query error:', operationsError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch operations: ${operationsError.message}`
        },
        { status: 500 }
      );
    }

    // Calculate status summary
    const statusSummary = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0
    };

    operations.forEach(op => {
      if (op.status in statusSummary) {
        statusSummary[op.status as keyof typeof statusSummary]++;
      }
    });

    // Calculate quality summary (if quality_status exists)
    const qualitySummary = {
      OK: 0,
      NG: 0,
      REWORK: 0,
      PENDING: 0
    };

    operations.forEach(op => {
      const qStatus = op.quality_status || 'PENDING';
      if (qStatus in qualitySummary) {
        qualitySummary[qStatus as keyof typeof qualitySummary]++;
      }
    });

    // Get active operations count (IN_PROGRESS)
    const activeCount = operations.filter(op => op.status === 'IN_PROGRESS').length;

    // Get completed today count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedTodayCount = operations.filter(op => {
      if (!op.completed_at) return false;
      const completedDate = new Date(op.completed_at);
      return completedDate >= today;
    }).length;

    // Calculate average efficiency for completed operations
    const completedOps = operations.filter(op => op.status === 'COMPLETED' && op.efficiency != null);
    const avgEfficiency = completedOps.length > 0
      ? completedOps.reduce((sum, op) => sum + (op.efficiency || 0), 0) / completedOps.length
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        operations: operations || [],
        summary: {
          total: operations.length,
          active: activeCount,
          completedToday: completedTodayCount,
          avgEfficiency: Math.round(avgEfficiency * 100) / 100
        },
        statusSummary,
        qualitySummary
      }
    });
  } catch (error) {
    console.error('[LOT Dashboard API] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
