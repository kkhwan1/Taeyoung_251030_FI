import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const category = searchParams.get('category');

    const supabase = getSupabaseClient();

    // Query v_monthly_accounting VIEW using Supabase client
    let companyQuery = supabase
      .from('v_monthly_accounting')
      .select('*')
      .eq('month', month)
      .order('net_amount', { ascending: false });

    if (category) {
      companyQuery = companyQuery.eq('company_category', category);
    }

    const { data: companyData, error: companyError } = await companyQuery;

    if (companyError) {
      throw new Error(`Company data query failed: ${companyError.message}`);
    }

    // Query v_category_monthly_summary VIEW for stats
    const { data: categoryData, error: categoryError } = await supabase
      .from('v_category_monthly_summary')
      .select('*')
      .eq('month', month)
      .order('company_category', { ascending: true });

    if (categoryError) {
      throw new Error(`Category data query failed: ${categoryError.message}`);
    }

    // Calculate total statistics
    const totalSales = companyData.reduce((sum: number, row: any) => sum + (row.sales_amount || 0), 0);
    const totalPurchases = companyData.reduce((sum: number, row: any) => sum + (row.purchase_amount || 0), 0);
    const netAmount = totalSales - totalPurchases;
    const totalCompanies = new Set(companyData.map((row: any) => row.company_code)).size;

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Metadata (내보내기 정보)
    const metadataRows = [
      ['내보내기 정보', ''],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
      ['조회 월', month],
      ['필터 분류', category || '전체'],
      ['총 레코드 수', companyData.length],
      ['', ''],
      ['태창 ERP 시스템', '월별 회계 집계 내보내기']
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    metadataSheet['!cols'] = [{ wch: 15 }, { wch: 30 }];

    // Sheet 2: Statistics (통계)
    const statsRows = [
      ['통계 항목', '값'],
      ['총 매출', `₩${totalSales.toLocaleString('ko-KR')}`],
      ['총 매입', `₩${totalPurchases.toLocaleString('ko-KR')}`],
      ['순이익', `₩${netAmount.toLocaleString('ko-KR')}`],
      ['거래처 수', `${totalCompanies}개`],
      ['', ''],
      ['분류별 집계', ''],
    ];

    // Add category breakdown to stats
    categoryData.forEach((cat: any) => {
      const categoryNet = cat.total_sales - cat.total_purchases;
      statsRows.push([
        cat.company_category,
        `매출: ₩${cat.total_sales.toLocaleString('ko-KR')} | 매입: ₩${cat.total_purchases.toLocaleString('ko-KR')} | 순: ₩${categoryNet.toLocaleString('ko-KR')}`
      ]);
    });

    statsRows.push(['', '']);
    statsRows.push(['평균 거래액', totalCompanies > 0 ? `₩${Math.round(netAmount / totalCompanies).toLocaleString('ko-KR')}` : '₩0']);

    const statsSheet = XLSX.utils.aoa_to_sheet(statsRows);
    statsSheet['!cols'] = [{ wch: 20 }, { wch: 60 }];

    // Sheet 3: Data (월별 회계 내역) with Korean headers
    const koreanData = companyData.map((row: any) => {
      // Parse business_info JSONB field
      let businessType = '';
      let businessItem = '';

      if (row.business_info) {
        try {
          const info = typeof row.business_info === 'string'
            ? JSON.parse(row.business_info)
            : row.business_info;
          businessType = info.business_type || '';
          businessItem = info.business_item || '';
        } catch (e) {
          // If parsing fails, leave empty
          console.warn('Failed to parse business_info:', e);
        }
      }

      return {
        '월': row.month,
        '거래처분류': row.company_category || '',
        '거래처명': row.company_name || '',
        '거래처코드': row.company_code || '',
        '업태': businessType,
        '종목': businessItem,
        '매출액': row.sales_amount || 0,
        '매입액': row.purchase_amount || 0,
        '순이익': row.net_amount || 0
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(koreanData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 10 },  // 월
      { wch: 18 },  // 거래처분류
      { wch: 25 },  // 거래처명
      { wch: 15 },  // 거래처코드
      { wch: 15 },  // 업태
      { wch: 15 },  // 종목
      { wch: 18 },  // 매출액
      { wch: 18 },  // 매입액
      { wch: 18 }   // 순이익
    ];

    // Append sheets to workbook
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');
    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');
    XLSX.utils.book_append_sheet(workbook, worksheet, '월별 회계 내역');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    // Create filename with current date
    const filename = `월별회계집계_${month}${category ? `_${category}` : ''}.xlsx`;

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': excelBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Error exporting accounting data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export accounting data to Excel'
      },
      { status: 500 }
    );
  }
}
