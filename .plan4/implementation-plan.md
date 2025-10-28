# 태창 ERP 신규 기능 구현 계획서

**작성일**: 2025년 1월 27일
**프로젝트**: FITaeYoungERP - 한글 자동차 부품 제조 ERP
**버전**: 1.0
**총 소요 시간**: 64시간 (8 근무일)

---

## 📋 프로젝트 개요

### 추가할 4가지 신규 기능

1. **사용자 관리 UI** (User Management UI)
   - 역할 기반 접근 제어 (RBAC: admin, manager, user, viewer)
   - 사용자 프로필 관리
   - 권한별 페이지 접근 제어

2. **계약서 관리** (Contract Management)
   - 매출계약(SC), 매입계약(PC), 협력계약(CC) 관리
   - 자동 계약번호 생성 (SC001, PC002, CC003...)
   - 계약 상태 관리 (진행중, 만료, 해지)

3. **계약별 문서 첨부** (Document Attachments)
   - Supabase Storage 기반 파일 업로드
   - 드래그 앤 드롭 파일 업로드
   - 문서 버전 관리

4. **이미지 압축 최적화** (Image Optimization)
   - 서버 사이드 최적화 (Sharp)
   - 클라이언트 사이드 압축 (browser-image-compression)
   - 다중 크기 이미지 생성 (썸네일, 중간, 전체)
   - WebP 변환

### 기술 스택

- **Frontend**: Next.js 15.5.4 + React 19.1.0 + TypeScript 5.7.3
- **Backend**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **Image Processing**: Sharp (서버), browser-image-compression (클라이언트)
- **File Upload**: react-dropzone
- **Authentication**: Supabase Auth Helpers

---

## 🗓️ Phase 1: 사용자 관리 시스템 (16시간)

### 목표
- 역할 기반 접근 제어 (RBAC) 시스템 구축
- 사용자 프로필 확장
- 라우트 보호 미들웨어 구현

### 1.1 데이터베이스 스키마 (4시간)

**파일**: `supabase/migrations/20250127_user_management.sql`

```sql
-- 사용자 프로필 테이블 (auth.users 확장)
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
  department VARCHAR(100),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) 정책
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 프로필 조회 가능
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 매니저와 관리자는 모든 프로필 조회 가능
CREATE POLICY "Managers can view all profiles"
  ON user_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
      AND is_active = true
    )
  );

-- 관리자만 프로필 생성/수정/삭제 가능
CREATE POLICY "Admins can manage profiles"
  ON user_profiles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );

-- 기존 auth.users에 대한 프로필 자동 생성 트리거
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();
```

### 1.2 인증 유틸리티 (4시간)

**파일**: `src/lib/auth.ts`

```typescript
import { createClient } from '@/lib/supabase/client';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer';

export interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  profile: UserProfile;
}

/**
 * 현재 로그인한 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email!,
    profile
  };
}

/**
 * 권한 검증 헬퍼
 */
export async function checkPermission(
  requiredRole: UserRole
): Promise<{ allowed: boolean; user?: CurrentUser; error?: string }> {
  const user = await getCurrentUser();

  if (!user) {
    return { allowed: false, error: '로그인이 필요합니다.' };
  }

  if (!user.profile.is_active) {
    return { allowed: false, error: '비활성화된 계정입니다.' };
  }

  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    user: 2,
    manager: 3,
    admin: 4
  };

  const userLevel = roleHierarchy[user.profile.role];
  const requiredLevel = roleHierarchy[requiredRole];

  if (userLevel < requiredLevel) {
    return { allowed: false, error: '권한이 부족합니다.' };
  }

  return { allowed: true, user };
}

/**
 * 역할 검증 (특정 역할만 허용)
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<{
  allowed: boolean;
  user?: CurrentUser;
  error?: string;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return { allowed: false, error: '로그인이 필요합니다.' };
  }

  if (!user.profile.is_active) {
    return { allowed: false, error: '비활성화된 계정입니다.' };
  }

  if (!allowedRoles.includes(user.profile.role)) {
    return { allowed: false, error: '접근 권한이 없습니다.' };
  }

  return { allowed: true, user };
}
```

### 1.3 미들웨어 보호 (2시간)

