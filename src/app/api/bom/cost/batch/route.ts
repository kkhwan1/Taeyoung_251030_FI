import { NextRequest, NextResponse } from 'next/server';
import { calculateTotalCost } from '@/lib/bom';
import { getSupabaseClient } from '@/lib/db-unified';

interface BatchBomCostRequest {
  item_ids: number[];
  price_month?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Korean UTF-8 support
    const text = await request.text();
    const body: BatchBomCostRequest = JSON.parse(text);
    const { item_ids, price_month } = body;

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: '품목 ID 배열이 필요합니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. 모든 품목에 대해 BOM 존재 여부 확인 (단일 쿼리)
    const { data: bomExistsData, error: bomExistsError } = await supabase
      .from('bom')
      .select('parent_item_id')
      .in('parent_item_id', item_ids)
      .eq('is_active', true);

    if (bomExistsError) {
      console.error('Error checking BOM existence:', bomExistsError);
      return NextResponse.json({
        success: false,
        error: 'BOM 존재 확인 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    // BOM이 있는 품목 ID만 추출
    const itemsWithBom = new Set(
      (bomExistsData || []).map(item => item.parent_item_id)
    );

    // 2. BOM이 있는 품목만 원가 계산
    const result: { [key: number]: any } = {};
    
    // 병렬 처리로 성능 최적화 (최대 10개씩 동시 처리)
    const batchSize = 10;
    for (let i = 0; i < item_ids.length; i += batchSize) {
      const batch = item_ids.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (itemId) => {
          if (itemsWithBom.has(itemId)) {
            try {
              const costBreakdown = await calculateTotalCost(
                supabase,
                itemId,
                price_month || undefined
              );
              
              result[itemId] = {
                has_bom: true,
                cost_breakdown: costBreakdown
              };
            } catch (error) {
              console.error(`Error calculating BOM cost for item ${itemId}:`, error);
              result[itemId] = {
                has_bom: true,
                cost_breakdown: {
                  material_cost: 0,
                  labor_cost: 0,
                  overhead_cost: 0,
                  scrap_revenue: 0,
                  net_cost: 0
                }
              };
            }
          } else {
            // BOM이 없는 품목
            result[itemId] = {
              has_bom: false,
              cost_breakdown: {
                material_cost: 0,
                labor_cost: 0,
                overhead_cost: 0,
                scrap_revenue: 0,
                net_cost: 0
              }
            };
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        total_items: item_ids.length,
        items_with_bom: itemsWithBom.size,
        items_without_bom: item_ids.length - itemsWithBom.size,
        price_month: price_month || null
      }
    });

  } catch (error) {
    console.error('Error calculating batch BOM cost:', error);
    return NextResponse.json({
      success: false,
      error: '배치 BOM 원가 계산 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
