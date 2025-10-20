import { NextRequest, NextResponse } from 'next/server';

export interface CorsOptions {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

const DEFAULT_CORS_OPTIONS: CorsOptions = {
  origin: process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
    : false, // Will be set to specific domains in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Accept',
    'Accept-Version',
    'Authorization',
    'Content-Length',
    'Content-MD5',
    'Content-Type',
    'Date',
    'X-Api-Version',
    'X-Requested-With',
    'X-CSRF-Token',
    'Cache-Control',
    'Accept-Encoding',
    'Accept-Language',
    'Accept-Charset'
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * CORS 미들웨어 - 한국어 콘텐츠 지원 포함
 * Cross-Origin Resource Sharing 설정을 처리합니다.
 */
export function corsMiddleware(options: Partial<CorsOptions> = {}) {
  const corsOptions: CorsOptions = { ...DEFAULT_CORS_OPTIONS, ...options };

  return (request: NextRequest, response?: NextResponse): NextResponse => {
    // 기존 응답이 있으면 사용하고, 없으면 새로 생성
    const res = response || new NextResponse();

    const origin = request.headers.get('origin');
    const requestMethod = request.method;

    // Origin 검사
    if (corsOptions.origin !== false && origin) {
      let allowedOrigin = false;

      if (corsOptions.origin === true) {
        allowedOrigin = true;
      } else if (typeof corsOptions.origin === 'string') {
        allowedOrigin = origin === corsOptions.origin;
      } else if (Array.isArray(corsOptions.origin)) {
        allowedOrigin = corsOptions.origin.includes(origin);
      }

      if (allowedOrigin) {
        res.headers.set('Access-Control-Allow-Origin', origin);
      }
    } else if (corsOptions.origin === true) {
      res.headers.set('Access-Control-Allow-Origin', '*');
    }

    // Credentials 설정
    if (corsOptions.credentials) {
      res.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // Preflight 요청 처리
    if (requestMethod === 'OPTIONS') {
      // Methods 설정
      if (corsOptions.methods && corsOptions.methods.length > 0) {
        res.headers.set('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
      }

      // Headers 설정
      if (corsOptions.allowedHeaders && corsOptions.allowedHeaders.length > 0) {
        res.headers.set('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
      }

      // 한국어 콘텐츠 지원을 위한 추가 헤더
      res.headers.set('Access-Control-Allow-Headers',
        [...(corsOptions.allowedHeaders || []), 'Content-Type', 'Accept-Language'].join(', ')
      );

      // Preflight 캐시 설정 (24시간)
      res.headers.set('Access-Control-Max-Age', '86400');

      // OPTIONS 요청에 대한 응답 상태 코드 설정
      return new NextResponse(null, {
        status: corsOptions.optionsSuccessStatus || 204,
        headers: res.headers
      });
    }

    // 일반 요청에 대한 CORS 헤더 설정
    if (corsOptions.methods && corsOptions.methods.length > 0) {
      res.headers.set('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
    }

    // 한국어 콘텐츠 노출을 위한 헤더
    res.headers.set('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range, Content-Language');

    return res;
  };
}

/**
 * 개발 환경용 CORS 설정
 */
export const developmentCorsOptions: CorsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    ...DEFAULT_CORS_OPTIONS.allowedHeaders!,
    'X-Debug-Mode',
    'X-Test-Request'
  ]
};

/**
 * 프로덕션 환경용 CORS 설정
 */
export const productionCorsOptions: CorsOptions = {
  origin: [
    // 프로덕션 도메인들을 여기에 추가
    // 'https://your-domain.com',
    // 'https://www.your-domain.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: DEFAULT_CORS_OPTIONS.allowedHeaders
};

/**
 * API 전용 CORS 설정
 */
export const apiCorsOptions: CorsOptions = {
  origin: process.env.NODE_ENV === 'development'
    ? developmentCorsOptions.origin
    : productionCorsOptions.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'Accept',
    'X-Requested-With',
    'Accept-Language',
    'Accept-Charset'
  ]
};

/**
 * 정적 파일용 CORS 설정
 */
export const staticCorsOptions: CorsOptions = {
  origin: true,
  credentials: false,
  methods: ['GET', 'HEAD'],
  allowedHeaders: ['Accept', 'Accept-Encoding', 'Cache-Control']
};