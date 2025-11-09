import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { optimizeImage, calculateCompressionRatio } from '@/lib/image-optimizer';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';
import { createSupabaseBrowserClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


/**
 * POST /api/images/optimize - 이미지 업로드 및 최적화
 */
export async function POST(request: NextRequest) {
  const { allowed, error, user } = await checkPermission('user');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const itemId = formData.get('item_id') as string;

    if (!file) {
      return Response.json({
        success: false,
        error: '파일이 없습니다.'
      }, { status: 400 });
    }

    // 이미지 파일 검증
    if (!file.type.startsWith('image/')) {
      return Response.json({
        success: false,
        error: '이미지 파일만 업로드 가능합니다.'
      }, { status: 400 });
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalSize = buffer.length;

    // 이미지 최적화 (3가지 크기 생성)
    const optimized = await optimizeImage(buffer, {
      maxThumbnailSize: 150,
      maxMediumSize: 600,
      maxFullSize: 1920,
      quality: 80
    });

    // Storage 경로 생성
    const timestamp = Date.now();
    const basePath = itemId ? `items/${itemId}` : `images/${timestamp}`;
    
    const supabaseClient = createSupabaseBrowserClient();

    // 3가지 크기를 모두 업로드
    const uploadPromises = [
      supabaseClient.storage
        .from('items')
        .upload(`${basePath}/thumbnail_${timestamp}.webp`, optimized.thumbnail, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false
        }),
      supabaseClient.storage
        .from('items')
        .upload(`${basePath}/medium_${timestamp}.webp`, optimized.medium, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false
        }),
      supabaseClient.storage
        .from('items')
        .upload(`${basePath}/full_${timestamp}.webp`, optimized.full, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false
        })
    ];

    const results = await Promise.all(uploadPromises);

    // 업로드 오류 확인
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      throw new Error(`Storage 업로드 실패: ${errors[0].error?.message}`);
    }

    // Public URL 생성
    const { data: { publicUrl: thumbnailUrl } } = supabaseClient.storage
      .from('items')
      .getPublicUrl(results[0].data!.path);

    const { data: { publicUrl: mediumUrl } } = supabaseClient.storage
      .from('items')
      .getPublicUrl(results[1].data!.path);

    const { data: { publicUrl: fullUrl } } = supabaseClient.storage
      .from('items')
      .getPublicUrl(results[2].data!.path);

    // 압축률 계산 (medium 기준)
    const compressionRatio = calculateCompressionRatio(
      originalSize,
      optimized.medium.length
    );

    // item_images 테이블에 저장 (itemId가 있는 경우)
    if (itemId) {
      const supabase = getSupabaseClient();
      const { data, error: dbError } = await supabase
        .from('item_images')
        .insert({
          item_id: parseInt(itemId),
          image_url: fullUrl,
          thumbnail_url: thumbnailUrl,
          medium_url: mediumUrl,
          full_url: fullUrl,
          compression_ratio: compressionRatio,
          created_by: user!.user_id
        })
        .select()
        .single();

      if (dbError) {
        return handleSupabaseError('insert', 'item_images', dbError);
      }

      return createSuccessResponse({
        ...data,
        stats: {
          originalSize,
          thumbnailSize: optimized.thumbnail.length,
          mediumSize: optimized.medium.length,
          fullSize: optimized.full.length,
          compressionRatio
        }
      }, undefined, 201);
    }

    // itemId가 없으면 URL만 반환
    return createSuccessResponse({
      thumbnailUrl,
      mediumUrl,
      fullUrl,
      stats: {
        originalSize,
        thumbnailSize: optimized.thumbnail.length,
        mediumSize: optimized.medium.length,
        fullSize: optimized.full.length,
        compressionRatio
      }
    }, undefined, 201);

  } catch (err) {
    console.error('이미지 최적화 오류:', err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : '이미지 최적화 실패'
    }, { status: 500 });
  }
}

