import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    // 총 미지급금 계산 (매입 거래 중 미지급금)
    const { data: outstandingPurchases, error: purchasesError } = await supabaseAdmin
      .from('purchase_transactions')
      .select('total_amount, paid_amount, transaction_date')
      .in('payment_status', ['PENDING', 'PARTIAL']);

    if (purchasesError) throw purchasesError;

    const totalOutstanding = outstandingPurchases?.reduce((sum, tx) => {
      return sum + (tx.total_amount - (tx.paid_amount || 0));
    }, 0) || 0;

    // 30일 이상 미처리 건수
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const overdueCount = outstandingPurchases?.filter(tx => {
      const txDate = new Date(tx.transaction_date);
      return txDate < thirtyDaysAgo;
    }).length || 0;

    // 이번주 처리 예정 금액 (임의로 계산)
    const thisWeekAmount = totalOutstanding * 0.3; // 예시: 전체의 30%

    // 평균 지연일수 계산
    const avgDaysOverdue = outstandingPurchases?.reduce((sum, tx) => {
      const txDate = new Date(tx.transaction_date);
      const daysDiff = Math.floor((Date.now() - txDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + Math.max(0, daysDiff);
    }, 0) / (outstandingPurchases?.length || 1) || 0;

    return NextResponse.json({
      success: true,
      data: {
        totalOutstanding: Math.round(totalOutstanding),
        overdueCount,
        thisWeekAmount: Math.round(thisWeekAmount),
        avgDaysOverdue: Math.round(avgDaysOverdue)
      }
    });
  } catch (error) {
    console.error('Error fetching payments summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments summary' },
      { status: 500 }
    );
  }
}
