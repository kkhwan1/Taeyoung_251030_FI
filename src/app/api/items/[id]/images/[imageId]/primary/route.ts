import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface RouteContext {
  params: Promise<{
    id: string;
    imageId: string;
  }>;
}

/**
 * PUT /api/items/[id]/images/[imageId]/primary
 * Set an image as primary for an item
 */
export async function PUT(
  request: NextRequest,
  routeContext: RouteContext
) {
  try {
    const { id: itemId, imageId } = await routeContext.params;

    // Verify item exists
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id')
      .eq('item_id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { success: false, error: '품목을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Verify image exists and belongs to this item
    const { data: image, error: imageError } = await supabase
      .from('item_images')
      .select('image_id, item_id')
      .eq('image_id', imageId)
      .eq('item_id', itemId)
      .single();

    if (imageError || !image) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Start transaction: remove primary from all images, then set new primary
    const { error: removePrimaryError } = await supabase
      .from('item_images')
      .update({ is_primary: false })
      .eq('item_id', itemId);

    if (removePrimaryError) {
      console.error('Error removing primary status:', removePrimaryError);
      return NextResponse.json(
        { success: false, error: '기존 대표 이미지 해제 실패' },
        { status: 500 }
      );
    }

    const { error: setPrimaryError } = await supabase
      .from('item_images')
      .update({ is_primary: true })
      .eq('image_id', imageId)
      .eq('item_id', itemId);

    if (setPrimaryError) {
      console.error('Error setting primary status:', setPrimaryError);
      return NextResponse.json(
        { success: false, error: '대표 이미지 설정 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '대표 이미지가 성공적으로 설정되었습니다'
    });
  } catch (error) {
    console.error('Unexpected error in PUT /api/items/[id]/images/[imageId]/primary:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}