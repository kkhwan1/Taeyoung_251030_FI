/**
 * Process Operations Complete API
 *
 * Endpoint: POST /api/process-operations/[id]/complete
 * Purpose: Complete a process operation (IN_PROGRESS → COMPLETED)
 *          Triggers automatic stock movement via database trigger
 *
 * @author Claude (Backend System Architect)
 * @date 2025-02-04
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';
import type {
  ProcessOperationWithItems,
  OperationStatus,
} from '@/types/process';
import { validateStatusTransition, calculateEfficiency } from '@/types/process';

export const dynamic = 'force-dynamic';


// ============================================================================
// POST - Complete Process Operation (IN_PROGRESS → COMPLETED)
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const operationId = parseInt(params.id);

    if (isNaN(operationId)) {
      return NextResponse.json(
        {
          success: false,
          error: '유효하지 않은 작업 ID입니다.',
        },
        { status: 400 }
      );
    }

    // Parse optional request body (for output_quantity, scrap_quantity, etc.)
    const text = await request.text();
    const body = text ? JSON.parse(text) : {};

    // Get current operation
    const { data: currentOp, error: fetchError } = await supabase
      .from('process_operations')
      .select('*')
      .eq('operation_id', operationId)
      .single();

    if (fetchError || !currentOp) {
      return NextResponse.json(
        {
          success: false,
          error: `작업 ID ${operationId}를 찾을 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    // Validate current status is IN_PROGRESS
    if (currentOp.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        {
          success: false,
          error: `작업을 완료할 수 없습니다. 현재 상태: ${currentOp.status}`,
        },
        { status: 400 }
      );
    }

    // Validate status transition
    const validation = validateStatusTransition(currentOp.status as OperationStatus, 'COMPLETED');
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error_message,
        },
        { status: 400 }
      );
    }

    // Calculate final quantities
    const inputQty = body.input_quantity ?? parseFloat(currentOp.input_quantity);
    const outputQty = body.output_quantity ?? parseFloat(currentOp.output_quantity);
    const scrapQty = body.scrap_quantity ?? 0;

    // Validate stock availability for input item
    const { data: inputItem, error: stockError } = await supabase
      .from('items')
      .select('current_stock, item_name')
      .eq('item_id', currentOp.input_item_id)
      .single();

    if (stockError || !inputItem) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 품목을 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    }

    const currentStock = parseFloat(inputItem.current_stock);
    if (currentStock < inputQty) {
      return NextResponse.json(
        {
          success: false,
          error: `투입 품목 "${inputItem.item_name}"의 재고가 부족합니다. (필요: ${inputQty}, 현재: ${currentStock})`,
        },
        { status: 400 }
      );
    }

    // Auto-recalculate efficiency
    const efficiency = calculateEfficiency(inputQty, outputQty);

    // Prepare update data
    const updateData: any = {
      status: 'COMPLETED',
      completed_at: body.completed_at || new Date().toISOString(),
      efficiency,
    };

    // Add optional fields if provided
    if (body.input_quantity) updateData.input_quantity = body.input_quantity;
    if (body.output_quantity) updateData.output_quantity = body.output_quantity;
    if (body.scrap_quantity !== undefined) updateData.scrap_quantity = body.scrap_quantity;
    if (body.quality_status) updateData.quality_status = body.quality_status;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Update operation to COMPLETED
    // This will trigger auto_process_stock_movement() database trigger
    const { data: updatedOp, error: updateError } = await supabase
      .from('process_operations')
      .update(updateData)
      .eq('operation_id', operationId)
      .select(`
        *,
        input_item:items!input_item_id (
          item_id,
          item_name,
          item_code,
          current_stock,
          unit,
          spec
        ),
        output_item:items!output_item_id (
          item_id,
          item_name,
          item_code,
          current_stock,
          unit,
          spec
        )
      `)
      .single();

    if (updateError) {
      console.error('[ERROR] Operation complete error:', updateError);
      return handleSupabaseError('update', 'process_operations', updateError);
    }

    // Transform response
    const operation: ProcessOperationWithItems = {
      operation_id: updatedOp.operation_id,
      operation_type: updatedOp.operation_type,
      input_item_id: updatedOp.input_item_id,
      output_item_id: updatedOp.output_item_id,
      input_quantity: parseFloat(updatedOp.input_quantity),
      output_quantity: parseFloat(updatedOp.output_quantity),
      efficiency: updatedOp.efficiency ? parseFloat(updatedOp.efficiency) : undefined,
      operator_id: updatedOp.operator_id,
      started_at: updatedOp.started_at,
      completed_at: updatedOp.completed_at,
      status: updatedOp.status,
      notes: updatedOp.notes,
      created_at: updatedOp.created_at,
      updated_at: updatedOp.updated_at,
      // LOT tracking fields
      lot_number: updatedOp.lot_number,
      parent_lot_number: updatedOp.parent_lot_number,
      child_lot_number: updatedOp.child_lot_number,
      // Chain management fields
      chain_id: updatedOp.chain_id,
      chain_sequence: updatedOp.chain_sequence,
      parent_operation_id: updatedOp.parent_operation_id,
      auto_next_operation: updatedOp.auto_next_operation,
      next_operation_type: updatedOp.next_operation_type,
      // Quality control fields
      quality_status: updatedOp.quality_status,
      scrap_quantity: updatedOp.scrap_quantity ? parseFloat(updatedOp.scrap_quantity) : undefined,
      scheduled_date: updatedOp.scheduled_date,
      input_item: {
        item_id: updatedOp.input_item.item_id,
        item_name: updatedOp.input_item.item_name,
        item_code: updatedOp.input_item.item_code,
        current_stock: parseFloat(updatedOp.input_item.current_stock),
        unit: updatedOp.input_item.unit,
        spec: updatedOp.input_item.spec,
      },
      output_item: {
        item_id: updatedOp.output_item.item_id,
        item_name: updatedOp.output_item.item_name,
        item_code: updatedOp.output_item.item_code,
        current_stock: parseFloat(updatedOp.output_item.current_stock),
        unit: updatedOp.output_item.unit,
        spec: updatedOp.output_item.spec,
      },
    };

    console.log(`[INFO] Process operation completed: ${operation.operation_id} (${operation.operation_type})`);
    console.log(`[INFO] Stock movement triggered automatically via database trigger`);

    return createSuccessResponse(operation);
  } catch (error) {
    console.error('[ERROR] Unexpected error in POST /api/process-operations/[id]/complete:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '공정 작업을 완료하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
