import { NextRequest, NextResponse } from 'next/server';
import { corsMiddleware, staticCorsOptions } from './src/middleware/cors';
import { securityHeadersMiddleware, staticSecurityOptions } from './src/middleware/security-headers';
import { getRouteSecurityConfig, applyEnvironmentOverrides } from './src/config/security';
import { applyRouteBasedRateLimit } from './src/middleware/rate-limit';

/**
 * Next.js 미들웨어 - CORS 및 보안 헤더 통합 관리
 *
 * 이 미들웨어는 다음과 같은 기능을 수행합니다:
 * 1. CORS 정책 적용 (한국어 콘텐츠 지원 포함)
 * 2. 보안 헤더 설정
 * 3. 라우트별 차별화된 보안 정책
 * 4. OPTIONS 요청 처리 (preflight)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // 정적 파일 및 Next.js 내부 파일 제외
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.')
  ) {
    // 정적 파일에 대한 기본 보안 헤더만 적용
    const staticSecurity = securityHeadersMiddleware(staticSecurityOptions);
    const staticCors = corsMiddleware(staticCorsOptions);

    let response = new NextResponse();
    response = staticSecurity(request, response);
    response = staticCors(request, response);

    return response;
  }

  // 라우트별 보안 설정 가져오기
  let securityConfig = getRouteSecurityConfig(pathname);
  securityConfig = applyEnvironmentOverrides(securityConfig);

  // CORS 미들웨어 설정
  let corsMiddlewareInstance;
  if (pathname.startsWith('/api/')) {
    corsMiddlewareInstance = corsMiddleware(securityConfig.cors);
  } else {
    corsMiddlewareInstance = corsMiddleware(securityConfig.cors);
  }

  // 보안 헤더 미들웨어 설정
  const securityMiddlewareInstance = securityHeadersMiddleware(securityConfig.security);

  // Rate limiting 적용 (API 라우트만)
  if (pathname.startsWith('/api/')) {
    const rateLimitResponse = await applyRouteBasedRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  // OPTIONS 요청 (preflight) 처리
  if (method === 'OPTIONS') {
    let response = new NextResponse(null, { status: 204 });

    // CORS 헤더 적용
    response = corsMiddlewareInstance(request, response);

    // 기본 보안 헤더 적용 (CSP 제외)
    response = securityHeadersMiddleware({
      ...securityConfig.security,
      contentSecurityPolicy: undefined // OPTIONS 요청에는 CSP 불필요
    })(request, response);

    return response;
  }

  // 응답 생성 또는 다음 미들웨어로 전달
  let response = NextResponse.next();

  // CORS 헤더 적용
  response = corsMiddlewareInstance(request, response);

  // 보안 헤더 적용
  response = securityMiddlewareInstance(request, response);

  // API 라우트에 대한 추가 헤더
  if (pathname.startsWith('/api/')) {
    // API 응답 캐싱 방지 (민감한 데이터 보호)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    // API 버전 헤더
    response.headers.set('X-API-Version', '1.0');

    // 요청 추적을 위한 헤더
    const requestId = crypto.randomUUID();
    response.headers.set('X-Request-ID', requestId);

    // 한국어 콘텐츠 명시
    response.headers.set('Content-Language', 'ko-KR');
  }

  // 인증이 필요한 페이지에 대한 추가 보안
  if (
    pathname.startsWith('/master/') ||
    pathname.startsWith('/inventory/') ||
    pathname.startsWith('/stock/') ||
    pathname.startsWith('/admin/')
  ) {
    // 추가 보안 헤더
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
    response.headers.set('X-Protected-Page', 'true');
  }

  // 개발 환경에서의 디버깅 헤더
  if (process.env.NODE_ENV === 'development') {
    response.headers.set('X-Debug-Route', pathname);
    response.headers.set('X-Debug-Method', method);
    response.headers.set('X-Debug-Timestamp', new Date().toISOString());
  }

  return response;
}

/**
 * 미들웨어가 적용될 경로 설정
 */
export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 요청에 미들웨어 적용:
     * - api (폴더)
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico (파비콘)
     * - public 폴더 파일들 (정적 자산)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public/).*)',
    // API 라우트에도 적용
    '/api/(.*)'
  ]
};

/**
 * 미들웨어 유틸리티 함수들
 */

/**
 * 요청이 안전한 메서드인지 확인
 */
export function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

/**
 * 요청이 API 경로인지 확인
 */
export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/**
 * 요청이 정적 자산인지 확인
 */
export function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/public/') ||
    pathname.includes('.') // 파일 확장자가 있는 경우
  );
}

/**
 * 요청이 보호된 경로인지 확인
 */
export function isProtectedRoute(pathname: string): boolean {
  const protectedPaths = [
    '/master',
    '/inventory',
    '/stock',
    '/admin',
    '/api/auth',
    '/api/admin'
  ];

  return protectedPaths.some(path => pathname.startsWith(path));
}

/**
 * 개발 환경 전용 디버깅 헤더 추가
 */
export function addDebugHeaders(response: NextResponse, request: NextRequest): void {
  if (process.env.NODE_ENV === 'development') {
    response.headers.set('X-Debug-Middleware', 'applied');
    response.headers.set('X-Debug-User-Agent', request.headers.get('user-agent') || 'unknown');
    response.headers.set('X-Debug-Origin', request.headers.get('origin') || 'none');
    response.headers.set('X-Debug-Referer', request.headers.get('referer') || 'none');
  }
}

/**
 * 에러 응답 생성 (보안 헤더 포함)
 */
export function createSecureErrorResponse(
  message: string,
  status: number,
  request: NextRequest
): NextResponse {
  const response = NextResponse.json(
    { success: false, error: message },
    { status }
  );

  // 기본 보안 헤더 적용
  const securityConfig = getRouteSecurityConfig(request.nextUrl.pathname);
  const securityMiddlewareInstance = securityHeadersMiddleware(securityConfig.security);
  const corsMiddlewareInstance = corsMiddleware(securityConfig.cors);

  let secureResponse = securityMiddlewareInstance(request, response);
  secureResponse = corsMiddlewareInstance(request, secureResponse);

  return secureResponse;
}