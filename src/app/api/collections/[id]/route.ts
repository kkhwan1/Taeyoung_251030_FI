import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

// 수금 수정 스키마
const CollectionUpdateSchema = z.object({
  collected_amount: z.number().positive('수금 금액은 0보다 커야 합니다').optional(),
  collection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
  payment_method: z.enum(['CASH', 'TRANSFER', 'CHECK', 'CARD']).optional(),
  notes: z.string().optional()
});

// GET: 특정 수금 조회
export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '수금 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Fetch collection with joins
    const collectionId = parseInt(id);
    const { data, error } = await supabaseAdmin
      .from('collection_transactions')
      .select(`
        *,
        sales_transaction:sales_transactions!sales_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status
        ),
        customer:companies!customer_id(
          company_id,
          company_name,
          company_code
        )
      `)
      .eq('collection_id', collectionId)
      .single() as any;

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: '수금을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Collection get error:', error);
    return NextResponse.json(
      { success: false, error: '수금 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// PUT: 수금 수정 (금액, 날짜, 메모만)
export const PUT = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '수금 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Korean encoding
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate update data
    const result = CollectionUpdateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: { message: string }) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    // Get original collection data
    const collectionId = parseInt(id);
    const { data: originalCollection, error: fetchError } = await supabaseAdmin
      .from('collection_transactions')
      .select('collection_id, sales_transaction_id, collected_amount')
      .eq('collection_id', collectionId)
      .eq('is_active', true)
      .single() as any;

    if (fetchError || !originalCollection) {
      return NextResponse.json(
        { success: false, error: '수금을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // If amount is being changed, recalculate payment status
    let needsStatusUpdate = false;
    let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED' = 'PENDING';

    if (body.collected_amount !== undefined && body.collected_amount !== originalCollection.collected_amount) {
      needsStatusUpdate = true;

      // Get sales transaction details
      const { data: salesTx, error: salesError } = await supabaseAdmin
        .from('sales_transactions')
        .select('total_amount')
        .eq('transaction_id', originalCollection.sales_transaction_id)
        .single() as any;

      if (salesError || !salesTx) {
        return NextResponse.json(
          { success: false, error: '판매 거래를 찾을 수 없습니다' },
          { status: 400 }
        );
      }

      // Calculate total collected (excluding current collection)
      const { data: otherCollections } = (await supabaseAdmin
        .from('collection_transactions')
        .select('collected_amount')
        .eq('sales_transaction_id', originalCollection.sales_transaction_id)
        .eq('is_active', true)
        .neq('collection_id', collectionId)) as any;

      const otherCollectedAmount = otherCollections?.reduce(
        (sum: number, col: any) => sum + (col.collected_amount || 0),
        0
      ) || 0;

      const totalCollected = otherCollectedAmount + body.collected_amount;
      const remaining = salesTx.total_amount - totalCollected;

      // Validate that new amount doesn't exceed total
      if (remaining < 0) {
        return NextResponse.json(
          {
            success: false,
            error: `수금 금액이 잔액을 초과합니다. 최대 수금 가능 금액: ${salesTx.total_amount - otherCollectedAmount}원`
          },
          { status: 400 }
        );
      }

      // Determine new payment status
      if (remaining === 0) {
        newPaymentStatus = 'COMPLETED';
      } else if (remaining < salesTx.total_amount) {
        newPaymentStatus = 'PARTIAL';
      } else {
        newPaymentStatus = 'PENDING';
      }
    }

    // Update collection
    const { data: updatedCollection, error: updateError } = await (supabaseAdmin
      .from('collection_transactions') as any)
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('collection_id', collectionId)
      .select(`
        *,
        sales_transaction:sales_transactions!sales_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status
        ),
        customer:companies!customer_id(
          company_id,
          company_name,
          company_code
        )
      `)
      .single();

    if (updateError) {
      console.error('Collection update error:', updateError);
      return NextResponse.json(
        { success: false, error: updateError?.message || '수금 수정 실패' },
        { status: 500 }
      );
    }

    if (!updatedCollection) {
      return NextResponse.json(
        { success: false, error: '수금을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Update sales transaction status if needed
    if (needsStatusUpdate) {
      const { error: statusError } = await (supabaseAdmin
        .from('sales_transactions') as any)
        .update({
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', originalCollection.sales_transaction_id);

      if (statusError) {
        console.error('Sales transaction status update error:', statusError);
        // Continue anyway - collection is updated
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedCollection,
      message: needsStatusUpdate
        ? '수금이 수정되고 판매 거래 상태가 업데이트되었습니다'
        : '수금이 수정되었습니다'
    });
  } catch (error) {
    console.error('Collection update error:', error);
    return NextResponse.json(
      { success: false, error: '수금 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// DELETE: 수금 삭제 (soft delete)
export const DELETE = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '수금 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Get collection data for payment status recalculation
    const collectionId = parseInt(id);
    const { data: collection, error: fetchError } = await supabaseAdmin
      .from('collection_transactions')
      .select('sales_transaction_id, collected_amount')
      .eq('collection_id', collectionId)
      .single() as any;

    if (fetchError || !collection) {
      return NextResponse.json(
        { success: false, error: '수금을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Soft delete collection
    const { data, error } = await (supabaseAdmin
      .from('collection_transactions') as any)
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('collection_id', collectionId)
      .select()
      .single();

    if (error) {
      console.error('Collection delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: '수금을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Recalculate payment status for sales transaction
    const { data: salesTx } = await supabaseAdmin
      .from('sales_transactions')
      .select('total_amount')
      .eq('transaction_id', collection.sales_transaction_id)
      .single() as any;

    if (salesTx) {
      const { data: remainingCollections } = (await supabaseAdmin
        .from('collection_transactions')
        .select('collected_amount')
        .eq('sales_transaction_id', collection.sales_transaction_id)
        .eq('is_active', true)) as any;

      const totalCollected = remainingCollections?.reduce(
        (sum: number, col: any) => sum + (col.collected_amount || 0),
        0
      ) || 0;

      const remaining = salesTx.total_amount - totalCollected;

      let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED';
      if (remaining === 0 && totalCollected > 0) {
        newPaymentStatus = 'COMPLETED';
      } else if (remaining > 0 && totalCollected > 0) {
        newPaymentStatus = 'PARTIAL';
      } else {
        newPaymentStatus = 'PENDING';
      }

      await (supabaseAdmin
        .from('sales_transactions') as any)
        .update({
          payment_status: newPaymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', collection.sales_transaction_id);
    }

    return NextResponse.json({
      success: true,
      message: '수금이 삭제되고 판매 거래 상태가 업데이트되었습니다'
    });
  } catch (error) {
    console.error('Collection delete error:', error);
    return NextResponse.json(
      { success: false, error: '수금 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};
