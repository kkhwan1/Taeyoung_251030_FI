import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { mcp__supabase__execute_sql } from '@/lib/supabase-mcp';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') || new Date().getFullYear() + '-01-01';
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    // Direct SQL query for balance sheet data
    const sqlResult = await mcp__supabase__execute_sql({
      project_id: process.env.SUPABASE_PROJECT_ID!,
      query: `
        WITH asset_items AS (
          -- 유동자산: 재고자산
          SELECT
            '자산' AS main_category,
            '유동자산' AS category,
            '재고자산' AS account_name,
            COALESCE(SUM(i.current_stock * COALESCE(i.unit_price, 0)), 0) AS current_period,
            0::numeric AS prior_period,
            1 AS display_order
          FROM items i
          WHERE i.is_active = true

          UNION ALL

          -- 유동자산: 매출채권
          SELECT
            '자산' AS main_category,
            '유동자산' AS category,
            '매출채권' AS account_name,
            COALESCE(SUM(s.total_amount - s.collected_amount), 0) AS current_period,
            0::numeric AS prior_period,
            2 AS display_order
          FROM sales_transactions s
          WHERE s.payment_status IN ('PENDING', 'PARTIAL')
            AND s.is_active = true
        ),
        liability_items AS (
          -- 유동부채: 매입채무
          SELECT
            '부채' AS main_category,
            '유동부채' AS category,
            '매입채무' AS account_name,
            COALESCE(SUM(p.total_amount - p.paid_amount), 0) AS current_period,
            0::numeric AS prior_period,
            3 AS display_order
          FROM purchases p
          WHERE p.payment_status IN ('PENDING', 'PARTIAL')
            AND p.is_active = true
        ),
        equity_items AS (
          -- 자본: 당기순이익
          SELECT
            '자본' AS main_category,
            '자본' AS category,
            '당기순이익' AS account_name,
            (
              SELECT COALESCE(SUM(s.total_amount), 0)
              FROM sales_transactions s
              WHERE s.transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
                AND s.is_active = true
            ) - (
              SELECT COALESCE(SUM(p.total_amount), 0)
              FROM purchases p
              WHERE p.transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
                AND p.is_active = true
            ) AS current_period,
            0::numeric AS prior_period,
            4 AS display_order
        )
        SELECT
          main_category,
          category,
          account_name,
          current_period,
          prior_period,
          current_period - prior_period AS change_amount,
          CASE
            WHEN prior_period = 0 THEN 0
            ELSE ROUND(((current_period - prior_period) / prior_period * 100)::numeric, 2)
          END AS change_rate,
          display_order
        FROM (
          SELECT * FROM asset_items
          UNION ALL
          SELECT * FROM liability_items
          UNION ALL
          SELECT * FROM equity_items
        ) combined
        ORDER BY display_order
      `
    });

    if (sqlResult.error) {
      throw new Error(sqlResult.error);
    }

    const data = sqlResult.rows || [];

    // Create workbook with xlsx skill patterns
    const workbook = XLSX.utils.book_new();

    // Sheet 1: 메타데이터 (Metadata)
    const metadataSheet = XLSX.utils.aoa_to_sheet([
      ['재무상태표 정보'],
      [''],
      ['보고서 생성일', new Date().toLocaleString('ko-KR')],
      ['시작일', startDate],
      ['종료일', endDate],
      ['통화', 'KRW (원)'],
      ['회계기준', 'K-GAAP'],
      [''],
      ['회사명', '태창 자동차'],
      ['사업자번호', '123-45-67890']
    ]);

    // Apply formatting to metadata sheet
    metadataSheet['A1'] = { v: '재무상태표 정보', t: 's', s: { font: { bold: true, sz: 14 } } };
    metadataSheet['!cols'] = [{ wch: 20 }, { wch: 30 }];

    // Sheet 2: 요약 (Summary)
    const summaryData: any[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    if (data) {
      data.forEach((item: any) => {
        if (item.main_category === '자산') {
          totalAssets += item.current_period || 0;
        } else if (item.main_category === '부채') {
          totalLiabilities += item.current_period || 0;
        } else if (item.main_category === '자본') {
          totalEquity += item.current_period || 0;
        }
      });
    }

    summaryData.push(
      ['항목', '금액'],
      ['총 자산', totalAssets],
      ['총 부채', totalLiabilities],
      ['총 자본', totalEquity],
      [''],
      ['재무상태 검증', ''],
      ['자산 합계', totalAssets],
      ['부채+자본 합계', totalLiabilities + totalEquity],
      ['차액', Math.abs(totalAssets - (totalLiabilities + totalEquity))],
      ['균형 상태', Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? '균형' : '불균형']
    );

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Apply currency formatting to summary sheet (xlsx skill pattern)
    const summaryRange = XLSX.utils.decode_range(summarySheet['!ref']!);
    for (let R = 1; R <= summaryRange.e.r; ++R) {
      const cell = XLSX.utils.encode_cell({ r: R, c: 1 });
      if (summarySheet[cell] && typeof summarySheet[cell].v === 'number') {
        summarySheet[cell].z = '#,##0'; // Korean won format without currency symbol
      }
    }

    // Sheet 3: 상세 데이터 (Detailed Data)
    const detailData = data?.map((item: any) => ({
      '주분류': item.main_category || '',
      '세부분류': item.category || '',
      '계정과목': item.account_name || '',
      '당기말': item.current_period || 0,
      '전기말': item.prior_period || 0,
      '증감액': item.change_amount || 0,
      '증감률(%)': item.change_rate || 0
    })) || [];

    const detailSheet = XLSX.utils.json_to_sheet(detailData);

    // Apply formatting to detail sheet (xlsx skill patterns)
    const detailRange = XLSX.utils.decode_range(detailSheet['!ref']!);

    // Format header row
    for (let C = 0; C <= detailRange.e.c; ++C) {
      const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
      if (detailSheet[headerCell]) {
        detailSheet[headerCell].s = { font: { bold: true }, fill: { fgColor: { rgb: "E0E0E0" } } };
      }
    }

    // Format data rows with proper number formatting
    for (let R = 1; R <= detailRange.e.r; ++R) {
      // Currency columns (당기말, 전기말, 증감액)
      for (let C = 3; C <= 5; ++C) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (detailSheet[cell] && typeof detailSheet[cell].v === 'number') {
          detailSheet[cell].z = '#,##0'; // Currency format
        }
      }

      // Percentage column (증감률)
      const percentCell = XLSX.utils.encode_cell({ r: R, c: 6 });
      if (detailSheet[percentCell] && typeof detailSheet[percentCell].v === 'number') {
        detailSheet[percentCell].z = '0.00%'; // Percentage format
      }
    }

    // Set column widths
    detailSheet['!cols'] = [
      { wch: 12 }, // 주분류
      { wch: 15 }, // 세부분류
      { wch: 20 }, // 계정과목
      { wch: 15 }, // 당기말
      { wch: 15 }, // 전기말
      { wch: 15 }, // 증감액
      { wch: 12 }  // 증감률
    ];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '정보');
    XLSX.utils.book_append_sheet(workbook, summarySheet, '요약');
    XLSX.utils.book_append_sheet(workbook, detailSheet, '상세내역');

    // Generate buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      bookSST: false,
      compression: true
    });

    // Return Excel file
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="재무상태표_${startDate}_${endDate}.xlsx"`,
        'Content-Length': buffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Balance sheet export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      },
      { status: 500 }
    );
  }
}