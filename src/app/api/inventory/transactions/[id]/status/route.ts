import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db-unified';
import { transitDocumentStatus, canTransitTo, getStatusLabel, getNextPossibleStates } from '@/lib/workflow';

export const dynamic = 'force-dynamic';


interface StatusTransitionRequest {
  new_status: 'DRAFT' | 'APPROVED' | 'CONFIRMED' | 'CANCELED';
  change_reason?: string;
  changed_by: number;
}

/**
 * GET /api/inventory/transactions/[id]/status
 * 문서 상태와 가능한 전이 상태를 조회합니다
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const transactionId = parseInt(id);

    if (isNaN(transactionId)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 거래 ID입니다.'
      }, { status: 400 });
    }

    // 현재 문서 상태 조회
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_id, document_number, status, transaction_type, created_at, updated_at')
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .single();

    if (txError || !transaction) {
      return NextResponse.json({
        success: false,
        error: '거래를 찾을 수 없습니다.'
      }, { status: 404 });
    }
    const currentStatus = transaction.status as 'DRAFT' | 'APPROVED' | 'CONFIRMED' | 'CANCELED';
    const nextPossibleStates = getNextPossibleStates(currentStatus);

    return NextResponse.json({
      success: true,
      data: {
        transaction_id: transaction.transaction_id,
        document_number: transaction.document_number,
        current_status: currentStatus,
        current_status_label: getStatusLabel(currentStatus),
        next_possible_states: nextPossibleStates.map(status => ({
          status,
          label: getStatusLabel(status)
        })),
        can_change_status: nextPossibleStates.length > 0,
        transaction_type: transaction.transaction_type,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching document status:', error);
    return NextResponse.json({
      success: false,
      error: '문서 상태 조회 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * PUT /api/inventory/transactions/[id]/status
 * 문서 상태를 전이합니다
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const transactionId = parseInt(id);

    if (isNaN(transactionId)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 거래 ID입니다.'
      }, { status: 400 });
    }

    const text = await request.text();
    const body: StatusTransitionRequest = JSON.parse(text);
    const { new_status, change_reason, changed_by } = body;

    // 필수 필드 검증
    if (!new_status || !changed_by) {
      return NextResponse.json({
        success: false,
        error: '새 상태와 변경자는 필수입니다.'
      }, { status: 400 });
    }

    // 유효한 상태값 검증
    const validStatuses = ['DRAFT', 'APPROVED', 'CONFIRMED', 'CANCELED'];
    if (!validStatuses.includes(new_status)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 상태입니다.'
      }, { status: 400 });
    }

    // 현재 문서 정보 조회
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_id, document_number, status, transaction_type')
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .single();

    if (txError || !transaction) {
      return NextResponse.json({
        success: false,
        error: '거래를 찾을 수 없습니다.'
      }, { status: 404 });
    }
    const currentStatus = transaction.status as 'DRAFT' | 'APPROVED' | 'CONFIRMED' | 'CANCELED';
    const documentNumber = transaction.document_number;

    // 문서 번호 검증
    if (!documentNumber) {
      return NextResponse.json({
        success: false,
        error: '문서 번호가 없습니다.'
      }, { status: 400 });
    }

    // 상태 전이 가능성 검증
    if (!canTransitTo(currentStatus, new_status)) {
      const nextPossibleStates = getNextPossibleStates(currentStatus);
      return NextResponse.json({
        success: false,
        error: `${getStatusLabel(currentStatus)}에서 ${getStatusLabel(new_status)}로 전이할 수 없습니다. 가능한 상태: ${nextPossibleStates.map(s => getStatusLabel(s)).join(', ')}`
      }, { status: 400 });
    }

    // 취소 시 사유 필수 검증
    if (new_status === 'CANCELED' && (!change_reason || change_reason.trim().length === 0)) {
      return NextResponse.json({
        success: false,
        error: '취소 시 사유는 필수입니다.'
      }, { status: 400 });
    }

    // 상태 전이 실행
    await transitDocumentStatus(
      'INVENTORY_TRANSACTION',
      transactionId,
      documentNumber,
      currentStatus,
      new_status,
      changed_by,
      change_reason
    );

    // 업데이트된 정보 조회
    const { data: updatedTransaction } = await supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_id, document_number, status, transaction_type, updated_at')
      .eq('transaction_id', transactionId)
      .single();

    return NextResponse.json({
      success: true,
      message: `문서 상태가 ${getStatusLabel(currentStatus)}에서 ${getStatusLabel(new_status)}로 변경되었습니다.`,
      data: {
        transaction_id: transactionId,
        document_number: documentNumber,
        previous_status: currentStatus,
        new_status: new_status,
        previous_status_label: getStatusLabel(currentStatus),
        new_status_label: getStatusLabel(new_status),
        change_reason: change_reason || null,
        changed_by: changed_by,
        updated_at: updatedTransaction?.updated_at,
        next_possible_states: getNextPossibleStates(new_status).map(status => ({
          status,
          label: getStatusLabel(status)
        }))
      }
    });
  } catch (error) {
    console.error('Error changing document status:', error);

    if (error instanceof Error && error.message.includes('상태 전이가 불가능합니다')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: '문서 상태 변경 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}