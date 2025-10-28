import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import * as XLSX from 'xlsx';

const supabase = getSupabaseClient();

/**
 * GET /api/export/contracts
 * Export contracts to Excel with Korean headers
 * Zero formula errors (xlsx skill requirement)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Fetch contracts with company info
    let query = supabase
      .from('contracts')
      .select(`
        *,
        company:companies(company_name, company_code),
        documents:contract_documents(document_id)
      `)
      .order('contract_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: contracts, error } = await query;

    if (error) {
      console.error('Error fetching contracts:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: 내보내기 정보 (Metadata)
    const metadataSheet = XLSX.utils.aoa_to_sheet([
      ['계약 내보내기 정보', ''],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })],
      ['총 계약 수', contracts?.length || 0],
      ['필터 상태', status || '전체'],
      ['', ''],
      ['생성 시스템', '태창 ERP'],
      ['내보내기 버전', '1.0']
    ]);

    // Sheet 2: 통계 (Statistics)
    const totalAmount = contracts?.reduce((sum, c) => sum + (c.total_amount || 0), 0) || 0;
    const activeCount = contracts?.filter(c => c.status === 'ACTIVE').length || 0;
    const expiredCount = contracts?.filter(c => c.status === 'EXPIRED').length || 0;
    const terminatedCount = contracts?.filter(c => c.status === 'TERMINATED').length || 0;

    const statsSheet = XLSX.utils.aoa_to_sheet([
      ['통계 항목', '값'],
      ['총 계약 금액', totalAmount.toLocaleString('ko-KR')],
      ['평균 계약 금액', contracts?.length ? (totalAmount / contracts.length).toLocaleString('ko-KR') : '0'],
      ['활성 계약', activeCount],
      ['만료 계약', expiredCount],
      ['해지 계약', terminatedCount],
      ['', ''],
      ['총 문서 수', contracts?.reduce((sum, c) => sum + (c.documents?.length || 0), 0) || 0]
    ]);

    // Sheet 3: 계약 목록 (Contracts) with Korean headers
    const statusMapping: Record<string, string> = {
      'ACTIVE': '활성',
      'EXPIRED': '만료',
      'TERMINATED': '해지'
    };

    const koreanData = contracts?.map(row => ({
      '계약번호': row.contract_no || '',
      '거래처코드': row.company?.company_code || '',
      '거래처명': row.company?.company_name || '',
      '계약일': new Date(row.contract_date).toLocaleDateString('ko-KR'),
      '시작일': new Date(row.start_date).toLocaleDateString('ko-KR'),
      '종료일': new Date(row.end_date).toLocaleDateString('ko-KR'),
      '계약금액': row.total_amount || 0,
      '상태': statusMapping[row.status] || row.status,
      '첨부문서수': row.documents?.length || 0,
      '비고': row.notes || ''
    })) || [];

    const contractSheet = XLSX.utils.json_to_sheet(koreanData);

    // Apply xlsx skill: Currency formatting for 계약금액 column
    if (contractSheet['!ref']) {
      const range = XLSX.utils.decode_range(contractSheet['!ref']);
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        // Column G (계약금액) - 0-indexed column 6
        const amountCell = XLSX.utils.encode_cell({ r: R, c: 6 });
        if (contractSheet[amountCell] && typeof contractSheet[amountCell].v === 'number') {
          contractSheet[amountCell].z = '₩#,##0'; // Korean won formatting
        }
      }
    }

    // Set column widths
    contractSheet['!cols'] = [
      { wch: 15 }, // 계약번호
      { wch: 12 }, // 거래처코드
      { wch: 20 }, // 거래처명
      { wch: 12 }, // 계약일
      { wch: 12 }, // 시작일
      { wch: 12 }, // 종료일
      { wch: 15 }, // 계약금액
      { wch: 10 }, // 상태
      { wch: 12 }, // 첨부문서수
      { wch: 30 }  // 비고
    ];

    // Append sheets to workbook
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');
    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');
    XLSX.utils.book_append_sheet(workbook, contractSheet, '계약 목록');

    // Generate Excel file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const today = new Date().toISOString().split('T')[0];
    const filename = `계약목록_${today}.xlsx`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/export/contracts:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