**파일**: `src/middleware.ts`

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  const { data: { session } } = await supabase.auth.getSession();

  // 보호된 경로 목록
  const protectedPaths = [
    '/admin',
    '/contracts',
    '/dashboard',
    '/sales',
    '/purchases',
    '/inventory',
    '/master'
  ];

  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  // 인증되지 않은 경우 로그인 페이지로 리다이렉트
  if (isProtectedPath && !session) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 관리자 전용 경로 보호
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (session) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('user_id', session.user.id)
        .single();

      if (!profile || !profile.is_active || profile.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // 매니저 이상 권한 필요 경로
  const managerPaths = ['/contracts', '/master'];
  const requiresManager = managerPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (requiresManager && session) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('user_id', session.user.id)
      .single();

    if (!profile || !profile.is_active) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (!['admin', 'manager'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/contracts/:path*',
    '/dashboard/:path*',
    '/sales/:path*',
    '/purchases/:path*',
    '/inventory/:path*',
    '/master/:path*'
  ]
};
```

### 1.4 API 엔드포인트 (4시간)

**파일**: `src/app/api/users/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';

export async function GET(request: NextRequest) {
  const { allowed, error } = await checkPermission('manager');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const role = searchParams.get('role');
  const search = searchParams.get('search');
  const isActive = searchParams.get('is_active');

  let query = supabase
    .from('user_profiles')
    .select('*', { count: 'exact' });

  if (role) {
    query = query.eq('role', role);
  }

  if (isActive !== null) {
    query = query.eq('is_active', isActive === 'true');
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

  const { data, error: dbError, count } = await query;

  if (dbError) {
    return handleSupabaseError('select', 'user_profiles', dbError);
  }

  return createSuccessResponse(data, {
    page,
    limit,
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / limit)
  });
}

export async function POST(request: NextRequest) {
  const { allowed, error } = await checkPermission('admin');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const text = await request.text();
  const body = JSON.parse(text);

  const supabase = getSupabaseClient();

  // Supabase Auth로 사용자 생성
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: {
      full_name: body.full_name,
      role: body.role
    }
  });

  if (authError) {
    return Response.json({
      success: false,
      error: `사용자 생성 실패: ${authError.message}`
    }, { status: 400 });
  }

  // 프로필은 트리거로 자동 생성되므로 생성된 프로필 조회
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', authData.user.id)
    .single();

  if (profileError) {
    return handleSupabaseError('select', 'user_profiles', profileError);
  }

  return createSuccessResponse(profile, undefined, 201);
}
```

**파일**: `src/app/api/users/[id]/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error, user } = await checkPermission('user');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const userId = params.id;

  // 자신의 프로필이거나 매니저 이상인 경우만 조회 가능
  if (userId !== user!.id && !['manager', 'admin'].includes(user!.profile.role)) {
    return Response.json({
      success: false,
      error: '다른 사용자의 프로필을 조회할 권한이 없습니다.'
    }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { data, error: dbError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (dbError) {
    return handleSupabaseError('select', 'user_profiles', dbError);
  }

  return createSuccessResponse(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error, user } = await checkPermission('user');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const userId = params.id;
  const text = await request.text();
  const body = JSON.parse(text);

  // 자신의 프로필이거나 관리자인 경우만 수정 가능
  if (userId !== user!.id && user!.profile.role !== 'admin') {
    return Response.json({
      success: false,
      error: '다른 사용자의 프로필을 수정할 권한이 없습니다.'
    }, { status: 403 });
  }

  // 일반 사용자는 role 변경 불가
  if (userId === user!.id && body.role && body.role !== user!.profile.role) {
    return Response.json({
      success: false,
      error: '자신의 역할은 변경할 수 없습니다.'
    }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { data, error: dbError } = await supabase
    .from('user_profiles')
    .update({
      full_name: body.full_name,
      department: body.department,
      phone: body.phone,
      ...(user!.profile.role === 'admin' && { role: body.role, is_active: body.is_active })
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (dbError) {
    return handleSupabaseError('update', 'user_profiles', dbError);
  }

  return createSuccessResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error } = await checkPermission('admin');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const userId = params.id;
  const supabase = getSupabaseClient();

  // 소프트 삭제 (is_active = false)
  const { data, error: dbError } = await supabase
    .from('user_profiles')
    .update({ is_active: false })
    .eq('user_id', userId)
    .select()
    .single();

  if (dbError) {
    return handleSupabaseError('update', 'user_profiles', dbError);
  }

  return createSuccessResponse(data);
}
```

### 1.5 UI 컴포넌트 (2시간)

**파일**: `src/app/admin/users/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { UserProfile } from '@/lib/auth';

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (roleFilter) params.set('role', roleFilter);

    const response = await fetch(`/api/users?${params}`);
    const result = await response.json();

    if (result.success) {
      setUsers(result.data);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">사용자 관리</h1>

      {/* 검색 및 필터 */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="이름 또는 이메일 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="">모든 역할</option>
          <option value="admin">관리자</option>
          <option value="manager">매니저</option>
          <option value="user">사용자</option>
          <option value="viewer">열람자</option>
        </select>
      </div>

      {/* 사용자 목록 테이블 */}
      {loading ? (
        <div className="text-center py-8">로딩 중...</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">이름</th>
              <th className="border p-2">이메일</th>
              <th className="border p-2">역할</th>
              <th className="border p-2">부서</th>
              <th className="border p-2">상태</th>
              <th className="border p-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.user_id}>
                <td className="border p-2">{user.full_name}</td>
                <td className="border p-2">{user.email}</td>
                <td className="border p-2">
                  <span className={`px-2 py-1 rounded ${getRoleBadgeColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td className="border p-2">{user.department || '-'}</td>
                <td className="border p-2">
                  <span className={`px-2 py-1 rounded ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="border p-2">
                  <button className="text-blue-600 hover:underline mr-2">수정</button>
                  <button className="text-red-600 hover:underline">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-blue-100 text-blue-800',
    user: 'bg-green-100 text-green-800',
    viewer: 'bg-gray-100 text-gray-800'
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: '관리자',
    manager: '매니저',
    user: '사용자',
    viewer: '열람자'
  };
  return labels[role] || role;
}
```

### Phase 1 완료 기준

- [ ] `user_profiles` 테이블 및 RLS 정책 생성 완료
- [ ] 자동 프로필 생성 트리거 작동 확인
- [ ] `src/lib/auth.ts` 유틸리티 함수 작성 및 테스트
- [ ] `src/middleware.ts` 라우트 보호 작동 확인
- [ ] `/api/users` 엔드포인트 CRUD 테스트
- [ ] `/admin/users` UI에서 사용자 목록 조회 확인
- [ ] 역할별 권한 분리 테스트 (admin, manager, user, viewer)

---

## 🗓️ Phase 2: 계약서 관리 (24시간)

### 목표
- 매출/매입/협력 계약 관리 시스템 구축
- 자동 계약번호 생성 (SC###, PC###, CC###)
- 계약 상태 및 생명주기 관리

### 2.1 데이터베이스 스키마 (6시간)

**파일**: `supabase/migrations/20250127_contract_management.sql`

```sql
-- 계약서 테이블
CREATE TABLE contracts (
  contract_id SERIAL PRIMARY KEY,
  contract_no VARCHAR(50) UNIQUE NOT NULL,
  company_id INTEGER REFERENCES companies(company_id) ON DELETE RESTRICT,
  contract_name VARCHAR(200) NOT NULL,
  contract_type VARCHAR(20) NOT NULL
    CHECK (contract_type IN ('매출계약', '매입계약', '협력계약')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  contract_amount DECIMAL(15,2),
  status VARCHAR(20) DEFAULT '진행중'
    CHECK (status IN ('진행중', '만료', '해지')),
  terms TEXT,
  created_by UUID REFERENCES user_profiles(user_id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 인덱스 생성
CREATE INDEX idx_contracts_company_id ON contracts(company_id);
CREATE INDEX idx_contracts_type ON contracts(contract_type);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_active ON contracts(is_active);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);

-- 계약번호 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_contract_no(p_contract_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR(3);
  v_next_num INTEGER;
  v_contract_no VARCHAR(50);
BEGIN
  -- 계약 타입에 따른 접두사 결정
  v_prefix := CASE p_contract_type
    WHEN '매출계약' THEN 'SC'
    WHEN '매입계약' THEN 'PC'
    WHEN '협력계약' THEN 'CC'
    ELSE 'CT'
  END;

  -- 해당 접두사의 다음 번호 조회
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(contract_no FROM LENGTH(v_prefix) + 1) AS INTEGER)
  ), 0) + 1
  INTO v_next_num
  FROM contracts
  WHERE contract_no LIKE v_prefix || '%'
  AND contract_no ~ ('^' || v_prefix || '[0-9]+$');

  -- 계약번호 생성 (예: SC001, PC002, CC003)
  v_contract_no := v_prefix || LPAD(v_next_num::TEXT, 3, '0');

  RETURN v_contract_no;
END;
$$ LANGUAGE plpgsql;

-- 계약 생성 시 자동으로 계약번호 할당
CREATE OR REPLACE FUNCTION set_contract_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_no IS NULL OR NEW.contract_no = '' THEN
    NEW.contract_no := generate_contract_no(NEW.contract_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_set_contract_no
  BEFORE INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION set_contract_no();

-- 자동 업데이트 트리거
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 계약 만료 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_contract_status()
RETURNS void AS $$
BEGIN
  UPDATE contracts
  SET status = '만료'
  WHERE status = '진행중'
  AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security 정책
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자는 활성 계약 조회 가능
CREATE POLICY "Users can view active contracts"
  ON contracts FOR SELECT TO authenticated
  USING (is_active = true);

-- 매니저와 관리자는 계약 생성 가능
CREATE POLICY "Managers can create contracts"
  ON contracts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
      AND is_active = true
    )
  );

-- 계약 작성자와 관리자는 계약 수정 가능
CREATE POLICY "Creators and admins can update contracts"
  ON contracts FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );

-- 관리자만 계약 삭제 가능 (소프트 삭제)
CREATE POLICY "Admins can delete contracts"
  ON contracts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );
```

### 2.2 검증 함수 (4시간)

**파일**: `src/lib/contractValidation.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export interface ContractValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * 계약 날짜 범위 검증
 */
export function validateDateRange(
  startDate: string,
  endDate: string
): ContractValidationResult {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      valid: false,
      error: '올바른 날짜 형식이 아닙니다.'
    };
  }

  if (end < start) {
    return {
      valid: false,
      error: '종료일은 시작일보다 이후여야 합니다.'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    return {
      valid: true,
      warning: '시작일이 과거입니다. 계속 진행하시겠습니까?'
    };
  }

  return { valid: true };
}

/**
 * 계약 타입 검증
 */
export function validateContractType(
  contractType: string
): ContractValidationResult {
  const validTypes = ['매출계약', '매입계약', '협력계약'];

  if (!validTypes.includes(contractType)) {
    return {
      valid: false,
      error: '올바른 계약 타입이 아닙니다. (매출계약, 매입계약, 협력계약 중 선택)'
    };
  }

  return { valid: true };
}

/**
 * 계약 금액 검증
 */
export function validateContractAmount(
  amount: number
): ContractValidationResult {
  if (amount < 0) {
    return {
      valid: false,
      error: '계약 금액은 0 이상이어야 합니다.'
    };
  }

  if (!Number.isFinite(amount)) {
    return {
      valid: false,
      error: '유효한 숫자를 입력하세요.'
    };
  }

  if (amount > 10000000000) {
    return {
      valid: true,
      warning: '계약 금액이 100억원을 초과합니다. 확인 후 진행하세요.'
    };
  }

  return { valid: true };
}

/**
 * 거래처 활성 상태 검증
 */
export async function validateCompanyActive(
  companyId: number,
  supabase: SupabaseClient
): Promise<ContractValidationResult> {
  const { data, error } = await supabase
    .from('companies')
    .select('is_active, company_name')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error || !data) {
    return {
      valid: false,
      error: '거래처를 찾을 수 없습니다.'
    };
  }

  if (!data.is_active) {
    return {
      valid: false,
      error: `비활성화된 거래처입니다: ${data.company_name}`
    };
  }

  return { valid: true };
}

/**
 * 계약 중복 검증 (동일 거래처, 동일 기간)
 */
export async function checkDuplicateContract(
  companyId: number,
  startDate: string,
  endDate: string,
  supabase: SupabaseClient
): Promise<{ exists: boolean; contracts?: any[] }> {
  const { data, error } = await supabase
    .from('contracts')
    .select('contract_no, contract_name, start_date, end_date')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);

  if (error) {
    console.error('계약 중복 검증 오류:', error);
    return { exists: false };
  }

  return {
    exists: (data?.length || 0) > 0,
    contracts: data
  };
}

/**
 * 종합 계약 검증 함수
 */
export async function validateContract(
  data: {
    company_id: number;
    contract_type: string;
    start_date: string;
    end_date: string;
    contract_amount: number;
  },
  supabase: SupabaseClient,
  options?: {
    checkDuplicate?: boolean;
  }
): Promise<ContractValidationResult> {
  // 1. 계약 타입 검증
  const typeCheck = validateContractType(data.contract_type);
  if (!typeCheck.valid) {
    return typeCheck;
  }

  // 2. 날짜 범위 검증
  const dateCheck = validateDateRange(data.start_date, data.end_date);
  if (!dateCheck.valid) {
    return dateCheck;
  }

  // 3. 계약 금액 검증
  const amountCheck = validateContractAmount(data.contract_amount);
  if (!amountCheck.valid) {
    return amountCheck;
  }

  // 4. 거래처 활성 상태 검증
  const companyCheck = await validateCompanyActive(data.company_id, supabase);
  if (!companyCheck.valid) {
    return companyCheck;
  }

  // 5. 중복 검증 (옵션)
  if (options?.checkDuplicate !== false) {
    const duplicate = await checkDuplicateContract(
      data.company_id,
      data.start_date,
      data.end_date,
      supabase
    );

    if (duplicate.exists) {
      return {
        valid: false,
        error: '동일 거래처의 중복된 계약 기간이 존재합니다.',
        warning: `기존 계약: ${duplicate.contracts?.map(c => c.contract_no).join(', ')}`
      };
    }
  }

  return { valid: true };
}
```

### 2.3 API 엔드포인트 (8시간)

**파일**: `src/app/api/contracts/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { validateContract } from '@/lib/contractValidation';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';

export async function GET(request: NextRequest) {
  const { allowed, error } = await checkPermission('user');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const contractType = searchParams.get('contract_type');
  const status = searchParams.get('status');
  const companyId = searchParams.get('company_id');
  const search = searchParams.get('search');

  let query = supabase
    .from('contracts')
    .select('*, company:companies(company_name)', { count: 'exact' })
    .eq('is_active', true);

  if (contractType) {
    query = query.eq('contract_type', contractType);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (companyId) {
    query = query.eq('company_id', parseInt(companyId));
  }

  if (search) {
    query = query.or(`contract_no.ilike.%${search}%,contract_name.ilike.%${search}%`);
  }

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

  const { data, error: dbError, count } = await query;

  if (dbError) {
    return handleSupabaseError('select', 'contracts', dbError);
  }

  return createSuccessResponse(data, {
    page,
    limit,
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / limit)
  });
}

export async function POST(request: NextRequest) {
  const { allowed, error, user } = await checkPermission('manager');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const text = await request.text();
  const body = JSON.parse(text);

  const supabase = getSupabaseClient();

  // 검증
  const validation = await validateContract(
    {
      company_id: body.company_id,
      contract_type: body.contract_type,
      start_date: body.start_date,
      end_date: body.end_date,
      contract_amount: body.contract_amount
    },
    supabase
  );

  if (!validation.valid) {
    return Response.json({
      success: false,
      error: validation.error,
      warning: validation.warning
    }, { status: 400 });
  }

  // 계약 생성 (contract_no는 트리거로 자동 생성)
  const { data, error: dbError } = await supabase
    .from('contracts')
    .insert({
      company_id: body.company_id,
      contract_name: body.contract_name,
      contract_type: body.contract_type,
      start_date: body.start_date,
      end_date: body.end_date,
      contract_amount: body.contract_amount,
      terms: body.terms,
      created_by: user!.id
    })
    .select('*, company:companies(company_name)')
    .single();

  if (dbError) {
    return handleSupabaseError('insert', 'contracts', dbError);
  }

  return createSuccessResponse(data, undefined, 201);
}
```

**파일**: `src/app/api/contracts/[id]/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { validateContract } from '@/lib/contractValidation';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error } = await checkPermission('user');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const contractId = parseInt(params.id);
  const supabase = getSupabaseClient();

  const { data, error: dbError } = await supabase
    .from('contracts')
    .select('*, company:companies(*)')
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .single();

  if (dbError) {
    return handleSupabaseError('select', 'contracts', dbError);
  }

  return createSuccessResponse(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error, user } = await checkPermission('manager');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const contractId = parseInt(params.id);
  const text = await request.text();
  const body = JSON.parse(text);

  const supabase = getSupabaseClient();

  // 권한 확인: 작성자이거나 관리자만 수정 가능
  const { data: existingContract } = await supabase
    .from('contracts')
    .select('created_by')
    .eq('contract_id', contractId)
    .single();

  if (existingContract && existingContract.created_by !== user!.id && user!.profile.role !== 'admin') {
    return Response.json({
      success: false,
      error: '이 계약을 수정할 권한이 없습니다.'
    }, { status: 403 });
  }

  // 검증
  if (body.company_id && body.contract_type && body.start_date && body.end_date && body.contract_amount) {
    const validation = await validateContract(
      {
        company_id: body.company_id,
        contract_type: body.contract_type,
        start_date: body.start_date,
        end_date: body.end_date,
        contract_amount: body.contract_amount
      },
      supabase,
      { checkDuplicate: false } // 수정 시 중복 검증 생략
    );

    if (!validation.valid) {
      return Response.json({
        success: false,
        error: validation.error,
        warning: validation.warning
      }, { status: 400 });
    }
  }

  const { data, error: dbError } = await supabase
    .from('contracts')
    .update({
      contract_name: body.contract_name,
      contract_type: body.contract_type,
      start_date: body.start_date,
      end_date: body.end_date,
      contract_amount: body.contract_amount,
      status: body.status,
      terms: body.terms
    })
    .eq('contract_id', contractId)
    .select('*, company:companies(company_name)')
    .single();

  if (dbError) {
    return handleSupabaseError('update', 'contracts', dbError);
  }

  return createSuccessResponse(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error } = await checkPermission('admin');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const contractId = parseInt(params.id);
  const supabase = getSupabaseClient();

  // 소프트 삭제
  const { data, error: dbError } = await supabase
    .from('contracts')
    .update({ is_active: false })
    .eq('contract_id', contractId)
    .select()
    .single();

  if (dbError) {
    return handleSupabaseError('update', 'contracts', dbError);
  }

  return createSuccessResponse(data);
}
```

### 2.4 UI 컴포넌트 (6시간)

**파일**: `src/app/contracts/page.tsx`

기본 계약 목록 및 필터링 UI 구현

**파일**: `src/components/ContractForm.tsx`

계약 생성/수정 폼 컴포넌트

### Phase 2 완료 기준

- [ ] `contracts` 테이블 및 RLS 정책 생성 완료
- [ ] `generate_contract_no()` 함수 작동 확인 (SC001, PC002, CC003)
- [ ] 계약 자동 번호 트리거 테스트
- [ ] 계약 검증 함수 테스트 (날짜, 금액, 타입, 중복)
- [ ] `/api/contracts` 엔드포인트 CRUD 테스트
- [ ] `/contracts` UI에서 계약 목록 조회 및 필터링 확인
- [ ] 계약 생성/수정/삭제 기능 테스트
- [ ] 계약 만료 자동 업데이트 함수 확인

---

## 🗓️ Phase 3: 계약별 문서 첨부 (16시간)

### 목표
- Supabase Storage 기반 파일 업로드 시스템
- 드래그 앤 드롭 파일 업로드 UI
- 문서 버전 관리 및 이력 추적

### 3.1 Supabase Storage 설정 (2시간)

**Supabase Dashboard에서 수동 설정:**

1. Storage → New Bucket 클릭
2. Bucket 이름: `contracts`
3. Public bucket: ❌ (체크 해제 - 비공개)
4. File size limit: 10 MB
5. Allowed MIME types:
   - `application/pdf`
   - `image/*`
   - `application/msword`
   - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   - `application/vnd.ms-excel`
   - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**Storage Policies (SQL):**

```sql
-- 인증된 사용자는 파일 업로드 가능
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contracts');

-- 계약 관련자는 파일 조회 가능
CREATE POLICY "Users can view contract files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contracts');

-- 업로더와 관리자는 파일 삭제 가능
CREATE POLICY "Uploaders can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contracts' AND
  (owner = auth.uid() OR
   EXISTS (
     SELECT 1 FROM user_profiles
     WHERE user_id = auth.uid()
     AND role = 'admin'
     AND is_active = true
   ))
);
```

### 3.2 데이터베이스 스키마 (3시간)

**파일**: `supabase/migrations/20250127_contract_documents.sql`

```sql
-- 계약 문서 테이블
CREATE TABLE contract_documents (
  document_id SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(contract_id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  version INTEGER DEFAULT 1,
  uploaded_by UUID REFERENCES user_profiles(user_id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_contract_documents_contract_id ON contract_documents(contract_id);
CREATE INDEX idx_contract_documents_active ON contract_documents(is_active);
CREATE INDEX idx_contract_documents_uploaded_by ON contract_documents(uploaded_by);

-- 자동 업데이트 트리거
CREATE TRIGGER contract_documents_updated_at
  BEFORE UPDATE ON contract_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 문서 버전 자동 증가 함수
CREATE OR REPLACE FUNCTION increment_document_version()
RETURNS TRIGGER AS $$
BEGIN
  -- 동일 파일명의 이전 문서가 있으면 버전 증가
  SELECT COALESCE(MAX(version), 0) + 1
  INTO NEW.version
  FROM contract_documents
  WHERE contract_id = NEW.contract_id
  AND file_name = NEW.file_name
  AND is_active = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contract_documents_version
  BEFORE INSERT ON contract_documents
  FOR EACH ROW
  EXECUTE FUNCTION increment_document_version();

-- RLS 정책
ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;

-- 계약 조회 권한이 있으면 문서도 조회 가능
CREATE POLICY "Users can view contract documents"
  ON contract_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contract_id = contract_documents.contract_id
      AND is_active = true
    )
  );

-- 매니저는 문서 업로드 가능
CREATE POLICY "Managers can upload documents"
  ON contract_documents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('manager', 'admin')
      AND is_active = true
    )
  );

-- 업로더와 관리자는 문서 삭제 가능
CREATE POLICY "Uploaders can delete documents"
  ON contract_documents FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );
```

### 3.3 Storage 유틸리티 (4시간)

**파일**: `src/lib/storage.ts`

```typescript
import { createClient } from '@/lib/supabase/client';

export interface UploadResult {
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface UploadOptions {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
}

/**
 * 파일 업로드
 */
