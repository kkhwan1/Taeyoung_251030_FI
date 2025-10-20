// Phase P3 - 단가 이력 개별 조회/수정/삭제 API
// src/app/api/price-history/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

/**
 * GET /api/price-history/[id]
 * 특정 단가 이력 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('item_price_history')
      .select(`
        *,
        item:items (
          item_id,
          item_code,
          item_name,
          category,
          unit
        )
      `)
      .eq('price_history_id', parseInt(id))
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: '단가 이력을 찾을 수 없습니다' },
          { status: 404 }
        );
      }
      throw new Error(`Database query failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[price-history] GET error:', error);
    return NextResponse.json(
      { success: false, error: '단가 이력 조회 실패' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/price-history/[id]
 * 단가 이력 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // UTF-8 한글 처리
    const text = await request.text();
    const body = JSON.parse(text);

    const { unit_price, price_per_kg, note, created_by } = body;

    // 최소 하나의 수정 필드 필요
    if (unit_price === undefined && price_per_kg === undefined && note === undefined) {
      return NextResponse.json(
        { success: false, error: '수정할 필드가 없습니다' },
        { status: 400 }
      );
    }

    // 단가 음수 체크
    if ((unit_price !== undefined && unit_price < 0) || 
        (price_per_kg !== undefined && price_per_kg !== null && price_per_kg < 0)) {
      return NextResponse.json(
        { success: false, error: '단가는 0 이상이어야 합니다' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 업데이트할 데이터 구성
    const updateData: any = {};
    if (unit_price !== undefined) updateData.unit_price = unit_price;
    if (price_per_kg !== undefined) updateData.price_per_kg = price_per_kg;
    if (note !== undefined) updateData.note = note;
    if (created_by !== undefined) updateData.created_by = created_by;

    // updated_at는 트리거가 자동 처리

    const { data, error } = await supabase
      .from('item_price_history')
      .update(updateData)
      .eq('price_history_id', parseInt(id))
      .select(`
        *,
        item:items (
          item_id,
          item_code,
          item_name,
          category,
          unit
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: '단가 이력을 찾을 수 없습니다' },
          { status: 404 }
        );
      }
      throw new Error(`Database update failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '단가 이력이 성공적으로 수정되었습니다.',
      data
    });

  } catch (error) {
    console.error('[price-history] PUT error:', error);
    return NextResponse.json(
      { success: false, error: '단가 이력 수정 실패' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/price-history/[id]
 * 단가 이력 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = getSupabaseClient();

    // 삭제 전 존재 여부 확인
    const { data: existing, error: checkError } = await supabase
      .from('item_price_history')
      .select('price_history_id, item_id, price_month')
      .eq('price_history_id', parseInt(id))
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { success: false, error: '단가 이력을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 삭제 실행
    const { error } = await supabase
      .from('item_price_history')
      .delete()
      .eq('price_history_id', parseInt(id));

    if (error) {
      throw new Error(`Database delete failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '단가 이력이 성공적으로 삭제되었습니다.',
      data: {
        deleted: true,
        price_history_id: parseInt(id),
        item_id: existing.item_id,
        price_month: existing.price_month
      }
    });

  } catch (error) {
    console.error('[price-history] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '단가 이력 삭제 실패' },
      { status: 500 }
    );
  }
}
