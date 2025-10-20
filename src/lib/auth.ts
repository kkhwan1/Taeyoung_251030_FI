import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { User, UserRole, JWTPayload, AuthError } from '@/types/auth';
import { AUTH_ERRORS } from '@/types/auth';

// JWT 토큰 생성
export function generateToken(payload: JWTPayload): string {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';

  // Cast payload to object type for jwt.sign
  return jwt.sign(payload as object, secret, { expiresIn } as jwt.SignOptions);
}

// JWT 토큰 검증
export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// 비밀번호 해싱
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// 비밀번호 검증
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// 사용자 인증
export async function authenticateUser(username: string, password: string): Promise<{ user: User; token: string } | AuthError> {
  try {
    // 사용자 조회 (실제 DB 필드명 사용)
    const { getSupabaseClient } = await import('@/lib/db-unified');
    const supabase = getSupabaseClient();

    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, username, password, name, email, role, is_active, created_at, updated_at')
      .eq('username', username)
      .eq('is_active', true);

    if (error || !users || users.length === 0) {
      return AUTH_ERRORS.INVALID_CREDENTIALS;
    }

    // Map database fields to User type
    const user = {
      id: users[0].user_id,
      username: users[0].username,
      name: users[0].name,
      email: users[0].email,
      role: users[0].role,
      is_active: users[0].is_active,
      created_at: users[0].created_at,
      updated_at: users[0].updated_at,
      password: users[0].password
    } as User & { password: string };

    // 비밀번호 검증
    const isPasswordValid = await verifyPassword(password, (user as any).password);

    if (!isPasswordValid) {
      return AUTH_ERRORS.INVALID_CREDENTIALS;
    }

    // 사용자 활성화 상태 확인
    if (!user.is_active) {
      return AUTH_ERRORS.USER_INACTIVE;
    }

    // JWT 토큰 생성
    const tokenPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const token = generateToken(tokenPayload);

    // password 제거 후 반환
    const { password: userPassword, ...userWithoutPassword } = user as any;

    return {
      user: userWithoutPassword,
      token
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return AUTH_ERRORS.INVALID_CREDENTIALS;
  }
}

// 토큰에서 사용자 정보 조회
export async function getUserFromToken(token: string): Promise<User | AuthError> {
  try {
    const payload = verifyToken(token);

    if (!payload) {
      return AUTH_ERRORS.TOKEN_INVALID;
    }

    // 사용자 조회
    const { getSupabaseClient } = await import('@/lib/db-unified');
    const supabase = getSupabaseClient();

    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, username, name, email, role, is_active, created_at, updated_at')
      .eq('user_id', payload.userId)
      .eq('is_active', true);

    if (error || !users || users.length === 0) {
      return AUTH_ERRORS.USER_NOT_FOUND;
    }

    // Map database fields to User type
    return {
      id: users[0].user_id,
      username: users[0].username,
      name: users[0].name,
      email: users[0].email,
      role: users[0].role,
      is_active: users[0].is_active,
      created_at: users[0].created_at,
      updated_at: users[0].updated_at
    } as User;

  } catch (error) {
    console.error('Get user from token error:', error);
    return AUTH_ERRORS.TOKEN_INVALID;
  }
}

// 권한 체크 유틸리티
export function checkPermission(userRole: UserRole, resource: string, action: string): boolean {
  const rolePermissions = {
    admin: ['*'], // 모든 권한
    manager: [
      'items:*', 'companies:*', 'inventory:*', 'production:*',
      'reports:read', 'reports:create', 'reports:update'
    ],
    operator: [
      'items:read', 'items:create', 'items:update',
      'companies:read', 'companies:create', 'companies:update',
      'inventory:read', 'inventory:create', 'inventory:update',
      'production:read', 'production:create', 'production:update',
      'reports:read'
    ],
    viewer: [
      'items:read', 'companies:read', 'inventory:read',
      'production:read', 'reports:read'
    ]
  };

  const permissions = rolePermissions[userRole] || [];

  // admin은 모든 권한
  if (permissions.includes('*')) {
    return true;
  }

  // 정확한 권한 매치
  if (permissions.includes(`${resource}:${action}`)) {
    return true;
  }

  // 와일드카드 권한 매치
  if (permissions.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

// 세션 쿠키 설정
export const SESSION_OPTIONS = {
  cookieName: 'taechang_session',
  password: process.env.SESSION_SECRET || 'session_secret_fallback',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24시간
    sameSite: 'strict' as const,
  },
};