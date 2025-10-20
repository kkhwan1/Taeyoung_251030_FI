/**
 * API #1: GET /api/accounting/monthly-summary
 *
 * Monthly accounting summary aggregated by company and category
 *
 * Query Parameters:
 * - month: Target month in YYYY-MM format (default: current month)
 * - category: Optional filter by company category
 *
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     month: "2025-01",
 *     summary: {
 *       total_sales: number,
 *       total_purchases: number,
 *       net_amount: number,
 *       company_count: number,
 *       categories: { [category]: { sales, purchases, count } }
 *     },
 *     by_category: CategoryMonthlySummary[],
 *     by_company: MonthlyAccounting[]
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { handleError, createSuccessResponse } from '@/lib/errorHandler';
import { getCurrentMonth } from '@/types/accounting.types';
import type { MonthlyAccounting, CategoryMonthlySummary } from '@/types/accounting.types';

/**
 * GET /api/accounting/monthly-summary
 * Retrieve monthly accounting summary with category and company breakdowns
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month') || getCurrentMonth();
    const category = searchParams.get('category');

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({
        success: false,
        error: '월 형식이 올바르지 않습니다. YYYY-MM 형식을 사용해주세요.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Date range for the month - calculate correct last day
    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Fetch sales transactions for the month
    const salesQuery = supabase
      .from('sales_transactions')
      .select(`
        transaction_id,
        transaction_date,
        customer_id,
        total_amount,
        companies!customer_id (
          company_id,
          company_name,
          company_code,
          company_category,
          business_info,
          business_number,
          representative
        )
      `)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .eq('is_active', true);

    // Fetch purchase transactions for the month
    const purchasesQuery = supabase
      .from('purchase_transactions')
      .select(`
        transaction_id,
        transaction_date,
        supplier_id,
        total_amount,
        companies!supplier_id (
          company_id,
          company_name,
          company_code,
          company_category,
          business_info,
          business_number,
          representative
        )
      `)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .eq('is_active', true);

    const [salesResult, purchasesResult] = await Promise.all([
      salesQuery,
      purchasesQuery
    ]);

    if (salesResult.error) {
      throw new Error(`Sales query failed: ${salesResult.error.message}`);
    }

    if (purchasesResult.error) {
      throw new Error(`Purchases query failed: ${purchasesResult.error.message}`);
    }

    const salesData = salesResult.data || [];
    const purchasesData = purchasesResult.data || [];

    // Aggregate by company
    const companyMap = new Map<number, any>();

    // Process sales
    salesData.forEach((sale: any) => {
      if (!sale.companies) return;
      
      const companyId = sale.companies.company_id;
      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, {
          month,
          company_id: companyId,
          company_code: sale.companies.company_code,
          company_name: sale.companies.company_name,
          company_category: sale.companies.company_category || '기타',
          business_info: sale.companies.business_info,
          business_number: sale.companies.business_number,
          representative: sale.companies.representative,
          sales_amount: 0,
          sales_count: 0,
          purchase_amount: 0,
          purchase_count: 0,
          net_amount: 0
        });
      }
      
      const company = companyMap.get(companyId);
      company.sales_amount += sale.total_amount || 0;
      company.sales_count += 1;
    });

    // Process purchases
    purchasesData.forEach((purchase: any) => {
      if (!purchase.companies) return;
      
      const companyId = purchase.companies.company_id;
      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, {
          month,
          company_id: companyId,
          company_code: purchase.companies.company_code,
          company_name: purchase.companies.company_name,
          company_category: purchase.companies.company_category || '기타',
          business_info: purchase.companies.business_info,
          business_number: purchase.companies.business_number,
          representative: purchase.companies.representative,
          sales_amount: 0,
          sales_count: 0,
          purchase_amount: 0,
          purchase_count: 0,
          net_amount: 0
        });
      }
      
      const company = companyMap.get(companyId);
      company.purchase_amount += purchase.total_amount || 0;
      company.purchase_count += 1;
    });

    // Calculate net amounts
    companyMap.forEach((company) => {
      company.net_amount = company.sales_amount - company.purchase_amount;
    });

    // Filter by category if specified
    let companyData = Array.from(companyMap.values());
    if (category) {
      companyData = companyData.filter(c => c.company_category === category);
    }

    // Sort by net amount
    companyData.sort((a, b) => b.net_amount - a.net_amount);

    // Aggregate by category
    const categoryMap = new Map<string, any>();
    
    companyData.forEach((company) => {
      const cat = company.company_category;
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          month,
          company_category: cat,
          total_sales: 0,
          total_sales_transactions: 0,
          total_purchases: 0,
          total_purchase_transactions: 0,
          net_amount: 0,
          company_count: 0,
          avg_sales_per_company: 0,
          avg_purchase_per_company: 0,
          sales_percentage: 0,
          purchase_percentage: 0
        });
      }
      
      const category = categoryMap.get(cat);
      category.total_sales += company.sales_amount;
      category.total_sales_transactions += company.sales_count;
      category.total_purchases += company.purchase_amount;
      category.total_purchase_transactions += company.purchase_count;
      category.net_amount += company.net_amount;
      category.company_count += 1;
    });

    // Calculate averages and percentages
    const totalSales = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.total_sales, 0);
    const totalPurchases = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.total_purchases, 0);

    categoryMap.forEach((category) => {
      category.avg_sales_per_company = category.company_count > 0 
        ? category.total_sales / category.company_count 
        : 0;
      category.avg_purchase_per_company = category.company_count > 0 
        ? category.total_purchases / category.company_count 
        : 0;
      category.sales_percentage = totalSales > 0 
        ? (category.total_sales / totalSales) * 100 
        : 0;
      category.purchase_percentage = totalPurchases > 0 
        ? (category.total_purchases / totalPurchases) * 100 
        : 0;
    });

    const categoryData = Array.from(categoryMap.values());
    categoryData.sort((a, b) => b.total_sales - a.total_sales);

    // Calculate overall summary
    const summary = {
      total_sales: categoryData.reduce((sum, cat) => sum + (cat.total_sales || 0), 0),
      total_purchases: categoryData.reduce((sum, cat) => sum + (cat.total_purchases || 0), 0),
      net_amount: categoryData.reduce((sum, cat) => sum + (cat.net_amount || 0), 0),
      company_count: categoryData.reduce((sum, cat) => sum + (cat.company_count || 0), 0),
      categories: categoryData.reduce((acc, cat) => {
        acc[cat.company_category] = {
          sales: cat.total_sales,
          purchases: cat.total_purchases,
          net_amount: cat.net_amount,
          count: cat.company_count,
          avg_sales: cat.avg_sales_per_company,
          avg_purchases: cat.avg_purchase_per_company,
          sales_percentage: cat.sales_percentage,
          purchase_percentage: cat.purchase_percentage
        };
        return acc;
      }, {} as Record<string, any>)
    };

    // Return response
    return createSuccessResponse({
      month,
      summary,
      by_category: categoryData,
      by_company: companyData
    });

  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    return handleError(error, {
      resource: 'accounting/monthly-summary',
      action: 'read'
    });
  }
}