export async function uploadDocument(
  options: UploadOptions
): Promise<UploadResult> {
  const { bucket, path, file, upsert = false } = options;
  const supabase = createClient();

  // 파일 크기 검증 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('파일 크기는 10MB를 초과할 수 없습니다.');
  }

  // MIME 타입 검증
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('지원하지 않는 파일 형식입니다.');
  }

  // Storage에 업로드
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert
    });

  if (error) {
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }

  // Public URL 생성 (비공개 버킷이므로 signed URL 사용)
  const { data: urlData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 3600); // 1시간 유효

  return {
    path: data.path,
    url: urlData?.signedUrl || '',
    size: file.size,
    mimeType: file.type
  };
}

/**
 * 파일 삭제
 */
export async function deleteDocument(
  bucket: string,
  path: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw new Error(`파일 삭제 실패: ${error.message}`);
  }
}

/**
 * Signed URL 생성
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`서명된 URL 생성 실패: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * 다중 파일 업로드
 */
export async function uploadMultipleDocuments(
  bucket: string,
  files: File[],
  getPath: (file: File, index: number) => string
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = getPath(file, i);

    try {
      const result = await uploadDocument({ bucket, path, file });
      results.push(result);
    } catch (error) {
      console.error(`파일 업로드 실패 (${file.name}):`, error);
      throw error;
    }
  }

  return results;
}
```

### 3.4 API 엔드포인트 (4시간)

**파일**: `src/app/api/contracts/[id]/documents/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { uploadDocument, deleteDocument } from '@/lib/storage';
import { createSuccessResponse, handleSupabaseError, getSupabaseClient } from '@/lib/db-unified';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error } = await checkPermission('user');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const contractId = parseInt(params.id);
  const supabase = getSupabaseClient();

  const { data, error: dbError } = await supabase
    .from('contract_documents')
    .select('*, uploader:user_profiles(full_name)')
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (dbError) {
    return handleSupabaseError('select', 'contract_documents', dbError);
  }

  return createSuccessResponse(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error, user } = await checkPermission('manager');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const contractId = parseInt(params.id);
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return Response.json({
      success: false,
      error: '파일이 제공되지 않았습니다.'
    }, { status: 400 });
  }

  try {
    // Storage에 파일 업로드
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    const filePath = `${contractId}/${filename}`;

    const uploadResult = await uploadDocument({
      bucket: 'contracts',
      path: filePath,
      file
    });

    // 데이터베이스에 문서 정보 저장
    const supabase = getSupabaseClient();
    const { data, error: dbError } = await supabase
      .from('contract_documents')
      .insert({
        contract_id: contractId,
        file_name: file.name,
        file_path: uploadResult.path,
        file_size: uploadResult.size,
        mime_type: uploadResult.mimeType,
        uploaded_by: user!.id
      })
      .select('*, uploader:user_profiles(full_name)')
      .single();

    if (dbError) {
      // 실패 시 Storage에서 파일 삭제
      await deleteDocument('contracts', uploadResult.path);
      return handleSupabaseError('insert', 'contract_documents', dbError);
    }

    return createSuccessResponse(data, undefined, 201);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '파일 업로드 실패';
    return Response.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { allowed, error, user } = await checkPermission('manager');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  const contractId = parseInt(params.id);
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('document_id');

  if (!documentId) {
    return Response.json({
      success: false,
      error: 'document_id 파라미터가 필요합니다.'
    }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  // 문서 정보 조회
  const { data: document } = await supabase
    .from('contract_documents')
    .select('file_path, uploaded_by')
    .eq('document_id', parseInt(documentId))
    .eq('contract_id', contractId)
    .single();

  if (!document) {
    return Response.json({
      success: false,
      error: '문서를 찾을 수 없습니다.'
    }, { status: 404 });
  }

  // 권한 확인: 업로더이거나 관리자만 삭제 가능
  if (document.uploaded_by !== user!.id && user!.profile.role !== 'admin') {
    return Response.json({
      success: false,
      error: '이 문서를 삭제할 권한이 없습니다.'
    }, { status: 403 });
  }

  try {
    // Storage에서 파일 삭제
    await deleteDocument('contracts', document.file_path);

    // 데이터베이스에서 소프트 삭제
    const { data, error: dbError } = await supabase
      .from('contract_documents')
      .update({ is_active: false })
      .eq('document_id', parseInt(documentId))
      .select()
      .single();

    if (dbError) {
      return handleSupabaseError('update', 'contract_documents', dbError);
    }

    return createSuccessResponse(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '문서 삭제 실패';
    return Response.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
```

### 3.5 UI 컴포넌트 (3시간)

**파일**: `src/components/FileUploadZone.tsx`

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadZoneProps {
  contractId: number;
  onUploadComplete?: () => void;
}

export default function FileUploadZone({ contractId, onUploadComplete }: FileUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setUploading(true);

    try {
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/contracts/${contractId}/documents`, {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '업로드 실패');
        }
      }

      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  }, [contractId, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <p className="text-gray-600">업로드 중...</p>
        ) : isDragActive ? (
          <p className="text-blue-600">파일을 여기에 놓으세요</p>
        ) : (
          <div>
            <p className="text-gray-600 mb-2">
              파일을 드래그 앤 드롭하거나 클릭하여 선택하세요
            </p>
            <p className="text-sm text-gray-500">
              PDF, 이미지, Word, Excel 파일 (최대 10MB)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-800 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
```

### Phase 3 완료 기준

- [ ] Supabase Storage `contracts` 버킷 생성 완료
- [ ] Storage RLS 정책 설정 완료
- [ ] `contract_documents` 테이블 생성 완료
- [ ] 문서 버전 자동 증가 트리거 테스트
- [ ] `src/lib/storage.ts` 업로드/삭제 함수 테스트
- [ ] `/api/contracts/[id]/documents` 엔드포인트 테스트
- [ ] 드래그 앤 드롭 파일 업로드 UI 작동 확인
- [ ] 문서 목록 조회 및 Signed URL 생성 확인
- [ ] 문서 삭제 기능 테스트

---

## 🗓️ Phase 4: 이미지 압축 최적화 (8시간)

### 목표
- 서버 사이드 이미지 최적화 (Sharp)
- 클라이언트 사이드 사전 압축 (browser-image-compression)
- 다중 크기 이미지 생성 (썸네일, 중간, 전체)
- WebP 변환으로 파일 크기 감소

### 4.1 패키지 설치 (0.5시간)

```bash
npm install sharp
npm install browser-image-compression
npm install --save-dev @types/sharp
```

### 4.2 서버 사이드 최적화 (3시간)

**파일**: `src/lib/image-optimizer.ts`

```typescript
import sharp from 'sharp';

export interface OptimizationConfig {
  thumbnailSize: number;
  mediumSize: number;
  fullSize: number;
  quality: number;
}

export const DEFAULT_CONFIG: OptimizationConfig = {
  thumbnailSize: 150,
  mediumSize: 600,
  fullSize: 1920,
  quality: 80
};

export interface OptimizedImages {
  thumbnail: Buffer;
  medium: Buffer;
  full: Buffer;
  metadata: {
    originalSize: number;
    thumbnailSize: number;
    mediumSize: number;
    fullSize: number;
    compressionRatio: number;
  };
}

/**
 * 이미지 최적화 (다중 크기 생성)
 */
export async function optimizeImage(
  buffer: Buffer,
  config: OptimizationConfig = DEFAULT_CONFIG
): Promise<OptimizedImages> {
  const image = sharp(buffer);

  // EXIF 메타데이터 기반 자동 회전
  image.rotate();

  // EXIF 메타데이터 제거 (프라이버시 및 파일 크기 감소)
  image.removeMetadata();

  // 썸네일 생성 (정사각형, 중앙 크롭)
  const thumbnail = await image
    .clone()
    .resize(config.thumbnailSize, config.thumbnailSize, {
      fit: 'cover',
      position: 'center'
    })
    .webp({ quality: config.quality })
    .toBuffer();

  // 중간 크기 생성 (비율 유지, 최대 크기)
  const medium = await image
    .clone()
    .resize(config.mediumSize, config.mediumSize, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: config.quality })
    .toBuffer();

  // 전체 크기 생성 (비율 유지, 최대 1920px)
  const full = await image
    .clone()
    .resize(config.fullSize, config.fullSize, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: config.quality })
    .toBuffer();

  return {
    thumbnail,
    medium,
    full,
    metadata: {
      originalSize: buffer.length,
      thumbnailSize: thumbnail.length,
      mediumSize: medium.length,
      fullSize: full.length,
      compressionRatio: (1 - full.length / buffer.length) * 100
    }
  };
}

/**
 * 단일 크기 이미지 최적화
 */
export async function optimizeSingleImage(
  buffer: Buffer,
  maxSize: number = 1920,
  quality: number = 80
): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .removeMetadata()
    .resize(maxSize, maxSize, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality })
    .toBuffer();
}

