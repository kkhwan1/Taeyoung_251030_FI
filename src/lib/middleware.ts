import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserFromToken, checkPermission } from '@/lib/auth';
import type { User, UserRole, JWTPayload } from '@/types/auth';
import { AUTH_ERRORS } from '@/types/auth';

// 요청에 사용자 정보를 추가하기 위한 인터페이스
export interface AuthenticatedRequest extends NextRequest {
  user?: User;
}

// 인증 미들웨어
export async function withAuth(request: NextRequest): Promise<NextResponse | { user: User }> {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 쿠키에서 토큰 추출 (fallback)
    if (!token) {
      token = request.cookies.get('auth_token')?.value || null;
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증 토큰이 없습니다.' },
        { status: 401 }
      );
    }

    // 토큰 검증
    const userResult = await getUserFromToken(token);

    if ('code' in userResult) {
      // AuthError인 경우
      let status = 401;
      if (userResult.code === 'TOKEN_EXPIRED') {
        status = 401;
      } else if (userResult.code === 'ACCESS_DENIED') {
        status = 403;
      }

      return NextResponse.json(
        { success: false, error: userResult.message },
        { status }
      );
    }

    // 정상적인 사용자 객체 반환
    return { user: userResult };

  } catch (error) {
    console.error('Authentication middleware error:', error);
    return NextResponse.json(
      { success: false, error: '인증 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 권한 확인 미들웨어
export function withRole(requiredRole: UserRole | UserRole[]) {
  return async (request: NextRequest, user: User): Promise<NextResponse | null> => {
    try {
      const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { success: false, error: '접근 권한이 없습니다.' },
          { status: 403 }
        );
      }

      return null; // 권한이 있으면 null 반환 (통과)

    } catch (error) {
      console.error('Role middleware error:', error);
      return NextResponse.json(
        { success: false, error: '권한 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  };
}

// 리소스별 권한 확인 미들웨어
export function withPermission(resource: string, action: string) {
  return async (request: NextRequest, user: User): Promise<NextResponse | null> => {
    try {
      const hasAccess = checkPermission(user.role, resource, action);

      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: `${resource} ${action} 권한이 없습니다.` },
          { status: 403 }
        );
      }

      return null; // 권한이 있으면 null 반환 (통과)

    } catch (error) {
      console.error('Permission middleware error:', error);
      return NextResponse.json(
        { success: false, error: '권한 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  };
}

// 미들웨어 체인 실행 헬퍼
export async function executeMiddleware(
  request: NextRequest,
  middlewares: Array<(req: NextRequest, user?: User) => Promise<NextResponse | { user: User } | null>>
): Promise<{ user?: User; response?: NextResponse }> {
  let user: User | undefined;

  for (const middleware of middlewares) {
    const result = await middleware(request, user);

    if (result === null) {
      // 미들웨어 통과
      continue;
    }

    if ('user' in result) {
      // 사용자 정보 설정
      user = result.user;
      continue;
    }

    // NextResponse가 반환된 경우 (에러 또는 리디렉트)
    return { response: result };
  }

  return { user };
}

// API 라우트 보호 래퍼
export function protectRoute(
  handler: (request: NextRequest, user: User) => Promise<NextResponse>,
  options: {
    roles?: UserRole | UserRole[];
    resource?: string;
    action?: string;
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const middlewares: Array<(req: NextRequest, user?: User) => Promise<NextResponse | { user: User } | null>> = [withAuth];

      // 역할 기반 권한 체크
      if (options.roles) {
        middlewares.push(async (req: NextRequest, user?: User) => {
          if (!user) return null;
          return await withRole(options.roles!)(req, user);
        });
      }

      // 리소스별 권한 체크
      if (options.resource && options.action) {
        middlewares.push(async (req: NextRequest, user?: User) => {
          if (!user) return null;
          return await withPermission(options.resource!, options.action!)(req, user);
        });
      }

      const { user, response } = await executeMiddleware(request, middlewares);

      if (response) {
        return response;
      }

      if (!user) {
        return NextResponse.json(
          { success: false, error: '인증된 사용자가 아닙니다.' },
          { status: 401 }
        );
      }

      // 실제 핸들러 실행
      return await handler(request, user);

    } catch (error) {
      console.error('Protected route error:', error);
      return NextResponse.json(
        { success: false, error: '요청 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  };
}