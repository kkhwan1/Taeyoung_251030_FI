// 인증 관련 타입 정의
export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  department?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';

export interface JWTPayload {
  userId: number;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: Omit<User, 'id'>;
  token?: string;
  error?: string;
}

export interface AuthSession {
  userId: number;
  username: string;
  role: UserRole;
  isLoggedIn: boolean;
}

// 권한 매트릭스
export const ROLE_PERMISSIONS = {
  admin: {
    users: { read: true, create: true, update: true, delete: true },
    items: { read: true, create: true, update: true, delete: true },
    companies: { read: true, create: true, update: true, delete: true },
    inventory: { read: true, create: true, update: true, delete: true },
    production: { read: true, create: true, update: true, delete: true },
    reports: { read: true, create: true, update: true, delete: true },
  },
  manager: {
    users: { read: true, create: false, update: false, delete: false },
    items: { read: true, create: true, update: true, delete: true },
    companies: { read: true, create: true, update: true, delete: true },
    inventory: { read: true, create: true, update: true, delete: true },
    production: { read: true, create: true, update: true, delete: true },
    reports: { read: true, create: true, update: true, delete: false },
  },
  operator: {
    users: { read: false, create: false, update: false, delete: false },
    items: { read: true, create: true, update: true, delete: false },
    companies: { read: true, create: true, update: true, delete: false },
    inventory: { read: true, create: true, update: true, delete: false },
    production: { read: true, create: true, update: true, delete: false },
    reports: { read: true, create: false, update: false, delete: false },
  },
  viewer: {
    users: { read: false, create: false, update: false, delete: false },
    items: { read: true, create: false, update: false, delete: false },
    companies: { read: true, create: false, update: false, delete: false },
    inventory: { read: true, create: false, update: false, delete: false },
    production: { read: true, create: false, update: false, delete: false },
    reports: { read: true, create: false, update: false, delete: false },
  },
} as const;

export type Permission = 'read' | 'create' | 'update' | 'delete';
export type Resource = 'users' | 'items' | 'companies' | 'inventory' | 'production' | 'reports';

// 권한 체크 함수
export function hasPermission(role: UserRole, resource: Resource, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role][resource][permission];
}

// API 에러 타입
export interface AuthError {
  code: string;
  message: string;
}

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: { code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 틀렸습니다.' },
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', message: '로그인 세션이 만료되었습니다.' },
  TOKEN_INVALID: { code: 'TOKEN_INVALID', message: '유효하지 않은 토큰입니다.' },
  ACCESS_DENIED: { code: 'ACCESS_DENIED', message: '접근 권한이 없습니다.' },
  USER_INACTIVE: { code: 'USER_INACTIVE', message: '비활성화된 사용자입니다.' },
  USER_NOT_FOUND: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
} as const;