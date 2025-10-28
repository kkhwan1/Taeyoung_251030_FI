import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { mcp__supabase__execute_sql, sanitizeSqlString } from '@/lib/supabase-mcp';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') || new Date().toISOString().slice(0, 8) + '01';
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    // Query cash flow data with date parameters
    const cashFlowQuery = `
      WITH operating_activities AS (
        -- 영업활동: 매출로 인한 현금유입
        SELECT
          '영업활동' AS category,
          '매출로 인한 현금유입' AS activity_name,
          COALESCE(SUM(c.collected_amount), 0) AS amount,
          1 AS display_order
        FROM collections c
        WHERE c.collected_date >= '${sanitizeSqlString(startDate)}'::date
          AND c.collected_date <= '${sanitizeSqlString(endDate)}'::date
          AND c.is_active = true

        UNION ALL

        -- 영업활동: 매입으로 인한 현금유출
        SELECT
          '영업활동' AS category,
          '매입으로 인한 현금유출' AS activity_name,
          -COALESCE(SUM(p.paid_amount), 0) AS amount,
          2 AS display_order
        FROM payments p
        WHERE p.payment_date >= '${sanitizeSqlString(startDate)}'::date
          AND p.payment_date <= '${sanitizeSqlString(endDate)}'::date
          AND p.is_active = true

        UNION ALL

        -- 영업활동: 재고자산의 변동
        SELECT
          '영업활동' AS category,
          '재고자산의 변동' AS activity_name,
          0 AS amount, -- Placeholder for inventory changes
          3 AS display_order
      ),
      investing_activities AS (
        -- 투자활동: 고정자산 취득
        SELECT
          '투자활동' AS category,
          '고정자산 취득' AS activity_name,
          0 AS amount,
          4 AS display_order

        UNION ALL

        -- 투자활동: 고정자산 처분
        SELECT
          '투자활동' AS category,
          '고정자산 처분' AS activity_name,
          0 AS amount,
          5 AS display_order
      ),
      financing_activities AS (
        -- 재무활동: 차입금 증가
        SELECT
          '재무활동' AS category,
          '단기차입금 증가' AS activity_name,
          0 AS amount,
          6 AS display_order

        UNION ALL

        -- 재무활동: 차입금 상환
        SELECT
          '재무활동' AS category,
          '차입금 상환' AS activity_name,
          0 AS amount,
          7 AS display_order
      ),
      cash_flow_data AS (
        SELECT * FROM operating_activities
        UNION ALL
        SELECT * FROM investing_activities
        UNION ALL
        SELECT * FROM financing_activities
      )
      SELECT
        category,
        activity_name,
        amount,
        SUM(amount) OVER (PARTITION BY category) AS category_total
      FROM cash_flow_data
      ORDER BY display_order;
    `;

    const result = await mcp__supabase__execute_sql({
      project_id: process.env.SUPABASE_PROJECT_ID!,
      query: cashFlowQuery
    });

    if (result.error) {
      throw new Error(result.error);
    }

    const data = result.rows || [];

    // Create workbook with xlsx skill patterns
    const workbook = XLSX.utils.book_new();

    // Sheet 1: 메타데이터 (Metadata)
    const metadataSheet = XLSX.utils.aoa_to_sheet([
      ['현금흐름표 정보'],
      [''],
      ['보고서 생성일', new Date().toLocaleString('ko-KR')],
      ['분석 시작일', startDate],
      ['분석 종료일', endDate],
      ['통화', 'KRW (원)'],
      ['회계기준', 'K-GAAP'],
      [''],
      ['회사명', '태창 자동차'],
      ['사업자번호', '123-45-67890'],
      [''],
      ['주의사항', '투자활동 및 재무활동은 향후 구현 예정입니다.']
    ]);

    // Apply formatting to metadata sheet
    metadataSheet['A1'] = { v: '현금흐름표 정보', t: 's', s: { font: { bold: true, sz: 14 } } };
    metadataSheet['!cols'] = [{ wch: 20 }, { wch: 35 }];

    // Sheet 2: 요약 (Summary)
    let operatingCashFlow = 0;
    let investingCashFlow = 0;
    let financingCashFlow = 0;

    // Calculate category totals
    const categoryTotals = new Map<string, number>();
    data.forEach((item: any) => {
      const category = item.category;
      const amount = Number(item.amount) || 0;

      if (!categoryTotals.has(category)) {
        categoryTotals.set(category, 0);
      }
      categoryTotals.set(category, categoryTotals.get(category)! + amount);
    });

    operatingCashFlow = categoryTotals.get('영업활동') || 0;
    investingCashFlow = categoryTotals.get('투자활동') || 0;
    financingCashFlow = categoryTotals.get('재무활동') || 0;

    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

    const summaryData = [
      ['현금흐름 요약', '금액'],
      [''],
      ['영업활동 현금흐름', operatingCashFlow],
      ['투자활동 현금흐름', investingCashFlow],
      ['재무활동 현금흐름', financingCashFlow],
      [''],
      ['기간 중 현금 증감', netCashFlow],
      [''],
      ['기초 현금', 0], // Placeholder
      ['기말 현금', netCashFlow],
      [''],
      ['분석 지표', ''],
      ['영업활동 비율(%)', operatingCashFlow !== 0 ? ((operatingCashFlow / Math.abs(netCashFlow)) * 100).toFixed(2) : '0.00'],
      ['현금 창출 능력', operatingCashFlow > 0 ? '양호' : '주의필요']
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Apply currency formatting to summary sheet (xlsx skill pattern)
    const summaryRange = XLSX.utils.decode_range(summarySheet['!ref']!);
    for (let R = 2; R <= 9; ++R) {
      const cell = XLSX.utils.encode_cell({ r: R, c: 1 });
      if (summarySheet[cell] && typeof summarySheet[cell].v === 'number') {
        summarySheet[cell].z = '#,##0'; // Korean won format
      }
    }

    // Sheet 3: 상세 데이터 (Detailed Data)
    const detailData = data.map((item: any) => ({
      '활동분류': item.category || '',
      '세부항목': item.activity_name || '',
      '금액': Number(item.amount) || 0,
      '분류별 소계': Number(item.category_total) || 0,
      '비고': item.amount === 0 ? '향후 구현 예정' : ''
    }));

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
      // Currency columns (금액, 분류별 소계)
      for (let C = 2; C <= 3; ++C) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (detailSheet[cell] && typeof detailSheet[cell].v === 'number') {
          detailSheet[cell].z = '#,##0'; // Currency format
          // Apply red color for negative values (cash outflows)
          if (detailSheet[cell].v < 0) {
            detailSheet[cell].s = { font: { color: { rgb: "FF0000" } } };
          }
        }
      }
    }

    // Set column widths
    detailSheet['!cols'] = [
      { wch: 15 }, // 활동분류
      { wch: 25 }, // 세부항목
      { wch: 18 }, // 금액
      { wch: 18 }, // 분류별 소계
      { wch: 20 }  // 비고
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
        'Content-Disposition': `attachment; filename="현금흐름표_${startDate}_${endDate}.xlsx"`,
        'Content-Length': buffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Cash flow export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      },
      { status: 500 }
    );
  }
}