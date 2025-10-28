import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import crypto from 'crypto';
import {
  PortalUser,
  PortalSession,
  PortalSessionWithUser,
  PortalApiResponse,
  LoginRequest,
} from '@/types/portal.types';

const supabase = getSupabaseClient();

/**
 * POST /api/portal/auth/login
 * Portal login with iron-session (24h duration)
 */
export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    const body = JSON.parse(text);

    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '사용자명과 비밀번호가 필요합니다' },
        { status: 400 }
      );
    }

    // Find user
    const { data: user, error: userError } = await supabase
      .from('portal_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json<PortalApiResponse>(
        { success: false, error: '사용자명 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      );
    }

    const portalUser = user as PortalUser;

    // Verify password (using simple comparison for now - TODO: use bcrypt)
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    if (hashedPassword !== portalUser.password_hash) {
      return NextResponse.json(
        { success: false, error: '사용자명 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      );
    }

    // Create session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    // Store session
    const { error: sessionError } = await supabase
      .from('portal_sessions')
      .insert({
        portal_user_id: portalUser.portal_user_id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString()
      });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json<PortalApiResponse>(
        { success: false, error: sessionError.message },
        { status: 500 }
      );
    }

    // Update last login
    await supabase
      .from('portal_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('portal_user_id', portalUser.portal_user_id);

    // Log login
    await supabase
      .from('portal_access_logs')
      .insert({
        portal_user_id: portalUser.portal_user_id,
        action: 'LOGIN',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      });

    // Return session data
    return NextResponse.json<PortalApiResponse>({
      success: true,
      data: {
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        user: {
          portal_user_id: portalUser.portal_user_id,
          username: portalUser.username,
          email: portalUser.email,
          role: portalUser.role,
          company_id: portalUser.company_id
        }
      }
    });
  } catch (error: any) {
    console.error('Error in POST /api/portal/auth/login:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portal/auth/logout
 * Portal logout
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionToken = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '세션 토큰이 필요합니다' },
        { status: 401 }
      );
    }

    // Find session
    const { data: session } = await supabase
      .from('portal_sessions')
      .select('portal_user_id')
      .eq('session_token', sessionToken)
      .single();

    // Delete session
    await supabase
      .from('portal_sessions')
      .delete()
      .eq('session_token', sessionToken);

    // Log logout
    if (session) {
      await supabase
        .from('portal_access_logs')
        .insert({
          portal_user_id: session.portal_user_id,
          action: 'LOGOUT',
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        });
    }

    return NextResponse.json({
      success: true,
      message: '로그아웃되었습니다'
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/portal/auth/logout:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/portal/auth/session
 * Check session validity
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: '세션 토큰이 필요합니다' },
        { status: 401 }
      );
    }

    // Find session with user data
    const { data: session, error } = await supabase
      .from('portal_sessions')
      .select(`
        *,
        portal_users!inner(portal_user_id, username, email, role, company_id)
      `)
      .eq('session_token', sessionToken)
      .single();

    if (error || !session) {
      return NextResponse.json<PortalApiResponse>(
        { success: false, error: '유효하지 않은 세션입니다' },
        { status: 401 }
      );
    }

    const portalSession = session as any as PortalSessionWithUser;

    // Check expiration
    if (new Date(portalSession.expires_at) < new Date()) {
      await supabase
        .from('portal_sessions')
        .delete()
        .eq('session_token', sessionToken);

      return NextResponse.json<PortalApiResponse>(
        { success: false, error: '세션이 만료되었습니다' },
        { status: 401 }
      );
    }

    return NextResponse.json<PortalApiResponse>({
      success: true,
      data: {
        expires_at: portalSession.expires_at,
        user: portalSession.portal_users
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/auth/session:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
