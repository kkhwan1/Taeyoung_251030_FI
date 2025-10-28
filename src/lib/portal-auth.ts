/**
 * Portal Authentication Library
 *
 * Session-based authentication for external suppliers/customers using iron-session.
 * Separate from internal JWT-based authentication system.
 */

import { SessionOptions } from 'iron-session';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '@/lib/db-unified';
import crypto from 'crypto';
import {
  PortalSessionData,
  PortalUserWithCompany,
  PortalSessionWithUser,
  AuthenticationResult,
  SessionValidationResult,
  RateLimitInfo,
} from '@/types/portal.types';

// Re-export types for convenience
export type { PortalSessionData, AuthenticationResult, SessionValidationResult, RateLimitInfo };

// Session configuration for iron-session
export const portalSessionOptions: SessionOptions = {
  password: process.env.PORTAL_SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'taechang_portal_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60, // 24 hours in seconds
    sameSite: 'strict' as const,
    path: '/portal',
  },
};

// Rate limiting storage (in-memory for simplicity, use Redis in production)
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

/**
 * Check rate limiting for login attempts
 */
export function checkRateLimit(username: string): RateLimitInfo {
  const key = username.toLowerCase();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const attempts = loginAttempts.get(key);

  if (!attempts) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  // Reset if window has passed
  if (now - attempts.firstAttempt > windowMs) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  // Check if exceeded
  if (attempts.count >= maxAttempts) {
    return { allowed: false, remainingAttempts: 0 };
  }

  // Increment
  attempts.count += 1;
  return { allowed: true, remainingAttempts: maxAttempts - attempts.count };
}

/**
 * Hash password using bcrypt (10 rounds as per spec)
 */
export async function hashPortalPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hash
 */
export async function verifyPortalPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Authenticate portal user and create session
 */
export async function authenticatePortalUser(
  username: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthenticationResult> {
  try {
    // Check rate limiting
    const rateLimit = checkRateLimit(username);
    if (!rateLimit.allowed) {
      await logPortalAccess(null, 'LOGIN_FAILED', null, ipAddress, userAgent, false, 'Rate limit exceeded');
      return {
        success: false,
        error: '로그인 시도 횟수가 초과되었습니다. 15분 후에 다시 시도하세요.'
      };
    }

    const supabase = getSupabaseClient();

    // Fetch user with company info
    const { data: users, error } = await supabase
      .from('portal_users')
      .select(`
        portal_user_id,
        username,
        password_hash,
        email,
        role,
        is_active,
        company_id,
        companies!inner(company_name, company_type)
      `)
      .eq('username', username)
      .eq('is_active', true)
      .limit(1);

    if (error || !users || users.length === 0) {
      await logPortalAccess(null, 'LOGIN_FAILED', null, ipAddress, userAgent, false, 'Invalid username');
      return { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
    }

    const user = users[0] as any as PortalUserWithCompany;

    // Verify password
    const isPasswordValid = await verifyPortalPassword(password, user.password_hash);
    if (!isPasswordValid) {
      await logPortalAccess(user.portal_user_id, 'LOGIN_FAILED', null, ipAddress, userAgent, false, 'Invalid password');
      return { success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
    }

    // Generate session token
    const sessionToken = crypto.randomUUID();

    // Create session in database
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const { error: sessionError } = await supabase
      .from('portal_sessions')
      .insert({
        portal_user_id: user.portal_user_id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return { success: false, error: '세션 생성에 실패했습니다.' };
    }

    // Update last login timestamp
    await supabase
      .from('portal_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('portal_user_id', user.portal_user_id);

    // Log successful login
    await logPortalAccess(user.portal_user_id, 'LOGIN_SUCCESS', null, ipAddress, userAgent, true);

    // Create session data
    const sessionData: PortalSessionData = {
      portalUserId: user.portal_user_id,
      username: user.username,
      role: user.role as any,
      companyId: user.company_id,
      companyName: user.companies.company_name,
      isLoggedIn: true,
    };

    return {
      success: true,
      session: sessionData,
      sessionToken,
    };
  } catch (error) {
    console.error('Portal authentication error:', error);
    return { success: false, error: '로그인 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * Validate session token and return user data
 */
export async function validatePortalSession(
  sessionToken: string
): Promise<SessionValidationResult> {
  try {
    const supabase = getSupabaseClient();

    // Fetch session with user info
    const { data: sessions, error } = await supabase
      .from('portal_sessions')
      .select(`
        session_id,
        portal_user_id,
        expires_at,
        portal_users!inner(
          portal_user_id,
          username,
          role,
          is_active,
          company_id,
          companies!inner(company_name)
        )
      `)
      .eq('session_token', sessionToken)
      .limit(1);

    if (error || !sessions || sessions.length === 0) {
      return { valid: false, error: '세션을 찾을 수 없습니다.' };
    }

    const session = sessions[0] as any as PortalSessionWithUser;
    const user = session.portal_users;

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await supabase
        .from('portal_sessions')
        .delete()
        .eq('session_id', session.session_id);

      return { valid: false, error: '세션이 만료되었습니다.' };
    }

    // Check user is still active
    if (!user.is_active) {
      return { valid: false, error: '비활성화된 사용자입니다.' };
    }

    // Create session data
    const sessionData: PortalSessionData = {
      portalUserId: user.portal_user_id,
      username: user.username,
      role: user.role as any,
      companyId: user.company_id,
      companyName: user.companies.company_name,
      isLoggedIn: true,
    };

    return { valid: true, session: sessionData };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, error: '세션 검증 중 오류가 발생했습니다.' };
  }
}

/**
 * Invalidate session (logout)
 */
export async function invalidatePortalSession(sessionToken: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('portal_sessions')
      .delete()
      .eq('session_token', sessionToken);

    return !error;
  } catch (error) {
    console.error('Session invalidation error:', error);
    return false;
  }
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('portal_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('session_id');

    if (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Session cleanup error:', error);
    return 0;
  }
}

/**
 * Log portal access for audit trail
 */
export async function logPortalAccess(
  portalUserId: number | null,
  action: string,
  resource: string | null,
  ipAddress?: string,
  userAgent?: string,
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase.from('portal_access_logs').insert({
      portal_user_id: portalUserId,
      action,
      resource,
      ip_address: ipAddress,
      user_agent: userAgent,
      success,
      error_message: errorMessage,
    });
  } catch (error) {
    console.error('Access log error:', error);
    // Don't throw - logging failure shouldn't break authentication
  }
}

/**
 * Set portal user context for RLS (must be called before RLS-protected queries)
 */
export async function setPortalUserContext(portalUserId: number): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.rpc('set_portal_user_context', { user_id: portalUserId });
  } catch (error) {
    console.error('Failed to set portal user context:', error);
    throw new Error('Failed to set user context for data access');
  }
}
