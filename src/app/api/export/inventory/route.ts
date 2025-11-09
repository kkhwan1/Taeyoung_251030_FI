import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const itemId = searchParams.get('item_id');

    // Initialize Supabase client for safe queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build safe query using Supabase client
    let query = supabase
      .from('inventory_transactions')
      .select(`
        transaction_id,
        transaction_date,
        transaction_type,
        quantity,
        unit_price,
        total_amount,
        from_location,
        to_location,
        warehouse_from,
        warehouse_to,
        lot_no,
        expiry_date,
        reference_no,
        reference_id,
        notes,
        created_at,
        items!left(item_code, item_name, spec, unit),
        companies!left(company_name),
        users!left(full_name)
      `);

    // Apply filters safely
    if (type) {
      query = query.eq('transaction_type', type);
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    if (itemId) {
      query = query.eq('item_id', parseInt(itemId));
    }

    // Apply ordering
    query = query
      .order('transaction_date', { ascending: false })
      .order('transaction_id', { ascending: false });

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Transform data to match expected format for Excel export
    const formattedTransactions = transactions?.map((t: any) => ({
      "거래ID": t.transaction_id,
      "거래일시": new Date(t.transaction_date).toLocaleString('ko-KR'),
      "거래유형": t.transaction_type,
      "품목코드": t.items?.item_code,
      "품목명": t.items?.item_name,
      "규격": t.items?.spec,
      "수량": t.quantity,
      "단위": t.items?.unit,
      "단가": t.unit_price,
      "총금액": t.total_amount,
      "거래처명": t.companies?.company_name,
      "출발위치": t.from_location,
      "도착위치": t.to_location,
      "출발창고": t.warehouse_from,
      "도착창고": t.warehouse_to,
      "LOT번호": t.lot_no,
      "만료일": t.expiry_date ? new Date(t.expiry_date).toLocaleDateString('ko-KR') : '',
      "참조번호": t.reference_no,
      "참조ID": t.reference_id,
      "처리자": t.users?.full_name,
      "비고": t.notes,
      "등록일시": new Date(t.created_at).toLocaleString('ko-KR')
    })) || [];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(formattedTransactions);

    // Set column widths for better formatting
    const columnWidths = [
      { wch: 10 }, // 거래ID
      { wch: 18 }, // 거래일시
      { wch: 10 }, // 거래유형
      { wch: 15 }, // 품목코드
      { wch: 25 }, // 품목명
      { wch: 20 }, // 규격
      { wch: 10 }, // 수량
      { wch: 8 },  // 단위
      { wch: 12 }, // 단가
      { wch: 15 }, // 총금액
      { wch: 20 }, // 거래처명
      { wch: 15 }, // 출발위치
      { wch: 15 }, // 도착위치
      { wch: 15 }, // 출발창고
      { wch: 15 }, // 도착창고
      { wch: 15 }, // LOT번호
      { wch: 12 }, // 만료일
      { wch: 15 }, // 참조번호
      { wch: 15 }, // 참조ID
      { wch: 15 }, // 처리자
      { wch: 25 }, // 비고
      { wch: 18 }  // 등록일시
    ];
    worksheet['!cols'] = columnWidths;

    // Calculate statistics
    const totalTransactions = transactions.length;
    const transactionsByType = transactions.reduce((acc: any, t: any) => {
      const type = t['거래유형'];
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalQuantity = transactions.reduce((sum: any, t: any) => sum + (t['수량'] || 0), 0);
    const totalAmount = transactions.reduce((sum: any, t: any) => sum + (t['총금액'] || 0), 0);

    // Add metadata sheet
    const metadataRows = [
      ['내보내기 정보', ''],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
      ['총 거래 수', totalTransactions],
      ['총 수량', totalQuantity],
      ['총 금액', totalAmount?.toLocaleString('ko-KR') || '0'],
      ['필터', ''],
      ['거래유형', type || '전체'],
      ['시작일', startDate || '없음'],
      ['종료일', endDate || '없음'],
      ['품목ID', itemId || '없음'],
      ['', ''],
      ['태창 ERP 시스템', '재고 거래 내보내기']
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    metadataSheet['!cols'] = [{ wch: 15 }, { wch: 25 }];

    // Add statistics sheet
    const statsRows: (string | number)[][] = [
      ['거래 유형별 통계', '건수'],
      ...Object.entries(transactionsByType).map(([type, count]): [string, number] => [type, Number(count)]),
      ['', ''],
      ['월별 거래 통계', ''],
      ...getMonthlyStats(transactions)
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsRows);
    statsSheet['!cols'] = [{ wch: 20 }, { wch: 15 }];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');
    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');
    XLSX.utils.book_append_sheet(workbook, worksheet, '재고 거래');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    // Create filename with current date and filters
    const currentDate = new Date().toISOString().split('T')[0];
    let filename = `재고거래_${currentDate}`;
    if (type) filename += `_${type}`;
    if (startDate) filename += `_${startDate}`;
    if (endDate) filename += `_${endDate}`;
    filename += '.xlsx';

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
    console.error('Error exporting inventory transactions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export inventory transactions to Excel'
      },
      { status: 500 }
    );
  }
}

// Helper function to calculate monthly statistics
function getMonthlyStats(transactions: Record<string, any>[]): (string | number)[][] {
  const monthlyStats = transactions.reduce((acc, t) => {
    const dateStr = t['거래일시'];
    if (dateStr) {
      const month = dateStr.substring(0, 7); // YYYY-MM format
      acc[month] = (acc[month] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(monthlyStats)
    .sort(([a], [b]) => b.localeCompare(a)) // Sort by month descending
    .slice(0, 12) // Last 12 months
    .map(([month, count]): [string, number] => [month, Number(count)]);
}