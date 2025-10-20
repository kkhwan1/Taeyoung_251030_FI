import { NextRequest, NextResponse } from 'next/server';

/**
 * 보안 미들웨어 테스트 API
 * CORS 및 보안 헤더가 올바르게 적용되는지 확인
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: '보안 미들웨어 테스트 성공',
    timestamp: new Date().toISOString(),
    headers: {
      origin: request.headers.get('origin'),
      userAgent: request.headers.get('user-agent'),
      acceptLanguage: request.headers.get('accept-language')
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: '한국어 콘텐츠 처리 테스트 성공',
      receivedData: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '요청 처리 중 오류가 발생했습니다.'
    }, { status: 400 });
  }
}

export async function OPTIONS(_request: NextRequest) {
  // OPTIONS 요청은 미들웨어에서 처리되므로 이 핸들러는 호출되지 않을 것임
  return NextResponse.json({
    message: '이 메시지가 보인다면 미들웨어의 OPTIONS 처리에 문제가 있습니다.'
  });
}