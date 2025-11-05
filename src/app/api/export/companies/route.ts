import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build safe query using Supabase client
    let query = supabase
      .from('companies')
      .select(`
        company_id,
        company_name,
        company_type,
        business_number,
        representative,
        phone,
        fax,
        email,
        address,
        payment_terms,
        description,
        is_active,
        created_at,
        updated_at
      `)
      .eq('is_active', true);

    // Apply filters safely
    if (type) {
      // Support both Korean and English types
      if (type === 'CUSTOMER' || type === '고객사') {
        query = query.in('company_type', ['CUSTOMER', '고객사']);
      } else if (type === 'SUPPLIER' || type === '공급사') {
        query = query.in('company_type', ['SUPPLIER', '공급사']);
      } else {
        query = query.eq('company_type', type);
      }
    }

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,representative.ilike.%${search}%,business_number.ilike.%${search}%`);
    }

    // Apply ordering
    query = query.order('company_name', { ascending: true });

    const { data: companies, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Transform data to match expected format for Excel export
    const formattedCompanies = companies?.map((company: any) => ({
      "회사ID": company.company_id,
      "회사명": company.company_name,
      "회사구분": company.company_type === 'CUSTOMER' || company.company_type === '고객사' ? '고객사' :
                 company.company_type === 'SUPPLIER' || company.company_type === '공급사' ? '공급사' : company.company_type,
      "사업자번호": company.business_number,
      "대표자": company.representative,
      "전화번호": company.phone,
      "팩스": company.fax,
      "이메일": company.email,
      "주소": company.address,
      "결제조건": company.payment_terms,
      "비고": company.description,
      "상태": company.is_active ? '활성' : '비활성',
      "등록일시": new Date(company.created_at).toLocaleString('ko-KR'),
      "수정일시": new Date(company.updated_at).toLocaleString('ko-KR')
    })) || [];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(formattedCompanies);

    // Set column widths for better formatting
    const columnWidths = [
      { wch: 10 }, // 회사ID
      { wch: 25 }, // 회사명
      { wch: 10 }, // 회사구분
      { wch: 15 }, // 사업자번호
      { wch: 15 }, // 대표자
      { wch: 15 }, // 전화번호
      { wch: 15 }, // 팩스
      { wch: 25 }, // 이메일
      { wch: 30 }, // 주소
      { wch: 15 }, // 결제조건
      { wch: 25 }, // 비고
      { wch: 10 }, // 상태
      { wch: 18 }, // 등록일시
      { wch: 18 }  // 수정일시
    ];
    worksheet['!cols'] = columnWidths;

    // Add metadata sheet
    const metadataRows = [
      ['내보내기 정보', ''],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
      ['총 회사 수', companies.length],
      ['필터', ''],
      ['회사구분', type || '전체'],
      ['검색어', search || '없음'],
      ['', ''],
      ['태창 ERP 시스템', '회사 목록 내보내기']
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    metadataSheet['!cols'] = [{ wch: 15 }, { wch: 25 }];

    // Add summary statistics (use original companies data for filtering)
    const customerCount = companies.filter((c: any) => 
      c.company_type === 'CUSTOMER' || c.company_type === '고객사'
    ).length;
    const supplierCount = companies.filter((c: any) => 
      c.company_type === 'SUPPLIER' || c.company_type === '공급사'
    ).length;

    const statsRows = [
      ['통계 정보', ''],
      ['총 회사 수', companies.length],
      ['고객사 수', customerCount],
      ['공급사 수', supplierCount],
      ['기타', companies.length - customerCount - supplierCount],
      ['', ''],
      ['활성 회사', companies.filter((c: any) => c.is_active).length],
      ['비활성 회사', companies.filter((c: any) => !c.is_active).length]
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsRows);
    statsSheet['!cols'] = [{ wch: 15 }, { wch: 15 }];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');
    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');
    XLSX.utils.book_append_sheet(workbook, worksheet, '회사 목록');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    // Create filename with current date
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `회사목록_${currentDate}.xlsx`;

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
    console.error('Error exporting companies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export companies to Excel'
      },
      { status: 500 }
    );
  }
}