/**
 * Phase 2: Accounting Summary Type Definitions
 *
 * TypeScript types for accounting summary schema extension
 * Generated: 2025-10-11 15:45:00
 */

/**
 * Company Category Enum
 * 협력업체 분류
 */
export enum CompanyCategory {
  /** 협력업체-원자재: Raw materials supplier */
  RAW_MATERIALS = '협력업체-원자재',

  /** 협력업체-외주: Outsourcing supplier */
  OUTSOURCING = '협력업체-외주',

  /** 소모품업체: Consumables supplier */
  CONSUMABLES = '소모품업체',

  /** 기타: Other */
  OTHER = '기타'
}

/**
 * Business Information Structure
 * 사업자 정보
 */
export interface BusinessInfo {
  /** 업태 (Business type) - e.g., 제조업, 도매업 */
  business_type?: string;

  /** 종목 (Business item) - e.g., 자동차부품, 금형가공 */
  business_item?: string;

  /** 주요품목 (Main products) - e.g., 엔진부품, 구동계부품 */
  main_products?: string;
}

/**
 * Extended Company Type with Phase 2 fields
 * 확장된 회사 정보
 */
export interface CompanyExtended {
  // Original fields from Phase 1
  company_id: string;
  company_code: string;
  company_name: string;
  business_number?: string;
  representative?: string;
  contact?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Phase 2 new fields
  company_category?: CompanyCategory | string;
  business_info?: BusinessInfo;
}

/**
 * Monthly Accounting View Row
 * v_monthly_accounting 뷰 결과
 */
export interface MonthlyAccounting {
  /** 월 (Month) - Format: YYYY-MM */
  month: string;

  /** 업체 ID */
  company_id: string;

  /** 업체 코드 */
  company_code: string;

  /** 업체명 */
  company_name: string;

  /** 업체 구분 */
  company_category?: CompanyCategory | string;

  /** 사업자 정보 */
  business_info?: BusinessInfo;

  /** 사업자등록번호 */
  business_number?: string;

  /** 대표자명 */
  representative?: string;

  /** 매출 금액 */
  sales_amount: number;

  /** 매출 건수 */
  sales_count: number;

  /** 매입 금액 */
  purchase_amount: number;

  /** 매입 건수 */
  purchase_count: number;

  /** 순매출 (매출 - 매입) */
  net_amount: number;
}

/**
 * Category Monthly Summary View Row
 * v_category_monthly_summary 뷰 결과
 */
export interface CategoryMonthlySummary {
  /** 월 (Month) - Format: YYYY-MM */
  month: string;

  /** 업체 구분 */
  company_category: CompanyCategory | string;

  /** 총 매출 */
  total_sales: number;

  /** 매출 거래 건수 */
  total_sales_transactions: number;

  /** 총 매입 */
  total_purchases: number;

  /** 매입 거래 건수 */
  total_purchase_transactions: number;

  /** 순매출 */
  net_amount: number;

  /** 업체 수 */
  company_count: number;

  /** 업체당 평균 매출 */
  avg_sales_per_company: number;

  /** 업체당 평균 매입 */
  avg_purchase_per_company: number;

  /** 매출 비중 (%) */
  sales_percentage: number;

  /** 매입 비중 (%) */
  purchase_percentage: number;
}

/**
 * Company Category Update DTO
 * 업체 구분 수정 요청
 */
export interface CompanyCategoryUpdateDto {
  company_category: CompanyCategory | string;
  business_info?: BusinessInfo;
}

/**
 * Monthly Accounting Query Parameters
 * 월별 회계 조회 파라미터
 */
export interface MonthlyAccountingQueryParams {
  /** 시작 월 (Start month) - Format: YYYY-MM */
  start_month?: string;

  /** 종료 월 (End month) - Format: YYYY-MM */
  end_month?: string;

  /** 업체 구분 필터 */
  company_category?: CompanyCategory | string;

  /** 업체 코드 필터 */
  company_code?: string;

  /** 업체명 검색 */
  company_name?: string;

  /** 최소 매출 금액 */
  min_sales_amount?: number;

  /** 최소 매입 금액 */
  min_purchase_amount?: number;

  /** 정렬 기준 */
  order_by?: 'month' | 'sales_amount' | 'purchase_amount' | 'net_amount' | 'company_name';

  /** 정렬 방향 */
  order_direction?: 'asc' | 'desc';

  /** 페이지 번호 */
  page?: number;

  /** 페이지 크기 */
  limit?: number;
}

/**
 * Category Summary Query Parameters
 * 업체 구분별 요약 조회 파라미터
 */
