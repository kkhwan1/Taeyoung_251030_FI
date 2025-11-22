import { NextRequest, NextResponse } from 'next/server';
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { getSupabaseClient } from '@/lib/db-unified';
import type {
  CreateCoilProcessRequest,
  CoilProcessFilters,
  CoilProcessWithDetails,
  ProcessStatus,
  ProcessType
} from '@/types/coil';
import { isValidProcessStatus, isValidProcessType } from '@/types/coil';

export const dynamic = 'force-dynamic';

/**
 * POST /api/coil/process
 *
 * 코일 공정 생성
 * - source_item_id는 반드시 inventory_type='코일'이어야 함 (데이터베이스 트리거로도 검증)
 * - 기본 상태: PENDING
 * - yield_rate는 자동 계산 (데이터베이스 GENERATED 컬럼)
 */
export const POST = createValidatedRoute(
  async (request: NextRequest) => {
    try {
      // Korean UTF-8 support - CRITICAL PATTERN
      const text = await request.text();
      const body = JSON.parse(text) as CreateCoilProcessRequest;

      // Validation
      if (!body.source_item_id || !body.target_item_id) {
        return NextResponse.json(
          {
            success: false,
            error: '소스 품목 ID와 타겟 품목 ID는 필수입니다.'
          },
          { status: 400 }
        );
      }

      if (!body.process_type || !isValidProcessType(body.process_type)) {
        return NextResponse.json(
          {
            success: false,
            error: '유효한 공정 유형을 선택하세요 (블랭킹/전단/절곡/용접).'
          },
          { status: 400 }
        );
      }

      if (!body.input_quantity || body.input_quantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: '투입 수량은 0보다 커야 합니다.'
          },
          { status: 400 }
        );
      }

      if (!body.output_quantity || body.output_quantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: '산출 수량은 0보다 커야 합니다.'
          },
          { status: 400 }
        );
      }

      const supabase = getSupabaseClient();

      // Validate source item is '코일' type (fail fast before database trigger)
      const { data: sourceItem, error: sourceError } = await supabase
        .from('items')
        .select('item_id, item_code, item_name, inventory_type')
        .eq('item_id', body.source_item_id)
        .single();

      if (sourceError || !sourceItem) {
        return NextResponse.json(
          {
            success: false,
            error: `소스 품목(ID: ${body.source_item_id})을 찾을 수 없습니다.`
          },
          { status: 404 }
        );
      }

      if (sourceItem.inventory_type !== '코일') {
        return NextResponse.json(
          {
            success: false,
            error: `소스 품목(${sourceItem.item_name})의 재고 유형이 '${sourceItem.inventory_type}'이므로 코일 공정에 사용할 수 없습니다. 재고 유형이 '코일'인 품목만 선택하세요.`
          },
          { status: 400 }
        );
      }

      // Validate target item exists
      const { data: targetItem, error: targetError } = await supabase
        .from('items')
        .select('item_id, item_code, item_name')
        .eq('item_id', body.target_item_id)
        .single();

      if (targetError || !targetItem) {
        return NextResponse.json(
          {
            success: false,
            error: `타겟 품목(ID: ${body.target_item_id})을 찾을 수 없습니다.`
          },
          { status: 404 }
        );
      }

      // Validate operator if provided
      if (body.operator_id) {
        const { data: operator, error: operatorError } = await supabase
          .from('users')
          .select('user_id')
          .eq('user_id', body.operator_id)
          .single();

        if (operatorError || !operator) {
          return NextResponse.json(
            {
              success: false,
              error: `작업자(ID: ${body.operator_id})를 찾을 수 없습니다.`
            },
            { status: 404 }
          );
        }
      }

      // Create coil process
      const { data: process, error: insertError } = await supabase
        .from('coil_process_history')
        .insert({
          source_item_id: body.source_item_id,
          process_type: body.process_type,
          target_item_id: body.target_item_id,
          input_quantity: body.input_quantity,
          output_quantity: body.output_quantity,
          process_date: body.process_date || new Date().toISOString().split('T')[0],
          operator_id: body.operator_id || null,
          notes: body.notes || null,
          status: 'PENDING' // Default status
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Error creating coil process:', insertError);
        return NextResponse.json(
          {
            success: false,
            error: `코일 공정 생성 실패: ${insertError.message}`
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: process
      });

    } catch (error) {
      console.error('Error in POST /api/coil/process:', error);
      return NextResponse.json(
        {
          success: false,
          error: `코일 공정 생성 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }
  },
  { resource: 'coil_process', action: 'create', requireAuth: false }
);

/**
 * GET /api/coil/process
 *
 * 코일 공정 이력 조회
 * - 필터링: status, source_item_id, target_item_id, process_type, start_date, end_date
 * - JOIN: items (source + target), users (operator)
 * - 정렬: process_date DESC, created_at DESC
 */
export const GET = createValidatedRoute(
  async (request: NextRequest) => {
    try {
      const searchParams = request.nextUrl.searchParams;

      // Parse filters
      const filters: CoilProcessFilters = {
        status: searchParams.get('status') as ProcessStatus | undefined,
        source_item_id: searchParams.get('source_item_id') ? parseInt(searchParams.get('source_item_id')!) : undefined,
        target_item_id: searchParams.get('target_item_id') ? parseInt(searchParams.get('target_item_id')!) : undefined,
        process_type: searchParams.get('process_type') as ProcessType | undefined,
        start_date: searchParams.get('start_date') || undefined,
        end_date: searchParams.get('end_date') || undefined
      };

      // Validate status if provided
      if (filters.status && !isValidProcessStatus(filters.status)) {
        return NextResponse.json(
          {
            success: false,
            error: '유효하지 않은 상태 값입니다.'
          },
          { status: 400 }
        );
      }

      // Validate process_type if provided
      if (filters.process_type && !isValidProcessType(filters.process_type)) {
        return NextResponse.json(
          {
            success: false,
            error: '유효하지 않은 공정 유형입니다.'
          },
          { status: 400 }
        );
      }

      const supabase = getSupabaseClient();

      // Build query with joins
      let query = supabase
        .from('coil_process_history')
        .select(`
          *,
          source_item:items!coil_process_history_source_item_id_fkey(
            item_id,
            item_code,
            item_name,
            spec,
            inventory_type,
            current_stock
          ),
          target_item:items!coil_process_history_target_item_id_fkey(
            item_id,
            item_code,
            item_name,
            spec,
            inventory_type,
            current_stock
          ),
          operator:users!coil_process_history_operator_id_fkey(
            user_id,
            name,
            email
          )
        `);

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.source_item_id) {
        query = query.eq('source_item_id', filters.source_item_id);
      }

      if (filters.target_item_id) {
        query = query.eq('target_item_id', filters.target_item_id);
      }

      if (filters.process_type) {
        query = query.eq('process_type', filters.process_type);
      }

      if (filters.start_date) {
        query = query.gte('process_date', filters.start_date);
      }

      if (filters.end_date) {
        query = query.lte('process_date', filters.end_date);
      }

      // Order by date descending
      query = query
        .order('process_date', { ascending: false })
        .order('created_at', { ascending: false });

      const { data: processes, error } = await query;

      if (error) {
        console.error('Error fetching coil processes:', error);
        return NextResponse.json(
          {
            success: false,
            error: `코일 공정 조회 실패: ${error.message}`
          },
          { status: 500 }
        );
      }

      // Get status counts for all processes (before filtering)
      const { data: statusCountsData, error: statusCountsError } = await supabase
        .from('coil_process_history')
        .select('status');

      const statusCounts: Record<string, number> = {
        PENDING: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        CANCELLED: 0,
        ALL: 0
      };

      if (!statusCountsError && statusCountsData) {
        statusCounts.ALL = statusCountsData.length;
        statusCountsData.forEach((p: any) => {
          if (p.status in statusCounts) {
            statusCounts[p.status as keyof typeof statusCounts]++;
          }
        });
      }

      // Transform data to CoilProcessWithDetails format
      const processesWithDetails: CoilProcessWithDetails[] = (processes || []).map((p: any) => ({
        ...p,
        source_item: p.source_item || undefined,
        target_item: p.target_item || undefined,
        operator: p.operator || undefined
      }));

      return NextResponse.json({
        success: true,
        data: processesWithDetails,
        count: processesWithDetails.length,
        statusCounts // 상태별 개수 추가
      });

    } catch (error) {
      console.error('Error in GET /api/coil/process:', error);
      return NextResponse.json(
        {
          success: false,
          error: `코일 공정 조회 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }
  },
  { resource: 'coil_process', action: 'read', requireAuth: false }
);
