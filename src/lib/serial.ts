// 문서 번호 자동 채번 시스템
import { getSupabaseClient } from './db-unified';

export interface SerialData {
  prefix: string;
  year_month: string;
  current_number: number;
}

/**
 * 다음 문서 번호를 생성합니다 (YYMM-#### 형식)
 * @param prefix 접두사 (REC, PRD, SHP 등)
 * @returns 생성된 문서 번호 (예: 2401-0001)
 */
export async function nextSerial(prefix: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // 연도 마지막 2자리
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 월 2자리
  const yearMonth = year + month;

  const supabase = getSupabaseClient();

  // Use Supabase RPC function for atomic serial number generation
  const { data, error } = await (supabase.rpc as any)('get_next_serial', {
    p_prefix: prefix,
    p_year_month: yearMonth
  });

  if (error) {
    throw new Error(`Failed to generate serial number: ${error.message}`);
  }

  // 문서 번호 형식: YYMM-#### (예: 2401-0001)
  const documentNumber = `${yearMonth}-${data.toString().padStart(4, '0')}`;

  return documentNumber;
}

/**
 * 특정 prefix의 현재 시리얼 정보를 조회합니다
 */
export async function getCurrentSerial(prefix: string, yearMonth?: string): Promise<SerialData | null> {
  const now = new Date();
  const currentYearMonth = yearMonth ||
    (now.getFullYear().toString().slice(-2) + (now.getMonth() + 1).toString().padStart(2, '0'));

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('serials')
    .select('prefix, year_month, current_number')
    .eq('prefix', prefix)
    .eq('year_month', currentYearMonth)
    .single();

  if (error || !data) {
    return null;
  }

  return data as SerialData;
}

/**
 * 모든 시리얼 정보를 조회합니다
 */
export async function getAllSerials(): Promise<SerialData[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('serials')
    .select('prefix, year_month, current_number, created_at, updated_at')
    .order('year_month', { ascending: false })
    .order('prefix', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as SerialData[];
}

/**
 * 트랜잭션 유형에 따른 접두사를 반환합니다
 */
export function getTransactionPrefix(transactionType: string): string {
  const prefixMap: Record<string, string> = {
    '입고': 'REC', // Receiving
    '생산': 'PRD', // Production
    '출고': 'SHP', // Shipping
    '조정': 'ADJ', // Adjustment
    '이동': 'TRF', // Transfer
  };

  return prefixMap[transactionType] || 'DOC'; // 기본값
}

/**
 * 문서 번호 형식을 검증합니다
 */
export function validateDocumentNumber(documentNumber: string): boolean {
  const pattern = /^\d{4}-\d{4}$/; // YYMM-#### 형식
  return pattern.test(documentNumber);
}

/**
 * 문서 번호에서 연월 정보를 추출합니다
 */
export function extractYearMonth(documentNumber: string): string | null {
  if (!validateDocumentNumber(documentNumber)) {
    return null;
  }

  return documentNumber.substring(0, 4); // YYMM 부분
}

/**
 * 문서 번호에서 시퀀스 번호를 추출합니다
 */
export function extractSequenceNumber(documentNumber: string): number | null {
  if (!validateDocumentNumber(documentNumber)) {
    return null;
  }

  const sequencePart = documentNumber.substring(5); // #### 부분
  return parseInt(sequencePart, 10);
}