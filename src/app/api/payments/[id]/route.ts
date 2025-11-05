import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

// 지급 수정 스키마
const PaymentUpdateSchema = z.object({
  paid_amount: z.number().positive('지급 금액은 0보다 커야 합니다').optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식: YYYY-MM-DD').optional(),
  payment_method: z.enum(['CASH', 'TRANSFER', 'CHECK', 'CARD']).optional(),
  notes: z.string().optional()
});

// GET: 특정 지급 조회
export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '지급 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Fetch payment with joins
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        purchase_transaction:purchase_transactions!purchase_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status
        ),
        supplier:companies!supplier_id(
          company_id,
          company_name,
          company_code
        )
      `)
      .eq('payment_id', parseInt(id, 10))
      .single() as any;

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: '지급을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Payment get error:', error);
    return NextResponse.json(
      { success: false, error: '지급 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// PUT: 지급 수정 (금액, 날짜, 메모만)
export const PUT = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '지급 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Korean encoding
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate update data
    const result = PaymentUpdateSchema.safeParse(body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: any) => err.message).join(', ');
      return NextResponse.json(
        { success: false, error: errorMessages || '입력 데이터가 유효하지 않습니다' },
        { status: 400 }
      );
    }

    // Get original payment data
    const { data: originalPayment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('payment_id, purchase_transaction_id, paid_amount')
      .eq('payment_id', parseInt(id, 10))
      .eq('is_active', true)
      .single() as any;

    if (fetchError || !originalPayment) {
      return NextResponse.json(
        { success: false, error: '지급을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // If amount is being changed, recalculate payment status
    let needsStatusUpdate = false;
    let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE' = 'PENDING';

    if (body.paid_amount !== undefined && body.paid_amount !== originalPayment.paid_amount) {
      needsStatusUpdate = true;

      // Get purchase transaction details
      const { data: purchaseTx, error: purchaseError } = await supabaseAdmin
        .from('purchase_transactions')
        .select('total_amount')
        .eq('transaction_id', originalPayment.purchase_transaction_id)
        .single() as any;

      if (purchaseError || !purchaseTx) {
        return NextResponse.json(
          { success: false, error: '매입 거래를 찾을 수 없습니다' },
          { status: 400 }
        );
      }

      // Calculate total paid (excluding current payment)
      const { data: otherPayments } = await supabaseAdmin
        .from('payments')
        .select('paid_amount')
        .eq('purchase_transaction_id', originalPayment.purchase_transaction_id)
        .eq('is_active', true)
        .neq('payment_id', parseInt(id, 10));

      const otherPaidAmount = otherPayments?.reduce(
        (sum, payment) => sum + (payment.paid_amount || 0),
        0
      ) || 0;

      const totalPaid = otherPaidAmount + body.paid_amount;
      const remaining = purchaseTx.total_amount - totalPaid;

      // Validate that new amount doesn't exceed total
      if (remaining < 0) {
        return NextResponse.json(
          {
            success: false,
            error: `지급 금액이 잔액을 초과합니다. 최대 지급 가능 금액: ${purchaseTx.total_amount - otherPaidAmount}원`
          },
          { status: 400 }
        );
      }

      // Determine new payment status
      if (remaining === 0) {
        newPaymentStatus = 'COMPLETE';
      } else if (remaining < purchaseTx.total_amount) {
        newPaymentStatus = 'PARTIAL';
      } else {
        newPaymentStatus = 'PENDING';
      }
    }

    // Update payment
    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', parseInt(id, 10))
      .select(`
        *,
        purchase_transaction:purchase_transactions!purchase_transaction_id(
          transaction_id,
          transaction_no,
          transaction_date,
          total_amount,
          payment_status
        ),
        supplier:companies!supplier_id(
          company_id,
          company_name,
          company_code
        )
      `)
      .single() as any;

    if (updateError) {
      console.error('Payment update error:', updateError);
      return NextResponse.json(
        { success: false, error: updateError?.message || '지급 수정 실패' },
        { status: 500 }
      );
    }

    if (!updatedPayment) {
      return NextResponse.json(
        { success: false, error: '지급을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Update purchase transaction status if needed
    if (needsStatusUpdate) {
      // Calculate new paid_amount for purchase transaction
      const { data: allPayments } = await supabaseAdmin
        .from('payments')
        .select('paid_amount')
        .eq('purchase_transaction_id', originalPayment.purchase_transaction_id)
        .eq('is_active', true);

      const newTotalPaid = allPayments?.reduce(
        (sum, payment) => sum + (payment.paid_amount || 0),
        0
      ) || 0;

      const { error: statusError } = await supabaseAdmin
        .from('purchase_transactions')
        .update({
          payment_status: newPaymentStatus,
          paid_amount: newTotalPaid,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', originalPayment.purchase_transaction_id);

      if (statusError) {
        console.error('Purchase transaction status update error:', statusError);
        // Continue anyway - payment is updated
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedPayment,
      message: needsStatusUpdate
        ? '지급이 수정되고 매입 거래 상태가 업데이트되었습니다'
        : '지급이 수정되었습니다'
    });
  } catch (error) {
    console.error('Payment update error:', error);
    return NextResponse.json(
      { success: false, error: '지급 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};

// DELETE: 지급 삭제 (soft delete)
export const DELETE = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '지급 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Get payment data for payment status recalculation
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('purchase_transaction_id, paid_amount')
      .eq('payment_id', parseInt(id, 10))
      .single() as any;

    if (fetchError || !payment) {
      return NextResponse.json(
        { success: false, error: '지급을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Soft delete payment
    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', parseInt(id, 10))
      .select()
      .single() as any;

    if (error) {
      console.error('Payment delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: '지급을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Recalculate payment status for purchase transaction
    const { data: purchaseTx } = await supabaseAdmin
      .from('purchase_transactions')
      .select('total_amount')
      .eq('transaction_id', payment.purchase_transaction_id)
      .single() as any;

    if (purchaseTx) {
      const { data: remainingPayments } = await supabaseAdmin
        .from('payments')
        .select('paid_amount')
        .eq('purchase_transaction_id', payment.purchase_transaction_id)
        .eq('is_active', true);

      const totalPaid = remainingPayments?.reduce(
        (sum, payment) => sum + (payment.paid_amount || 0),
        0
      ) || 0;

      const remaining = purchaseTx.total_amount - totalPaid;

      let newPaymentStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE';
      if (remaining === 0 && totalPaid > 0) {
        newPaymentStatus = 'COMPLETE';
      } else if (remaining > 0 && totalPaid > 0) {
        newPaymentStatus = 'PARTIAL';
      } else {
        newPaymentStatus = 'PENDING';
      }

      await supabaseAdmin
        .from('purchase_transactions')
        .update({
          payment_status: newPaymentStatus,
          paid_amount: totalPaid,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', payment.purchase_transaction_id);
    }

    return NextResponse.json({
      success: true,
      message: '지급이 삭제되고 매입 거래 상태가 업데이트되었습니다'
    });
  } catch (error) {
    console.error('Payment delete error:', error);
    return NextResponse.json(
      { success: false, error: '지급 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
};
