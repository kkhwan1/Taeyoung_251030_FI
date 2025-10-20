/**
 * 부가세 및 금액 계산 유틸리티
 * 한국 부가세법 기준 (기본 10%)
 */

export interface TaxCalculationInput {
  quantity: number;
  unitPrice: number;
  taxRate?: number; // 기본 10%
  currency?: string; // 기본 KRW
  exchangeRate?: number; // 외화 환율
}

export interface TaxCalculationResult {
  subtotalAmount: number; // 공급가액 (수량 × 단가)
  taxAmount: number; // 부가세액
  grandTotal: number; // 합계 (공급가액 + 부가세)
  totalAmount: number; // 원화 환산 금액
  currency: string;
  exchangeRate: number;
  taxRate: number;
}

export interface BulkTaxCalculationInput {
  items: Array<{
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
  currency?: string;
  exchangeRate?: number;
  globalTaxRate?: number; // 전체 적용 세율
}

export interface BulkTaxCalculationResult {
  items: Array<{
    subtotalAmount: number;
    taxAmount: number;
    grandTotal: number;
  }>;
  totalSubtotal: number;
  totalTax: number;
  totalGrand: number;
  totalAmountKRW: number; // 원화 환산 총액
  currency: string;
  exchangeRate: number;
}

/**
 * 기본 부가세율 (10%)
 */
export const DEFAULT_TAX_RATE = 10.00;

/**
 * 지원 통화 목록
 */
export const SUPPORTED_CURRENCIES = {
  KRW: '원',
  USD: '달러',
  JPY: '엔',
  CNY: '위안',
  EUR: '유로'
} as const;

/**
 * 단일 항목 부가세 계산
 */
export function calculateTax(input: TaxCalculationInput): TaxCalculationResult {
  const {
    quantity,
    unitPrice,
    taxRate = DEFAULT_TAX_RATE,
    currency = 'KRW',
    exchangeRate = 1.0
  } = input;

  // 소계 계산 (수량 × 단가)
  const subtotalAmount = Math.round(quantity * unitPrice * 100) / 100;

  // 부가세 계산
  const taxAmount = Math.round(subtotalAmount * (taxRate / 100) * 100) / 100;

  // 합계 계산 (소계 + 부가세)
  const grandTotal = subtotalAmount + taxAmount;

  // 원화 환산 (외화인 경우)
  const totalAmount = currency !== 'KRW' && exchangeRate > 0
    ? Math.round(grandTotal * exchangeRate * 100) / 100
    : grandTotal;

  return {
    subtotalAmount,
    taxAmount,
    grandTotal,
    totalAmount,
    currency,
    exchangeRate,
    taxRate
  };
}

/**
 * 복수 항목 부가세 계산
 */
export function calculateBulkTax(input: BulkTaxCalculationInput): BulkTaxCalculationResult {
  const {
    items,
    currency = 'KRW',
    exchangeRate = 1.0,
    globalTaxRate
  } = input;

  let totalSubtotal = 0;
  let totalTax = 0;
  let totalGrand = 0;

  const calculatedItems = items.map(item => {
    const taxRate = globalTaxRate ?? item.taxRate ?? DEFAULT_TAX_RATE;

    // 항목별 계산
    const subtotalAmount = Math.round(item.quantity * item.unitPrice * 100) / 100;
    const taxAmount = Math.round(subtotalAmount * (taxRate / 100) * 100) / 100;
    const grandTotal = subtotalAmount + taxAmount;

    // 누적 합계
    totalSubtotal += subtotalAmount;
    totalTax += taxAmount;
    totalGrand += grandTotal;

    return {
      subtotalAmount,
      taxAmount,
      grandTotal
    };
  });

  // 원화 환산
  const totalAmountKRW = currency !== 'KRW' && exchangeRate > 0
    ? Math.round(totalGrand * exchangeRate * 100) / 100
    : totalGrand;

  return {
    items: calculatedItems,
    totalSubtotal: Math.round(totalSubtotal * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    totalGrand: Math.round(totalGrand * 100) / 100,
    totalAmountKRW,
    currency,
    exchangeRate
  };
}

/**
 * 부가세 역계산 (총액에서 공급가액과 부가세 분리)
 */
export function reverseTaxCalculation(
  totalAmount: number,
  taxRate: number = DEFAULT_TAX_RATE
): { subtotal: number; tax: number } {
  // 공급가액 = 총액 / (1 + 세율)
  const subtotal = Math.round(totalAmount / (1 + taxRate / 100) * 100) / 100;

  // 부가세 = 총액 - 공급가액
  const tax = Math.round((totalAmount - subtotal) * 100) / 100;

  return { subtotal, tax };
}

/**
 * 세금계산서 번호 생성
 * 형식: YYYYMMDD-XXXX (일자-순번)
 */
export function generateTaxInvoiceNumber(date: Date = new Date(), sequence: number = 1): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');

  return `${year}${month}${day}-${seq}`;
}

/**
 * 금액을 한국 원화 형식으로 포맷팅
 */
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * 외화를 해당 통화 형식으로 포맷팅
 */
export function formatCurrency(amount: number, currency: string = 'KRW'): string {
  const locale = currency === 'KRW' ? 'ko-KR' :
                 currency === 'USD' ? 'en-US' :
                 currency === 'JPY' ? 'ja-JP' :
                 currency === 'CNY' ? 'zh-CN' :
                 currency === 'EUR' ? 'de-DE' : 'en-US';

  const decimals = currency === 'KRW' || currency === 'JPY' ? 0 : 2;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);
}

/**
 * 부가세 포함/미포함 여부 확인
 */
export function isTaxIncluded(
  totalAmount: number,
  subtotalAmount: number,
  taxRate: number = DEFAULT_TAX_RATE
): boolean {
  const expectedTax = subtotalAmount * (taxRate / 100);
  const expectedTotal = subtotalAmount + expectedTax;

  // 1원 단위 오차 허용
  return Math.abs(totalAmount - expectedTotal) < 1;
}

/**
 * 세금계산서 발행 가능 여부 체크
 */
export function canIssueTaxInvoice(data: {
  supplierBusinessNumber?: string;
  buyerBusinessNumber?: string;
  amount: number;
}): { canIssue: boolean; reason?: string } {
  // 사업자번호 체크
  if (!data.supplierBusinessNumber) {
    return { canIssue: false, reason: '공급자 사업자번호가 없습니다.' };
  }

  if (!data.buyerBusinessNumber) {
    return { canIssue: false, reason: '공급받는자 사업자번호가 없습니다.' };
  }

  // 금액 체크
  if (data.amount <= 0) {
    return { canIssue: false, reason: '발행 금액이 0원 이하입니다.' };
  }

  return { canIssue: true };
}

/**
 * 사업자번호 유효성 검증 (간단한 형식 체크)
 */
export function validateBusinessNumber(businessNumber: string): boolean {
  // 하이픈 제거
  const cleaned = businessNumber.replace(/-/g, '');

  // 10자리 숫자인지 확인
  if (!/^\d{10}$/.test(cleaned)) {
    return false;
  }

  // TODO: 실제 사업자번호 검증 알고리즘 구현
  // 여기서는 형식만 체크

  return true;
}

/**
 * 세율 옵션 목록
 */
export const TAX_RATE_OPTIONS = [
  { value: 0, label: '영세율 (0%)' },
  { value: 10, label: '일반과세 (10%)' },
  { value: -1, label: '면세' }
];