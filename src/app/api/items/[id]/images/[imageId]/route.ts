import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';


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
 * DELETE /api/items/[id]/images/[imageId]
 * Delete an image for an item
 */
export async function DELETE(
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

    // Get image details before deletion
    const { data: image, error: imageError } = await supabase
      .from('item_images')
      .select('image_id, item_id, image_url, is_primary')
      .eq('image_id', imageId)
      .eq('item_id', itemId)
      .single();

    if (imageError || !image) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Delete from database first
    const { error: deleteError } = await supabase
      .from('item_images')
      .delete()
      .eq('image_id', imageId)
      .eq('item_id', itemId);

    if (deleteError) {
      console.error('Error deleting image record:', deleteError);
      return NextResponse.json(
        { success: false, error: '이미지 정보 삭제 실패' },
        { status: 500 }
      );
    }

    // Extract storage path from URL
    const url = new URL(image.image_url);
    const pathParts = url.pathname.split('/');
    const storagePath = pathParts.slice(-2).join('/'); // Get last two parts (itemId/filename)

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('item-images')
      .remove([storagePath]);

    if (storageError) {
      console.error('Error deleting from storage:', storageError);
      // Don't fail the request if storage deletion fails, as DB record is already deleted
    }

    // If this was the primary image, set another image as primary
    if (image.is_primary) {
      const { data: remainingImages } = await supabase
        .from('item_images')
        .select('image_id')
        .eq('item_id', itemId)
        .order('display_order', { ascending: true })
        .limit(1);

      if (remainingImages && remainingImages.length > 0) {
        await supabase
          .from('item_images')
          .update({ is_primary: true })
          .eq('image_id', remainingImages[0].image_id)
          .eq('item_id', itemId);
      }
    }

    return NextResponse.json({
      success: true,
      message: '이미지가 성공적으로 삭제되었습니다'
    });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/items/[id]/images/[imageId]:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}