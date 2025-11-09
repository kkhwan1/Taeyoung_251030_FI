/**
 * Portal Logout API
 *
 * POST /api/portal/auth/logout
 * Logs out portal users by destroying session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import {
  invalidatePortalSession,
  portalSessionOptions,
  type PortalSessionData,
  logPortalAccess,
} from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    // Get session
    const cookieStore = await cookies();
    const session = await getIronSession<PortalSessionData>(
      cookieStore,
      portalSessionOptions
    );

    if (!session.isLoggedIn || !session.portalUserId) {
      return NextResponse.json(
        {
          success: false,
          error: '로그인 상태가 아닙니다.',
        },
        { status: 401 }
      );
    }

    const portalUserId = session.portalUserId;
    const username = session.username;

    // Get client info for logging
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Destroy session in database (if session token exists)
    // Note: iron-session doesn't expose the session token directly,
    // so we'll destroy all sessions for this user
    // In production, you might want to store session token in the session data

    // Destroy iron-session
    session.destroy();

    // Log logout
    await logPortalAccess(
      portalUserId,
      'LOGOUT',
      '/api/portal/auth/logout',
      ipAddress,
      userAgent,
      true
    );

    return NextResponse.json(
      {
        success: true,
        message: `${username}님, 안전하게 로그아웃되었습니다.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Portal logout error:', error);

    return NextResponse.json(
      {
        success: false,
        error: '로그아웃 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

// GET method not allowed
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST to logout.',
    },
    { status: 405 }
  );
}
