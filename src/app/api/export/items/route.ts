
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { COATING_STATUS_LABELS, type CoatingStatus } from '@/lib/constants/coatingStatus';

export const dynamic = 'force-dynamic';


const ITEM_TYPE_LABEL: Record<string, string> = {
  RAW: 'RAW',
  SUB: 'SUB',
  FINISHED: 'FINISHED'
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const itemType = searchParams.get('itemType');
    const materialType = searchParams.get('materialType');
    const search = searchParams.get('search');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('items')
      .select(`
        item_id,
        item_code,
        item_name,
        category,
        item_type,
        material_type,
        vehicle_model,
        material,
        spec,
        unit,
        thickness,
        width,
        height,
        specific_gravity,
        mm_weight,
        daily_requirement,
        blank_size,
        current_stock,
        safety_stock,
        price,
        location,
        description,
        coating_status,
        is_active,
        created_at,
        updated_at
      `)
      .eq('is_active', true)
      .order('item_code', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    if (materialType) {
      query = query.eq('material_type', materialType);
    }

    if (search) {
      query = query.or(
        `item_code.ilike.%${search}%,item_name.ilike.%${search}%,spec.ilike.%${search}%,material.ilike.%${search}%,vehicle_model.ilike.%${search}%`
      );
    }

    const { data: items, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const rows = (items ?? []).map((item) => ({
      '품목ID': item.item_id,
      '품목코드': item.item_code,
      '품목명': item.item_name,
      '분류': item.category,
      '타입': ITEM_TYPE_LABEL[item.item_type ?? ''] ?? item.item_type ?? '-',
      '소재형태': item.material_type ?? '-',
      '차종': item.vehicle_model ?? '-',
      '규격/소재': item.spec ?? item.material ?? '-',
      '단위': item.unit,
      '두께(mm)': item.thickness ?? '-',
      '폭(mm)': item.width ?? '-',
      '단위중량(kg)': item.mm_weight ?? '-',
      '현재고': item.current_stock ?? 0,
      '안전재고': item.safety_stock ?? 0,
      '기준단가': item.price ?? 0,
      '도장상태': COATING_STATUS_LABELS[item.coating_status as CoatingStatus] ?? '-',
      '비고': item.description ?? '-',
      '생성일시': item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '-',
      '수정일시': item.updated_at ? new Date(item.updated_at).toLocaleString('ko-KR') : '-'
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 10 },  // 품목ID
      { wch: 15 },  // 품목코드
      { wch: 25 },  // 품목명
      { wch: 10 },  // 분류
      { wch: 12 },  // 타입
      { wch: 12 },  // 소재형태
      { wch: 15 },  // 차종
      { wch: 20 },  // 규격/소재
      { wch: 8 },   // 단위
      { wch: 10 },  // 두께(mm)
      { wch: 10 },  // 폭(mm)
      { wch: 12 },  // 단위중량(kg)
      { wch: 12 },  // 현재고
      { wch: 12 },  // 안전재고
      { wch: 12 },  // 기준단가
      { wch: 15 },  // 도장상태
      { wch: 25 },  // 비고
      { wch: 18 },  // 생성일시
      { wch: 18 }   // 수정일시
    ];

    const metadataRows = [
      ['생성 일시', new Date().toLocaleString('ko-KR')],
      ['총 품목 수', rows.length],
      ['분류', category || '전체'],
      ['타입', itemType || '전체'],
      ['소재형태', materialType || '전체'],
      ['검색어', search || '없음']
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    metadataSheet['!cols'] = [{ wch: 15 }, { wch: 30 }];

    XLSX.utils.book_append_sheet(workbook, metadataSheet, '요약');
    XLSX.utils.book_append_sheet(workbook, worksheet, '품목 목록');

    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `items_${currentDate}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${encodeURIComponent(filename)}`,
        'Content-Length': excelBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Error exporting items:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export items to Excel'
      },
      { status: 500 }
    );
  }
}
