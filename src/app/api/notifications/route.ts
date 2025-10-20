// Wave 3 Day 4 - Notification Management API
// src/app/api/notifications/route.ts
// Phase 1 Optimization: In-Memory caching with 60s TTL
// Phase 2 Task 6: Redis caching with automatic fallback
// Phase 2 Task 7: Cursor-based pagination with backward compatibility

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import {
  NotificationCreateSchema,
  NotificationUpdateSchema,
  NotificationQuerySchema
} from '@/lib/validation';
import { ERROR_MESSAGES, formatErrorResponse } from '@/lib/errorMessages';
import { ZodError } from 'zod';
import {
  getCachedData,
  setCachedData,
  deleteCacheByPattern,
  CacheKeys
} from '@/lib/cache-redis';
import {
  applyCursorPagination,
  buildCursorPaginationResponse,
  generateCursorCacheKey,
  cursorToOffsetResponse,
  logPaginationMetrics,
  type CursorPaginationParams
} from '@/lib/pagination-cursor';

/**
 * GET /api/notifications
 * 사용자 알림 목록 조회 (페이지네이션, 필터링)
 *
 * Query Parameters (Cursor-based with backward compatibility):
 * - cursor: 커서 문자열 (cursor-based pagination)
 * - direction: forward|backward (기본값: forward)
 * - page: 페이지 번호 (backward compatibility, 기본값: 1)
 * - limit: 페이지당 항목 수 (기본값: 20, 최대: 100)
 * - user_id: 사용자 ID 필터 (optional)
 * - type: 알림 유형 (price_alert|price_change|system)
 * - is_read: 읽음 상태 (true|false)
 * - start_date: 시작일 (YYYY-MM-DD)
 * - end_date: 종료일 (YYYY-MM-DD)
 *
 * Performance: 20-30% faster than offset pagination for deep pages
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Parse query params
    const queryParams: any = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20'
    };

    // Cursor-based parameters
    const cursor = searchParams.get('cursor');
    const direction = searchParams.get('direction') as 'forward' | 'backward' | null;

    const user_id_str = searchParams.get('user_id');
    if (user_id_str) queryParams.user_id = parseInt(user_id_str);

    const type_str = searchParams.get('type');
    if (type_str) queryParams.type = type_str;

    const is_read_str = searchParams.get('is_read');
    if (is_read_str) queryParams.is_read = is_read_str === 'true';

    const start_date_str = searchParams.get('start_date');
    if (start_date_str) queryParams.start_date = start_date_str;

    const end_date_str = searchParams.get('end_date');
    if (end_date_str) queryParams.end_date = end_date_str;

    // Validate with Zod
    const validatedParams = NotificationQuerySchema.parse(queryParams);
    const { page, limit, user_id, type, is_read, start_date, end_date } = validatedParams;

    // Determine pagination method
    const useCursor = !!cursor;

    // Build filter object for cache key
    const filters = {
      user_id: user_id || 'all',
      type: type || 'all',
      is_read: is_read ?? 'all',
      start_date: start_date || 'any',
      end_date: end_date || 'any'
    };

    // Phase 2 Cache: Generate cache key (supports both pagination methods)
    const cacheKey = useCursor
      ? generateCursorCacheKey('notifications', {
          cursor: cursor || undefined,
          direction: direction || 'forward',
          limit,
          orderBy: 'created_at',
          orderDirection: 'desc'
        }, filters)
      : `notifications:list:${user_id || 'all'}:${page}:${limit}:${type || 'all'}:${is_read ?? 'all'}`;

    // Try cache first
    const cachedResult = await getCachedData<any>(cacheKey);

    if (cachedResult) {
      logPaginationMetrics('notifications GET (cached)', startTime, cachedResult.data?.length || 0, useCursor);

      return NextResponse.json({
        success: true,
        ...cachedResult,
        cached: true
      });
    }

    const supabase = getSupabaseClient();

    // Build base query
    let query = supabase.from('notifications').select('*');

    // Apply filters
    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (is_read !== undefined) {
      query = query.eq('is_read', is_read);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    let responseData: any;

    if (useCursor) {
      // Use cursor-based pagination
      const cursorParams: CursorPaginationParams = {
        cursor: cursor || undefined,
        direction: direction || 'forward',
        limit,
        orderBy: 'created_at',
        orderDirection: 'desc'
      };

      // Apply cursor pagination
      query = applyCursorPagination(query, cursorParams);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Build cursor pagination response
      const cursorResponse = buildCursorPaginationResponse(
        data || [],
        cursorParams
      );

      responseData = {
        data: cursorResponse.data,
        pagination: {
          ...cursorResponse.pagination,
          // Include page for backward compatibility
          page: page
        }
      };
    } else {
      // Use offset-based pagination (backward compatibility)
      const offset = (page - 1) * limit;

      // Reuse existing query object with all filters intact
      const { data, error, count } = await query
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      responseData = {
        data: data || [],
        pagination: {
          page,
          limit,
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNext: (offset + limit) < (count || 0),
          hasPrev: offset > 0
        }
      };
    }

    // Cache result
    await setCachedData(cacheKey, responseData, 60);

    // Log performance metrics
    logPaginationMetrics('notifications GET', startTime, responseData.data.length, useCursor);

    return NextResponse.json({
      success: true,
      ...responseData,
      cached: false
    });

  } catch (error) {
    console.error('[notifications] GET error:', error);

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
      formatErrorResponse(error, '알림 조회'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * 새로운 알림 생성
 *
 * Body:
 * - user_id: 사용자 ID
 * - type: 알림 유형 (price_alert|price_change|system)
 * - title: 알림 제목
 * - message: 알림 내용
 * - item_id: 품목 ID (optional)
 * - is_read: 읽음 상태 (기본값: false)
 */
