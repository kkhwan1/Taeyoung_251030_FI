import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


/**
 * POST /api/stock/adjustment
 * Create stock adjustment transaction
 * Body: {
 *   item_id: number,
 *   adjustment_type: 'INCREASE' | 'DECREASE' | 'SET',
 *   quantity: number,
 *   reason: string,
 *   reference_no?: string,
 *   notes?: string,
 *   created_by: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);
    const {
      item_id,
      adjustment_type,
      quantity,
      reason,
      reference_no,
      notes,
      created_by
    } = body;

    // 필수 필드 검증
    if (!item_id || !adjustment_type || quantity === undefined || !reason || !created_by) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다. (품목, 조정유형, 수량, 사유, 작성자 필수)'
      }, { status: 400 });
    }

    if (quantity === 0) {
      return NextResponse.json({
        success: false,
        error: '조정 수량은 0이 될 수 없습니다.'
      }, { status: 400 });
    }

    // 조정 유형 검증
    if (!['INCREASE', 'DECREASE', 'SET'].includes(adjustment_type)) {
      return NextResponse.json({
        success: false,
        error: '올바르지 않은 조정 유형입니다.'
      }, { status: 400 });
    }

    // Check if item exists and is active
    const { data: itemCheck, error: itemError } = await supabaseAdmin
      .from('items')
      .select('item_id, item_name, unit, is_active')
      .eq('item_id', item_id)
      .single();

    if (itemError || !itemCheck) {
      return NextResponse.json({
        success: false,
        error: '존재하지 않는 품목입니다.'
      }, { status: 404 });
    }

    if (!itemCheck.is_active) {
      return NextResponse.json({
        success: false,
        error: '비활성화된 품목입니다.'
      }, { status: 400 });
    }

    // Get current stock from items table (much faster than calculating from all transactions)
    const { data: currentItem, error: stockError } = await supabaseAdmin
      .from('items')
      .select('current_stock')
      .eq('item_id', item_id)
      .single();

    if (stockError) {
      throw new Error(`재고 조회 실패: ${stockError.message}`);
    }

    const finalCurrentStock = currentItem?.current_stock || 0;

    // Calculate adjustment quantity based on type
    let adjustmentQuantity: number;
    let newStock: number;

    switch (adjustment_type) {
      case 'INCREASE':
        adjustmentQuantity = Math.abs(quantity);
        newStock = finalCurrentStock + adjustmentQuantity;
        break;
      case 'DECREASE':
        adjustmentQuantity = -Math.abs(quantity);
        newStock = finalCurrentStock + adjustmentQuantity;
        // Check if new stock would be negative
        if (newStock < 0) {
          return NextResponse.json({
            success: false,
            error: `재고가 부족합니다. 현재 재고: ${finalCurrentStock}, 요청 감소량: ${Math.abs(quantity)}`
          }, { status: 400 });
        }
        break;
      case 'SET':
        adjustmentQuantity = quantity - finalCurrentStock;
        newStock = quantity;
        if (newStock < 0) {
          return NextResponse.json({
            success: false,
            error: '재고는 음수가 될 수 없습니다.'
          }, { status: 400 });
        }
        break;
      default:
        return NextResponse.json({
          success: false,
          error: '올바르지 않은 조정 유형입니다.'
        }, { status: 400 });
    }

    // Insert adjustment transaction
    // Note: The trigger 'update_stock_on_transaction' will automatically update current_stock
    const { data: insertedTransaction, error: insertError } = await supabaseAdmin
      .from('inventory_transactions')
      .insert({
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: '조정',
        item_id,
        quantity: adjustmentQuantity,
        unit_price: 0,
        total_amount: 0,
        reference_number: reference_no || `ADJ-${Date.now()}`,
        notes: `${reason}${notes ? ` | ${notes}` : ''} | 이전 재고: ${finalCurrentStock} → 조정 후: ${newStock}`,
        created_by
      })
      .select()
      .single();

    if (insertError) {
      console.error('[STOCK_ADJUSTMENT] Insert error:', insertError);
      throw new Error(`거래 생성 실패: ${insertError.message}`);
    }

    // Manually update stock to ensure consistency (in case trigger didn't run properly)
    const { error: updateStockError } = await supabaseAdmin
      .from('items')
      .update({ current_stock: newStock })
      .eq('item_id', item_id);

    if (updateStockError) {
      console.error('[STOCK_ADJUSTMENT] Stock update error:', updateStockError);
      // Don't throw - transaction was already created
    }

    // Get full transaction details with joins
    const { data: fullTransaction, error: detailError } = await supabaseAdmin
      .from('inventory_transactions')
      .select(`
        *,
        items (item_code, item_name, spec, unit),
        users!inventory_transactions_created_by_fkey (name)
      `)
      .eq('transaction_id', insertedTransaction.transaction_id)
      .single();

    if (detailError) {
      console.error('[STOCK_ADJUSTMENT] Detail fetch error:', detailError);
    }

    const result = {
      ...insertedTransaction,
      item_code: fullTransaction?.items?.item_code,
      item_name: fullTransaction?.items?.item_name,
      specification: fullTransaction?.items?.spec,
      item_unit: fullTransaction?.items?.unit,
      created_by_name: fullTransaction?.users?.name,
      adjustment_type,
      current_stock_before: finalCurrentStock,
      current_stock_after: newStock
    };

    return NextResponse.json({
      success: true,
      message: '재고 조정이 성공적으로 완료되었습니다.',
      data: result
    });
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    const errorMessage = error instanceof Error ? error.message : '재고 조정 중 오류가 발생했습니다.';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stock/adjustment
 * Get stock adjustment history
 * Query parameters:
 * - start_date: Filter by start date (YYYY-MM-DD)
 * - end_date: Filter by end date (YYYY-MM-DD)
 * - item_id: Filter by specific item
 * - limit: Number of records to return (default: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const itemId = searchParams.get('item_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('inventory_transactions')
      .select(`
        *,
        items (item_code, item_name, spec, unit),
        users!inventory_transactions_created_by_fkey (name)
      `, { count: 'exact' })
      .eq('transaction_type', '조정')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    if (itemId) {
      query = query.eq('item_id', parseInt(itemId));
    }

    const { data: adjustments, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        adjustments: adjustments || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: offset + limit < (count || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stock adjustments:', error);
    return NextResponse.json(
      {
        success: false,
        error: '재고 조정 이력 조회 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}