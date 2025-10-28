/**
 * 현금흐름표 (Cash Flow Statement) API
 * GET /api/reports/cash-flow
 *
 * Query Parameters:
 * - start_date: YYYY-MM-DD format (optional, defaults to current month start)
 * - end_date: YYYY-MM-DD format (optional, defaults to current date)
 *
 * Returns cash flow data categorized by operating, investing, and financing activities
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, handleSupabaseError } from '@/lib/db-unified';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    console.log('[현금흐름표] 조회 기간:', { 시작일: startDate, 종료일: endDate });

    const supabase = getSupabaseClient();

    // Use direct Supabase queries instead of RPC
    // 영업활동: 매출로 인한 현금유입
    const { data: collectionsData, error: collectionsError } = await supabase
      .from('collections')
      .select('collected_amount')
      .gte('collected_date', startDate)
      .lte('collected_date', endDate)
      .eq('is_active', true);

    if (collectionsError) {
      const errorResponse = handleSupabaseError('select', 'collections', collectionsError);
      return NextResponse.json(errorResponse, { status: 500 }) as Response;
    }

    const totalCollections = (collectionsData || []).reduce((sum: number, item: any) =>
      sum + Number(item.collected_amount || 0), 0
    );

    // 영업활동: 매입으로 인한 현금유출
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('paid_amount')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .eq('is_active', true);

    if (paymentsError) {
      const errorResponse = handleSupabaseError('select', 'payments', paymentsError);
      return NextResponse.json(errorResponse, { status: 500 }) as Response;
    }

    const totalPayments = (paymentsData || []).reduce((sum: number, item: any) =>
      sum + Number(item.paid_amount || 0), 0
    );

    // Build response data
    const data = [
      {
        main_category: '영업활동',
        sub_category: '매출수금',
        activity_name: '매출로 인한 현금유입',
        current_month: totalCollections,
        year_to_date: 0,
        category_month_total: totalCollections - totalPayments,
        category_year_total: 0,
        display_order: 1
      },
      {
        main_category: '영업활동',
        sub_category: '매입지급',
        activity_name: '매입으로 인한 현금유출',
        current_month: -totalPayments,
        year_to_date: 0,
        category_month_total: totalCollections - totalPayments,
        category_year_total: 0,
        display_order: 2
      },
      {
        main_category: '투자활동',
        sub_category: '자산취득',
        activity_name: '고정자산 취득',
        current_month: 0,
        year_to_date: 0,
        category_month_total: 0,
        category_year_total: 0,
        display_order: 3
      },
      {
        main_category: '재무활동',
        sub_category: '차입금',
        activity_name: '차입금 증가',
        current_month: 0,
        year_to_date: 0,
        category_month_total: 0,
        category_year_total: 0,
        display_order: 4
      }
    ];

    // Group data by main category
    const groupedData = {
      영업활동: {
        항목: [] as any[],
        소계: 0
      },
      투자활동: {
        항목: [] as any[],
        소계: 0
      },
      재무활동: {
        항목: [] as any[],
        소계: 0
      }
    };

    // Process and group the data with Korean accounting format
    data.forEach((item: any) => {
      const formattedItem = {
        활동명: item.activity_name,
        금액: Number(item.current_month || 0)
      };

      const category = item.main_category as '영업활동' | '투자활동' | '재무활동';
      if (groupedData[category]) {
        groupedData[category].항목.push(formattedItem);
        groupedData[category].소계 = Number(item.category_month_total || 0);
      }
    });

    // Calculate net cash flow
    const netCashFlow = groupedData.영업활동.소계 +
                       groupedData.투자활동.소계 +
                       groupedData.재무활동.소계;

    // Get beginning and ending cash balance (placeholder - would need actual data)
    const beginningCashBalance = 0; // Would be retrieved from historical data
    const endingCashBalance = beginningCashBalance + netCashFlow;

    const response = {
      success: true,
      data: {
        보고일자: endDate,
        조회기간: {
          시작일: startDate,
          종료일: endDate
        },
        영업활동: groupedData.영업활동,
        투자활동: groupedData.투자활동,
        재무활동: groupedData.재무활동,
        요약: {
          현금증감: netCashFlow,
          기초현금: beginningCashBalance,
          기말현금: endingCashBalance,
          현금유입합계: Math.max(0, groupedData.영업활동.소계) +
                      Math.max(0, groupedData.투자활동.소계) +
                      Math.max(0, groupedData.재무활동.소계),
          현금유출합계: Math.abs(Math.min(0, groupedData.영업활동.소계)) +
                      Math.abs(Math.min(0, groupedData.투자활동.소계)) +
                      Math.abs(Math.min(0, groupedData.재무활동.소계))
        }
      }
    };

    console.log('[현금흐름표] 생성 완료');
    return NextResponse.json(response);

  } catch (error) {
    console.error('[현금흐름표] API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '현금흐름표 생성 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
