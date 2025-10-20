import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const payment_method = searchParams.get('payment_method');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query with joins
    let query = supabase
      .from('collection_transactions')
      .select(`
        collection_id,
        collection_no,
        collection_date,
        collected_amount,
        payment_method,
        bank_name,
        account_number,
        check_number,
        card_number,
        notes,
        is_active,
        created_at,
        updated_at,
        sales_transaction:sales_transactions!sales_transaction_id(
          transaction_no,
          transaction_date,
          total_amount,
          payment_status
        ),
        customer:companies!customer_id(
          company_name,
          company_code,
          business_number
        )
      `)
      .eq('is_active', true);

    // Apply filters
    if (start_date) {
      query = query.gte('collection_date', start_date);
    }

    if (end_date) {
      query = query.lte('collection_date', end_date);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    if (search) {
      query = query.or(`collection_no.ilike.%${search}%`);
    }

    // Apply ordering
    query = query.order('collection_date', { ascending: false });

    const { data: collections, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Transform data with Korean headers
    const formattedCollections = collections?.map((collection: any) => ({
      "수금ID": collection.collection_id,
      "수금번호": collection.collection_no,
      "수금일자": collection.collection_date,
      "매출번호": collection.sales_transaction?.transaction_no || '',
      "매출일자": collection.sales_transaction?.transaction_date || '',
      "고객사명": collection.customer?.company_name || '',
      "사업자번호": collection.customer?.business_number || '',
      "수금금액": collection.collected_amount,
      "결제방법": collection.payment_method === 'CASH' ? '현금' :
                   collection.payment_method === 'TRANSFER' ? '계좌이체' :
                   collection.payment_method === 'CHECK' ? '수표' :
                   collection.payment_method === 'CARD' ? '카드' : collection.payment_method,
      "은행명": collection.bank_name || '',
      "계좌번호": collection.account_number || '',
      "수표번호": collection.check_number || '',
      "카드번호": collection.card_number || '',
      "비고": collection.notes || '',
      "매출금액": collection.sales_transaction?.total_amount || 0,
      "수금상태": collection.sales_transaction?.payment_status === 'PENDING' ? '미수금' :
                 collection.sales_transaction?.payment_status === 'PARTIAL' ? '부분수금' :
                 collection.sales_transaction?.payment_status === 'COMPLETED' ? '완료' : '',
      "등록일시": new Date(collection.created_at).toLocaleString('ko-KR'),
      "수정일시": new Date(collection.updated_at).toLocaleString('ko-KR')
    })) || [];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(formattedCollections);

    // Set column widths
    const columnWidths = [
      { wch: 10 }, // 수금ID
      { wch: 15 }, // 수금번호
      { wch: 12 }, // 수금일자
      { wch: 15 }, // 매출번호
      { wch: 12 }, // 매출일자
      { wch: 20 }, // 고객사명
      { wch: 15 }, // 사업자번호
      { wch: 15 }, // 수금금액
      { wch: 12 }, // 결제방법
      { wch: 15 }, // 은행명
      { wch: 20 }, // 계좌번호
      { wch: 15 }, // 수표번호
      { wch: 20 }, // 카드번호
      { wch: 25 }, // 비고
      { wch: 15 }, // 매출금액
      { wch: 12 }, // 수금상태
      { wch: 18 }, // 등록일시
      { wch: 18 }  // 수정일시
    ];
    worksheet['!cols'] = columnWidths;

    // Add metadata sheet
    const metadataRows = [
      ['내보내기 정보', ''],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
      ['총 수금 건수', collections.length],
      ['필터', ''],
      ['결제방법', payment_method || '전체'],
      ['검색어', search || '없음'],
      ['시작일자', start_date || '없음'],
      ['종료일자', end_date || '없음'],
      ['', ''],
      ['태창 ERP 시스템', '수금 내역 내보내기']
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    metadataSheet['!cols'] = [{ wch: 15 }, { wch: 25 }];

    // Calculate statistics
    const totalCollected = collections.reduce((sum: number, col: any) => sum + (col.collected_amount || 0), 0);
    const cashCount = collections.filter((c: any) => c.payment_method === 'CASH').length;
    const transferCount = collections.filter((c: any) => c.payment_method === 'TRANSFER').length;
    const checkCount = collections.filter((c: any) => c.payment_method === 'CHECK').length;
    const cardCount = collections.filter((c: any) => c.payment_method === 'CARD').length;

    const statsRows = [
      ['통계 정보', ''],
      ['총 수금 건수', collections.length],
      ['총 수금 금액', `₩${totalCollected.toLocaleString('ko-KR')}`],
      ['', ''],
      ['결제방법별 건수', ''],
      ['현금', cashCount],
      ['계좌이체', transferCount],
      ['수표', checkCount],
      ['카드', cardCount],
      ['', ''],
      ['평균 수금 금액', collections.length > 0 ? `₩${Math.round(totalCollected / collections.length).toLocaleString('ko-KR')}` : '₩0']
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsRows);
    statsSheet['!cols'] = [{ wch: 15 }, { wch: 20 }];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');
    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');
    XLSX.utils.book_append_sheet(workbook, worksheet, '수금 내역');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    // Create filename with current date
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `수금내역_${currentDate}.xlsx`;

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
    console.error('Error exporting collections:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export collections to Excel'
      },
      { status: 500 }
    );
  }
}
