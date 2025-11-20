// POST /api/process/start - Start a process operation
// Changes status from PENDING → IN_PROGRESS
// Records start time for tracking

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Korean text handling pattern
    const text = await request.text();
    const body = JSON.parse(text);

    const { operation_id, notes } = body;

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

    if (operation.status === 'IN_PROGRESS') {
      return NextResponse.json(
        { success: false, error: '이미 진행 중인 공정입니다' },
        { status: 400 }
      );
    }

    if (operation.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: '이미 완료된 공정입니다' },
        { status: 400 }
      );
    }

    // Step 2: Validate stock availability BEFORE starting
    const { data: inputItem, error: itemError } = await supabase
      .from('items')
      .select('current_stock, item_name, item_code, unit')
      .eq('item_id', operation.input_item_id)
      .single();

    if (itemError || !inputItem) {
      return NextResponse.json(
        { success: false, error: '투입 품목을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (inputItem.current_stock < operation.input_quantity) {
      return NextResponse.json(
        {
          success: false,
          error: `재고 부족: ${inputItem.item_name} (${inputItem.item_code}), 필요: ${operation.input_quantity}${inputItem.unit}, 현재: ${inputItem.current_stock}${inputItem.unit}`,
          available_stock: inputItem.current_stock,
          required_stock: operation.input_quantity
        },
        { status: 400 }
      );
    }

    // Step 3: Update operation to IN_PROGRESS
    const updateData: any = {
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

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
      console.error('공정 시작 오류:', updateError);
      return NextResponse.json(
        { success: false, error: `공정 시작 실패: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        operation: updated,
        input_stock_available: inputItem.current_stock,
        message: `공정 시작: ${operation.operation_type} (LOT: ${operation.lot_number})`
      }
    });

  } catch (error: any) {
    console.error('공정 시작 처리 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '공정 시작 처리 중 오류 발생' },
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
