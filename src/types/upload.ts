// Excel 업로드 관련 타입 정의
import { type CoatingStatus as SharedCoatingStatus, VALID_COATING_STATUSES as SHARED_VALID_COATING_STATUSES } from '@/lib/constants/coatingStatus';

export interface ValidationError {
  row: number;
  field: string;
  value: unknown;
  message: string;
}

export interface UploadResult {
  success: boolean;
  total_rows: number;
  success_count: number;
  error_count: number;
  errors: ValidationError[];
  duplicates: string[];
}

export interface ExcelItemData {
  item_code: string;
  item_name: string;
  item_type: string;
  car_model?: string;
  spec?: string;
  unit: string;
  unit_price?: number;
  min_stock_level?: number;
  location?: string;
  coating_status?: SharedCoatingStatus;
}

export interface ExcelCompanyData {
  company_name: string;
  company_type: string;
  business_number?: string;
  representative?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  address?: string;
  payment_terms?: string;
  contact_info?: string;
  notes?: string;
}

// 유효한 값들
export const VALID_ITEM_TYPES = ['원자재', '부자재', '반제품', '제품', '상품'] as const;
export const VALID_COMPANY_TYPES = ['고객사', '공급사', '협력사', '기타'] as const;
// VALID_COATING_STATUSES now imported from @/lib/constants/coatingStatus
export const VALID_COATING_STATUSES = SHARED_VALID_COATING_STATUSES;

export type ItemType = typeof VALID_ITEM_TYPES[number];
export type CompanyType = typeof VALID_COMPANY_TYPES[number];
export type CoatingStatus = SharedCoatingStatus;