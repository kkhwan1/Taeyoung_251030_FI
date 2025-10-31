import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, type User, type UserRole } from '@/lib/auth';

// 요청에 사용자 정보를 추가하기 위한 인터페이스
export interface AuthenticatedRequest extends NextRequest {
  user?: User;
}

// 인증 미들웨어
export async function withAuth(request: NextRequest): Promise<NextResponse | { user: User }> {
  try {
    // 현재 사용자 정보 가져오기
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { success: false, error: '비활성화된 계정입니다.' },
        { status: 403 }
      );
    }

    // 정상적인 사용자 객체 반환
    return { user };

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

// 리소스별 권한 확인 미들웨어 (역할 계층 기반)
export function withPermission(resource: string, action: string) {
  return async (request: NextRequest, user: User): Promise<NextResponse | null> => {
    try {
      // 간단한 역할 기반 권한 체크
      // ceo는 모든 권한, admin은 거의 모든 권한, manager는 대부분, user는 읽기/쓰기, viewer는 읽기만
      const roleHierarchy: Record<UserRole, number> = {
        viewer: 1,
        operator: 2,
        user: 3,
        accountant: 4,
        manager: 5,
        admin: 6,
        ceo: 7
      };

      const userLevel = roleHierarchy[user.role];
      
      // 삭제 작업은 manager 이상만 가능
      if (action === 'delete' && userLevel < 4) {
        return NextResponse.json(
          { success: false, error: `${resource} ${action} 권한이 없습니다.` },
          { status: 403 }
        );
      }

      // 생성/수정은 user 이상만 가능
      if ((action === 'create' || action === 'update') && userLevel < 3) {
        return NextResponse.json(
          { success: false, error: `${resource} ${action} 권한이 없습니다.` },
          { status: 403 }
        );
      }

      // 읽기는 operator 이상만 가능
      if (action === 'read' && userLevel < 2) {
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