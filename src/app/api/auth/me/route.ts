import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';


/**
 * 현재 로그인한 사용자 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다.'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        id: user.user_id, // 호환성을 위해
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({
      success: false,
      error: '사용자 정보를 조회하는 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
