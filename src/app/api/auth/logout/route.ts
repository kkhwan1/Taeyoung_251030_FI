import { NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * 사용자 로그아웃
 */
export async function POST() {
  try {
    // 로그아웃 응답 생성
    const response = NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.'
    });

    // 쿠키에서 토큰 제거
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // 즉시 만료
      path: '/'
    });

    return response;

  } catch (_error) {
    console.error('Logout error:', _error);
    return NextResponse.json(
      {
        success: false,
        error: '로그아웃 처리 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}