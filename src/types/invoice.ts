/**
 * Invoice-related type definitions
 * 계산서 관련 타입 정의
 */

/**
 * Invoice Item - 계산서 품목 상세
 * Represents a single line item in an invoice
 */
export interface InvoiceItem {
  invoice_item_id?: number;
  transaction_id?: number;
  item_id: number;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  line_no?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Invoice Item Create - 계산서 품목 생성용
 */
export interface InvoiceItemCreate {
  transaction_id: number;
  item_id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
  line_no: number;
  notes?: string;
}

/**
 * Invoice Item Update - 계산서 품목 수정용
 */
export interface InvoiceItemUpdate {
  item_id?: number;
  quantity?: number;
  unit_price?: number;
  total_amount?: number;
  line_no?: number;
  notes?: string;
}

/**
 * Payment Split - 복합 결제
 * Represents a payment split for complex payment scenarios
 */
export interface PaymentSplit {
  payment_split_id?: number;
  transaction_id?: number;
  payment_method: 'CASH' | 'CARD' | 'BILL' | 'CHECK' | 'CREDIT';
  amount: number;
  bill_number?: string;
  bill_date?: string;
  check_number?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Payment Split Create - 복합 결제 생성용
 */
export interface PaymentSplitCreate {
  transaction_id: number;
  payment_method: 'CASH' | 'CARD' | 'BILL' | 'CHECK' | 'CREDIT';
  amount: number;
  bill_number?: string;
  bill_date?: string;
  check_number?: string;
  notes?: string;
}

/**
 * Payment Method Display Names - 결제 수단 표시명
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentSplit['payment_method'], string> = {
  CASH: '현금',
  CARD: '카드',
  BILL: '어음',
  CHECK: '수표',
  CREDIT: '외상'
};

/**
 * Invoice with Items - 계산서 품목 포함
 */
export interface InvoiceWithItems {
  transaction_id: number;
  transaction_no: string;
  transaction_date: string;
  customer_id: number;
  total_amount: number;
  payment_status: string;
  items: InvoiceItem[];
  payment_splits?: PaymentSplit[];
}

/**
 * Monthly Breakdown - 월별 집계
 */
export interface MonthlyBreakdown {
  month: string; // YYYY-MM
  total_amount: number;
  collected_amount: number;
  outstanding_amount: number;
}

/**
 * Monthly Item Breakdown - 월별 품목 집계
 */
export interface MonthlyItemBreakdown {
  month: string; // YYYY-MM
  quantity: number;
  amount: number;
}

/**
 * Customer Grouping - 고객사별 집계
 */
export interface CustomerGrouping {
  customer_id: number;
  customer_name: string;
  total_amount: number;
  collected_amount: number;
  outstanding_amount: number;
  transaction_count: number;
  monthly_breakdown: MonthlyBreakdown[];
}

/**
 * Item Grouping - 품목별 집계
 */
export interface ItemGrouping {
  item_id: number;
  item_name: string;
  total_quantity: number;
  total_amount: number;
  transaction_count: number;
  monthly_breakdown: MonthlyItemBreakdown[];
}
