// POST /api/process/complete - Complete a process operation
// This is the MOST IMPORTANT endpoint - triggers automatic stock movement
// When status changes to COMPLETED, database trigger handles:
// 1. Stock validation
// 2. Input material deduction (e.g., coil)
// 3. Output material addition (e.g., plate)
// 4. Stock history audit trail
// 5. Auto-creation of next operation (if configured)
// 6. Child LOT number generation

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Korean text handling pattern
    const text = await request.text();
    const body = JSON.parse(text);

    const { operation_id, actual_output_quantity, efficiency, notes } = body;

    if (!operation_id) {
      return NextResponse.json(
        { success: false, error: '공정 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get operation details
    const { data: operation, error: fetchError } = await supabase
      .from('process_operations')
      .select('*')
      .eq('operation_id', operation_id)
      .single();

    if (fetchError || !operation) {
      return NextResponse.json(
        { success: false, error: '공정을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (operation.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: '이미 완료된 공정입니다' },
        { status: 400 }
      );
    }

    if (operation.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { success: false, error: '진행 중인 공정만 완료할 수 있습니다' },
        { status: 400 }
      );
    }

    // Step 2: Calculate efficiency if actual output provided
    let calculatedEfficiency = efficiency;
    if (actual_output_quantity && operation.output_quantity) {
      calculatedEfficiency = (actual_output_quantity / operation.output_quantity) * 100;
    }

    // Step 3: Update operation to COMPLETED
    // This triggers auto_process_stock_movement() function!
    const updateData: any = {
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (actual_output_quantity) {
      updateData.actual_output_quantity = actual_output_quantity;
    }

    if (calculatedEfficiency) {
      updateData.efficiency = calculatedEfficiency;
    }

    if (notes) {
      updateData.notes = notes;
    }

    const { data: updated, error: updateError } = await supabase
      .from('process_operations')
      .update(updateData)
      .eq('operation_id', operation_id)
      .select()
      .single();

    if (updateError) {
      console.error('공정 완료 오류:', updateError);
      return NextResponse.json(
        { success: false, error: `공정 완료 실패: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Step 4: Get stock history created by trigger
    const { data: stockHistory, error: historyError } = await supabase
      .from('stock_history')
      .select('*')
      .eq('reference_type', 'process_operation')
      .eq('reference_id', operation_id)
      .order('created_at', { ascending: false })
      .limit(2);

    // Step 5: Get updated item stocks
    const { data: inputItem } = await supabase
      .from('items')
      .select('item_code, item_name, current_stock, unit')
      .eq('item_id', operation.input_item_id)
      .single();

    const { data: outputItem } = await supabase
      .from('items')
      .select('item_code, item_name, current_stock, unit')
      .eq('item_id', operation.output_item_id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        operation: updated,
        stock_movements: stockHistory || [],
        current_stocks: {
          input: inputItem,
          output: outputItem
        },
        message: `공정 완료: ${operation.operation_type} (LOT: ${operation.lot_number})`
      }
    });

  } catch (error: any) {
    console.error('공정 완료 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '공정 완료 처리 중 오류 발생' },
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
