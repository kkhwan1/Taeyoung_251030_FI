import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: transactions, error } = await supabase
      .from('inventory_transactions')
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit, category),
        users!created_by(username)
      `)
      .eq('transaction_type', '생산입고')
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 각 거래에 대해 BOM 차감 로그 조회하여 부족 정보 계산
    const transactionsWithShortage = await Promise.all(
      (transactions || []).map(async (tx: any) => {
        // 해당 생산입고 거래의 BOM 차감 로그 조회
        const { data: bomLogs } = await supabase
          .from('bom_deduction_log')
          .select(`
            quantity_required,
            deducted_quantity
          `)
          .eq('transaction_id', tx.transaction_id);

        // 부족 총계 계산
        const totalShortage = (bomLogs || []).reduce((sum, log) => {
          const required = parseFloat(log.quantity_required || 0);
          const deducted = parseFloat(log.deducted_quantity || 0);
          return sum + Math.max(0, required - deducted);
        }, 0);

        return {
          ...tx,
          shortage_total: totalShortage
        };
      })
    );

    return NextResponse.json({ success: true, data: { transactions: transactionsWithShortage } });
  } catch (error) {
    console.error('Error fetching production history:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch production history' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/production
 * Create new production transaction with auto BOM deduction
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Korean text handling pattern - prevents character corruption
    const text = await request.text();
    const body = JSON.parse(text);

    const {
      transaction_date,
      item_id,
      quantity,
      unit_price,
      reference_number,
      notes,
      created_by,
      transaction_type
    } = body;

    // 필수 필드 검증
    if (!transaction_date || !item_id || !quantity || unit_price === undefined || !created_by || !transaction_type) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다. (거래일자, 품목, 수량, 단가, 작성자, 거래유형 필수)'
      }, { status: 400 });
    }

    if (!['생산입고', '생산출고'].includes(transaction_type)) {
      return NextResponse.json({
        success: false,
        error: '거래유형은 생산입고 또는 생산출고여야 합니다.'
      }, { status: 400 });
    }

    // 데이터 타입 강제 변환 및 검증
    const parsedQuantity = Math.floor(Number(quantity));
    const parsedUnitPrice = parseFloat(String(unit_price));

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      return NextResponse.json({
        success: false,
        error: '수량은 양의 정수여야 합니다.'
      }, { status: 400 });
    }

    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      return NextResponse.json({
        success: false,
        error: '단가는 유효한 숫자여야 합니다.'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if item exists and is active
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_name, unit, is_active')
      .eq('item_id', item_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({
        success: false,
        error: '존재하지 않는 품목입니다.'
      }, { status: 404 });
    }

    if (!item.is_active) {
      return NextResponse.json({
        success: false,
        error: '비활성화된 품목입니다.'
      }, { status: 400 });
    }

    // Calculate total amount using parsed values
    const total_amount = parsedQuantity * parsedUnitPrice;

    // Initialize stock warnings variable
    let stockWarnings: any = null;

    // === API 레벨 BOM 검증 및 차감 (이중 보장) ===
    if (transaction_type === '생산입고') {
      // 1. BOM 조회
      const { data: bomData, error: bomError } = await supabase
        .from('bom')
        .select(`
          child_item_id,
          quantity_required,
          child_item:items!child_item_id (
            item_id,
            item_code,
            item_name,
            current_stock,
            unit
          )
        `)
        .eq('parent_item_id', item_id)
        .eq('is_active', true);

      if (bomError) {
        console.error('BOM query error:', bomError);
        // BOM이 없어도 생산은 가능하도록 허용
      }

      // 2. 재고 검증 및 부족 원자재 체크 (경고만, 에러 아님)
      if (bomData && bomData.length > 0) {
        const stockShortages: Array<{ item_code: string; item_name: string; required: number; available: number }> = [];
        let maxProducible = Infinity;
        let bottleneckItem: any = null;
        
        for (const bomItem of bomData) {
          const childItem = bomItem.child_item;
          if (!childItem) continue;
          
          const requiredQuantity = (bomItem.quantity_required || 0) * parsedQuantity;
          const currentStock = childItem.current_stock || 0;
          const bomQuantityPerUnit = bomItem.quantity_required || 0;
          const maxProducibleByThisItem = Math.floor(currentStock / bomQuantityPerUnit);
          
          if (currentStock < requiredQuantity) {
            stockShortages.push({
              item_code: childItem.item_code,
              item_name: childItem.item_name,
              required: requiredQuantity,
              available: currentStock
            });
          }
          
          // Track bottleneck
          if (maxProducibleByThisItem < maxProducible) {
            maxProducible = maxProducibleByThisItem;
            bottleneckItem = {
              item_code: childItem.item_code,
              item_name: childItem.item_name,
              required: requiredQuantity,
              available: currentStock
            };
          }
        }
        
        // 재고 부족 시 경고 정보 저장 (에러 아님)
        if (stockShortages.length > 0) {
          stockWarnings = {
            has_shortage: true,
            max_producible: maxProducible === Infinity ? parsedQuantity : maxProducible,
            shortage_quantity: Math.max(0, parsedQuantity - (maxProducible === Infinity ? parsedQuantity : maxProducible)),
            bottleneck_materials: stockShortages
          };
        }
      }
    }
    // === API 레벨 BOM 검증 종료 ===

    // Insert production transaction using parsed values
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert([{
        item_id,
        created_by,
        transaction_type,
        quantity: parsedQuantity,  // 변환된 정수값
        unit_price: parsedUnitPrice,  // 변환된 숫자값
        total_amount,
        reference_number: reference_number || null,
        transaction_date,
        notes: notes || null
      }])
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit, category),
        users!created_by(username)
      `);

    if (error) {
      console.error('Supabase insert error:', error);
      // Note: stock shortage errors are handled by trigger, don't fail here

      // SECURITY FIX: Hide schema details in production
      const response: any = {
        success: false,
        error: '생산 등록 중 오류가 발생했습니다.'
      };

      if (process.env.NODE_ENV !== 'production') {
        response.details = error.message;
      }

      return NextResponse.json(response, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: false,
        error: '생산 등록에 실패했습니다.'
      }, { status: 500 });
    }

    const transaction = data[0];
    const transactionId = transaction.transaction_id;

    // Update product stock for 생산입고 transactions
    if (transaction_type === '생산입고') {
      // Get current stock first
      const { data: currentItem, error: getItemError } = await supabase
        .from('items')
        .select('current_stock')
        .eq('item_id', item_id)
        .single();
      
      if (!getItemError && currentItem) {
        const newStock = (currentItem.current_stock || 0) + quantity;
        
        const { error: stockError } = await supabase
          .from('items')
          .update({ current_stock: newStock })
          .eq('item_id', item_id);
        
        if (stockError) {
          console.error('Stock update error:', stockError);
        }
      }
    }

    // Fetch auto-generated BOM deduction logs with child item details
    const { data: deductionLogs, error: deductionError } = await supabase
      .from('bom_deduction_log')
      .select(`
        log_id,
        child_item_id,
        deducted_quantity,
        usage_rate,
        stock_before,
        stock_after,
        items:child_item_id (
          item_code,
          item_name,
          unit
        )
      `)
      .eq('transaction_id', transactionId)
      .order('log_id', { ascending: true });

    if (deductionError) {
      console.error('Error fetching deduction logs:', deductionError);
      // Continue execution - deduction logs are optional info
    }

    // Format auto_deductions array
    const auto_deductions = (deductionLogs || []).map((log: any) => ({
      log_id: log.log_id,
      child_item_id: log.child_item_id,
      item_code: log.items?.item_code || '',
      item_name: log.items?.item_name || '',
      unit: log.items?.unit || '',
      deducted_quantity: log.deducted_quantity,
      usage_rate: log.usage_rate,
      stock_before: log.stock_before,
      stock_after: log.stock_after
    }));

    const responseData: any = {
      transaction,
      auto_deductions
    };
    
    // Add stock warnings if any
    if (stockWarnings) {
      responseData.stock_warning = stockWarnings;
    }
    
    return NextResponse.json({
      success: true,
      message: stockWarnings 
        ? '생산이 등록되었습니다. (재고 부족 경고 있음)'
        : '생산이 성공적으로 등록되었습니다.',
      data: responseData
    });
  } catch (error) {
    console.error('Error creating production transaction:', error);

    return NextResponse.json(
      {
        success: false,
        error: '생산 등록 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/production
 * Update existing production transaction
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Korean text handling pattern - prevents character corruption
    const text = await request.text();
    const body = JSON.parse(text);
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Transaction ID is required'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if transaction exists and is a production transaction
    const { data: existingTransaction, error: existingError } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('transaction_id', id)
      .in('transaction_type', ['생산입고', '생산출고'])
      .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: 'Production transaction not found'
      }, { status: 404 });
    }

    // Validate fields if being updated
    if (updateData.quantity !== undefined && updateData.quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Quantity must be greater than 0'
      }, { status: 400 });
    }

    if (updateData.unit_price !== undefined && updateData.unit_price < 0) {
      return NextResponse.json({
        success: false,
        error: 'Unit price cannot be negative'
      }, { status: 400 });
    }

    // Recalculate total amount if quantity or unit_price is updated
    if (updateData.quantity !== undefined || updateData.unit_price !== undefined) {
      const newQuantity = updateData.quantity ?? existingTransaction.quantity;
      const newUnitPrice = updateData.unit_price ?? existingTransaction.unit_price;
      updateData.total_amount = newQuantity * newUnitPrice;
    }

    // Update transaction
    const { data, error } = await supabase
      .from('inventory_transactions')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', id)
      .select(`
        *,
        items!inner(item_code, item_name, spec, unit, category),
        users!created_by(username)
      `);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update production transaction',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Production transaction updated successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error updating production transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update production transaction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/production
 * Delete production transaction
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Transaction ID is required'
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if transaction exists and is a production transaction
    const { data: existingTransaction, error: existingError } = await supabase
      .from('inventory_transactions')
      .select('transaction_id')
      .eq('transaction_id', id)
      .in('transaction_type', ['생산입고', '생산출고'])
      .single();

    if (existingError || !existingTransaction) {
      return NextResponse.json({
        success: false,
        error: 'Production transaction not found'
      }, { status: 404 });
    }

    // Delete transaction
    const { error } = await supabase
      .from('inventory_transactions')
      .delete()
      .eq('transaction_id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete production transaction',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Production transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting production transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete production transaction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}