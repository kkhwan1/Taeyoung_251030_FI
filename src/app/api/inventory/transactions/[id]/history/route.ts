import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db-unified';
import { getDocumentStatusHistory, getDocumentStatusHistoryByNumber, getStatusLabel } from '@/lib/workflow';

export const dynamic = 'force-dynamic';


/**
 * GET /api/inventory/transactions/[id]/history
 * 문서의 상태 변경 이력을 조회합니다
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

    // 거래 존재 여부 확인
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_id, document_number, status, transaction_type, transaction_date')
      .eq('transaction_id', transactionId)
      .eq('is_active', true)
      .single();

    if (txError || !transaction) {
      return NextResponse.json({
        success: false,
        error: '거래를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 상태 변경 이력 조회
    const history = await getDocumentStatusHistory('INVENTORY_TRANSACTION', transactionId);

    // 이력을 사용자 정보와 함께 조회
    const detailedHistory = await Promise.all(
      history.map(async (record) => {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('user_id, username')
          .eq('user_id', record.changed_by)
          .single();

        return {
          id: record.id,
          document_number: record.document_number,
          previous_status: record.previous_status,
          new_status: record.new_status,
          previous_status_label: record.previous_status ? getStatusLabel(record.previous_status) : null,
          new_status_label: getStatusLabel(record.new_status),
          changed_by: record.changed_by,
          changed_by_name: user?.username || '알 수 없음',
          change_reason: record.change_reason,
          created_at: record.created_at
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        transaction: {
          transaction_id: transaction.transaction_id,
          document_number: transaction.document_number,
          current_status: transaction.status,
          current_status_label: getStatusLabel(transaction.status as any),
          transaction_type: transaction.transaction_type,
          transaction_date: transaction.transaction_date
        },
        history: detailedHistory,
        history_count: detailedHistory.length
      }
    });
  } catch (error) {
    console.error('Error fetching document history:', error);
    return NextResponse.json({
      success: false,
      error: '문서 이력 조회 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * POST /api/inventory/transactions/[id]/history
 * 문서 번호로 상태 변경 이력을 조회합니다 (향후 확장을 위한 엔드포인트)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Korean UTF-8 support
    const text = await request.text();
    const body = JSON.parse(text);
    const { document_number } = body;

    if (!document_number) {
      return NextResponse.json({
        success: false,
        error: '문서 번호가 필요합니다.'
      }, { status: 400 });
    }

    // 문서 번호로 상태 변경 이력 조회
    const history = await getDocumentStatusHistoryByNumber(document_number);

    if (history.length === 0) {
      return NextResponse.json({
        success: false,
        error: '해당 문서 번호의 이력을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 이력을 사용자 정보와 함께 조회
    const detailedHistory = await Promise.all(
      history.map(async (record) => {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('user_id, username')
          .eq('user_id', record.changed_by)
          .single();

        return {
          id: record.id,
          document_type: record.document_type,
          document_id: record.document_id,
          document_number: record.document_number,
          previous_status: record.previous_status,
          new_status: record.new_status,
          previous_status_label: record.previous_status ? getStatusLabel(record.previous_status) : null,
          new_status_label: getStatusLabel(record.new_status),
          changed_by: record.changed_by,
          changed_by_name: user?.username || '알 수 없음',
          change_reason: record.change_reason,
          created_at: record.created_at
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        document_number: document_number,
        history: detailedHistory,
        history_count: detailedHistory.length
      }
    });
  } catch (error) {
    console.error('Error fetching document history by number:', error);
    return NextResponse.json({
      success: false,
      error: '문서 이력 조회 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}