/**
 * 이미지 메타데이터 추출
 */
export async function getImageMetadata(buffer: Buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    space: metadata.space,
    channels: metadata.channels,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation
  };
}
```

### 4.3 클라이언트 사이드 압축 (2시간)

**파일**: `src/lib/client-image-compression.ts`

```typescript
import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  useWebWorker: boolean;
  quality: number;
}

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  quality: 0.8
};

/**
 * 클라이언트 사이드 이미지 압축
 */
export async function compressImage(
  file: File,
  options: Partial<CompressionOptions> = {}
): Promise<File> {
  const finalOptions = {
    ...DEFAULT_COMPRESSION_OPTIONS,
    ...options
  };

  try {
    const compressedFile = await imageCompression(file, finalOptions);
    return compressedFile;
  } catch (error) {
    console.error('이미지 압축 실패:', error);
    throw new Error('이미지 압축에 실패했습니다.');
  }
}

/**
 * 다중 이미지 압축
 */
export async function compressMultipleImages(
  files: File[],
  options: Partial<CompressionOptions> = {}
): Promise<File[]> {
  return Promise.all(
    files.map(file => compressImage(file, options))
  );
}

/**
 * 압축 전후 크기 비교
 */
export function getCompressionStats(
  originalFile: File,
  compressedFile: File
) {
  const originalSize = originalFile.size;
  const compressedSize = compressedFile.size;
  const reduction = ((originalSize - compressedSize) / originalSize) * 100;

  return {
    originalSize,
    compressedSize,
    reductionPercentage: reduction.toFixed(2),
    reductionBytes: originalSize - compressedSize
  };
}
```

### 4.4 통합 이미지 업로드 API (1.5시간)

**파일**: `src/app/api/images/optimize/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/auth';
import { optimizeImage } from '@/lib/image-optimizer';
import { uploadDocument } from '@/lib/storage';
import { createSuccessResponse } from '@/lib/db-unified';

