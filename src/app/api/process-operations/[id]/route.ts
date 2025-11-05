/**
 * Process Operations API - Individual Operation Routes
 *
 * Endpoints:
 * - GET /api/process-operations/[id] - Get single operation
 * - PATCH /api/process-operations/[id] - Update operation
 * - DELETE /api/process-operations/[id] - Cancel operation
 *
 * @author Claude (Backend System Architect)
 * @date 2025-02-04
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';
import type {
  ProcessOperationWithItems,
  UpdateProcessOperationRequest,
  OperationStatus,
} from '@/types/process';
import { validateStatusTransition, calculateEfficiency } from '@/types/process';

// ============================================================================
// GET - Retrieve Single Process Operation
// ============================================================================

export async function GET(
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

    const { data, error } = await supabase
      .from('process_operations')
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
      .eq('operation_id', operationId)
      .single();

    if (error) {
      console.error('❌ Operation retrieval error:', error);
      return handleSupabaseError('select', 'process_operations', error);
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: `작업 ID ${operationId}를 찾을 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    // Transform response
    const operation: ProcessOperationWithItems = {
      operation_id: data.operation_id,
      operation_type: data.operation_type,
      input_item_id: data.input_item_id,
      output_item_id: data.output_item_id,
      input_quantity: parseFloat(data.input_quantity),
      output_quantity: parseFloat(data.output_quantity),
      efficiency: data.efficiency ? parseFloat(data.efficiency) : undefined,
      operator_id: data.operator_id,
      started_at: data.started_at,
      completed_at: data.completed_at,
      status: data.status,
      notes: data.notes,
      created_at: data.created_at,
      updated_at: data.updated_at,
      input_item: {
        item_id: data.input_item.item_id,
        item_name: data.input_item.item_name,
        item_code: data.input_item.item_code,
        current_stock: parseFloat(data.input_item.current_stock),
        unit: data.input_item.unit,
        spec: data.input_item.spec,
      },
      output_item: {
        item_id: data.output_item.item_id,
        item_name: data.output_item.item_name,
        item_code: data.output_item.item_code,
        current_stock: parseFloat(data.output_item.current_stock),
        unit: data.output_item.unit,
        spec: data.output_item.spec,
      },
    };

    return createSuccessResponse(operation);
  } catch (error) {
    console.error('❌ Unexpected error in GET /api/process-operations/[id]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '공정 작업을 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update Process Operation
// ============================================================================

export async function PATCH(
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

    // Parse request body with proper UTF-8 handling
    const text = await request.text();
    const body: UpdateProcessOperationRequest = JSON.parse(text);

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

    // Check if operation is already completed
    if (currentOp.status === 'COMPLETED') {
      return NextResponse.json(
        {
          success: false,
          error: '이미 완료된 작업은 수정할 수 없습니다.',
        },
        { status: 400 }
      );
    }

    // Validate status transition if status is being updated
    if (body.status && body.status !== currentOp.status) {
      const validation = validateStatusTransition(currentOp.status as OperationStatus, body.status);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error_message,
          },
          { status: 400 }
        );
      }

      // If transitioning to IN_PROGRESS, set started_at
      if (body.status === 'IN_PROGRESS' && !currentOp.started_at) {
        body.started_at = new Date().toISOString();
      }

      // If transitioning to COMPLETED, validate stock availability
      if (body.status === 'COMPLETED') {
        const inputQty = body.input_quantity ?? parseFloat(currentOp.input_quantity);

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

        // Set completed_at if not provided
        if (!body.completed_at) {
          body.completed_at = new Date().toISOString();
        }
      }
    }

    // Auto-recalculate efficiency if quantities are updated
    if (body.input_quantity || body.output_quantity) {
      const inputQty = body.input_quantity ?? parseFloat(currentOp.input_quantity);
      const outputQty = body.output_quantity ?? parseFloat(currentOp.output_quantity);
      body.efficiency = calculateEfficiency(inputQty, outputQty);
    }

    // Update operation
    const { data: updatedOp, error: updateError } = await supabase
      .from('process_operations')
      .update({
        ...(body.status && { status: body.status }),
        ...(body.input_quantity && { input_quantity: body.input_quantity }),
        ...(body.output_quantity && { output_quantity: body.output_quantity }),
        ...(body.efficiency !== undefined && { efficiency: body.efficiency }),
        ...(body.operator_id !== undefined && { operator_id: body.operator_id }),
        ...(body.started_at && { started_at: body.started_at }),
        ...(body.completed_at && { completed_at: body.completed_at }),
        ...(body.notes !== undefined && { notes: body.notes }),
      })
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
      console.error('❌ Operation update error:', updateError);
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

    console.log(`✅ Process operation updated: ${operation.operation_id} → ${operation.status}`);

    return createSuccessResponse(operation);
  } catch (error) {
    console.error('❌ Unexpected error in PATCH /api/process-operations/[id]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '공정 작업을 수정하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Cancel Process Operation (Soft Delete)
// ============================================================================

export async function DELETE(
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

    // Get current operation
    const { data: currentOp, error: fetchError } = await supabase
      .from('process_operations')
      .select('operation_id, status')
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

    // Check if operation can be cancelled
    if (currentOp.status === 'COMPLETED') {
      return NextResponse.json(
        {
          success: false,
          error: '완료된 작업은 취소할 수 없습니다.',
        },
        { status: 400 }
      );
    }

    if (currentOp.status === 'CANCELLED') {
      return NextResponse.json(
        {
          success: false,
          error: '이미 취소된 작업입니다.',
        },
        { status: 400 }
      );
    }

    // Soft delete: Set status to CANCELLED
    const { error: deleteError } = await supabase
      .from('process_operations')
      .update({ status: 'CANCELLED' })
      .eq('operation_id', operationId);

    if (deleteError) {
      console.error('❌ Operation cancellation error:', deleteError);
      return handleSupabaseError('update', 'process_operations', deleteError);
    }

    console.log(`✅ Process operation cancelled: ${operationId}`);

    return NextResponse.json(
      {
        success: true,
        message: `작업 ID ${operationId}가 취소되었습니다.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Unexpected error in DELETE /api/process-operations/[id]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '공정 작업을 취소하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
