import { NextRequest, NextResponse } from 'next/server';
import { protectRoute } from '@/lib/middleware';

/**
 * GET /api/auth/me
 * 현재 로그인한 사용자 정보 조회
 */
export const GET = protectRoute(
  async (request: NextRequest, user) => {
    try {
      return NextResponse.json({
        success: true,
        user: {
          user_id: user.user_id,
          username: user.username,
          name: user.name,
          email: user.email,
          department: user.department,
          role: user.role,
          is_active: user.is_active
        }
      });

    } catch (error) {
      console.error('Get current user error:', error);
      return NextResponse.json(
        {
          success: false,
          error: '사용자 정보 조회 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }
  }
);