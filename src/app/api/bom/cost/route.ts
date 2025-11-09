import { NextRequest, NextResponse } from 'next/server';
import { calculateTotalCost } from '@/lib/bom';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('item_id');
    const priceMonth = searchParams.get('price_month');

    if (!itemId) {
      return NextResponse.json({
        success: false,
        error: '품목 ID가 필요합니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // BOM이 있는지 확인
    const { data: bomData, error: bomError } = await supabase
      .from('bom')
      .select('bom_id')
      .eq('parent_item_id', parseInt(itemId))
      .eq('is_active', true)
      .limit(1);

    if (bomError || !bomData || bomData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          has_bom: false,
          total_cost: 0
        }
      });
    }

    // BOM 원가 계산
    const costBreakdown = await calculateTotalCost(
      supabase,
      parseInt(itemId),
      priceMonth || undefined
    );

    return NextResponse.json({
      success: true,
      data: {
        item_id: parseInt(itemId),
        price_month: priceMonth,
        has_bom: true,
        cost_breakdown: costBreakdown
      }
    });

  } catch (error) {
    console.error('Error calculating BOM cost:', error);
    return NextResponse.json({
      success: false,
      error: 'BOM 원가 계산 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