export interface CategorySummaryQueryParams {
  /** 시작 월 (Start month) - Format: YYYY-MM */
  start_month?: string;

  /** 종료 월 (End month) - Format: YYYY-MM */
  end_month?: string;

  /** 업체 구분 필터 */
  company_category?: CompanyCategory | string;

  /** 정렬 기준 */
  order_by?: 'month' | 'total_sales' | 'total_purchases' | 'net_amount' | 'company_count';

  /** 정렬 방향 */
  order_direction?: 'asc' | 'desc';
}

/**
 * Accounting Dashboard Summary
 * 회계 대시보드 요약 데이터
 */
export interface AccountingDashboardSummary {
  /** 현재 월 */
  current_month: string;

  /** 전월 대비 매출 증감률 */
  sales_growth_rate: number;

  /** 전월 대비 매입 증감률 */
  purchase_growth_rate: number;

  /** 업체 구분별 요약 */
  category_summaries: CategoryMonthlySummary[];

  /** 상위 10개 업체 (순매출 기준) */
  top_companies: MonthlyAccounting[];

  /** 월별 트렌드 (최근 12개월) */
  monthly_trend: {
    month: string;
    total_sales: number;
    total_purchases: number;
    net_amount: number;
  }[];
}

/**
 * Company Category Distribution
 * 업체 구분별 분포
 */
export interface CategoryDistribution {
  company_category: CompanyCategory | string;
  company_count: number;
  percentage: number;
  with_business_info_count: number;
}

/**
 * API Response Types
 */
export interface MonthlyAccountingResponse {
  success: boolean;
  data: MonthlyAccounting[];
  pagination?: {
    page: number;
    limit: number;
    total_pages: number;
    total_count: number;
  };
  error?: string;
}

export interface CategorySummaryResponse {
  success: boolean;
  data: CategoryMonthlySummary[];
  error?: string;
}

export interface AccountingDashboardResponse {
  success: boolean;
  data: AccountingDashboardSummary;
  error?: string;
}

export interface CategoryDistributionResponse {
  success: boolean;
  data: CategoryDistribution[];
  error?: string;
}

/**
 * Validation Schemas (for Zod integration)
 */
export const COMPANY_CATEGORY_VALUES = [
  '협력업체-원자재',
  '협력업체-외주',
  '소모품업체',
  '기타'
] as const;

export const MONTH_FORMAT_REGEX = /^\d{4}-\d{2}$/;

/**
 * Helper Functions
 */

/**
 * Check if value is valid company category
 */
export function isValidCompanyCategory(value: string): value is CompanyCategory {
  return COMPANY_CATEGORY_VALUES.includes(value as CompanyCategory);
}

/**
 * Format month string to YYYY-MM
 */
export function formatMonth(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  return formatMonth(new Date());
}

/**
 * Get previous month in YYYY-MM format
 */
export function getPreviousMonth(month?: string): string {
  const currentMonth = month || getCurrentMonth();
  const [year, monthNum] = currentMonth.split('-').map(Number);

  if (monthNum === 1) {
    return `${year - 1}-12`;
  }

  return `${year}-${String(monthNum - 1).padStart(2, '0')}`;
}

/**
 * Get date range for last N months
 */
export function getLastNMonths(n: number): { start_month: string; end_month: string } {
  const end_month = getCurrentMonth();
  const [year, month] = end_month.split('-').map(Number);

  const startDate = new Date(year, month - 1);
  startDate.setMonth(startDate.getMonth() - n + 1);

  const start_month = formatMonth(startDate);

  return { start_month, end_month };
}

/**
 * Format currency (KRW)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate growth rate between two values
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Get Korean category label
 */
export function getCategoryLabel(category: CompanyCategory | string | null | undefined): string {
  if (!category) return '미분류';

  const labels: Record<string, string> = {
    [CompanyCategory.RAW_MATERIALS]: '원자재',
    [CompanyCategory.OUTSOURCING]: '외주',
    [CompanyCategory.CONSUMABLES]: '소모품',
    [CompanyCategory.OTHER]: '기타'
  };

  return labels[category] || category;
}

/**
 * Get category color for UI
 */
export function getCategoryColor(category: CompanyCategory | string | null | undefined): string {
  const colors: Record<string, string> = {
    [CompanyCategory.RAW_MATERIALS]: 'bg-gray-500',
    [CompanyCategory.OUTSOURCING]: 'bg-gray-500',
    [CompanyCategory.CONSUMABLES]: 'bg-gray-500',
    [CompanyCategory.OTHER]: 'bg-gray-500'
  };

  return colors[category || ''] || 'bg-gray-400';
}
