import { NextRequest, NextResponse } from 'next/server';

export interface SecurityHeadersOptions {
  contentTypeOptions?: boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  xssProtection?: boolean;
  contentSecurityPolicy?: string | CSPDirectives;
  strictTransportSecurity?: string | boolean;
  referrerPolicy?: ReferrerPolicyValue;
  permissionsPolicy?: string;
  crossOriginEmbedderPolicy?: 'unsafe-none' | 'require-corp';
  crossOriginOpenerPolicy?: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
  crossOriginResourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin';
}

export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'connect-src'?: string[];
  'font-src'?: string[];
  'object-src'?: string[];
  'media-src'?: string[];
  'frame-src'?: string[];
  'worker-src'?: string[];
  'child-src'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'base-uri'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

export type ReferrerPolicyValue =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

const DEFAULT_SECURITY_OPTIONS: SecurityHeadersOptions = {
  contentTypeOptions: true,
  frameOptions: 'SAMEORIGIN',
  xssProtection: true,
  strictTransportSecurity: process.env.NODE_ENV === 'production',
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginEmbedderPolicy: 'unsafe-none',
  crossOriginOpenerPolicy: 'same-origin-allow-popups',
  crossOriginResourcePolicy: 'same-origin'
};

/**
 * 개발 환경용 CSP 설정 - 더 관대한 정책
 */
const DEVELOPMENT_CSP: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-eval'",
    "'unsafe-inline'",
    'localhost:*',
    '127.0.0.1:*',
    'https://cdn.jsdelivr.net',
    'https://unpkg.com'
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    'https://cdn.jsdelivr.net'
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https:',
    'http://localhost:*',
    'http://127.0.0.1:*'
  ],
  'connect-src': [
    "'self'",
    'localhost:*',
    '127.0.0.1:*',
    'ws://localhost:*',
    'ws://127.0.0.1:*',
    'wss://localhost:*',
    'wss://127.0.0.1:*'
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
    'https://cdn.jsdelivr.net',
    'data:'
  ],
  'object-src': ["'none'"],
  'media-src': ["'self'", 'data:', 'blob:'],
  'frame-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'child-src': ["'self'", 'blob:'],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
  'base-uri': ["'self'"],
  'upgrade-insecure-requests': false
};

/**
 * 프로덕션 환경용 CSP 설정 - 엄격한 정책
 */
const PRODUCTION_CSP: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'sha256-hash-here'", // 실제 스크립트 해시로 교체 필요
    'https://cdn.jsdelivr.net'
  ],
  'style-src': [
    "'self'",
    "'sha256-hash-here'", // 실제 스타일 해시로 교체 필요
    'https://fonts.googleapis.com'
  ],
  'img-src': [
    "'self'",
    'data:',
    'https:'
  ],
  'connect-src': ["'self'"],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
    'data:'
  ],
  'object-src': ["'none'"],
  'media-src': ["'self'"],
  'frame-src': ["'none'"],
  'worker-src': ["'self'"],
  'child-src': ["'none'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'upgrade-insecure-requests': true,
  'block-all-mixed-content': true
};

/**
 * CSP 지시문을 문자열로 변환
 */
function buildCSPString(directives: CSPDirectives): string {
  const policies: string[] = [];

  Object.entries(directives).forEach(([directive, values]) => {
    if (directive === 'upgrade-insecure-requests' && values === true) {
      policies.push('upgrade-insecure-requests');
    } else if (directive === 'block-all-mixed-content' && values === true) {
      policies.push('block-all-mixed-content');
    } else if (Array.isArray(values) && values.length > 0) {
      policies.push(`${directive} ${values.join(' ')}`);
    }
  });

  return policies.join('; ');
}

/**
 * 보안 헤더 미들웨어
 * 다양한 보안 헤더를 설정하여 웹 애플리케이션을 보호합니다.
 */
