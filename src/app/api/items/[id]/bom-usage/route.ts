import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = id;

    // 모품목으로 사용되는 BOM 수
    const { count: asParent } = await supabaseAdmin
      .from('bom')
      .select('*', { count: 'exact', head: true })
      .eq('parent_item_id', Number(itemId))
      .eq('is_active', true);

    // 자품목으로 사용되는 BOM 수
    const { count: asChild } = await supabaseAdmin
      .from('bom')
      .select('*', { count: 'exact', head: true })
      .eq('child_item_id', Number(itemId))
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      data: {
        as_parent: asParent || 0,
        as_child: asChild || 0
      }
    });
  } catch (error) {
    console.error('Error fetching BOM usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch BOM usage' },
      { status: 500 }
    );
  }
}
