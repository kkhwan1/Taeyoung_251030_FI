/**
 * TypeScript Type Definitions for Excel Data Migration
 *
 * Maps Excel column structures to Supabase database types
 */

import { Database } from '@/types/supabase';

// ============================================================================
// EXCEL RAW DATA TYPES (직접 파싱된 형태)
// ============================================================================

/**
 * BOM Excel 원본 데이터
 */
export interface BomExcelRow {
  고객사: string;
  차종: string;
  품번: string;
  품명: string;
  규격: string;
  단위: string;
  '단위중량(KG)': number;
  'L(종)': number;
  'W(횡)': number;
  'B(Board)': number;
  '출고단가': number;
  '자재비': number;
  level: number; // 1 or 2
}

/**
 * 매입수불 Excel 원본 데이터 (8개 시트)
 */
export interface InventoryExcelRow {
  품번: string;
  품명: string;
  규격: string;
  단위: string;
  // T1 ~ T268 컬럼 (268일치 일별 데이터)
  [key: `T${number}`]: number;
}

/**
 * 종합관리 SHEET Excel 원본 데이터
 */
export interface ComprehensiveExcelRow {
  품목코드: string;
  품목명: string;
  규격: string;
  단위: string;
  거래처코드?: string;
  거래처명?: string;
  현재재고?: number;
  안전재고?: number;
  // ... 추가 필드
}

/**
 * 매입매출 Excel 원본 데이터
 */
export interface PurchaseSalesExcelRow {
  거래일자: string;
  거래처명: string;
  품목코드: string;
  품목명: string;
  규격: string;
  수량: number;
  단가: number;
  금액: number;
  부가세: number;
  합계: number;
  비고?: string;
  거래구분: '매입' | '매출';
}

/**
 * COIL Spec Excel 원본 데이터
 */
export interface CoilSpecExcelRow {
  품번: string;
  품명: string;
  비중: number;       // density
  길이: number;       // length (mm)
  폭: number;         // width (mm)
  두께: number;       // thickness (mm)
  SEP계수: number;    // sep_factor
  'KG단가': number;   // kg_unit_price
}

/**
 * 스크랩 추적 Excel 원본 데이터
 */
export interface ScrapTrackingExcelRow {
  생산일자: string;
  품목코드: string;
  품목명: string;
  실적수량: number;
  스크랩중량: number;  // kg
  스크랩단가: number;  // 원/kg
}

// ============================================================================
// PARSED & TRANSFORMED DATA TYPES (데이터베이스 임포트 준비 완료)
// ============================================================================

/**
 * 변환된 거래처 데이터
 */
export type ParsedCompany = Database['public']['Tables']['companies']['Insert'];

/**
 * 변환된 품목 데이터
 */
export type ParsedItem = Database['public']['Tables']['items']['Insert'];

/**
 * 변환된 BOM 데이터
 */
export type ParsedBom = Database['public']['Tables']['bom']['Insert'];

/**
 * 변환된 COIL 사양 데이터
 */
export type ParsedCoilSpec = Database['public']['Tables']['coil_specs']['Insert'];

/**
 * 변환된 재고 거래 데이터
 */
export type ParsedInventoryTransaction = Database['public']['Tables']['inventory_transactions']['Insert'];

/**
 * 변환된 매입 거래 데이터
 */
export type ParsedPurchaseTransaction = Database['public']['Tables']['purchase_transactions']['Insert'];

/**
 * 변환된 매출 거래 데이터
 */
export type ParsedSalesTransaction = Database['public']['Tables']['sales_transactions']['Insert'];

/**
 * 변환된 단가 마스터 데이터
 */
export type ParsedPriceMaster = Database['public']['Tables']['price_master']['Insert'];

/**
 * 변환된 스크랩 추적 데이터
 */
export type ParsedScrapTracking = Database['public']['Tables']['scrap_tracking']['Insert'];

// ============================================================================
// VALIDATION & ERROR TYPES
// ============================================================================

/**
 * 검증 에러
 */
export interface ValidationError {
  field: string;
  value: any;
  error: string;
  message: string;
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * 파싱 결과
 */
export interface ParseResult<T> {
  success: boolean;
  data: T[];
  errors: Array<{
    row: number;
    field: string;
    error: string;
  }>;
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

// ============================================================================
// MIGRATION STATE & PROGRESS
// ============================================================================

/**
 * 마이그레이션 진행 상태
 */
export interface MigrationProgress {
  phase: string;
  current: number;
  total: number;
  percentage: number;
  startTime: number;
  estimatedTimeRemaining?: number;
}

/**
 * 마이그레이션 결과
 */
export interface MigrationResult {
  phase: string;
  success: boolean;
  recordsProcessed: number;
  recordsSuccess: number;
  recordsFailed: number;
  duration: number;
  errors: any[];
}

/**
 * 전체 마이그레이션 요약
 */
export interface MigrationSummary {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  phases: MigrationResult[];
  totalRecordsProcessed: number;
  totalRecordsSuccess: number;
  totalRecordsFailed: number;
  overallSuccess: boolean;
}

// ============================================================================
// LOOKUP MAPS (FK 매핑용)
// ============================================================================

/**
 * 거래처 코드 → ID 매핑
 */
export type CompanyCodeMap = Map<string, number>;

/**
 * 품목 코드 → ID 매핑
 */
export type ItemCodeMap = Map<string, number>;

/**
 * 창고 코드 → ID 매핑
 */
export type WarehouseCodeMap = Map<string, number>;