export function securityHeadersMiddleware(options: Partial<SecurityHeadersOptions> = {}) {
  const securityOptions: SecurityHeadersOptions = { ...DEFAULT_SECURITY_OPTIONS, ...options };

  return (request: NextRequest, response?: NextResponse): NextResponse => {
    const res = response || new NextResponse();

    // X-Content-Type-Options
    if (securityOptions.contentTypeOptions) {
      res.headers.set('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    if (securityOptions.frameOptions) {
      res.headers.set('X-Frame-Options', securityOptions.frameOptions);
    }

    // X-XSS-Protection (레거시 브라우저 지원용)
    if (securityOptions.xssProtection) {
      res.headers.set('X-XSS-Protection', '1; mode=block');
    }

    // Content-Security-Policy
    if (securityOptions.contentSecurityPolicy) {
      let cspValue: string;

      if (typeof securityOptions.contentSecurityPolicy === 'string') {
        cspValue = securityOptions.contentSecurityPolicy;
      } else {
        cspValue = buildCSPString(securityOptions.contentSecurityPolicy);
      }

      res.headers.set('Content-Security-Policy', cspValue);
    } else {
      // 기본 CSP 설정
      const defaultCSP = process.env.NODE_ENV === 'development' ? DEVELOPMENT_CSP : PRODUCTION_CSP;
      res.headers.set('Content-Security-Policy', buildCSPString(defaultCSP));
    }

    // Strict-Transport-Security (HTTPS에서만 유효)
    if (securityOptions.strictTransportSecurity) {
      const hstsValue = typeof securityOptions.strictTransportSecurity === 'string'
        ? securityOptions.strictTransportSecurity
        : 'max-age=63072000; includeSubDomains; preload';

      // HTTPS 환경에서만 HSTS 헤더 추가
      if (request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://')) {
        res.headers.set('Strict-Transport-Security', hstsValue);
      }
    }

    // Referrer-Policy
    if (securityOptions.referrerPolicy) {
      res.headers.set('Referrer-Policy', securityOptions.referrerPolicy);
    }

    // Permissions-Policy (구 Feature-Policy)
    if (securityOptions.permissionsPolicy) {
      res.headers.set('Permissions-Policy', securityOptions.permissionsPolicy);
    } else {
      // 기본 권한 정책 - 민감한 기능들 비활성화
      const defaultPermissions = [
        'accelerometer=()',
        'camera=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'payment=()',
        'usb=()'
      ].join(', ');
      res.headers.set('Permissions-Policy', defaultPermissions);
    }

    // Cross-Origin-Embedder-Policy
    if (securityOptions.crossOriginEmbedderPolicy) {
      res.headers.set('Cross-Origin-Embedder-Policy', securityOptions.crossOriginEmbedderPolicy);
    }

    // Cross-Origin-Opener-Policy
    if (securityOptions.crossOriginOpenerPolicy) {
      res.headers.set('Cross-Origin-Opener-Policy', securityOptions.crossOriginOpenerPolicy);
    }

    // Cross-Origin-Resource-Policy
    if (securityOptions.crossOriginResourcePolicy) {
      res.headers.set('Cross-Origin-Resource-Policy', securityOptions.crossOriginResourcePolicy);
    }

    // 한국어 콘텐츠 지원을 위한 추가 헤더
    res.headers.set('Accept-CH', 'Accept-Language');
    res.headers.set('Vary', 'Accept-Language, Accept-Encoding');

    // 캐시 제어 (민감한 페이지)
    if (request.nextUrl.pathname.includes('/api/') && !request.nextUrl.pathname.includes('/public')) {
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.headers.set('Pragma', 'no-cache');
      res.headers.set('Expires', '0');
    }

    return res;
  };
}

/**
 * API 전용 보안 헤더 설정
 */
export const apiSecurityOptions: SecurityHeadersOptions = {
  contentTypeOptions: true,
  frameOptions: 'DENY',
  xssProtection: true,
  referrerPolicy: 'no-referrer',
  crossOriginResourcePolicy: 'same-origin',
  contentSecurityPolicy: {
    'default-src': ["'none'"],
    'connect-src': ["'self'"]
  }
};

/**
 * 정적 파일용 보안 헤더 설정
 */
export const staticSecurityOptions: SecurityHeadersOptions = {
  contentTypeOptions: true,
  frameOptions: 'SAMEORIGIN',
  crossOriginResourcePolicy: 'cross-origin',
  referrerPolicy: 'strict-origin-when-cross-origin'
};

/**
 * 관리자 페이지용 강화된 보안 헤더 설정
 */
export const adminSecurityOptions: SecurityHeadersOptions = {
  contentTypeOptions: true,
  frameOptions: 'DENY',
  xssProtection: true,
  referrerPolicy: 'no-referrer',
  crossOriginResourcePolicy: 'same-origin',
  contentSecurityPolicy: PRODUCTION_CSP
};