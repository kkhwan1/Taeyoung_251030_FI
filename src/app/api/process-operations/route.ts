/**
 * Process Operations API Routes
 *
 * Endpoints:
 * - GET /api/process-operations - List operations with filtering
 * - POST /api/process-operations - Create new operation
 *
 * @author Claude (Backend System Architect)
 * @date 2025-02-04
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';
import type {
  ProcessOperationWithItems,
  ProcessOperationListOptions,
  CreateProcessOperationRequest,
  OperationType,
  OperationStatus,
} from '@/types/process';
import { calculateEfficiency } from '@/types/process';

// ============================================================================
// GET - List Process Operations with Filtering
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const operation_type = searchParams.get('operation_type');
    const status = searchParams.get('status');
    const input_item_id = searchParams.get('input_item_id');
    const output_item_id = searchParams.get('output_item_id');
    const operator_id = searchParams.get('operator_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = (searchParams.get('sortBy') || 'created_at') as 'created_at' | 'started_at' | 'completed_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
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
      `, { count: 'exact' });

    // Apply filters
    if (operation_type) {
      const types = operation_type.split(',') as OperationType[];
      query = query.in('operation_type', types);
    }

    if (status) {
      const statuses = status.split(',') as OperationStatus[];
      query = query.in('status', statuses);
    }

    if (input_item_id) {
      query = query.eq('input_item_id', parseInt(input_item_id));
    }

    if (output_item_id) {
      query = query.eq('output_item_id', parseInt(output_item_id));
    }

    if (operator_id) {
      query = query.eq('operator_id', parseInt(operator_id));
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    if (search) {
      query = query.or(`notes.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Process operations query error:', error);
      return handleSupabaseError('select', 'process_operations', error);
    }

    // Transform data to include proper relations
    const operations: ProcessOperationWithItems[] = (data || []).map((op: any) => ({
      operation_id: op.operation_id,
      operation_type: op.operation_type,
      input_item_id: op.input_item_id,
      output_item_id: op.output_item_id,
      input_quantity: parseFloat(op.input_quantity),
      output_quantity: parseFloat(op.output_quantity),
      efficiency: op.efficiency ? parseFloat(op.efficiency) : undefined,
      operator_id: op.operator_id,
      started_at: op.started_at,
      completed_at: op.completed_at,
      status: op.status,
      notes: op.notes,
      created_at: op.created_at,
      updated_at: op.updated_at,
      input_item: {
        item_id: op.input_item.item_id,
        item_name: op.input_item.item_name,
        item_code: op.input_item.item_code,
        current_stock: parseFloat(op.input_item.current_stock),
        unit: op.input_item.unit,
        spec: op.input_item.spec,
      },
      output_item: {
        item_id: op.output_item.item_id,
        item_name: op.output_item.item_name,
        item_code: op.output_item.item_code,
        current_stock: parseFloat(op.output_item.current_stock),
        unit: op.output_item.unit,
        spec: op.output_item.spec,
      },
    }));

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return createSuccessResponse(operations, {
      page,
      limit,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error('❌ Unexpected error in GET /api/process-operations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '공정 작업 목록을 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create Process Operation
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Parse request body with proper UTF-8 handling
    const text = await request.text();
    const body: CreateProcessOperationRequest = JSON.parse(text);

    // Validation
    if (!body.operation_type || !['BLANKING', 'PRESS', 'ASSEMBLY'].includes(body.operation_type)) {
      return NextResponse.json(
        {
          success: false,
          error: '유효하지 않은 공정 유형입니다. (BLANKING, PRESS, ASSEMBLY 중 선택)',
        },
        { status: 400 }
      );
    }

    if (!body.input_item_id || !body.output_item_id) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 품목과 산출 품목을 모두 지정해야 합니다.',
        },
        { status: 400 }
      );
    }

    if (body.input_item_id === body.output_item_id) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 품목과 산출 품목이 동일할 수 없습니다.',
        },
        { status: 400 }
      );
    }

    if (!body.input_quantity || body.input_quantity <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '투입 수량은 0보다 커야 합니다.',
        },
        { status: 400 }
      );
    }

    if (!body.output_quantity || body.output_quantity <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: '산출 수량은 0보다 커야 합니다.',
        },
        { status: 400 }
      );
    }

    // Check if items exist
    const { data: inputItem, error: inputError } = await supabase
      .from('items')
      .select('item_id, item_name, current_stock')
      .eq('item_id', body.input_item_id)
      .single();

    if (inputError || !inputItem) {
      return NextResponse.json(
        {
          success: false,
          error: `투입 품목(ID: ${body.input_item_id})을 찾을 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    const { data: outputItem, error: outputError } = await supabase
      .from('items')
      .select('item_id, item_name, current_stock')
      .eq('item_id', body.output_item_id)
      .single();

    if (outputError || !outputItem) {
      return NextResponse.json(
        {
          success: false,
          error: `산출 품목(ID: ${body.output_item_id})을 찾을 수 없습니다.`,
        },
        { status: 404 }
      );
    }

    // Check stock availability for input item
    const currentStock = parseFloat(inputItem.current_stock);
    if (currentStock < body.input_quantity) {
      return NextResponse.json(
        {
          success: false,
          error: `투입 품목 "${inputItem.item_name}"의 재고가 부족합니다. (필요: ${body.input_quantity}, 현재: ${currentStock})`,
        },
        { status: 400 }
      );
    }

    // Auto-calculate efficiency if not provided
    const efficiency = body.efficiency ?? calculateEfficiency(body.input_quantity, body.output_quantity);

    // Create operation
    const { data: newOperation, error: createError } = await supabase
      .from('process_operations')
      .insert({
        operation_type: body.operation_type,
        input_item_id: body.input_item_id,
        output_item_id: body.output_item_id,
        input_quantity: body.input_quantity,
        output_quantity: body.output_quantity,
        efficiency,
        operator_id: body.operator_id,
        notes: body.notes,
        status: 'PENDING',
      })
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

    if (createError) {
      console.error('❌ Operation creation error:', createError);
      return handleSupabaseError('insert', 'process_operations', createError);
    }

    // Transform response
    const operation: ProcessOperationWithItems = {
      operation_id: newOperation.operation_id,
      operation_type: newOperation.operation_type,
      input_item_id: newOperation.input_item_id,
      output_item_id: newOperation.output_item_id,
      input_quantity: parseFloat(newOperation.input_quantity),
      output_quantity: parseFloat(newOperation.output_quantity),
      efficiency: newOperation.efficiency ? parseFloat(newOperation.efficiency) : undefined,
      operator_id: newOperation.operator_id,
      started_at: newOperation.started_at,
      completed_at: newOperation.completed_at,
      status: newOperation.status,
      notes: newOperation.notes,
      created_at: newOperation.created_at,
      updated_at: newOperation.updated_at,
      input_item: {
        item_id: newOperation.input_item.item_id,
        item_name: newOperation.input_item.item_name,
        item_code: newOperation.input_item.item_code,
        current_stock: parseFloat(newOperation.input_item.current_stock),
        unit: newOperation.input_item.unit,
        spec: newOperation.input_item.spec,
      },
      output_item: {
        item_id: newOperation.output_item.item_id,
        item_name: newOperation.output_item.item_name,
        item_code: newOperation.output_item.item_code,
        current_stock: parseFloat(newOperation.output_item.current_stock),
        unit: newOperation.output_item.unit,
        spec: newOperation.output_item.spec,
      },
    };

    console.log(`✅ Process operation created: ${operation.operation_id} (${operation.operation_type})`);

    return NextResponse.json(
      {
        success: true,
        data: operation,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Unexpected error in POST /api/process-operations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '공정 작업을 생성하는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
