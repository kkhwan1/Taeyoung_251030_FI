// GET /api/process/lot/:lotNumber - Track process operations by LOT number
// Returns complete LOT lineage with parent-child relationships
// Includes related stock movements and operation details

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { lotNumber: string } }
) {
  try {
    const lotNumber = params.lotNumber;

    if (!lotNumber) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 LOT 번호입니다' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get the main operation for this LOT
    const { data: operation, error: operationError } = await supabase
      .from('process_operations')
      .select('*')
      .eq('lot_number', lotNumber)
      .single();

    if (operationError || !operation) {
      return NextResponse.json(
        { success: false, error: 'LOT 번호를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Step 2: Get parent operation (if exists)
    let parentOperation = null;
    if (operation.parent_lot_number) {
      const { data: parent } = await supabase
        .from('process_operations')
        .select('*')
        .eq('lot_number', operation.parent_lot_number)
        .single();
      parentOperation = parent;
    }

    // Step 3: Get child operation (if exists)
    let childOperation = null;
    if (operation.child_lot_number) {
      const { data: child } = await supabase
        .from('process_operations')
        .select('*')
        .eq('lot_number', operation.child_lot_number)
        .single();
      childOperation = child;
    }

    // Step 4: Get all operations in the same chain
    const { data: chainOperations } = await supabase
      .from('process_operations')
      .select('*')
      .eq('chain_id', operation.chain_id)
      .order('chain_sequence', { ascending: true });

    // Step 5: Get stock movements related to this operation
    const { data: stockMovements } = await supabase
      .from('stock_history')
      .select('*')
      .eq('reference_type', 'process_operation')
      .eq('reference_id', operation.operation_id)
      .order('created_at', { ascending: false });

    // Step 6: Get input and output item details
    const { data: inputItem } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock, unit')
      .eq('item_id', operation.input_item_id)
      .single();

    const { data: outputItem } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, current_stock, unit')
      .eq('item_id', operation.output_item_id)
      .single();

    // Step 7: Build LOT lineage
    const lineage = {
      parent: parentOperation ? {
        lot_number: parentOperation.lot_number,
        operation_type: parentOperation.operation_type,
        status: parentOperation.status,
        completed_at: parentOperation.completed_at
      } : null,
      current: {
        lot_number: operation.lot_number,
        operation_type: operation.operation_type,
        status: operation.status,
        started_at: operation.started_at,
        completed_at: operation.completed_at
      },
      child: childOperation ? {
        lot_number: childOperation.lot_number,
        operation_type: childOperation.operation_type,
        status: childOperation.status,
        started_at: childOperation.started_at
      } : null
    };

    return NextResponse.json({
      success: true,
      data: {
        operation: {
          ...operation,
          input_item: inputItem,
          output_item: outputItem
        },
        lineage,
        chain: chainOperations || [],
        stock_movements: stockMovements || [],
        summary: {
          chain_position: operation.chain_sequence || 1,
          total_chain_operations: chainOperations?.length || 1,
          has_parent: !!operation.parent_lot_number,
          has_child: !!operation.child_lot_number,
          stock_movements_count: stockMovements?.length || 0
        }
      }
    });

  } catch (error: any) {
    console.error('LOT 추적 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'LOT 추적 중 오류 발생' },
      { status: 500 }
    );
  }
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
