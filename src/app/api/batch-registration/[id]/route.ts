import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

// ===================================
// GET /api/batch-registration/[id]
// 특정 생산 배치 상세 조회
// ===================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const batchId = parseInt(params.id, 10);

    if (isNaN(batchId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 배치 ID입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('production_batch')
      .select(`
        *,
        items:production_batch_items(
          *,
          item:items(item_id, item_code, item_name, spec, unit)
        )
      `)
      .eq('batch_id', batchId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('배치 조회 실패:', error);
      return NextResponse.json(
        { success: false, error: `배치 조회 실패: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: '배치를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('배치 조회 API 에러:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ===================================
// PATCH /api/batch-registration/[id]
// 생산 배치 상태 변경 (IN_PROGRESS → COMPLETED)
// ===================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const batchId = parseInt(params.id, 10);

    if (isNaN(batchId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 배치 ID입니다.' },
        { status: 400 }
      );
    }

    // 한글 깨짐 방지
    const text = await request.text();
    const data = JSON.parse(text);

    const { status, notes } = data;

    // status 값 검증
    if (status && !['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: "상태는 'IN_PROGRESS', 'COMPLETED', 'CANCELLED' 중 하나여야 합니다." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 업데이트할 필드 구성
    const updates: any = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const { data: updatedBatch, error } = await supabase
      .from('production_batch')
      .update(updates)
      .eq('batch_id', batchId)
      .eq('is_active', true)
      .select(`
        *,
        items:production_batch_items(
          *,
          item:items(item_id, item_code, item_name, spec, unit)
        )
      `)
      .single();

    if (error) {
      console.error('배치 상태 변경 실패:', error);
      return NextResponse.json(
        { success: false, error: `배치 상태 변경 실패: ${error.message}` },
        { status: 500 }
      );
    }

    // 상태가 COMPLETED로 변경되면 트리거가 자동으로 재고 이동 처리
    const message =
      status === 'COMPLETED'
        ? `배치 ${updatedBatch.batch_number}이(가) 완료되었습니다. 재고가 자동으로 업데이트되었습니다.`
        : `배치 ${updatedBatch.batch_number}이(가) 업데이트되었습니다.`;

    return NextResponse.json({
      success: true,
      data: updatedBatch,
      message,
    });
  } catch (error: any) {
    console.error('배치 상태 변경 API 에러:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ===================================
// DELETE /api/batch-registration/[id]
// 생산 배치 삭제 (소프트 삭제)
// ===================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const batchId = parseInt(params.id, 10);

    if (isNaN(batchId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 배치 ID입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 배치 존재 여부 및 상태 확인
    const { data: batch } = await supabase
      .from('production_batch')
      .select('status, batch_number')
      .eq('batch_id', batchId)
      .eq('is_active', true)
      .single();

    if (!batch) {
      return NextResponse.json(
        { success: false, error: '배치를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // COMPLETED 배치는 삭제 불가
    if (batch.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: '완료된 배치는 삭제할 수 없습니다. 취소 상태로 변경하려면 PATCH를 사용하세요.' },
        { status: 400 }
      );
    }

    // 소프트 삭제 (is_active = false)
    const { error } = await supabase
      .from('production_batch')
      .update({ is_active: false })
      .eq('batch_id', batchId);

    if (error) {
      console.error('배치 삭제 실패:', error);
      return NextResponse.json(
        { success: false, error: `배치 삭제 실패: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `배치 ${batch.batch_number}이(가) 삭제되었습니다.`,
    });
  } catch (error: any) {
    console.error('배치 삭제 API 에러:', error);
    return NextResponse.json(
      { success: false, error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
