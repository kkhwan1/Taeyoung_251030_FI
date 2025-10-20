import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build Supabase query
    let query = supabaseAdmin
      .from('items')
      .select('*')
      .eq('is_active', true)
      .order('item_code');

    if (type) {
      query = query.eq('category', type as "원자재" | "부자재" | "반제품" | "제품" | "상품");
    }

    if (search) {
      query = query.or(`item_code.ilike.%${search}%,item_name.ilike.%${search}%,spec.ilike.%${search}%`);
    }

    const { data: items, error } = (await query) as any;

    if (error) {
      throw new Error(error.message);
    }

    // Transform data for export
    const stockData = ((items || []) as any[]).map((item: any) => {
      const currentStock = item.current_stock || 0;
      const minStock = item.safety_stock || 0;
      const unitPrice = item.price || 0;
      const stockValue = currentStock * unitPrice;

      let statusText = '정상';
      let statusCode = 'NORMAL';

      if (currentStock <= 0) {
        statusText = '재고없음';
        statusCode = 'OUT_OF_STOCK';
      } else if (minStock > 0 && currentStock <= minStock * 0.5) {
        statusText = '부족';
        statusCode = 'LOW_STOCK';
      } else if (minStock > 0 && currentStock <= minStock) {
        statusText = '주의';
        statusCode = 'WARNING';
      }

      const categoryMap: Record<string, string> = {
        '원자재': '원자재',
        '부자재': '부자재',
        '반제품': '반제품',
        '제품': '제품',
        '상품': '상품'
      };

      return {
        '품목ID': item.item_id,
        '품목코드': item.item_code,
        '품목명': item.item_name,
        '품목구분': categoryMap[item.category] || item.category,
        '규격': item.spec,
        '단위': item.unit,
        '현재재고': currentStock,
        '안전재고': minStock,
        '단가': unitPrice,
        '재고금액': stockValue,
        '위치': item.location,
        '재고상태': statusText,
        'status_code': statusCode,
        '설명': item.description,
        '등록일': item.created_at?.split('T')[0],
        '수정일': item.updated_at?.split('T')[0]
      };
    });

    // Filter by status if specified
    let filteredData = stockData;
    if (status) {
      filteredData = stockData.filter(item => {
        const statusCode = item['status_code'];
        switch (status) {
          case 'low': return statusCode === 'LOW_STOCK';
          case 'warning': return statusCode === 'WARNING';
          case 'normal': return statusCode === 'NORMAL';
          case 'out': return statusCode === 'OUT_OF_STOCK';
          default: return true;
        }
      });
    }

    // Remove status_code column before export
    const exportData = filteredData.map(({ status_code: _, ...rest }) => rest);

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths for better formatting
    const columnWidths = [
      { wch: 10 }, // 품목ID
      { wch: 15 }, // 품목코드
      { wch: 25 }, // 품목명
      { wch: 10 }, // 품목구분
      { wch: 20 }, // 규격
      { wch: 8 },  // 단위
      { wch: 12 }, // 현재재고
      { wch: 12 }, // 안전재고
      { wch: 12 }, // 단가
      { wch: 15 }, // 재고금액
      { wch: 15 }, // 위치
      { wch: 10 }, // 재고상태
      { wch: 25 }, // 설명
      { wch: 12 }, // 등록일
      { wch: 12 }  // 수정일
    ];
    worksheet['!cols'] = columnWidths;

    // Calculate statistics
    const totalItems = exportData.length;
    const totalStockValue = exportData.reduce((sum, item) => sum + (item['재고금액'] || 0), 0);
    const totalStock = exportData.reduce((sum, item) => sum + (item['현재재고'] || 0), 0);

    const statusCounts = stockData.reduce((acc, item) => {
      const status = item['재고상태'];
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeCounts = exportData.reduce((acc, item) => {
      const type = item['품목구분'];
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Add metadata sheet
    const metadataRows = [
      ['내보내기 정보', ''],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
      ['총 품목 수', totalItems],
      ['총 재고량', totalStock.toLocaleString('ko-KR')],
      ['총 재고금액', totalStockValue.toLocaleString('ko-KR') + '원'],
      ['필터', ''],
      ['품목구분', type || '전체'],
      ['재고상태', status || '전체'],
      ['검색어', search || '없음'],
      ['', ''],
      ['태창 ERP 시스템', '재고 현황 내보내기']
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    metadataSheet['!cols'] = [{ wch: 15 }, { wch: 25 }];

    // Add statistics sheet
    const statsRows = [
      ['재고 상태별 통계', '품목 수'],
      ...Object.entries(statusCounts).map(([status, count]) => [status, count]),
      ['', ''],
      ['품목 구분별 통계', '품목 수'],
      ...Object.entries(typeCounts).map(([type, count]) => [type, count]),
      ['', ''],
      ['재고 금액 상위 10개', ''],
      ...exportData
        .sort((a, b) => (b['재고금액'] || 0) - (a['재고금액'] || 0))
        .slice(0, 10)
        .map(item => [
          `${item['품목코드']} - ${item['품목명']}`,
          (item['재고금액'] || 0).toLocaleString('ko-KR') + '원'
        ])
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsRows);
    statsSheet['!cols'] = [{ wch: 30 }, { wch: 15 }];

    // Add low stock alert sheet
    const lowStockItems = stockData.filter(item =>
      item['status_code'] === 'LOW_STOCK' ||
      item['status_code'] === 'OUT_OF_STOCK' ||
      item['status_code'] === 'WARNING'
    ).map(({ status_code: _, ...rest }) => rest);

    if (lowStockItems.length > 0) {
      const lowStockSheet = XLSX.utils.json_to_sheet(lowStockItems);
      lowStockSheet['!cols'] = columnWidths;
      XLSX.utils.book_append_sheet(workbook, lowStockSheet, '주의 품목');
    }

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');
    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');
    XLSX.utils.book_append_sheet(workbook, worksheet, '재고 현황');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    // Create filename with current date and filters
    const currentDate = new Date().toISOString().split('T')[0];
    let filename = `재고현황_${currentDate}`;
    if (type) filename += `_${type}`;
    if (status) filename += `_${status}`;
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
    console.error('Error exporting stock status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export stock status to Excel'
      },
      { status: 500 }
    );
  }
}