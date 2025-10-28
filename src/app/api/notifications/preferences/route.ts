// Wave 3 Day 4 - Notification Preferences API
// src/app/api/notifications/preferences/route.ts
// Phase 1 Optimization: In-Memory caching with 60s TTL

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import {
  NotificationPreferencesSchema,
  NotificationPreferencesUpdateSchema
} from '@/lib/validation';
import { ERROR_MESSAGES, formatErrorResponse } from '@/lib/errorMessages';
import { ZodError } from 'zod';
import {
  CacheKeys,
  cacheGet,
  cacheSet,
  invalidateUserNotifications
} from '@/lib/cache-memory';

/**
 * GET /api/notifications/preferences?user_id=1
 * 사용자 알림 설정 조회
 *
 * Query Parameters:
 * - user_id: 사용자 ID (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdStr = searchParams.get('user_id');

    if (!userIdStr) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.REQUIRED_FIELD('사용자 ID')
        },
        { status: 400 }
      );
    }

    const user_id = parseInt(userIdStr);

    if (isNaN(user_id) || user_id <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.INVALID_FIELD('사용자 ID')
        },
        { status: 400 }
      );
    }

    // Phase 1 Cache: Try cache first
    const cacheKey = CacheKeys.NOTIFICATION_PREFERENCES(user_id);
    const cachedPrefs = cacheGet(cacheKey);

    if (cachedPrefs) {
      return NextResponse.json({
        success: true,
        data: cachedPrefs,
        cached: true
      });
    }

    const supabase = getSupabaseClient() as any;

    // Get user preferences
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (error) {
      // If not found, return default preferences
      if (error.code === 'PGRST116') {
        const defaultPrefs = {
          user_id,
          email_enabled: true,
          push_enabled: false,
          price_threshold: null,
          categories: null
        };

        // Phase 1 Cache: Cache default preferences
        cacheSet(cacheKey, defaultPrefs, 60);

        return NextResponse.json({
          success: true,
          data: defaultPrefs,
          cached: false
        });
      }

      throw new Error(`Database query failed: ${error.message}`);
    }

    // Phase 1 Cache: Store result with 60s TTL
    cacheSet(cacheKey, data, 60);

    return NextResponse.json({
      success: true,
      data,
      cached: false
    });

  } catch (error) {
    console.error('[notification-preferences] GET error:', error);
    return NextResponse.json(
      formatErrorResponse(error, '알림 설정 조회'),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 * 사용자 알림 설정 업데이트 (upsert)
 *
 * Body:
 * - user_id: 사용자 ID (required)
 * - email_enabled: 이메일 알림 활성화 (optional)
 * - push_enabled: 푸시 알림 활성화 (optional)
 * - price_threshold: 가격 알림 임계값 (optional)
 * - categories: 알림 받을 카테고리 배열 (optional)
 */
export async function PUT(request: NextRequest) {
  try {
    // UTF-8 한글 처리
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate with Zod
    const validatedData = NotificationPreferencesUpdateSchema.parse(body);
    const { user_id, email_enabled, push_enabled, price_threshold, categories } = validatedData;

    const supabase = getSupabaseClient();

    // Prepare update data (only include provided fields)
    const updateData: any = { user_id };

    if (email_enabled !== undefined) {
      updateData.email_enabled = email_enabled;
    }

    if (push_enabled !== undefined) {
      updateData.push_enabled = push_enabled;
    }

    if (price_threshold !== undefined) {
      updateData.price_threshold = price_threshold;
    }

    if (categories !== undefined) {
      updateData.categories = categories;
    }

    // Upsert preferences (insert or update)
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(updateData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database upsert failed: ${error.message}`);
    }

    // Phase 1 Cache: Invalidate user's notification and preferences cache
    invalidateUserNotifications(user_id);

    return NextResponse.json({
      success: true,
      message: '알림 설정이 성공적으로 업데이트되었습니다.',
      data
    });

  } catch (error) {
    console.error('[notification-preferences] PUT error:', error);

    if (error instanceof ZodError) {
      const details = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.VALIDATION_FAILED,
          details
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      formatErrorResponse(error, '알림 설정 업데이트'),
      { status: 500 }
    );
  }
}
