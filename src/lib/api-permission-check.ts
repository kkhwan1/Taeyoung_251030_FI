import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, checkResourcePermission } from '@/lib/auth';

/**
 * API 라우트에서 리소스 권한 체크
 * @param request Request 객체
 * @param resource 리소스 타입 ('sales', 'purchases', 'items' 등)
 * @param action 작업 타입 ('read', 'create', 'update', 'delete')
 * @returns { user, response } user가 있으면 통과, response가 있으면 권한 오류
 */
export async function checkAPIResourcePermission(
  request: NextRequest,
  resource: string,
  action: 'read' | 'create' | 'update' | 'delete'
): Promise<{ user?: any; response?: NextResponse }> {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return {
        response: NextResponse.json(
          { success: false, error: '로그인이 필요합니다.' },
          { status: 401 }
        )
      };
    }
    
    if (!user.is_active) {
      return {
        response: NextResponse.json(
          { success: false, error: '비활성화된 계정입니다.' },
          { status: 403 }
        )
      };
    }
    
    const permissionResult = checkResourcePermission(user, resource, action);
    
    if (!permissionResult.allowed) {
      return {
        response: NextResponse.json(
          { success: false, error: permissionResult.error || '권한이 부족합니다.' },
          { status: 403 }
        )
      };
    }
    
    return { user };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      response: NextResponse.json(
        { success: false, error: '권한 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    };
  }
}

