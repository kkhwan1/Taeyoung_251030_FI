// 문서 상태 관리 및 워크플로우 시스템
import { supabaseAdmin, handleSupabaseError } from './db-unified';

export type DocState = "DRAFT" | "APPROVED" | "CONFIRMED" | "CANCELED";

export type DocumentType = "INVENTORY_TRANSACTION";

export interface StatusHistoryRecord {
  id: number;
  document_type: DocumentType;
  document_id: number;
  document_number: string;
  previous_status: DocState | null;
  new_status: DocState;
  changed_by: number;
  change_reason: string | null;
  created_at: Date;
}

/**
 * 상태 전이 규칙 정의
 */
export const canTransit: Record<DocState, DocState[]> = {
  DRAFT: ["APPROVED", "CANCELED"],
  APPROVED: ["CONFIRMED", "CANCELED"],
  CONFIRMED: [], // 확정 후에는 변경 불가
  CANCELED: [], // 취소 후에는 변경 불가
};

/**
 * 상태 전이가 가능한지 검증합니다
 */
export function canTransitTo(currentStatus: DocState, newStatus: DocState): boolean {
  return canTransit[currentStatus].includes(newStatus);
}

/**
 * 상태 전이를 수행하고 이력을 기록합니다
 *
 * NOTE: Supabase doesn't support automatic transaction rollback like MySQL.
 * If the history insert fails, the status update is already committed.
 * Consider implementing compensating transactions or using PostgreSQL functions
 * with proper transaction handling for critical operations.
 */
export async function transitDocumentStatus(
  documentType: DocumentType,
  documentId: number,
  documentNumber: string,
  currentStatus: DocState,
  newStatus: DocState,
  changedBy: number,
  changeReason?: string
): Promise<void> {
  // 상태 전이 가능성 검증
  if (!canTransitTo(currentStatus, newStatus)) {
    throw new Error(
      `상태 전이가 불가능합니다: ${currentStatus} → ${newStatus}. ` +
      `가능한 상태: ${canTransit[currentStatus].join(', ')}`
    );
  }

  // Step 1: Update document status
  let updateError: any;

  switch (documentType) {
    case 'INVENTORY_TRANSACTION':
      const { error } = await supabaseAdmin
        .from('inventory_transactions')
        .update({
          document_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_id', documentId);
      updateError = error;
      break;
    default:
      throw new Error(`지원하지 않는 문서 유형: ${documentType}`);
  }

  if (updateError) {
    throw new Error(`상태 업데이트 실패: ${updateError.message}`);
  }

  // Step 2: Insert history record
  // NOTE: document_status_history table doesn't exist in Supabase yet
  // This functionality is disabled until the table is created
  /*
  const { error: historyError } = await supabaseAdmin
    .from('document_status_history')
    .insert({
      document_type: documentType,
      document_id: documentId,
      document_number: documentNumber,
      previous_status: currentStatus as string,
      new_status: newStatus as string,
      changed_by: changedBy,
      change_reason: changeReason || null
    } as any);

  if (historyError) {
    // Log error - status update is already committed, cannot rollback
    console.error('History insert failed after status update:', historyError);
    throw new Error(`이력 기록 실패: ${historyError.message}`);
  }
  */
}

/**
 * 문서의 상태 변경 이력을 조회합니다
 * NOTE: document_status_history table doesn't exist - returns empty array
 */
export async function getDocumentStatusHistory(
  documentType: DocumentType,
  documentId: number
): Promise<StatusHistoryRecord[]> {
  // Table doesn't exist yet, return empty array
  return [];

  /*
  const { data, error } = await supabaseAdmin
    .from('document_status_history')
    .select<'*', StatusHistoryRecord>('*')
    .eq('document_type', documentType)
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`상태 이력 조회 실패: ${error.message}`);
  }

  return data || [];
  */
}

/**
 * 문서 번호로 상태 변경 이력을 조회합니다
 * NOTE: document_status_history table doesn't exist - returns empty array
 */
export async function getDocumentStatusHistoryByNumber(
  documentNumber: string
): Promise<StatusHistoryRecord[]> {
  // Table doesn't exist yet, return empty array
  return [];

  /*
  const { data, error } = await supabaseAdmin
    .from('document_status_history')
    .select<'*', StatusHistoryRecord>('*')
    .eq('document_number', documentNumber)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`상태 이력 조회 실패: ${error.message}`);
  }

  return data || [];
  */
}

/**
 * 상태별 문서 수를 조회합니다
 */
export async function getDocumentStatusSummary(
  documentType: DocumentType
): Promise<Record<DocState, number>> {
  let data: any[] | null = null;
  let error: any = null;

  switch (documentType) {
    case 'INVENTORY_TRANSACTION':
      const result = await supabaseAdmin
        .from('inventory_transactions')
        .select('document_status')
        .eq('is_active', true);
      data = result.data;
      error = result.error;
      break;
    default:
      throw new Error(`지원하지 않는 문서 유형: ${documentType}`);
  }

  if (error) {
    throw new Error(`상태 요약 조회 실패: ${error.message}`);
  }

  // 모든 상태를 0으로 초기화
  const summary: Record<DocState, number> = {
    DRAFT: 0,
    APPROVED: 0,
    CONFIRMED: 0,
    CANCELED: 0
  };

  // 실제 데이터로 업데이트 (TypeScript에서 수동으로 집계)
  data?.forEach((row) => {
    if (row.document_status in summary) {
      summary[row.document_status as DocState]++;
    }
  });

  return summary;
}

/**
 * 상태 한국어 라벨을 반환합니다
 */
export function getStatusLabel(status: DocState): string {
  const statusLabels: Record<DocState, string> = {
    DRAFT: '초안',
    APPROVED: '승인',
    CONFIRMED: '확정',
    CANCELED: '취소'
  };

  return statusLabels[status];
}

/**
 * 상태 색상을 반환합니다 (UI용)
 */
export function getStatusColor(status: DocState): string {
  const statusColors: Record<DocState, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    CANCELED: 'bg-red-100 text-red-800'
  };

  return statusColors[status];
}

/**
 * 다음 가능한 상태들을 반환합니다
 */
export function getNextPossibleStates(currentStatus: DocState): DocState[] {
  return canTransit[currentStatus];
}

/**
 * 상태 전이 권한을 검증합니다 (향후 확장 가능)
 */
export function canUserTransitStatus(
  userId: number,
  currentStatus: DocState,
  newStatus: DocState
): boolean {
  // 기본적으로 모든 사용자가 상태 전이 가능
  // 향후 역할 기반 권한 시스템 구현 시 확장
  return canTransitTo(currentStatus, newStatus);
}

/**
 * 상태 전이 사유를 검증합니다
 */
export function validateTransitionReason(
  currentStatus: DocState,
  newStatus: DocState,
  reason?: string
): boolean {
  // 취소로 전이할 때는 사유가 필수
  if (newStatus === 'CANCELED' && (!reason || reason.trim().length === 0)) {
    return false;
  }

  // 확정으로 전이할 때는 사유가 권장 (선택사항)
  return true;
}