import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


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
      .from('payments')
      .select(`
        payment_id,
        payment_no,
        payment_date,
        paid_amount,
        payment_method,
        bank_name,
        account_number,
        check_number,
        card_number,
        notes,
        is_active,
        created_at,
        updated_at,
        purchase_transaction:purchase_transactions!purchase_transaction_id(
          transaction_no,
          transaction_date,
          total_amount,
          payment_status,
          paid_amount
        ),
        supplier:companies!supplier_id(
          company_name,
          company_code,
          business_number
        )
      `)
      .eq('is_active', true);

    // Apply filters
    if (start_date) {
      query = query.gte('payment_date', start_date);
    }

    if (end_date) {
      query = query.lte('payment_date', end_date);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    if (search) {
      query = query.or(`payment_no.ilike.%${search}%`);
    }

    // Apply ordering
    query = query.order('payment_date', { ascending: false });

    const { data: payments, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Transform data with Korean headers
    const formattedPayments = payments?.map((payment: any) => ({
      "지급ID": payment.payment_id,
      "지급번호": payment.payment_no,
      "지급일자": payment.payment_date,
      "매입번호": payment.purchase_transaction?.transaction_no || '',
      "매입일자": payment.purchase_transaction?.transaction_date || '',
      "공급사명": payment.supplier?.company_name || '',
      "사업자번호": payment.supplier?.business_number || '',
      "지급금액": payment.paid_amount,
      "결제방법": payment.payment_method === 'CASH' ? '현금' :
                   payment.payment_method === 'TRANSFER' ? '계좌이체' :
                   payment.payment_method === 'CHECK' ? '수표' :
                   payment.payment_method === 'CARD' ? '카드' : payment.payment_method,
      "은행명": payment.bank_name || '',
      "계좌번호": payment.account_number || '',
      "수표번호": payment.check_number || '',
      "카드번호": payment.card_number || '',
      "비고": payment.notes || '',
      "매입금액": payment.purchase_transaction?.total_amount || 0,
      "누적지급액": payment.purchase_transaction?.paid_amount || 0,
      "지급상태": payment.purchase_transaction?.payment_status === 'PENDING' ? '미지급' :
                 payment.purchase_transaction?.payment_status === 'PARTIAL' ? '부분지급' :
                 payment.purchase_transaction?.payment_status === 'COMPLETE' ? '완료' : '',
      "등록일시": new Date(payment.created_at).toLocaleString('ko-KR'),
      "수정일시": new Date(payment.updated_at).toLocaleString('ko-KR')
    })) || [];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(formattedPayments);

    // Set column widths
    const columnWidths = [
      { wch: 10 }, // 지급ID
      { wch: 15 }, // 지급번호
      { wch: 12 }, // 지급일자
      { wch: 15 }, // 매입번호
      { wch: 12 }, // 매입일자
      { wch: 20 }, // 공급사명
      { wch: 15 }, // 사업자번호
      { wch: 15 }, // 지급금액
      { wch: 12 }, // 결제방법
      { wch: 15 }, // 은행명
      { wch: 20 }, // 계좌번호
      { wch: 15 }, // 수표번호
      { wch: 20 }, // 카드번호
      { wch: 25 }, // 비고
      { wch: 15 }, // 매입금액
      { wch: 15 }, // 누적지급액
      { wch: 12 }, // 지급상태
      { wch: 18 }, // 등록일시
      { wch: 18 }  // 수정일시
    ];
    worksheet['!cols'] = columnWidths;

    // Add metadata sheet
    const metadataRows = [
      ['내보내기 정보', ''],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
      ['총 지급 건수', payments.length],
      ['필터', ''],
      ['결제방법', payment_method || '전체'],
      ['검색어', search || '없음'],
      ['시작일자', start_date || '없음'],
      ['종료일자', end_date || '없음'],
      ['', ''],
      ['태창 ERP 시스템', '지급 내역 내보내기']
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    metadataSheet['!cols'] = [{ wch: 15 }, { wch: 25 }];

    // Calculate statistics
    const totalPaid = payments.reduce((sum: number, payment: any) => sum + (payment.paid_amount || 0), 0);
    const cashCount = payments.filter((p: any) => p.payment_method === 'CASH').length;
    const transferCount = payments.filter((p: any) => p.payment_method === 'TRANSFER').length;
    const checkCount = payments.filter((p: any) => p.payment_method === 'CHECK').length;
    const cardCount = payments.filter((p: any) => p.payment_method === 'CARD').length;

    const statsRows = [
      ['통계 정보', ''],
      ['총 지급 건수', payments.length],
      ['총 지급 금액', `₩${totalPaid.toLocaleString('ko-KR')}`],
      ['', ''],
      ['결제방법별 건수', ''],
      ['현금', cashCount],
      ['계좌이체', transferCount],
      ['수표', checkCount],
      ['카드', cardCount],
      ['', ''],
      ['평균 지급 금액', payments.length > 0 ? `₩${Math.round(totalPaid / payments.length).toLocaleString('ko-KR')}` : '₩0']
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsRows);
    statsSheet['!cols'] = [{ wch: 15 }, { wch: 20 }];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');
    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');
    XLSX.utils.book_append_sheet(workbook, worksheet, '지급 내역');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    // Create filename with current date
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `지급내역_${currentDate}.xlsx`;

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
    console.error('Error exporting payments:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export payments to Excel'
      },
      { status: 500 }
    );
  }
}
