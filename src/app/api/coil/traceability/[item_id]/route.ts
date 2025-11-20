import { NextRequest, NextResponse } from 'next/server';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { getSupabaseClient } from '@/lib/db-unified';
import type { CoilTraceabilityChain } from '@/types/coil';

export const dynamic = 'force-dynamic';

/**
 * GET /api/coil/traceability/[item_id]
 *
 * 코일 공정 추적성 체인 조회
 * - 특정 품목의 상류/하류 공정 이력을 모두 조회
 * - 상류(upstream): 이 품목을 생산한 공정들 (target_item_id = [item_id])
 * - 하류(downstream): 이 품목을 사용한 공정들 (source_item_id = [item_id])
 * - 완전한 추적성 체인 반환
 */
export const GET = createValidatedRoute(
  async (
    request: NextRequest,
    { params }: { params: { item_id: string } }
  ) => {
    try {
      const item_id = parseInt(params.item_id);

      if (isNaN(item_id)) {
        return NextResponse.json(
          {
            success: false,
            error: '유효하지 않은 품목 ID입니다.'
          },
          { status: 400 }
        );
      }

      const supabase = getSupabaseClient();

      // First, get the item basic info
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('item_id, item_code, item_name')
        .eq('item_id', item_id)
        .single();

      if (itemError || !item) {
        return NextResponse.json(
          {
            success: false,
            error: `품목(ID: ${item_id})을 찾을 수 없습니다.`
          },
          { status: 404 }
        );
      }

      // Get upstream processes (processes that produced this item)
      // This item is the target_item (output) of these processes
      const { data: upstreamProcesses, error: upstreamError } = await supabase
        .from('coil_process_history')
        .select(`
          process_id,
          process_type,
          source_item_id,
          input_quantity,
          output_quantity,
          yield_rate,
          process_date,
          status,
          source_item:items!coil_process_history_source_item_id_fkey(
            item_code,
            item_name
          )
        `)
        .eq('target_item_id', item_id)
        .order('process_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (upstreamError) {
        console.error('Error fetching upstream processes:', upstreamError);
        return NextResponse.json(
          {
            success: false,
            error: `상류 공정 조회 실패: ${upstreamError.message}`
          },
          { status: 500 }
        );
      }

      // Get downstream processes (processes that used this item)
      // This item is the source_item (input) of these processes
      const { data: downstreamProcesses, error: downstreamError } = await supabase
        .from('coil_process_history')
        .select(`
          process_id,
          process_type,
          target_item_id,
          input_quantity,
          output_quantity,
          yield_rate,
          process_date,
          status,
          target_item:items!coil_process_history_target_item_id_fkey(
            item_code,
            item_name
          )
        `)
        .eq('source_item_id', item_id)
        .order('process_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (downstreamError) {
        console.error('Error fetching downstream processes:', downstreamError);
        return NextResponse.json(
          {
            success: false,
            error: `하류 공정 조회 실패: ${downstreamError.message}`
          },
          { status: 500 }
        );
      }

      // Build traceability chain response
      const traceabilityChain: CoilTraceabilityChain = {
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,

        // Upstream: Processes that produced this item
        upstream: (upstreamProcesses || []).map((p: any) => ({
          process_id: p.process_id,
          process_type: p.process_type,
          source_item_id: p.source_item_id,
          source_item_code: p.source_item?.item_code || '',
          source_item_name: p.source_item?.item_name || '',
          input_quantity: p.input_quantity,
          output_quantity: p.output_quantity,
          yield_rate: p.yield_rate,
          process_date: p.process_date,
          status: p.status
        })),

        // Downstream: Processes that used this item
        downstream: (downstreamProcesses || []).map((p: any) => ({
          process_id: p.process_id,
          process_type: p.process_type,
          target_item_id: p.target_item_id,
          target_item_code: p.target_item?.item_code || '',
          target_item_name: p.target_item?.item_name || '',
          input_quantity: p.input_quantity,
          output_quantity: p.output_quantity,
          yield_rate: p.yield_rate,
          process_date: p.process_date,
          status: p.status
        }))
      };

      return NextResponse.json({
        success: true,
        data: traceabilityChain,
        message: `품목 ${item.item_name}의 추적성 체인을 조회했습니다. 상류 공정: ${traceabilityChain.upstream.length}개, 하류 공정: ${traceabilityChain.downstream.length}개`
      });

    } catch (error) {
      console.error('Error in GET /api/coil/traceability/[item_id]:', error);
      return NextResponse.json(
        {
          success: false,
          error: `추적성 조회 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }
  },
  { resource: 'coil_process', action: 'read', requireAuth: false }
);
