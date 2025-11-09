/**
 * API #2: GET /api/companies/[id]/stats
 *
 * Get monthly statistics for a specific company
 *
 * URL Parameters:
 * - id: Company ID (UUID)
 *
 * Query Parameters:
 * - months: Number of months to retrieve (default: 12)
 *
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     company: {
 *       company_id: string,
 *       company_name: string,
 *       company_category: string,
 *       business_info: BusinessInfo
 *     },
 *     monthly_data: MonthlyAccounting[],
 *     summary: {
 *       total_sales: number,
 *       total_purchases: number,
 *       net_amount: number,
 *       average_monthly_sales: number,
 *       average_monthly_purchases: number
 *     }
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { handleError, createSuccessResponse, handleNotFoundError } from '@/lib/errorHandler';
import type { MonthlyAccounting, BusinessInfo } from '@/types/accounting.types';

export const dynamic = 'force-dynamic';


/**
 * GET /api/companies/[id]/stats
 * Retrieve monthly statistics for a specific company
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const companyId = parseInt(id);
    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '12');

    // Validate months parameter
    if (months < 1 || months > 60) {
      return NextResponse.json({
        success: false,
        error: '월 수는 1~60 사이의 값이어야 합니다.'
      }, { status: 400 });
    }

    // First, verify company exists and get basic info
    const supabase = getSupabaseClient();
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('company_id, company_name, company_category, business_info, business_number, representative, is_active')
      .eq('company_id', companyId)
      .single() as any;

    if (companyError || !company) {
      return handleNotFoundError('회사', id);
    }

    // Build SQL query for monthly data
    // Get last N months of data for this company
    const sql = `
      SELECT
        month,
        company_id,
        company_code,
        company_name,
        company_category,
        business_info,
        business_number,
        representative,
        sales_amount,
        sales_count,
        purchase_amount,
        purchase_count,
        net_amount
      FROM v_monthly_accounting
      WHERE company_id = '${id}'
      ORDER BY month DESC
      LIMIT ${months}
    `;

    // Execute query using Supabase RPC
    const result = (await supabase.rpc('execute_sql' as any, {
      query_text: sql,
      params: null
    } as any)) as any;

    if (result.error) {
      throw new Error(`Query failed: ${result.error.message}`);
    }

    // Parse results
    const monthlyData = (Array.isArray(result.data) ? result.data : []) as MonthlyAccounting[];

    // Calculate summary statistics
    const summary = {
      total_sales: monthlyData.reduce((sum, month) => sum + (month.sales_amount || 0), 0),
      total_purchases: monthlyData.reduce((sum, month) => sum + (month.purchase_amount || 0), 0),
      net_amount: monthlyData.reduce((sum, month) => sum + (month.net_amount || 0), 0),
      average_monthly_sales: monthlyData.length > 0
        ? monthlyData.reduce((sum, month) => sum + (month.sales_amount || 0), 0) / monthlyData.length
        : 0,
      average_monthly_purchases: monthlyData.length > 0
        ? monthlyData.reduce((sum, month) => sum + (month.purchase_amount || 0), 0) / monthlyData.length
        : 0,
      months_with_data: monthlyData.length,
      total_sales_transactions: monthlyData.reduce((sum, month) => sum + (month.sales_count || 0), 0),
      total_purchase_transactions: monthlyData.reduce((sum, month) => sum + (month.purchase_count || 0), 0)
    };

    // Return response
    return createSuccessResponse({
      company: {
        company_id: company.company_id,
        company_name: company.company_name,
        company_category: company.company_category,
        business_info: company.business_info as BusinessInfo,
        business_number: company.business_number,
        representative: company.representative,
        is_active: company.is_active
      },
      monthly_data: monthlyData,
      summary
    });

  } catch (error) {
    console.error('Error fetching company stats:', error);
    return handleError(error, {
      resource: 'companies/stats',
      action: 'read'
    });
  }
}
