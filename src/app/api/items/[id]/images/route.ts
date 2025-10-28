import { NextRequest } from 'next/server';
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
// import { cookies } from 'next/headers';
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

/**
 * GET /api/items/[id]/images
 * Get all images for an item
 */
interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  routeContext: RouteContext
) {
  try {
    const { id: itemId } = await routeContext.params;

    // Fetch images ordered by is_primary DESC, display_order ASC
    const { data: images, error } = await supabase
      .from('item_images')
      .select('*')
      .eq('item_id', itemId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching images:', error);
      return Response.json(
        { success: false, error: '이미지 조회 실패' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: images || []
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/items/[id]/images:', error);
    return Response.json(
      { success: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/items/[id]/images
 * Upload a new image for an item
 */
export async function POST(
  request: NextRequest,
  routeContext: RouteContext
) {
  try {
    const { id: itemId } = await routeContext.params;

    // Verify item exists
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('item_id, item_name')
      .eq('item_id', itemId)
      .single();

    if (itemError || !item) {
      return Response.json(
        { success: false, error: '품목을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json(
        { success: false, error: '파일이 제공되지 않았습니다' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        { success: false, error: '지원하지 않는 파일 형식입니다 (JPEG, PNG, GIF, WebP만 가능)' },
        { status: 400 }
      );
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return Response.json(
        { success: false, error: '파일 크기는 10MB를 초과할 수 없습니다' },
        { status: 400 }
      );
    }

    // Validate Korean filename encoding
    const fileName = file.name;
    const koreanRegex = /[가-힣]/;
    if (koreanRegex.test(fileName)) {
      // Ensure proper UTF-8 encoding
      try {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8');
        const encoded = encoder.encode(fileName);
        const decoded = decoder.decode(encoded);
        if (decoded !== fileName) {
          return Response.json(
            { success: false, error: '한글 파일명 인코딩 오류' },
            { status: 400 }
          );
        }
      } catch (error) {
        return Response.json(
          { success: false, error: '파일명 검증 실패' },
          { status: 400 }
        );
      }
    }

    // Generate unique file name
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExt = fileName.split('.').pop();
    const storagePath = `${itemId}/${timestamp}_${randomString}.${fileExt}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return Response.json(
        { success: false, error: '파일 업로드 실패' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('item-images')
      .getPublicUrl(storagePath);

    // Check if this is the first image for this item
    const { data: existingImages } = await supabase
      .from('item_images')
      .select('image_id')
      .eq('item_id', itemId);

    const isPrimary = !existingImages || existingImages.length === 0;

    // Get max display_order
    const { data: maxOrderData } = await supabase
      .from('item_images')
      .select('display_order')
      .eq('item_id', itemId)
      .order('display_order', { ascending: false })
      .limit(1);

    const displayOrder = maxOrderData && maxOrderData.length > 0
      ? (maxOrderData[0].display_order || 0) + 1
      : 0;

    // Insert image record
    const { data: imageRecord, error: insertError } = await supabase
      .from('item_images')
      .insert({
        item_id: itemId,
        image_url: urlData.publicUrl,
        file_name: fileName,
        file_size: file.size,
        mime_type: file.type,
        is_primary: isPrimary,
        display_order: displayOrder
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      // Cleanup uploaded file
      await supabase.storage.from('item-images').remove([storagePath]);
      return Response.json(
        { success: false, error: '이미지 정보 저장 실패' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: imageRecord,
      message: '이미지가 성공적으로 업로드되었습니다'
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/items/[id]/images:', error);
    return Response.json(
      { success: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