export async function POST(request: NextRequest) {
  const { allowed, error } = await checkPermission('user');
  if (!allowed) {
    return Response.json({ success: false, error }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as string || 'contracts';
    const path = formData.get('path') as string;

    if (!file) {
      return Response.json({
        success: false,
        error: '파일이 제공되지 않았습니다.'
      }, { status: 400 });
    }

    if (!path) {
      return Response.json({
        success: false,
        error: '파일 경로가 제공되지 않았습니다.'
      }, { status: 400 });
    }

    // 이미지 파일인지 확인
    if (!file.type.startsWith('image/')) {
      return Response.json({
        success: false,
        error: '이미지 파일만 업로드 가능합니다.'
      }, { status: 400 });
    }

    // 버퍼로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 이미지 최적화 (다중 크기 생성)
    const optimized = await optimizeImage(buffer);

    // 각 크기별로 Storage에 업로드
    const basePath = path.replace(/\.[^/.]+$/, ''); // 확장자 제거

    const thumbnailPath = `${basePath}_thumbnail.webp`;
    const mediumPath = `${basePath}_medium.webp`;
    const fullPath = `${basePath}_full.webp`;

    const [thumbnailResult, mediumResult, fullResult] = await Promise.all([
      uploadDocument({
        bucket,
        path: thumbnailPath,
        file: new File([optimized.thumbnail], 'thumbnail.webp', { type: 'image/webp' })
      }),
      uploadDocument({
        bucket,
        path: mediumPath,
        file: new File([optimized.medium], 'medium.webp', { type: 'image/webp' })
      }),
      uploadDocument({
        bucket,
        path: fullPath,
        file: new File([optimized.full], 'full.webp', { type: 'image/webp' })
      })
    ]);

    return createSuccessResponse({
      thumbnail: thumbnailResult,
      medium: mediumResult,
      full: fullResult,
      metadata: optimized.metadata
    }, undefined, 201);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '이미지 최적화 실패';
    return Response.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
```

### 4.5 UI 컴포넌트 (1시간)

**파일**: `src/components/ImageUploadZone.tsx`

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { compressImage, getCompressionStats } from '@/lib/client-image-compression';

interface ImageUploadZoneProps {
  bucket: string;
  getPath: (file: File) => string;
  onUploadComplete?: (urls: { thumbnail: string; medium: string; full: string }) => void;
}

export default function ImageUploadZone({ bucket, getPath, onUploadComplete }: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compressionStats, setCompressionStats] = useState<any>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setCompressing(true);

    try {
      const file = acceptedFiles[0];

      // 클라이언트 사이드 사전 압축
      const compressedFile = await compressImage(file);
      const stats = getCompressionStats(file, compressedFile);
      setCompressionStats(stats);

      setCompressing(false);
      setUploading(true);

      // 서버로 업로드 (서버에서 추가 최적화 및 다중 크기 생성)
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('bucket', bucket);
      formData.append('path', getPath(compressedFile));

      const response = await fetch('/api/images/optimize', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '업로드 실패');
      }

      onUploadComplete?.({
        thumbnail: result.data.thumbnail.url,
        medium: result.data.medium.url,
        full: result.data.full.url
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setCompressing(false);
      setUploading(false);
    }
  }, [bucket, getPath, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${(uploading || compressing) ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        {compressing ? (
          <p className="text-gray-600">이미지 압축 중...</p>
        ) : uploading ? (
          <p className="text-gray-600">업로드 중...</p>
        ) : isDragActive ? (
          <p className="text-blue-600">이미지를 여기에 놓으세요</p>
        ) : (
          <div>
            <p className="text-gray-600 mb-2">
              이미지를 드래그 앤 드롭하거나 클릭하여 선택하세요
            </p>
            <p className="text-sm text-gray-500">
              JPG, PNG, GIF, WebP (최대 10MB)
            </p>
          </div>
        )}
      </div>

      {compressionStats && (
        <div className="mt-4 p-4 bg-green-50 text-green-800 rounded">
          <p className="font-semibold">압축 완료</p>
          <p className="text-sm">
            {(compressionStats.originalSize / 1024).toFixed(2)} KB → {(compressionStats.compressedSize / 1024).toFixed(2)} KB
            ({compressionStats.reductionPercentage}% 감소)
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-800 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
```

### Phase 4 완료 기준

- [ ] `sharp` 및 `browser-image-compression` 패키지 설치 완료
- [ ] `src/lib/image-optimizer.ts` 서버 사이드 최적화 함수 테스트
- [ ] 다중 크기 이미지 생성 확인 (썸네일, 중간, 전체)
- [ ] WebP 변환 작동 확인
- [ ] `src/lib/client-image-compression.ts` 클라이언트 압축 테스트
- [ ] `/api/images/optimize` 엔드포인트 테스트
- [ ] ImageUploadZone 컴포넌트 UI 작동 확인
- [ ] 압축 전후 파일 크기 비교 확인
- [ ] 기존 업로드 지점에 이미지 최적화 적용 (items, companies, contracts, users)

---

## 📦 패키지 요구사항

### 새로 추가할 의존성

```json
{
  "dependencies": {
    "@supabase/auth-helpers-nextjs": "^0.8.0",
    "react-dropzone": "^14.2.3",
    "sharp": "^0.33.0",
    "browser-image-compression": "^2.0.2"
  },
  "devDependencies": {
    "@types/sharp": "^0.32.0"
  }
}
```

### 설치 명령어

```bash
npm install @supabase/auth-helpers-nextjs react-dropzone sharp browser-image-compression
npm install --save-dev @types/sharp
```

---

## ✅ 전체 완료 기준

### Phase 1: 사용자 관리 시스템
- [ ] 모든 데이터베이스 테이블 및 RLS 정책 생성 완료
- [ ] 인증 유틸리티 및 미들웨어 작동 확인
- [ ] API 엔드포인트 CRUD 테스트
- [ ] UI 컴포넌트 작동 확인
- [ ] 역할별 권한 분리 테스트

### Phase 2: 계약서 관리
- [ ] 계약 테이블 및 자동 번호 생성 작동 확인
- [ ] 계약 검증 함수 테스트
- [ ] API 엔드포인트 CRUD 테스트
- [ ] UI 컴포넌트 작동 확인
- [ ] 계약 상태 관리 테스트

### Phase 3: 문서 첨부
- [ ] Supabase Storage 버킷 및 정책 설정
- [ ] 문서 테이블 및 버전 관리 작동 확인
- [ ] 파일 업로드/삭제 API 테스트
- [ ] 드래그 앤 드롭 UI 작동 확인
- [ ] Signed URL 생성 확인

### Phase 4: 이미지 최적화
- [ ] 서버/클라이언트 최적화 함수 테스트
- [ ] 다중 크기 이미지 생성 확인
- [ ] WebP 변환 작동 확인
- [ ] API 엔드포인트 테스트
- [ ] 기존 업로드 지점에 최적화 적용

### 통합 테스트
- [ ] 사용자 생성 → 계약 생성 → 문서 첨부 → 이미지 최적화 전체 플로우 테스트
- [ ] 권한별 접근 제어 테스트 (admin, manager, user, viewer)
- [ ] 에러 핸들링 및 검증 테스트
- [ ] 성능 테스트 (대용량 파일, 다중 업로드)

---

## 📝 구현 시 주의사항

### 보안
- 모든 API 엔드포인트에 권한 검증 적용
- 파일 업로드 시 MIME 타입 검증
- Signed URL 유효 기간 설정 (기본 1시간)
- RLS 정책으로 데이터 접근 제어

### 성능
- 이미지 최적화는 비동기 처리
- 대용량 파일은 스트리밍 업로드
- Storage 캐시 제어 헤더 설정
- 다중 크기 이미지 병렬 생성

### 사용자 경험
- 업로드 진행률 표시
- 압축 전후 크기 비교 표시
- 드래그 앤 드롭 시각적 피드백
- 에러 메시지 명확하게 한글로 표시

### 유지보수
- 한글 주석 추가
- 타입 안전성 보장
- 에러 로깅 및 모니터링
- 테스트 코드 작성

---

**문서 끝**
