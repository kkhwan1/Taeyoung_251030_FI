import { getSupabaseClient } from '@/lib/db-unified';

export interface ContractValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * 계약 날짜 범위 검증
 */
export function validateDateRange(
  startDate: string,
  endDate: string
): ContractValidationResult {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      valid: false,
      error: '올바른 날짜 형식이 아닙니다.'
    };
  }

  if (end < start) {
    return {
      valid: false,
      error: '종료일은 시작일보다 이후여야 합니다.'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    return {
      valid: true,
      warning: '시작일이 과거입니다. 계속 진행하시겠습니까?'
    };
  }

  return { valid: true };
}

/**
 * 계약 타입 검증
 */
export function validateContractType(
  contractType: string
): ContractValidationResult {
  const validTypes = ['매출계약', '매입계약', '협력계약'];

  if (!validTypes.includes(contractType)) {
    return {
      valid: false,
      error: '올바른 계약 타입이 아닙니다. (매출계약, 매입계약, 협력계약 중 선택)'
    };
  }

  return { valid: true };
}

/**
 * 계약 금액 검증
 */
export function validateContractAmount(
  amount: number
): ContractValidationResult {
  if (amount < 0) {
    return {
      valid: false,
      error: '계약 금액은 0 이상이어야 합니다.'
    };
  }

  if (!Number.isFinite(amount)) {
    return {
      valid: false,
      error: '유효한 숫자를 입력하세요.'
    };
  }

  if (amount > 10000000000) {
    return {
      valid: true,
      warning: '계약 금액이 100억원을 초과합니다. 확인 후 진행하세요.'
    };
  }

  return { valid: true };
}

/**
 * 거래처 활성 상태 검증
 */
export async function validateCompanyActive(
  companyId: number
): Promise<ContractValidationResult> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('companies')
    .select('is_active, company_name')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error || !data) {
    return {
      valid: false,
      error: '거래처를 찾을 수 없습니다.'
    };
  }

  if (!data.is_active) {
    return {
      valid: false,
      error: `비활성화된 거래처입니다: ${data.company_name}`
    };
  }

  return { valid: true };
}

/**
 * 계약 중복 검증 (동일 거래처, 동일 기간)
 */
export async function checkDuplicateContract(
  companyId: number,
  startDate: string,
  endDate: string,
  excludeContractId?: number
): Promise<{ exists: boolean; contracts?: any[] }> {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('contracts')
    .select('contract_id, contract_no, contract_name, start_date, end_date')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);

  if (excludeContractId) {
    query = query.neq('contract_id', excludeContractId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('계약 중복 검증 오류:', error);
    return { exists: false };
  }

  return {
    exists: (data?.length || 0) > 0,
    contracts: data
  };
}

/**
 * 종합 계약 검증 함수
 */
export async function validateContract(
  data: {
    company_id: number;
    contract_type: string;
    start_date: string;
    end_date: string;
    total_amount: number;
  },
  options?: {
    checkDuplicate?: boolean;
    excludeContractId?: number;
  }
): Promise<ContractValidationResult> {
  // 1. 계약 타입 검증
  const typeCheck = validateContractType(data.contract_type);
  if (!typeCheck.valid) {
    return typeCheck;
  }

  // 2. 날짜 범위 검증
  const dateCheck = validateDateRange(data.start_date, data.end_date);
  if (!dateCheck.valid) {
    return dateCheck;
  }

  // 3. 계약 금액 검증
  const amountCheck = validateContractAmount(data.total_amount);
  if (!amountCheck.valid) {
    return amountCheck;
  }

  // 4. 거래처 활성 상태 검증
  const companyCheck = await validateCompanyActive(data.company_id);
  if (!companyCheck.valid) {
    return companyCheck;
  }

  // 5. 중복 검증 (옵션)
  if (options?.checkDuplicate !== false) {
    const duplicate = await checkDuplicateContract(
      data.company_id,
      data.start_date,
      data.end_date,
      options?.excludeContractId
    );

    if (duplicate.exists) {
      const contractNos = duplicate.contracts?.map(c => c.contract_no).join(', ');
      return {
        valid: false,
        error: '동일 거래처의 중복된 계약 기간이 존재합니다.',
        warning: `기존 계약: ${contractNos}`
      };
    }
  }

  // 모든 검증 통과
  return { valid: true };
}

