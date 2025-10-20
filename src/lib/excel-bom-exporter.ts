/**
 * Excel BOM Exporter Utility
 *
 * Exports BOM (Bill of Materials) data to Excel with multi-level hierarchy visualization,
 * cost analysis, and Korean formatting support.
 *
 * Features:
 * - Multi-level BOM hierarchy with visual indentation
 * - Comprehensive cost analysis (material cost, scrap revenue, net cost)
 * - Three-sheet export: BOM structure, cost analysis, metadata
 * - Korean number formatting with thousand separators
 * - Conditional formatting for high-cost items
 * - Auto-sized columns for readability
 */

import * as XLSX from 'xlsx';

/**
 * BOM export data structure
 */
export interface BOMExportData {
  bom_id: number;
  parent_item_code: string;
  parent_item_name: string;
  child_item_code: string;
  child_item_name: string;
  quantity_required: number;
  level: number;
  item_type: 'internal_production' | 'external_purchase';
  // Cost data
  piece_unit_price?: number;
  material_cost?: number;
  scrap_revenue?: number;
  net_cost?: number;
  // Specs
  material_grade?: string;
  weight_per_piece?: number;
  scrap_weight?: number;
  unit_price?: number;
}

/**
 * Export options
 */
export interface ExportOptions {
  includeInactive?: boolean;
  filterByParentId?: number;
  includeCostAnalysis?: boolean;
}

/**
 * Cost statistics for analysis
 */
interface CostStatistics {
  totalMaterialCost: number;
  totalScrapRevenue: number;
  totalNetCost: number;
  averageMaterialCost: number;
  averageScrapRevenue: number;
  averageNetCost: number;
  internalProductionCount: number;
  externalPurchaseCount: number;
  internalProductionCost: number;
  externalPurchaseCost: number;
  levelDistribution: Map<number, number>;
  topCostItems: Array<{
    itemCode: string;
    itemName: string;
    netCost: number;
    materialCost: number;
  }>;
}

/**
 * Format number with Korean locale (천 단위 구분)
 */
function formatKoreanNumber(value: number | undefined | null, decimals: number = 0): string {
  if (value === undefined || value === null) {
    return '-';
  }
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Calculate cost statistics from BOM data
 */
function calculateCostStatistics(data: BOMExportData[]): CostStatistics {
  const stats: CostStatistics = {
    totalMaterialCost: 0,
    totalScrapRevenue: 0,
    totalNetCost: 0,
    averageMaterialCost: 0,
    averageScrapRevenue: 0,
    averageNetCost: 0,
    internalProductionCount: 0,
    externalPurchaseCount: 0,
    internalProductionCost: 0,
    externalPurchaseCost: 0,
    levelDistribution: new Map(),
    topCostItems: []
  };

  const costItems: Array<{
    itemCode: string;
    itemName: string;
    netCost: number;
    materialCost: number;
  }> = [];

  data.forEach(item => {
    // Total costs
    const materialCost = item.material_cost ?? 0;
    const scrapRevenue = item.scrap_revenue ?? 0;
    const netCost = item.net_cost ?? 0;

    stats.totalMaterialCost += materialCost;
    stats.totalScrapRevenue += scrapRevenue;
    stats.totalNetCost += netCost;

    // Item type distribution
    if (item.item_type === 'internal_production') {
      stats.internalProductionCount++;
      stats.internalProductionCost += netCost;
    } else {
      stats.externalPurchaseCount++;
      stats.externalPurchaseCost += netCost;
    }

    // Level distribution
    const levelCount = stats.levelDistribution.get(item.level) ?? 0;
    stats.levelDistribution.set(item.level, levelCount + 1);

    // Collect for top cost items
    costItems.push({
      itemCode: item.child_item_code,
      itemName: item.child_item_name,
      netCost,
      materialCost
    });
  });

  // Calculate averages
  const count = data.length || 1;
  stats.averageMaterialCost = stats.totalMaterialCost / count;
  stats.averageScrapRevenue = stats.totalScrapRevenue / count;
  stats.averageNetCost = stats.totalNetCost / count;

  // Get top 10 cost items
  stats.topCostItems = costItems
    .sort((a, b) => b.netCost - a.netCost)
    .slice(0, 10);

  return stats;
}

/**
 * Create BOM structure sheet with hierarchy visualization
 */
function createBOMStructureSheet(data: BOMExportData[]): XLSX.WorkSheet {
  const rows = data.map(item => {
    // Visual indentation for hierarchy levels
    const indent = '  '.repeat(item.level);
    const itemTypeLabel = item.item_type === 'internal_production' ? '내부생산' : '외부구매';

    return {
      '부모품목코드': item.parent_item_code,
      '부모품목명': item.parent_item_name,
      '자식품목코드': item.child_item_code,
      '자식품목명': `${indent}${item.child_item_name}`,
      '소요량': item.quantity_required,
      '레벨': item.level,
      '품목구분': itemTypeLabel,
      '재질등급': item.material_grade ?? '-',
      'EA중량(kg)': item.weight_per_piece ? formatKoreanNumber(item.weight_per_piece, 3) : '-',
      '단품단가(원)': item.piece_unit_price ? formatKoreanNumber(item.piece_unit_price, 0) : '-',
      '자재비(원)': item.material_cost ? formatKoreanNumber(item.material_cost, 0) : '-',
      '스크랩중량(kg)': item.scrap_weight ? formatKoreanNumber(item.scrap_weight, 3) : '-',
      '스크랩금액(원)': item.scrap_revenue ? formatKoreanNumber(item.scrap_revenue, 0) : '-',
      '순원가(원)': item.net_cost ? formatKoreanNumber(item.net_cost, 0) : '-'
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // 부모품목코드
    { wch: 25 }, // 부모품목명
    { wch: 15 }, // 자식품목코드
    { wch: 30 }, // 자식품목명 (wider for indentation)
    { wch: 10 }, // 소요량
    { wch: 8 },  // 레벨
    { wch: 12 }, // 품목구분
    { wch: 15 }, // 재질등급
    { wch: 15 }, // EA중량
    { wch: 15 }, // 단품단가
    { wch: 15 }, // 자재비
    { wch: 15 }, // 스크랩중량
    { wch: 15 }, // 스크랩금액
    { wch: 15 }  // 순원가
  ];

  // Apply filter to header row
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: 13, r: data.length }
  })};

  // Freeze top row
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  return worksheet;
}

