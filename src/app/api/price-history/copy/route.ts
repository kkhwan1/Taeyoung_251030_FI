import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { handleAPIError } from '@/lib/api-utils';

/**
 * 전월 단가 복사 API
 * POST /api/price-history/copy
 * 
 * Body:
 * {
 *   from_month: string; // YYYY-MM-DD 형식
 *   to_month: string;   // YYYY-MM-DD 형식
 *   created_by: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { success: false, error: '잘못된 JSON 형식입니다.' },
        { status: 400 }
      );
    }

    const { from_month, to_month, created_by } = body;

    // 입력 검증
    if (!from_month) {
      return NextResponse.json(
        { success: false, error: '복사할 월(from_month)이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!to_month) {
      return NextResponse.json(
        { success: false, error: '복사될 월(to_month)이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!created_by) {
      return NextResponse.json(
        { success: false, error: '작성자가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 1. from_month의 모든 단가 조회
    const { data: prevPrices, error: fetchError } = await supabase
      .from('item_price_history')
      .select('*')
      .eq('price_month', from_month);

    if (fetchError) {
      throw new Error(`이전 월 단가 조회 실패: ${fetchError.message}`);
    }

    if (!prevPrices || prevPrices.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          count: 0,
          from_month,
          to_month,
          created_by
        },
        message: `${from_month}에 저장된 단가가 없습니다.`
      });
    }

    // 2. to_month에 복사 (UPSERT)
    const results = await Promise.all(
      prevPrices.map(async (price) => {
        const { data, error } = await supabase
          .from('item_price_history')
          .upsert({
            item_id: price.item_id,
            price_month: to_month,
            unit_price: price.unit_price,
            note: price.note,
            created_by,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'item_id,price_month'
          })
          .select()
          .single();

        if (error) {
          throw new Error(`단가 복사 실패 (item_id: ${price.item_id}): ${error.message}`);
        }

        return data;
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        count: results.length,
        from_month,
        to_month,
        created_by
      },
      message: `${from_month}의 ${results.length}개 품목 단가를 ${to_month}로 복사했습니다.`
    });

  } catch (error) {
    console.error('[price-history/copy] POST error:', error);
    return handleAPIError(error);
  }
}
