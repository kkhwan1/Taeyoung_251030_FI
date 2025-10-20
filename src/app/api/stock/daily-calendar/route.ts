/**
 * Daily Stock Calendar API
 *
 * Provides daily stock tracking data from materialized view mv_daily_stock_calendar
 * Supports date range filtering, item filtering, pagination, and Excel export
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { DailyCalendarQuerySchema } from '@/lib/validation';
import * as XLSX from 'xlsx';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DailyStockCalendarRow {
  calendar_date: string;
  item_id: number;
  item_code: string;
  item_name: string;
  opening_stock: number;
  receiving_qty: number;
  shipping_qty: number;
  adjustment_qty: number;
  closing_stock: number;
  stock_value: number;
  updated_at: string;
}

interface DailyCalendarFilters {
  start_date?: string;
  end_date?: string;
  item_id?: number;
  min_stock_value?: number;
  page?: number;
  limit?: number;
  format?: 'json' | 'excel';
}

// ============================================================================
// GET /api/stock/daily-calendar
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ✅ SECURITY FIX: Validate input with Zod schema to prevent NaN values
    const rawParams = Object.fromEntries(searchParams.entries());
    const validationResult = DailyCalendarQuerySchema.safeParse(rawParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '유효하지 않은 요청 파라미터입니다',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const filters: DailyCalendarFilters = validationResult.data;

    // Default date range: last 30 days if not specified
    if (!filters.start_date) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filters.start_date = thirtyDaysAgo.toISOString().split('T')[0];
    }

    if (!filters.end_date) {
      filters.end_date = new Date().toISOString().split('T')[0];
    }

    // Query materialized view
    const supabase = getSupabaseClient();
    let query = supabase
      .from('mv_daily_stock_calendar')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.start_date) {
      query = query.gte('calendar_date', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('calendar_date', filters.end_date);
    }

    if (filters.item_id) {
      query = query.eq('item_id', filters.item_id);
    }

    if (filters.min_stock_value !== undefined) {
      query = query.gte('stock_value', filters.min_stock_value);
    }

    // Apply ordering (date DESC, item_code ASC)
    query = query.order('calendar_date', { ascending: false });
    query = query.order('item_code', { ascending: true });

    // Apply pagination
    if (filters.page && filters.limit) {
      const start = (filters.page - 1) * filters.limit;
      const end = start + filters.limit - 1;
      query = query.range(start, end);
    }

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('[daily-calendar] Query failed:', error);
      return NextResponse.json(
        { success: false, error: '일일재고 조회 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }

    const rows = data as DailyStockCalendarRow[];

    // Handle Excel export
    if (filters.format === 'excel') {
      return exportToExcel(rows, filters);
    }

    // JSON response
    const totalPages = filters.limit ? Math.ceil((count || 0) / filters.limit) : 1;

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 100,
        totalCount: count || 0,
        totalPages
      },
      filters: {
        start_date: filters.start_date,
        end_date: filters.end_date,
        item_id: filters.item_id,
        min_stock_value: filters.min_stock_value
      }
    });

  } catch (error: any) {
    console.error('[daily-calendar] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// ============================================================================
// EXCEL EXPORT HELPER
// ============================================================================

function exportToExcel(
  rows: DailyStockCalendarRow[],
  filters: DailyCalendarFilters
): NextResponse {
  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();

    // ========== Sheet 1: Metadata ==========
    const metadataSheet = XLSX.utils.aoa_to_sheet([
      ['일일재고 캘린더 내보내기', ''],
      ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
      ['조회 기간', `${filters.start_date} ~ ${filters.end_date}`],
      ['품목 필터', filters.item_id ? `품목ID: ${filters.item_id}` : '전체'],
      ['최소 재고금액', filters.min_stock_value ? filters.min_stock_value.toLocaleString('ko-KR') : '없음'],
      ['총 레코드 수', rows.length.toLocaleString('ko-KR')]
    ]);

    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');

    // ========== Sheet 2: Statistics ==========
    const totalStockValue = rows.reduce((sum, row) => sum + (row.stock_value || 0), 0);
    const totalReceiving = rows.reduce((sum, row) => sum + (row.receiving_qty || 0), 0);
    const totalShipping = rows.reduce((sum, row) => sum + (row.shipping_qty || 0), 0);
    const totalAdjustment = rows.reduce((sum, row) => sum + (row.adjustment_qty || 0), 0);

    const statsSheet = XLSX.utils.aoa_to_sheet([
      ['통계 항목', '값'],
      ['총 재고금액', totalStockValue.toLocaleString('ko-KR') + '원'],
      ['총 입고수량', totalReceiving.toLocaleString('ko-KR')],
      ['총 출고수량', totalShipping.toLocaleString('ko-KR')],
      ['총 조정수량', totalAdjustment.toLocaleString('ko-KR')],
      ['품목 수', new Set(rows.map(r => r.item_id)).size.toLocaleString('ko-KR')],
      ['조회 일수', new Set(rows.map(r => r.calendar_date)).size.toLocaleString('ko-KR')]
    ]);

    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');

    // ========== Sheet 3: Data with Korean headers ==========
    const koreanData = rows.map(row => ({
      '날짜': row.calendar_date,
      '품목코드': row.item_code,
      '품목명': row.item_name,
      '기초재고': row.opening_stock,
      '입고수량': row.receiving_qty,
      '출고수량': row.shipping_qty,
      '조정수량': row.adjustment_qty,
      '기말재고': row.closing_stock,
      '재고금액': row.stock_value,
      '갱신일시': new Date(row.updated_at).toLocaleString('ko-KR')
    }));

    const dataSheet = XLSX.utils.json_to_sheet(koreanData);

    // Set column widths for better readability
    dataSheet['!cols'] = [
      { wch: 12 },  // 날짜
      { wch: 15 },  // 품목코드
      { wch: 30 },  // 품목명
      { wch: 10 },  // 기초재고
      { wch: 10 },  // 입고수량
      { wch: 10 },  // 출고수량
      { wch: 10 },  // 조정수량
      { wch: 10 },  // 기말재고
      { wch: 15 },  // 재고금액
      { wch: 20 }   // 갱신일시
    ];

    XLSX.utils.book_append_sheet(workbook, dataSheet, '일일재고 내역');

    // ========== Generate Excel file buffer ==========
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    // ========== Return as downloadable file ==========
    const filename = `일일재고캘린더_${filters.start_date}_${filters.end_date}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': excelBuffer.length.toString()
      }
    });

  } catch (error: any) {
    console.error('[daily-calendar] Excel export failed:', error);
    return NextResponse.json(
      { success: false, error: 'Excel 내보내기 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
