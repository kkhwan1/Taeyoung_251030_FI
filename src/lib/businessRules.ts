/**
 * Business Rules for Price History Management
 * 가격 이력 관리 비즈니스 규칙
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 규칙 1: 가격 인상률 경고
 * Price increase rate warning
 */
export function validatePriceIncrease(
  oldPrice: number,
  newPrice: number
): { valid: boolean; warning?: string } {
  const increaseRate = ((newPrice - oldPrice) / oldPrice) * 100;

  if (increaseRate > 100) {
    return {
      valid: true,
      warning: `가격 인상률이 ${increaseRate.toFixed(1)}%로 100%를 초과합니다. 확인 후 진행하세요.`
    };
  }

  if (increaseRate < -50) {
    return {
      valid: true,
      warning: `가격 하락률이 ${Math.abs(increaseRate).toFixed(1)}%로 50%를 초과합니다. 확인 후 진행하세요.`
    };
  }

  return { valid: true };
}

/**
 * 규칙 2: 음수 가격 차단
 * Negative price validation
 */
export function validatePositivePrice(price: number): {
  valid: boolean;
  error?: string;
} {
  if (price <= 0) {
    return {
      valid: false,
      error: '단가는 0보다 커야 합니다.'
    };
  }

  if (!Number.isFinite(price)) {
    return {
      valid: false,
      error: '유효한 숫자를 입력하세요.'
    };
  }

  return { valid: true };
}

/**
 * 규칙 3: 월별 중복 검증
 * Duplicate price month validation
 */
export async function checkDuplicatePriceMonth(
  itemId: number,
  priceMonth: string,
  supabase: SupabaseClient
): Promise<{ exists: boolean; currentPrice?: number }> {
  const { data, error } = await supabase
    .from('item_price_history')
    .select('unit_price')
    .eq('item_id', itemId)
    .eq('price_month', priceMonth)
    .maybeSingle();

  if (error) {
    console.error('Error checking duplicate price month:', error);
    return { exists: false };
  }

  return {
    exists: !!data,
    currentPrice: data?.unit_price
  };
}

/**
 * 규칙 4: 가격 범위 검증
 * Price range validation
 */
export function validatePriceRange(
  price: number,
  minPrice?: number,
  maxPrice?: number
): { valid: boolean; error?: string } {
  if (minPrice !== undefined && price < minPrice) {
    return {
      valid: false,
      error: `단가는 최소 ${minPrice.toLocaleString('ko-KR')}원 이상이어야 합니다.`
    };
  }

  if (maxPrice !== undefined && price > maxPrice) {
    return {
      valid: false,
      error: `단가는 최대 ${maxPrice.toLocaleString('ko-KR')}원 이하여야 합니다.`
    };
  }

  return { valid: true };
}

/**
 * 규칙 5: 날짜 형식 검증
 * Date format validation (YYYY-MM)
 */
export function validatePriceMonth(priceMonth: string): {
  valid: boolean;
  error?: string;
} {
  const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

  if (!monthPattern.test(priceMonth)) {
    return {
      valid: false,
      error: '올바른 날짜 형식(YYYY-MM)을 입력하세요.'
    };
  }

  // Check if date is in the future
  const inputDate = new Date(priceMonth + '-01');
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (inputDate > currentMonth) {
    return {
      valid: false,
      error: '미래 날짜는 입력할 수 없습니다.'
    };
  }

  return { valid: true };
}

/**
 * 규칙 6: 품목 활성화 상태 검증
 * Item active status validation
 */
export async function validateItemActive(
  itemId: number,
  supabase: SupabaseClient
): Promise<{ valid: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('items')
    .select('is_active')
    .eq('item_id', itemId)
    .maybeSingle();

  if (error || !data) {
    return {
      valid: false,
      error: '품목을 찾을 수 없습니다.'
    };
  }

  if (!data.is_active) {
    return {
      valid: false,
      error: '비활성화된 품목입니다.'
    };
  }

  return { valid: true };
}

/**
 * 종합 검증 함수
 * Comprehensive validation function
 */
export async function validatePriceHistoryEntry(
  data: {
    item_id: number;
    price_month: string;
    unit_price: number;
  },
  supabase: SupabaseClient,
  options?: {
    checkDuplicate?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }
): Promise<{
  valid: boolean;
  error?: string;
  warning?: string;
  details?: any;
}> {
  // 1. 양수 가격 검증
  const priceCheck = validatePositivePrice(data.unit_price);
  if (!priceCheck.valid) {
    return priceCheck;
  }

  // 2. 가격 범위 검증
  if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
    const rangeCheck = validatePriceRange(
      data.unit_price,
      options.minPrice,
      options.maxPrice
    );
    if (!rangeCheck.valid) {
      return rangeCheck;
    }
  }

  // 3. 날짜 형식 검증
  const dateCheck = validatePriceMonth(data.price_month);
  if (!dateCheck.valid) {
    return dateCheck;
  }

  // 4. 품목 활성화 상태 검증
  const itemCheck = await validateItemActive(data.item_id, supabase);
  if (!itemCheck.valid) {
    return itemCheck;
  }

  // 5. 중복 체크 및 인상률 경고
  if (options?.checkDuplicate !== false) {
    const duplicate = await checkDuplicatePriceMonth(
      data.item_id,
      data.price_month,
      supabase
    );

    if (duplicate.exists && duplicate.currentPrice) {
      const increaseCheck = validatePriceIncrease(
        duplicate.currentPrice,
        data.unit_price
      );

      return {
        valid: false,
        error: '이미 해당 월의 가격 이력이 존재합니다.',
        warning: increaseCheck.warning,
        details: {
          current_price: duplicate.currentPrice,
          new_price: data.unit_price,
          increase_rate: ((data.unit_price - duplicate.currentPrice) / duplicate.currentPrice * 100).toFixed(1)
        }
      };
    }
  }

  return { valid: true };
}
