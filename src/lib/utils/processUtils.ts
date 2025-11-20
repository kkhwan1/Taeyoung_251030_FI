/**
 * processUtils.ts
 *
 * 공정 관리 공통 유틸리티 함수
 * - 상태 스타일 헬퍼
 * - 수율 색상 헬퍼
 * - 날짜 포맷팅
 * - 공정 유효성 검증
 */

export type ProcessStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type ProcessType = '블랭킹' | '전단' | '절곡' | '용접';

/**
 * 공정 상태에 따른 Tailwind CSS 클래스명 반환
 * @param status 공정 상태
 * @returns Tailwind CSS 클래스 문자열
 */
export function getProcessStatusClassName(status: ProcessStatus): string {
  const statusStyles: Record<ProcessStatus, string> = {
    'PENDING': 'bg-yellow-100 text-yellow-800',
    'IN_PROGRESS': 'bg-blue-100 text-blue-800',
    'COMPLETED': 'bg-green-100 text-green-800',
    'CANCELLED': 'bg-gray-100 text-gray-800'
  };

  return statusStyles[status] || statusStyles.PENDING;
}

/**
 * 공정 상태에 따른 한글 라벨 반환
 * @param status 공정 상태
 * @returns 한글 상태 라벨
 */
export function getProcessStatusLabel(status: ProcessStatus): string {
  const statusLabels: Record<ProcessStatus, string> = {
    'PENDING': '대기',
    'IN_PROGRESS': '진행중',
    'COMPLETED': '완료',
    'CANCELLED': '취소'
  };

  return statusLabels[status] || status;
}

/**
 * 수율에 따른 색상 클래스 반환
 * - ≥95%: 녹색 (우수)
 * - ≥90%: 노란색 (양호)
 * - <90%: 빨간색 (개선 필요)
 *
 * @param yieldRate 수율 (0-100)
 * @returns Tailwind CSS 텍스트 색상 클래스
 */
export function getYieldRateColorClass(yieldRate: number): string {
  if (yieldRate >= 95) return 'text-green-600 font-semibold';
  if (yieldRate >= 90) return 'text-yellow-600 font-semibold';
  return 'text-red-600 font-semibold';
}

/**
 * 수율 계산 함수
 * @param input 투입 수량
 * @param output 산출 수량
 * @returns 수율 (0-100), 소수점 2자리
 */
export function calculateYieldRate(input: number, output: number): number {
  if (input <= 0) return 0;
  const rate = (output / input) * 100;
  return Math.round(rate * 100) / 100; // 소수점 2자리 반올림
}

/**
 * 공정 완료 가능 여부 확인
 * @param status 공정 상태
 * @returns 완료 가능 여부
 */
export function canCompleteProcess(status: ProcessStatus): boolean {
  return status === 'PENDING' || status === 'IN_PROGRESS';
}

/**
 * 공정 취소 가능 여부 확인
 * @param status 공정 상태
 * @returns 취소 가능 여부
 */
export function canCancelProcess(status: ProcessStatus): boolean {
  return status === 'PENDING' || status === 'IN_PROGRESS';
}

/**
 * 공정 수정 가능 여부 확인
 * @param status 공정 상태
 * @returns 수정 가능 여부
 */
export function canEditProcess(status: ProcessStatus): boolean {
  return status === 'PENDING';
}

/**
 * 공정 날짜 포맷팅
 * @param date 날짜 문자열 또는 Date 객체
 * @returns 한글 날짜 형식 (YYYY년 M월 D일)
 */
export function formatProcessDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * 공정 날짜시간 포맷팅
 * @param datetime 날짜시간 문자열 또는 Date 객체
 * @returns 한글 날짜시간 형식 (YYYY년 M월 D일 HH:MM)
 */
export function formatProcessDateTime(datetime: string | Date): string {
  const d = new Date(datetime);
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 수량 한글 포맷팅
 * @param quantity 수량
 * @param decimals 소수점 자릿수 (기본: 2)
 * @returns 쉼표 구분 숫자 문자열
 */
export function formatQuantity(quantity: number, decimals: number = 2): string {
  return quantity.toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}


/**
 * 공정 타입 검증
 * @param value 검증할 값
 * @returns ProcessType | null
 */
export function validateProcessType(value: string): ProcessType | null {
  const validTypes: ProcessType[] = ['블랭킹', '전단', '절곡', '용접'];
  return validTypes.includes(value as ProcessType) ? (value as ProcessType) : null;
}

/**
 * 공정 상태 검증
 * @param value 검증할 값
 * @returns ProcessStatus | null
 */
export function validateProcessStatus(value: string): ProcessStatus | null {
  const validStatuses: ProcessStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  return validStatuses.includes(value as ProcessStatus) ? (value as ProcessStatus) : null;
}

/**
 * 수율 경고 메시지 생성
 * @param yieldRate 수율
 * @returns 경고 메시지 (문제 없으면 null)
 */
export function getYieldRateWarning(yieldRate: number): string | null {
  if (yieldRate > 100) {
    return '[WARN] 수율이 100%를 초과했습니다. 입력값을 확인해주세요.';
  }
  if (yieldRate < 85) {
    return '[WARN] 수율이 낮습니다. 공정을 점검하시기 바랍니다.';
  }
  return null;
}

/**
 * 공정 통계 계산
 * @param processes 공정 배열
 * @returns 공정 통계 객체
 */
export function calculateProcessStats(processes: Array<{ status: ProcessStatus; yield_rate: number }>) {
  return {
    total: processes.length,
    pending: processes.filter(p => p.status === 'PENDING').length,
    inProgress: processes.filter(p => p.status === 'IN_PROGRESS').length,
    completed: processes.filter(p => p.status === 'COMPLETED').length,
    cancelled: processes.filter(p => p.status === 'CANCELLED').length,
    averageYield: processes.length > 0
      ? processes.reduce((sum, p) => sum + p.yield_rate, 0) / processes.length
      : 0
  };
}
