/**
 * 재무상태표 (Balance Sheet) API
 * GET /api/reports/balance-sheet
 *
 * Query Parameters:
 * - start_date: YYYY-MM-DD format (optional, defaults to current year start)
 * - end_date: YYYY-MM-DD format (optional, defaults to current date)
 *
 * Returns balance sheet data with assets, liabilities, and equity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, handleSupabaseError } from '@/lib/db-unified';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    console.log('[재무상태표] 조회 기간:', { 시작일: startDate, 종료일: endDate });

    const supabase = getSupabaseClient();

    // Use direct Supabase queries instead of RPC
    // 유동자산: 재고자산
    const { data: inventoryData, error: invError } = await supabase
      .from('items')
      .select('current_stock, price')
      .eq('is_active', true);

    if (invError) {
      const errorResponse = handleSupabaseError('select', 'items', invError);
      return NextResponse.json(errorResponse, { status: 500 }) as Response;
    }

    const inventoryValue = (inventoryData || []).reduce((sum: number, item: any) =>
      sum + (Number(item.current_stock || 0) * Number(item.price || 0)), 0
    );

    // 유동자산: 매출채권
    const { data: arData, error: arError } = await supabase
      .from('sales_transactions')
      .select('total_amount, collected_amount')
      .in('payment_status', ['PENDING', 'PARTIAL'])
      .eq('is_active', true);

    if (arError) {
      const errorResponse = handleSupabaseError('select', 'sales_transactions', arError);
      return NextResponse.json(errorResponse, { status: 500 }) as Response;
    }

    const accountsReceivable = (arData || []).reduce((sum: number, item: any) =>
      sum + (Number(item.total_amount || 0) - Number(item.collected_amount || 0)), 0
    );

    // 유동부채: 매입채무
    const { data: apData, error: apError } = await supabase
      .from('purchases' as any)
      .select('total_amount, paid_amount')
      .in('payment_status', ['PENDING', 'PARTIAL'])
      .eq('is_active', true);

    if (apError) {
      const errorResponse = handleSupabaseError('select', 'purchases', apError);
      return NextResponse.json(errorResponse, { status: 500 }) as Response;
    }

    const accountsPayable = (apData || []).reduce((sum: number, item: any) =>
      sum + (Number(item.total_amount || 0) - Number(item.paid_amount || 0)), 0
    );

    // 자본: 당기순이익 (연초부터 현재까지)
    const { data: salesData, error: salesError } = await supabase
      .from('sales_transactions')
      .select('total_amount')
      .gte('transaction_date', new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
      .eq('is_active', true);

    if (salesError) {
      const errorResponse = handleSupabaseError('select', 'sales_transactions', salesError);
      return NextResponse.json(errorResponse, { status: 500 }) as Response;
    }

    const totalSales = (salesData || []).reduce((sum: number, item: any) =>
      sum + Number(item.total_amount || 0), 0
    );

    const { data: purchasesData, error: purchasesError } = await supabase
      .from('purchases' as any)
      .select('total_amount')
      .gte('transaction_date', new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
      .eq('is_active', true);

    if (purchasesError) {
      const errorResponse = handleSupabaseError('select', 'purchases', purchasesError);
      return NextResponse.json(errorResponse, { status: 500 }) as Response;
    }

    const totalPurchases = (purchasesData || []).reduce((sum: number, item: any) =>
      sum + Number(item.total_amount || 0), 0
    );

    const netIncome = totalSales - totalPurchases;

    // Build response data
    const data = [
      {
        main_category: '자산',
        sub_category: '유동자산',
        account_name: '재고자산',
        account_code: 'INV001',
        current_amount: inventoryValue,
        prior_amount: 0,
        change_amount: inventoryValue,
        change_rate: 0,
        display_order: 1
      },
      {
        main_category: '자산',
        sub_category: '유동자산',
        account_name: '매출채권',
        account_code: 'AR001',
        current_amount: accountsReceivable,
        prior_amount: 0,
        change_amount: accountsReceivable,
        change_rate: 0,
        display_order: 2
      },
      {
        main_category: '부채',
        sub_category: '유동부채',
        account_name: '매입채무',
        account_code: 'AP001',
        current_amount: accountsPayable,
        prior_amount: 0,
        change_amount: accountsPayable,
        change_rate: 0,
        display_order: 3
      },
      {
        main_category: '자본',
        sub_category: '자본',
        account_name: '당기순이익',
        account_code: 'EQ001',
        current_amount: netIncome,
        prior_amount: 0,
        change_amount: netIncome,
        change_rate: 0,
        display_order: 4
      }
    ];

    // Group data by main category for better presentation
    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    // Process and group the data
    data.forEach((item: any) => {
      const formattedItem = {
        category: item.sub_category,
        account_name: item.account_name,
        account_code: item.account_code,
        current_period: Number(item.current_amount || 0),
        prior_period: Number(item.prior_amount || 0),
        change_amount: Number(item.change_amount || 0),
        change_rate: Number(item.change_rate || 0)
      };

      switch (item.main_category) {
        case '자산':
          assets.push(formattedItem);
          totalAssets += formattedItem.current_period;
          break;
        case '부채':
          liabilities.push(formattedItem);
          totalLiabilities += formattedItem.current_period;
          break;
        case '자본':
          equity.push(formattedItem);
          totalEquity += formattedItem.current_period;
          break;
      }
    });

    // Validate balance sheet equation: Assets = Liabilities + Equity
    const balanceCheck = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

    const response = {
      success: true,
      data: {
        자산: assets,
        부채: liabilities,
        자본: equity,
        summary: {
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
          total_equity: totalEquity,
          balance_check: balanceCheck
        }
      }
    };

    console.log('[재무상태표] 생성 완료');
    return NextResponse.json(response);

  } catch (error) {
    console.error('[재무상태표] API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '재무상태표 생성 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