export async function POST(request: NextRequest) {
  try {
    // UTF-8 한글 처리
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate with Zod
    const validatedData = NotificationCreateSchema.parse(body);
    const { user_id, type, title, message, item_id, is_read } = validatedData;

    const supabase = getSupabaseClient();

    // Create notification
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id,
        type,
        title,
        message,
        item_id: item_id || null,
        is_read: is_read || false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    // Phase 2 Cache: Invalidate user's notification cache using pattern-based deletion
    await deleteCacheByPattern(CacheKeys.allNotifications(user_id));

    return NextResponse.json({
      success: true,
      message: '알림이 성공적으로 생성되었습니다.',
      data
    }, { status: 201 });

  } catch (error) {
    console.error('[notifications] POST error:', error);

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
      formatErrorResponse(error, '알림 생성'),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications
 * 알림 읽음 상태 업데이트
 *
 * Body:
 * - notification_id: 알림 ID
 * - is_read: 읽음 상태 (true|false)
 */
export async function PUT(request: NextRequest) {
  try {
    // UTF-8 한글 처리
    const text = await request.text();
    const body = JSON.parse(text);

    // Validate with Zod
    const validatedData = NotificationUpdateSchema.parse(body);
    const { notification_id, is_read } = validatedData;

    const supabase = getSupabaseClient();

    // Check if notification exists
    const { data: existing, error: checkError } = await supabase
      .from('notifications')
      .select('notification_id')
      .eq('notification_id', notification_id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.NOT_FOUND
        },
        { status: 404 }
      );
    }

    // Update notification
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read })
      .eq('notification_id', notification_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }

    // Phase 2 Cache: Invalidate user's notification cache using pattern-based deletion
    if (data?.user_id) {
      await deleteCacheByPattern(CacheKeys.allNotifications(data.user_id));
    }

    return NextResponse.json({
      success: true,
      message: '알림이 성공적으로 수정되었습니다.',
      data
    });

  } catch (error) {
    console.error('[notifications] PUT error:', error);

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
      formatErrorResponse(error, '알림 수정'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications?notification_id=123
 * 알림 삭제
 *
 * Query Parameters:
 * - notification_id: 알림 ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const notificationIdStr = searchParams.get('notification_id');

    if (!notificationIdStr) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.REQUIRED_FIELD('알림 ID')
        },
        { status: 400 }
      );
    }

    const notification_id = parseInt(notificationIdStr);

    if (isNaN(notification_id) || notification_id <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.INVALID_FIELD('알림 ID')
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Check if notification exists
    const { data: existing, error: checkError } = await supabase
      .from('notifications')
      .select('notification_id')
      .eq('notification_id', notification_id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES.NOT_FOUND
        },
        { status: 404 }
      );
    }

    // Get user_id before deletion for cache invalidation
    const { data: toDelete } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('notification_id', notification_id)
      .single();

    // Delete notification (hard delete)
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('notification_id', notification_id);

    if (error) {
      throw new Error(`Database delete failed: ${error.message}`);
    }

    // Phase 2 Cache: Invalidate user's notification cache using pattern-based deletion
    if (toDelete?.user_id) {
      await deleteCacheByPattern(CacheKeys.allNotifications(toDelete.user_id));
    }

    return NextResponse.json({
      success: true,
      message: '알림이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('[notifications] DELETE error:', error);
    return NextResponse.json(
      formatErrorResponse(error, '알림 삭제'),
      { status: 500 }
    );
  }
}
