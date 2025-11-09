/**
 * BOM Export API - Export BOM data to Excel
 * GET /api/bom/export
 *
 * Query parameters:
 * - parent_item_id: Filter by parent item (optional)
 * - include_inactive: Include inactive BOM entries (default: false)
 * - include_cost_analysis: Include cost calculations (default: true)
 *
 * Returns Excel file with three sheets:
 * 1. 내보내기 정보 (Export metadata)
 * 2. BOM 구조 (BOM structure data)
 * 3. 원가 분석 (Cost analysis - if included)
 *
 * Response: Excel file download with Korean headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';


// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BOMDetailRow {
  bom_id: number;
  parent_item_id: number;
  parent_code: string;
  parent_name: string;
  child_item_id: number;
  child_code: string;
  child_name: string;
  item_type: string;
  quantity_required: number;
  level_no: number;
  purchase_unit_price?: number;
  weight_per_piece?: number;
  production_unit_price?: number;
  effective_unit_price: number;
  component_cost: number;
  scrap_revenue_per_piece?: number;
  net_cost: number;
  created_at: string;
  updated_at: string;
  // Added by transformation
  is_active?: boolean;
}

interface ExportOptions {
  includeInactive: boolean;
  includeCostAnalysis: boolean;
  filterByParentId?: number;
}

interface ParentCostSummary {
  parent_code: string;
  parent_name: string;
  total_material_cost: number;
  total_scrap_revenue: number;
  total_net_cost: number;
  child_count: number;
}

// ============================================================================
// EXCEL GENERATION
// ============================================================================

/**
 * Generate Excel file with BOM data
 * Returns buffer ready for download
 */
