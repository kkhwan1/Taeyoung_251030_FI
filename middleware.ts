import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  console.log('[MIDDLEWARE] === Processing request:', pathname);
  
  // 정적 파일 제외
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/images')
  ) {
    console.log('[MIDDLEWARE] Static file - allowing');
    return NextResponse.next();
  }

  // 로그인 페이지는 인증 체크를 하지 않음
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    console.log('[MIDDLEWARE] Login/API auth route - allowing');
    return NextResponse.next();
  }

  // 기타 API 라우트는 제외 (자체 인증 체크 수행)
  if (pathname.startsWith('/api')) {
    console.log('[MIDDLEWARE] API route - allowing (will check auth internally)');
    return NextResponse.next();
  }

  // 페이지 라우트는 인증 체크
  console.log('[MIDDLEWARE] Checking authentication for page:', pathname);
  const user = await getCurrentUser(request);
  console.log('[MIDDLEWARE] User:', user ? `${user.username} (${user.role})` : 'not authenticated');
  
  if (!user) {
    console.log('[MIDDLEWARE] No user - redirecting to /login');
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  console.log('[MIDDLEWARE] Authenticated - allowing');
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled separately in middleware)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};