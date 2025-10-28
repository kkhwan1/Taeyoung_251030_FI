/**
 * Portal Middleware Utilities
 *
 * Helper functions for validating portal sessions and enforcing RLS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import {
  portalSessionOptions,
  type PortalSessionData,
  setPortalUserContext,
  logPortalAccess,
} from '@/lib/portal-auth';

/**
 * Get portal session from request
 * Returns session data if valid, null otherwise
 */
export async function getPortalSession(): Promise<PortalSessionData | null> {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<PortalSessionData>(
      cookieStore,
      portalSessionOptions
    );

    if (!session.isLoggedIn || !session.portalUserId) {
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to get portal session:', error);
    return null;
  }
}

/**
 * Require portal authentication
 * Returns error response if not authenticated
 */
export async function requirePortalAuth(
  allowedRoles?: Array<'CUSTOMER' | 'SUPPLIER' | 'ADMIN'>
): Promise<{ session: PortalSessionData } | NextResponse> {
  const session = await getPortalSession();

  if (!session) {
    return NextResponse.json(
      {
        success: false,
        error: '로그인이 필요합니다.',
      },
      { status: 401 }
    );
  }

  // Check role if specified
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return NextResponse.json(
      {
        success: false,
        error: '접근 권한이 없습니다.',
      },
      { status: 403 }
    );
  }

  // Set portal user context for RLS
  try {
    await setPortalUserContext(session.portalUserId);
  } catch (error) {
    console.error('Failed to set portal user context:', error);
    return NextResponse.json(
      {
        success: false,
        error: '사용자 컨텍스트 설정에 실패했습니다.',
      },
      { status: 500 }
    );
  }

  return { session };
}

/**
 * Log portal API access
 */
export async function logPortalApiAccess(
  request: NextRequest,
  session: PortalSessionData | null,
  action: string,
  resource: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logPortalAccess(
      session?.portalUserId || null,
      action,
      resource,
      ipAddress,
      userAgent,
      success,
      errorMessage
    );
  } catch (error) {
    console.error('Failed to log portal API access:', error);
    // Don't throw - logging failure shouldn't break API
  }
}

/**
 * Create standardized portal API response
 */
export function createPortalResponse(
  success: boolean,
  data?: any,
  error?: string,
  status: number = 200
): NextResponse {
  if (success) {
    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status }
    );
  } else {
    return NextResponse.json(
      {
        success: false,
        error: error || '요청 처리 중 오류가 발생했습니다.',
      },
      { status }
    );
  }
}
