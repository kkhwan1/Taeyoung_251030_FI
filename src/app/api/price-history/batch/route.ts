import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { handleAPIError } from '@/lib/api-utils';

/**
 * 일괄 단가 저장 API
 * POST /api/price-history/batch
 * 
 * Body:
 * {
 *   prices: Array<{
 *     item_id: number;
 *     unit_price: number;
 *     note?: string;
 *   }>;
 *   price_month: string; // YYYY-MM-DD 형식
 *   created_by: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { prices, price_month, created_by } = await request.json();

    // 입력 검증
    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      return NextResponse.json(
        { success: false, error: '가격 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!price_month) {
      return NextResponse.json(
        { success: false, error: '가격 월이 필요합니다.' },
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

    // 각 가격 데이터에 대해 UPSERT 실행
    const results = await Promise.all(
      prices.map(async (priceData) => {
        const { item_id, unit_price, note } = priceData;

        if (!item_id || unit_price === undefined || unit_price === null) {
          throw new Error(`잘못된 가격 데이터: item_id=${item_id}, unit_price=${unit_price}`);
        }

        // UPSERT: 기존 레코드가 있으면 UPDATE, 없으면 INSERT
        const { data, error } = await supabase
          .from('item_price_history')
          .upsert({
            item_id,
            price_month,
            unit_price: parseFloat(unit_price),
            note: note || null,
            created_by,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'item_id,price_month'
          })
          .select()
          .single();

        if (error) {
          throw new Error(`가격 저장 실패 (item_id: ${item_id}): ${error.message}`);
        }

        return data;
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        count: results.length,
        price_month,
        created_by
      },
      message: `${results.length}개 품목의 단가가 저장되었습니다.`
    });

  } catch (error) {
    console.error('[price-history/batch] POST error:', error);
    return handleAPIError(error);
  }
}
