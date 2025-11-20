import { NextRequest, NextResponse } from 'next/server';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bom/coil-materials
 *
 * 코일 재료 BOM 조회 (Track 2C)
 * - BOM 항목 중 자재가 '코일' 타입인 것만 반환
 * - 월별 단가 및 재료비 자동 계산
 * - 스크랩 수익 포함 순재료비 계산
 */
export const GET = createValidatedRoute(
  async (request: NextRequest) => {
    try {
      const searchParams = request.nextUrl.searchParams;

      // Query parameters
      const parent_item_id = searchParams.get('parent_item_id')
        ? parseInt(searchParams.get('parent_item_id')!)
        : undefined;
      const price_month = searchParams.get('price_month') || undefined;
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
      const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

      const supabase = getSupabaseClient();

      // Build query with JOINs
      let query = supabase
        .from('bom')
        .select(`
          bom_id,
          parent_item_id,
          child_item_id,
          quantity_required,
          level_no,
          notes,
          created_at,
          updated_at,
          parent:items!bom_parent_item_id_fkey(
            item_id,
            item_code,
            item_name,
            spec,
            unit
          ),
          child:items!bom_child_item_id_fkey(
            item_id,
            item_code,
            item_name,
            spec,
            unit,
            price,
            inventory_type
          )
        `);

      // Apply parent_item_id filter if provided
      if (parent_item_id) {
        query = query.eq('parent_item_id', parent_item_id);
      }

      // Apply pagination
      if (limit) {
        query = query.limit(limit);
      }
      if (offset) {
        query = query.range(offset, offset + (limit || 10) - 1);
      }

      // Order by parent then child
      query = query.order('parent_item_id').order('child_item_id');

      const { data: bomEntries, error } = await query;

      if (error) {
        console.error('BOM query failed:', error);
        return NextResponse.json({
          success: false,
          error: 'BOM 조회에 실패했습니다.'
        }, { status: 500 });
      }

      // Filter to coil materials only (inventory_type='코일')
      const coilEntries = (bomEntries || []).filter((entry: any) =>
        entry.child?.inventory_type === '코일'
      );

      // Step 1: 월별 단가 및 재료비 계산
      const entriesWithPrice = await Promise.all(
        coilEntries.map(async (item: any) => {
          // 월별 단가 조회 (없으면 items.price 사용)
          // price_month는 DATE 형식이므로 'YYYY-MM-01' 형식으로 변환
          const monthStr = price_month || new Date().toISOString().slice(0, 7) + '-01';
          const { data: priceData } = await supabase
            .from('item_price_history')
            .select('unit_price')
            .eq('item_id', item.child_item_id)
            .eq('price_month', monthStr)
            .maybeSingle();

          const unit_price = priceData?.unit_price || item.child?.price || 0;

          // 재료비 = 수량 × 단가
          const material_cost = item.quantity_required * unit_price;

          return {
            ...item,
            unit_price,
            material_cost
          };
        })
      );

      // Step 2: 스크랩 수익 계산 및 순재료비
      const enrichedEntries = entriesWithPrice.map((item: any) => {
        // 스크랩량 = 수량 × 스크랩율 (scrap_rate는 BOM 테이블에 없으므로 0으로 처리)
        const scrap_rate = 0; // BOM 테이블에 scrap_rate 컬럼이 없음
        const scrap_quantity = item.quantity_required * (scrap_rate / 100);

        // 스크랩 수익 = 스크랩량 × 단가 (동일 단가 가정)
        const scrap_revenue = scrap_quantity * item.unit_price;

        // 순재료비 = 재료비 - 스크랩 수익
        const net_cost = item.material_cost - scrap_revenue;

        return {
          bom_id: item.bom_id,
          parent_item_id: item.parent_item_id,
          child_item_id: item.child_item_id,
          quantity: item.quantity_required,
          level_no: item.level_no,
          notes: item.notes,
          created_at: item.created_at,
          updated_at: item.updated_at,

          // JOINed data
          parent_item_code: item.parent?.item_code || '',
          parent_item_name: item.parent?.item_name || '',
          parent_spec: item.parent?.spec || '',
          child_item_code: item.child?.item_code || '',
          child_item_name: item.child?.item_name || '',
          child_spec: item.child?.spec || '',
          child_inventory_type: item.child?.inventory_type || '',

          // Calculated fields
          unit_price: item.unit_price,
          material_cost: item.material_cost,
          scrap_rate: 0, // BOM 테이블에 scrap_rate 컬럼이 없음
          scrap_quantity,
          scrap_revenue,
          net_cost
        };
      });

      return NextResponse.json({
        success: true,
        data: enrichedEntries,
        count: enrichedEntries.length,
        message: `코일 재료 BOM ${enrichedEntries.length}건을 조회했습니다.`
      });

    } catch (error) {
      console.error('Error in GET /api/bom/coil-materials:', error);
      return NextResponse.json(
        {
          success: false,
          error: `코일 재료 BOM 조회 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }
  },
  { resource: 'bom', action: 'read', requireAuth: false }
);
