import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id);

    if (isNaN(itemId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid item ID' },
        { status: 400 }
      );
    }

    // 이 품목이 모품목인 BOM 구성 (자식 품목들)
    const { data: childBoms, error: childError } = await supabaseAdmin
      .from('bom')
      .select(`
        bom_id,
        child_item_id,
        quantity_required,
        level_no,
        labor_cost,
        machine_time,
        setup_time,
        notes
      `)
      .eq('parent_item_id', itemId)
      .eq('is_active', true)
      .order('level_no', { ascending: true });

    if (childError) {
      console.error('Error fetching child BOMs:', childError);
      throw childError;
    }

    // 자식 품목 정보를 별도로 조회
    const childItemIds = childBoms?.map(bom => bom.child_item_id) || [];
    let childItems: Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      unit: string;
      current_stock: number | null;
      price: number | null;
    }> = [];
    if (childItemIds.length > 0) {
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('items')
        .select('item_id, item_code, item_name, unit, current_stock, price')
        .in('item_id', childItemIds);

      if (itemsError) {
        console.error('Error fetching child items:', itemsError);
        throw itemsError;
      }
      childItems = items || [];
    }

    // 자식 품목 정보를 BOM 데이터에 병합
    const childBomsWithItems = childBoms?.map(bom => ({
      ...bom,
      child_item: childItems.find(item => item.item_id === bom.child_item_id)
    })) || [];

    // 이 품목이 자품목인 BOM 구성 (부모 품목들)
    const { data: parentBoms, error: parentError } = await supabaseAdmin
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        quantity_required,
        level_no,
        labor_cost,
        machine_time,
        setup_time,
        notes
      `)
      .eq('child_item_id', itemId)
      .eq('is_active', true)
      .order('level_no', { ascending: true });

    if (parentError) {
      console.error('Error fetching parent BOMs:', parentError);
      throw parentError;
    }

    // 부모 품목 정보를 별도로 조회
    const parentItemIds = parentBoms?.map(bom => bom.parent_item_id) || [];
    let parentItems: Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      unit: string;
      current_stock: number | null;
      price: number | null;
    }> = [];
    if (parentItemIds.length > 0) {
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('items')
        .select('item_id, item_code, item_name, unit, current_stock, price')
        .in('item_id', parentItemIds);

      if (itemsError) {
        console.error('Error fetching parent items:', itemsError);
        throw itemsError;
      }
      parentItems = items || [];
    }

    // 부모 품목 정보를 BOM 데이터에 병합
    const parentBomsWithItems = parentBoms?.map(bom => ({
      ...bom,
      parent_item: parentItems.find(item => item.item_id === bom.parent_item_id)
    })) || [];

    return NextResponse.json({
      success: true,
      data: {
        as_parent: parentBomsWithItems,
        as_child: childBomsWithItems
      }
    });
  } catch (error) {
    console.error('Error fetching BOM structure:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch BOM structure' },
      { status: 500 }
    );
  }
}