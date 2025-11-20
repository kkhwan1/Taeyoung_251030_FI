// GET /api/process/chain/:chainId - View entire process chain flow
// Returns all operations in a chain with complete flow visualization
// Shows sequence, status, and dependencies

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    const chainId = params.chainId;

    if (!chainId) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 체인 ID입니다' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get all operations in this chain, ordered by sequence
    const { data: operations, error: operationsError } = await supabase
      .from('process_operations')
      .select('*')
      .eq('chain_id', chainId)
      .order('chain_sequence', { ascending: true });

    if (operationsError) {
      console.error('체인 조회 오류:', operationsError);
      return NextResponse.json(
        { success: false, error: `체인 조회 실패: ${operationsError.message}` },
        { status: 500 }
      );
    }

    if (!operations || operations.length === 0) {
      return NextResponse.json(
        { success: false, error: '체인을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Step 2: Get item details for all operations
    const itemIds = new Set<number>();
    operations.forEach(op => {
      if (op.input_item_id) itemIds.add(op.input_item_id);
      if (op.output_item_id) itemIds.add(op.output_item_id);
    });

    const { data: items } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock, unit')
      .in('item_id', Array.from(itemIds));

    const itemsMap = new Map(items?.map(item => [item.item_id, item]) || []);

    // Step 3: Get stock movements for all operations in chain
    const operationIds = operations.map(op => op.operation_id);
    const { data: stockMovements } = await supabase
      .from('stock_history')
      .select('*')
      .eq('reference_type', 'process_operation')
      .in('reference_id', operationIds)
      .order('created_at', { ascending: false });

    // Group stock movements by operation_id
    const stockMovementsByOperation = new Map<number, any[]>();
    stockMovements?.forEach(movement => {
      const opId = movement.reference_id;
      if (!stockMovementsByOperation.has(opId)) {
        stockMovementsByOperation.set(opId, []);
      }
      stockMovementsByOperation.get(opId)!.push(movement);
    });

    // Step 4: Build enriched operations with item details and stock movements
    const enrichedOperations = operations.map(op => ({
      ...op,
      input_item: itemsMap.get(op.input_item_id) || null,
      output_item: itemsMap.get(op.output_item_id) || null,
      stock_movements: stockMovementsByOperation.get(op.operation_id) || []
    }));

    // Step 5: Calculate chain statistics
    const stats = {
      total_operations: operations.length,
      completed_count: operations.filter(op => op.status === 'COMPLETED').length,
      in_progress_count: operations.filter(op => op.status === 'IN_PROGRESS').length,
      pending_count: operations.filter(op => op.status === 'PENDING').length,
      first_operation: operations[0],
      last_operation: operations[operations.length - 1],
      chain_status: operations.every(op => op.status === 'COMPLETED')
        ? 'COMPLETED'
        : operations.some(op => op.status === 'IN_PROGRESS')
        ? 'IN_PROGRESS'
        : 'PENDING',
      total_stock_movements: stockMovements?.length || 0
    };

    // Step 6: Build process flow visualization
    const flow = enrichedOperations.map((op, index) => ({
      sequence: op.chain_sequence || index + 1,
      operation_type: op.operation_type,
      lot_number: op.lot_number,
      status: op.status,
      input: op.input_item ? `${op.input_item.item_name} (${op.input_item.item_code})` : null,
      output: op.output_item ? `${op.output_item.item_name} (${op.output_item.item_code})` : null,
      quantity: op.output_quantity,
      efficiency: op.efficiency,
      started_at: op.started_at,
      completed_at: op.completed_at,
      is_first: index === 0,
      is_last: index === operations.length - 1
    }));

    return NextResponse.json({
      success: true,
      data: {
        chain_id: chainId,
        operations: enrichedOperations,
        flow,
        statistics: stats,
        summary: {
          chain_type: `${stats.first_operation.operation_type} → ${stats.last_operation.operation_type}`,
          progress: `${stats.completed_count}/${stats.total_operations} 완료`,
          efficiency: calculateChainEfficiency(operations),
          created_at: stats.first_operation.created_at,
          completed_at: stats.chain_status === 'COMPLETED' ? stats.last_operation.completed_at : null
        }
      }
    });

  } catch (error: any) {
    console.error('체인 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '체인 처리 중 오류 발생' },
      { status: 500 }
    );
  }
}

// Helper function to calculate overall chain efficiency
function calculateChainEfficiency(operations: any[]): number | null {
  const completedOps = operations.filter(op => op.status === 'COMPLETED' && op.efficiency != null);
  if (completedOps.length === 0) return null;

  const totalEfficiency = completedOps.reduce((sum, op) => sum + (op.efficiency || 0), 0);
  return Math.round(totalEfficiency / completedOps.length);
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