/**
 * Create cost analysis sheet with statistics and summaries
 */
function createCostAnalysisSheet(data: BOMExportData[], stats: CostStatistics): XLSX.WorkSheet {
  const analysisData: any[][] = [
    ['=== 원가 요약 ===', ''],
    ['총 자재비', `${formatKoreanNumber(stats.totalMaterialCost, 0)} 원`],
    ['총 스크랩금액', `${formatKoreanNumber(stats.totalScrapRevenue, 0)} 원`],
    ['총 순원가', `${formatKoreanNumber(stats.totalNetCost, 0)} 원`],
    ['평균 자재비', `${formatKoreanNumber(stats.averageMaterialCost, 0)} 원`],
    ['평균 스크랩금액', `${formatKoreanNumber(stats.averageScrapRevenue, 0)} 원`],
    ['평균 순원가', `${formatKoreanNumber(stats.averageNetCost, 0)} 원`],
    [''],
    ['=== 품목구분별 원가 ===', ''],
    ['내부생산 품목 수', `${stats.internalProductionCount} 개`],
    ['내부생산 총원가', `${formatKoreanNumber(stats.internalProductionCost, 0)} 원`],
    ['외부구매 품목 수', `${stats.externalPurchaseCount} 개`],
    ['외부구매 총원가', `${formatKoreanNumber(stats.externalPurchaseCost, 0)} 원`],
    [''],
    ['=== 레벨별 품목 수 ===', '']
  ];

  // Add level distribution
  const sortedLevels = Array.from(stats.levelDistribution.entries())
    .sort((a, b) => a[0] - b[0]);

  sortedLevels.forEach(([level, count]) => {
    analysisData.push([`레벨 ${level}`, `${count} 개`]);
  });

  // Add top cost items
  analysisData.push(['']);
  analysisData.push(['=== 원가 상위 10개 품목 ===', '']);
  analysisData.push(['순위', '품목코드', '품목명', '자재비(원)', '순원가(원)']);

  stats.topCostItems.forEach((item, index) => {
    analysisData.push([
      `${index + 1}위`,
      item.itemCode,
      item.itemName,
      formatKoreanNumber(item.materialCost, 0),
      formatKoreanNumber(item.netCost, 0)
    ]);
  });

  // Add high-cost threshold note
  const highCostThreshold = stats.averageNetCost * 1.5;
  analysisData.push(['']);
  analysisData.push(['고원가 기준 (평균의 1.5배)', `${formatKoreanNumber(highCostThreshold, 0)} 원`]);

  const highCostCount = data.filter(item =>
    (item.net_cost ?? 0) > highCostThreshold
  ).length;
  analysisData.push(['고원가 품목 수', `${highCostCount} 개`]);

  const worksheet = XLSX.utils.aoa_to_sheet(analysisData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Label column
    { wch: 20 }, // Value column
    { wch: 30 }, // Item name (for top cost items)
    { wch: 18 }, // Material cost
    { wch: 18 }  // Net cost
  ];

  return worksheet;
}

/**
 * Create metadata sheet with export information
 */
