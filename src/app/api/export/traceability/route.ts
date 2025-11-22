import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseClient } from '@/lib/db-unified';

export const dynamic = 'force-dynamic';

/**
 * GET /api/export/traceability
 *
 * 공정 추적성 데이터 Excel 내보내기
 * - 3-Sheet 표준 패턴 적용 (메타데이터, 통계, 데이터)
 * - 날짜/상태/공정유형 필터 지원
 * - 한글 헤더 및 값 변환
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Query Parameters
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status') || 'all';
    const processType = searchParams.get('process_type');

    const supabase = getSupabaseClient();

    // 데이터 조회 쿼리 구성
    let query = supabase
      .from('coil_process_history')
      .select(`
        process_id,
        process_type,
        source_item_id,
        target_item_id,
        input_quantity,
        output_quantity,
        yield_rate,
        process_date,
        status,
        created_at,
        source_item:items!coil_process_history_source_item_id_fkey(
          item_code,
          item_name
        ),
        target_item:items!coil_process_history_target_item_id_fkey(
          item_code,
          item_name
        ),
        process_operation:process_operations!coil_process_id(
          operation_id,
          lot_number
        )
      `);

    // 필터 적용
    if (startDate) {
      query = query.gte('process_date', startDate);
    }
    if (endDate) {
      query = query.lte('process_date', endDate);
    }
    if (processType && processType !== 'all') {
      query = query.eq('process_type', processType);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // 정렬
    query = query.order('process_date', { ascending: false });

    const { data: processHistory, error } = await query;

    if (error) {
      console.error('Error fetching process history for export:', error);
      return NextResponse.json(
        { success: false, error: `데이터 조회 실패: ${error.message}` },
        { status: 500 }
      );
    }

    const data = processHistory || [];

    // 통계 계산
    const summary = {
      total_count: data.length,
      pending_count: data.filter((d: any) => d.status === 'pending').length,
      in_progress_count: data.filter((d: any) => d.status === 'in_progress').length,
      completed_count: data.filter((d: any) => d.status === 'completed').length,
      total_input_quantity: data.reduce((sum: number, d: any) => sum + (d.input_quantity || 0), 0),
      total_output_quantity: data.reduce((sum: number, d: any) => sum + (d.output_quantity || 0), 0),
      average_yield_rate: data.length > 0
        ? data.reduce((sum: number, d: any) => sum + (d.yield_rate || 0), 0) / data.length
        : 0
    };

    // Excel 워크북 생성
    const workbook = XLSX.utils.book_new();

    // Sheet 1: 내보내기 정보 (메타데이터)
    const exportDate = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const metadataRows = [
      ['공정 추적성 내보내기 정보', ''],
      ['', ''],
      ['내보낸 날짜', exportDate],
      ['총 레코드 수', data.length],
      ['', ''],
      ['적용된 필터', ''],
      ['시작일', startDate || '전체'],
      ['종료일', endDate || '전체'],
      ['상태', getStatusLabel(status)],
      ['공정 유형', processType ? getProcessTypeLabel(processType) : '전체']
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    metadataSheet['!cols'] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');

    // Sheet 2: 통계 요약
    const statsRows = [
      ['공정 추적성 통계', ''],
      ['', ''],
      ['항목', '값'],
      ['총 공정 수', summary.total_count.toLocaleString()],
      ['대기 중', summary.pending_count.toLocaleString()],
      ['진행 중', summary.in_progress_count.toLocaleString()],
      ['완료', summary.completed_count.toLocaleString()],
      ['', ''],
      ['총 투입량', summary.total_input_quantity.toLocaleString()],
      ['총 산출량', summary.total_output_quantity.toLocaleString()],
      ['평균 수율', `${summary.average_yield_rate.toFixed(1)}%`]
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsRows);
    statsSheet['!cols'] = [{ wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, statsSheet, '통계');

    // Sheet 3: 데이터 (한글 헤더)
    const koreanData = data.map((row: any) => ({
      '공정ID': row.process_id,
      '공정유형': getProcessTypeLabel(row.process_type),
      'LOT번호': row.process_operation?.lot_number || '',
      '원자재 코드': row.source_item?.item_code || '',
      '원자재명': row.source_item?.item_name || '',
      '생산품 코드': row.target_item?.item_code || '',
      '생산품명': row.target_item?.item_name || '',
      '투입량': row.input_quantity,
      '산출량': row.output_quantity,
      '수율(%)': row.yield_rate != null ? row.yield_rate.toFixed(1) : '',
      '공정일': row.process_date ? new Date(row.process_date).toLocaleDateString('ko-KR') : '',
      '상태': getStatusLabel(row.status),
      '생성일시': row.created_at ? new Date(row.created_at).toLocaleString('ko-KR') : ''
    }));

    const dataSheet = XLSX.utils.json_to_sheet(koreanData);
    dataSheet['!cols'] = [
      { wch: 10 },  // 공정ID
      { wch: 10 },  // 공정유형
      { wch: 15 },  // LOT번호
      { wch: 15 },  // 원자재 코드
      { wch: 25 },  // 원자재명
      { wch: 15 },  // 생산품 코드
      { wch: 25 },  // 생산품명
      { wch: 12 },  // 투입량
      { wch: 12 },  // 산출량
      { wch: 10 },  // 수율
      { wch: 12 },  // 공정일
      { wch: 10 },  // 상태
      { wch: 20 }   // 생성일시
    ];
    XLSX.utils.book_append_sheet(workbook, dataSheet, '공정 이력');

    // Excel 파일 생성
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 생성
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `공정추적성_${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });

  } catch (error) {
    console.error('Error in GET /api/export/traceability:', error);
    return NextResponse.json(
      {
        success: false,
        error: `내보내기 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}

// 상태 라벨 변환
function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    'all': '전체',
    'pending': '대기',
    'in_progress': '진행중',
    'completed': '완료'
  };
  return statusMap[status] || status;
}

// 공정 유형 라벨 변환
function getProcessTypeLabel(processType: string): string {
  const typeMap: Record<string, string> = {
    'all': '전체',
    'slitting': '슬리팅',
    'cutting': '재단',
    'coating': '코팅',
    'assembly': '조립',
    'other': '기타'
  };
  return typeMap[processType] || processType;
}