function exportBOMToExcel(
  bomData: BOMDetailRow[],
  options: ExportOptions
): Buffer {
  const workbook = XLSX.utils.book_new();

  // ========================================================================
  // Sheet 1: 내보내기 정보 (Export Metadata)
  // ========================================================================
  const now = new Date();
  const metadataSheet = XLSX.utils.aoa_to_sheet([
    ['BOM 내보내기 정보', ''],
    ['내보낸 날짜', now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })],
    ['총 레코드 수', bomData.length],
    ['비활성 항목 포함', options.includeInactive ? '예' : '아니오'],
    ['원가 분석 포함', options.includeCostAnalysis ? '예' : '아니오'],
    ['필터 조건', options.filterByParentId ? `부모 품목 ID: ${options.filterByParentId}` : '전체'],
    ['', ''],
    ['시스템 정보', ''],
    ['시스템명', '태창 ERP 시스템'],
    ['버전', '1.0.0'],
    ['내보내기 형식', 'Excel (XLSX)']
  ]);

  XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');

  // ========================================================================
  // Sheet 2: BOM 구조 (BOM Structure Data)
  // ========================================================================

  // Prepare data with Korean headers
  const koreanData = bomData.map(row => ({
    'BOM ID': row.bom_id,
    '부모 품목 코드': row.parent_code,
    '부모 품목명': row.parent_name,
    '자식 품목 코드': row.child_code,
    '자식 품목명': row.child_name,
    '품목 유형': row.item_type,
    '소요량': row.quantity_required,
    'Level': row.level_no,
    '활성 상태': row.is_active ? '활성' : '비활성',
    // Cost analysis fields (if included)
    ...(options.includeCostAnalysis && {
      '단품 원가': row.component_cost || 0,
      '스크랩 수익': row.scrap_revenue_per_piece || 0,
      '순원가': row.net_cost || 0,
      '구매 단가': row.purchase_unit_price || 0,
      'EA 중량': row.weight_per_piece || 0,
      '생산 단가': row.production_unit_price || 0
    })
  }));

  const dataSheet = XLSX.utils.json_to_sheet(koreanData);

  // Set column widths
  const columnWidths = [
    { wch: 10 }, // BOM ID
    { wch: 15 }, // 부모 품목 코드
    { wch: 25 }, // 부모 품목명
    { wch: 20 }, // 부모 규격
    { wch: 15 }, // 자식 품목 코드
    { wch: 25 }, // 자식 품목명
    { wch: 20 }, // 자식 규격
    { wch: 10 }, // 소요량
    { wch: 8 },  // 단위
    { wch: 8 },  // Level
    { wch: 30 }, // 비고
    { wch: 10 }  // 활성 상태
  ];

  if (options.includeCostAnalysis) {
    columnWidths.push(
      { wch: 12 }, // 재료비
      { wch: 12 }, // 스크랩 수익
      { wch: 12 }, // 순원가
      { wch: 12 }, // 재질 등급
      { wch: 12 }  // 구매 단가
    );
  }

  dataSheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, dataSheet, 'BOM 구조');

  // ========================================================================
  // Sheet 3: 원가 분석 (Cost Analysis - if included)
  // ========================================================================
  if (options.includeCostAnalysis) {
    // Aggregate cost statistics
    const totalMaterialCost = bomData.reduce((sum, row) => sum + (row.component_cost || 0), 0);
    const totalScrapRevenue = bomData.reduce((sum, row) => sum + (row.scrap_revenue_per_piece || 0), 0);
    const totalNetCost = bomData.reduce((sum, row) => sum + (row.net_cost || 0), 0);
    const coilItemCount = bomData.filter(row => row.weight_per_piece).length;
    const purchasedItemCount = bomData.filter(row => row.purchase_unit_price).length;

    // Group by parent item
    const parentGroups = bomData.reduce((acc, row) => {
      const key = `${row.parent_code}|${row.parent_name}`;
      if (!acc[key]) {
        acc[key] = {
          parent_code: row.parent_code,
          parent_name: row.parent_name,
          total_material_cost: 0,
          total_scrap_revenue: 0,
          total_net_cost: 0,
          child_count: 0
        };
      }
      acc[key].total_material_cost += row.component_cost || 0;
      acc[key].total_scrap_revenue += row.scrap_revenue_per_piece || 0;
      acc[key].total_net_cost += row.net_cost || 0;
      acc[key].child_count += 1;
      return acc;
    }, {} as Record<string, ParentCostSummary>);

    const costAnalysisData = [
      ['원가 분석 요약', ''],
      ['항목', '금액 (원)'],
      ['총 재료비', totalMaterialCost.toLocaleString('ko-KR')],
      ['총 스크랩 수익', totalScrapRevenue.toLocaleString('ko-KR')],
      ['총 순원가', totalNetCost.toLocaleString('ko-KR')],
      ['', ''],
      ['항목별 통계', ''],
      ['코일 사용 품목 수', coilItemCount],
      ['구매 품목 수', purchasedItemCount],
      ['총 BOM 항목 수', bomData.length],
      ['', ''],
      ['부모 품목별 원가', ''],
      ['부모 품목 코드', '부모 품목명', '재료비', '스크랩 수익', '순원가', '자식 품목 수']
    ];

    // Add parent group details
    Object.values(parentGroups).forEach((group: ParentCostSummary) => {
      costAnalysisData.push([
        group.parent_code,
        group.parent_name,
        group.total_material_cost.toLocaleString('ko-KR'),
        group.total_scrap_revenue.toLocaleString('ko-KR'),
        group.total_net_cost.toLocaleString('ko-KR'),
        group.child_count
      ]);
    });

    const costSheet = XLSX.utils.aoa_to_sheet(costAnalysisData);

    // Set column widths for cost analysis
    costSheet['!cols'] = [
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(workbook, costSheet, '원가 분석');
  }

  // ========================================================================
  // Generate buffer
  // ========================================================================
  const excelBuffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true
  });

  return excelBuffer;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const parentItemId = searchParams.get('parent_item_id');
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const includeCostAnalysis = searchParams.get('include_cost_analysis') !== 'false'; // Default true

    const supabase = getSupabaseClient();

    // Build query from v_bom_details view for cost calculations
    let query = supabase
      .from('v_bom_details')
      .select('*')
      .order('parent_code', { ascending: true })
      .order('level_no', { ascending: true })
      .order('child_code', { ascending: true });

    // Apply filters
    if (parentItemId) {
      query = query.eq('parent_item_id', parseInt(parentItemId));
    }

    // ️ NOTE: Cannot filter by is_active in v_bom_details view (column doesn't exist)
    // Will transform and filter after query

    const { data: bomData, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'BOM 데이터 조회 실패',
          details: error.message
        },
        { status: 500 }
      );
    }

    // CRITICAL FIX: Transform data to include is_active field
    // v_bom_details view doesn't have is_active column, so we add it with default true
    const transformedData = (bomData || []).map((item: any) => ({
      ...item,
      is_active: item.is_active !== undefined ? item.is_active : true
    } as BOMDetailRow));

    // Apply is_active filter if includeInactive is false
    const filteredData = includeInactive
      ? transformedData
      : transformedData.filter(item => item.is_active);

    if (!filteredData || filteredData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '내보낼 BOM 데이터가 없습니다',
          details: '필터 조건을 확인해주세요'
        },
        { status: 404 }
      );
    }

    // Generate Excel file
    const excelBuffer = exportBOMToExcel(
      filteredData as BOMDetailRow[],
      {
        includeInactive,
        includeCostAnalysis,
        filterByParentId: parentItemId ? parseInt(parentItemId) : undefined
      }
    );

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `BOM_구조_${timestamp}.xlsx`;

    // Return as downloadable file with proper headers
    return new NextResponse(Buffer.from(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': excelBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('BOM export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'BOM 내보내기 실패',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
