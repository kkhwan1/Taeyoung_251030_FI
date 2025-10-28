import { getSupabaseClient } from '@/lib/db-unified';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export type UserRole = 'ceo' | 'admin' | 'manager' | 'user' | 'viewer' | 'operator' | 'accountant';

export interface User {
  user_id: number;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * 현재 로그인한 사용자 정보 조회 (세션 기반)
 */
export async function getCurrentUser(request?: NextRequest): Promise<User | null> {
  try {
    // API 라우트에서는 request 객체 사용, 서버 컴포넌트에서는 cookies() 사용
    const userId = request 
      ? request.cookies.get('user_id')?.value 
      : (await cookies()).get('user_id')?.value;  // await 추가

    console.log('[getCurrentUser] userId from cookie:', userId);

    if (!userId) {
      console.log('[getCurrentUser] No userId found in cookie');
      return null;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', parseInt(userId))
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[getCurrentUser] Database error:', error);
      return null;
    }

    if (!data) {
      console.log('[getCurrentUser] No user data found');
      return null;
    }

    console.log('[getCurrentUser] User found:', data.username);
    return data as User;
  } catch (err) {
    console.error('[getCurrentUser] Exception:', err);
    return null;
  }
}

/**
 * 권한 검증 (계층적 역할)
 */
export async function checkPermission(
  requiredRole: UserRole,
  request?: NextRequest
): Promise<{ allowed: boolean; user?: User; error?: string }> {
  const user = await getCurrentUser(request);

  if (!user) {
    return { allowed: false, error: '로그인이 필요합니다.' };
  }

  if (!user.is_active) {
    return { allowed: false, error: '비활성화된 계정입니다.' };
  }

  // CEO는 모든 권한 통과
  if (user.role === 'ceo') {
    return { allowed: true, user };
  }

  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    operator: 2,
    user: 3,
    accountant: 3,  // viewer 이상 권한 (READ 가능)
    manager: 4,
    admin: 5,
    ceo: 6
  };

  const userLevel = roleHierarchy[user.role];
  const requiredLevel = roleHierarchy[requiredRole];

  if (userLevel >= requiredLevel) {
    return { allowed: true, user };
  }

  return { allowed: false, error: '권한이 부족합니다.' };
}

/**
 * 특정 역할만 허용 (정확한 매칭)
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<{
  allowed: boolean;
  user?: User;
  error?: string;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return { allowed: false, error: '로그인이 필요합니다.' };
  }

  if (!user.is_active) {
    return { allowed: false, error: '비활성화된 계정입니다.' };
  }

  if (!allowedRoles.includes(user.role)) {
    return { allowed: false, error: '접근 권한이 없습니다.' };
  }

  return { allowed: true, user };
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(
  username: string,
  password: string
): Promise<User | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  const valid = await bcrypt.compare(password, data.password);
  if (!valid) return null;

  return data as User;
}

/**
 * 비밀번호 해싱
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * 역할 레이블 한글 변환
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    ceo: 'CEO',
    admin: '관리자',
    accountant: '회계 담당자',
    manager: '매니저',
    user: '사용자',
    viewer: '열람자',
    operator: '운영자'
  };
  return labels[role] || role;
}

/**
 * 역할 배지 색상
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    ceo: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
    admin: 'bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900',
    accountant: 'bg-gray-500 text-white dark:bg-gray-400 dark:text-gray-900',
    manager: 'bg-gray-400 text-gray-900 dark:bg-gray-500 dark:text-white',
    user: 'bg-gray-300 text-gray-900 dark:bg-gray-600 dark:text-white',
    viewer: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    operator: 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

/**
 * 리소스별 작업 권한 확인
 * @param user 사용자 정보
 * @param resource 리소스 타입 ('sales', 'purchases', 'items', 'inventory' 등)
 * @param action 작업 타입 ('read', 'create', 'update', 'delete')
 */
export function checkResourcePermission(
  user: User,
  resource: string,
  action: 'read' | 'create' | 'update' | 'delete'
): { allowed: boolean; error?: string } {
  // CEO는 모든 리소스에 대한 모든 작업 가능
  if (user.role === 'ceo') {
    return { allowed: true };
  }
  
  // admin은 모든 리소스 CRUD 가능
  if (user.role === 'admin') {
    return { allowed: true };
  }
  
  // accountant 특수 처리
  if (user.role === 'accountant') {
    const accountingResources = ['sales', 'purchases', 'collections', 'payments', 'accounting'];
    
    // 회계 리소스는 모든 작업 가능
    if (accountingResources.includes(resource)) {
      return { allowed: true };
    }
    
    // 회계 외 리소스는 읽기만 가능
    if (action === 'read') {
      return { allowed: true };
    }
    
    return { allowed: false, error: '회계 담당자는 회계 관련 데이터만 수정할 수 있습니다.' };
  }
  
  // 기타 역할은 기존 계층 구조 따름
  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    operator: 2,
    user: 3,
    accountant: 3,
    manager: 4,
    admin: 5,
    ceo: 6
  };
  
  const userLevel = roleHierarchy[user.role];
  
  // 삭제는 manager 이상
  if (action === 'delete' && userLevel < 4) {
    return { allowed: false, error: '삭제 권한이 없습니다.' };
  }
  
  // 생성/수정은 user 이상
  if ((action === 'create' || action === 'update') && userLevel < 3) {
    return { allowed: false, error: '쓰기 권한이 없습니다.' };
  }
  
  // 읽기는 operator 이상
  if (action === 'read' && userLevel < 2) {
    return { allowed: false, error: '읽기 권한이 없습니다.' };
  }
  
  return { allowed: true };
}
