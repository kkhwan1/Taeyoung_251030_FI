/**
 * Portal Login API
 *
 * POST /api/portal/auth/login
 * Authenticates portal users (customers/suppliers) using iron-session
 * Supports Korean usernames with proper UTF-8 encoding
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import {
  authenticatePortalUser,
  portalSessionOptions,
  type PortalSessionData,
  logPortalAccess,
} from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Use request.text() + JSON.parse() for Korean username support
    // DO NOT use request.json() - it breaks UTF-8 Korean characters
    const text = await request.text();
    const body = JSON.parse(text);

    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: '아이디와 비밀번호를 입력해주세요.',
        },
        { status: 400 }
      );
    }

    // Get client info for logging
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Authenticate user
    const result = await authenticatePortalUser(
      username,
      password,
      ipAddress,
      userAgent
    );

    if (!result.success || !result.session || !result.sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || '로그인에 실패했습니다.',
        },
        { status: 401 }
      );
    }

    // Create iron-session
    const cookieStore = await cookies();
    const session = await getIronSession<PortalSessionData>(
      cookieStore,
      portalSessionOptions
    );

    // Store session data
    session.portalUserId = result.session.portalUserId;
    session.username = result.session.username;
    session.role = result.session.role;
    session.companyId = result.session.companyId;
    session.companyName = result.session.companyName;
    session.isLoggedIn = true;

    await session.save();

    // Log successful login
    await logPortalAccess(
      result.session.portalUserId,
      'LOGIN_SUCCESS',
      '/api/portal/auth/login',
      ipAddress,
      userAgent,
      true
    );

    // Return success with user info (excluding sensitive data)
    return NextResponse.json(
      {
        success: true,
        data: {
          username: result.session.username,
          role: result.session.role,
          companyName: result.session.companyName,
        },
        message: `환영합니다, ${result.session.username}님!`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Portal login error:', error);

    // Log failed login attempt
    try {
      const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      await logPortalAccess(
        null,
        'LOGIN_ERROR',
        '/api/portal/auth/login',
        ipAddress,
        userAgent,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: '로그인 처리 중 오류가 발생했습니다.',
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
      error: 'Method not allowed. Use POST to login.',
    },
    { status: 405 }
  );
}