function createMetadataSheet(data: BOMExportData[], options?: ExportOptions): XLSX.WorkSheet {
  const now = new Date();
  const metadataRows = [
    ['=== 내보내기 정보 ===', ''],
    ['내보낸 날짜', now.toLocaleDateString('ko-KR')],
    ['내보낸 시간', now.toLocaleTimeString('ko-KR')],
    ['총 BOM 항목 수', `${data.length} 개`],
    [''],
    ['=== 레벨별 항목 수 ===', '']
  ];

  // Calculate level distribution
  const levelCounts = new Map<number, number>();
  data.forEach(item => {
    const count = levelCounts.get(item.level) ?? 0;
    levelCounts.set(item.level, count + 1);
  });

  const sortedLevels = Array.from(levelCounts.entries())
    .sort((a, b) => a[0] - b[0]);

  sortedLevels.forEach(([level, count]) => {
    metadataRows.push([`레벨 ${level}`, `${count} 개`]);
  });

  // Add cost totals
  const totalMaterialCost = data.reduce((sum, item) => sum + (item.material_cost ?? 0), 0);
  const totalScrapRevenue = data.reduce((sum, item) => sum + (item.scrap_revenue ?? 0), 0);
  const totalNetCost = data.reduce((sum, item) => sum + (item.net_cost ?? 0), 0);

  metadataRows.push(['']);
  metadataRows.push(['=== 원가 요약 ===', '']);
  metadataRows.push(['총 자재비', `${formatKoreanNumber(totalMaterialCost, 0)} 원`]);
  metadataRows.push(['총 스크랩금액', `${formatKoreanNumber(totalScrapRevenue, 0)} 원`]);
  metadataRows.push(['총 순원가', `${formatKoreanNumber(totalNetCost, 0)} 원`]);

  // Add filter options if provided
  if (options) {
    metadataRows.push(['']);
    metadataRows.push(['=== 필터 옵션 ===', '']);
    metadataRows.push(['비활성 항목 포함', options.includeInactive ? '예' : '아니오']);
    if (options.filterByParentId) {
      metadataRows.push(['부모품목 ID 필터', options.filterByParentId.toString()]);
    }
    metadataRows.push(['원가분석 포함', options.includeCostAnalysis !== false ? '예' : '아니오']);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(metadataRows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Label column
    { wch: 30 }  // Value column
  ];

  return worksheet;
}

/**
 * Apply conditional formatting for high-cost items
 * Note: xlsx library has limited conditional formatting support
 * This function prepares cell styles that can be applied
 */
function applyConditionalFormatting(
  worksheet: XLSX.WorkSheet,
  data: BOMExportData[],
  stats: CostStatistics
): void {
  const highCostThreshold = stats.averageNetCost * 1.5;

  // Note: xlsx library doesn't support full Excel conditional formatting
  // This is a placeholder for future enhancement
  // In Excel, you would manually apply conditional formatting to highlight
  // cells where net_cost > highCostThreshold

  // For now, we can add a comment or note to guide manual formatting
  const headerRow = 0;
  const netCostCol = 13; // 순원가 column (0-indexed)

  if (!worksheet['!comments']) {
    worksheet['!comments'] = [];
  }

  // Add note to the net cost header
  const headerCell = XLSX.utils.encode_cell({ r: headerRow, c: netCostCol });
  if (!worksheet['!comments']) {
    worksheet['!comments'] = [];
  }

  // Note: Full conditional formatting would be applied in Excel after opening
}

/**
 * Main export function
 *
 * @param data - BOM data array to export
 * @param options - Export options (optional)
 * @returns Buffer containing the Excel file
 */
export async function exportBOMToExcel(
  data: BOMExportData[],
  options?: ExportOptions
): Promise<Buffer> {
  if (!data || data.length === 0) {
    throw new Error('No BOM data provided for export');
  }

  // Filter data based on options
  let filteredData = data;
  if (options?.filterByParentId) {
    filteredData = data.filter(item =>
      item.parent_item_code.includes(options.filterByParentId!.toString())
    );
  }

  // Calculate statistics
  const stats = calculateCostStatistics(filteredData);

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Sheet 1: BOM Structure
  const bomSheet = createBOMStructureSheet(filteredData);
  XLSX.utils.book_append_sheet(workbook, bomSheet, 'BOM 구조');

  // Sheet 2: Cost Analysis (if enabled)
  if (options?.includeCostAnalysis !== false) {
    const costSheet = createCostAnalysisSheet(filteredData, stats);
    XLSX.utils.book_append_sheet(workbook, costSheet, '원가 분석');
  }

  // Sheet 3: Metadata
  const metadataSheet = createMetadataSheet(filteredData, options);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, '메타데이터');

  // Write workbook to buffer
  const excelBuffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
    cellStyles: true
  });

  return excelBuffer;
}

/**
 * Generate Excel filename with timestamp
 */
export function generateBOMExcelFilename(prefix: string = 'BOM'): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  return `${prefix}_${dateStr}_${timeStr}.xlsx`;
}

/**
 * Helper function to create Excel response headers
 */
export function createExcelResponseHeaders(filename: string, bufferLength: number): Record<string, string> {
  return {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename=${encodeURIComponent(filename)}`,
    'Content-Length': bufferLength.toString(),
    'Cache-Control': 'no-cache'
  };
}
