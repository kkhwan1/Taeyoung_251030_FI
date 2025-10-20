import type { CorsOptions } from '../middleware/cors';
import type { SecurityHeadersOptions } from '../middleware/security-headers';

/**
 * 환경별 보안 설정
 */
export interface SecurityConfig {
  cors: CorsOptions;
  security: SecurityHeadersOptions;
  rateLimit?: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests?: boolean;
  };
  session?: {
    maxAge: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
}

/**
 * 개발 환경 보안 설정
 */
export const developmentConfig: SecurityConfig = {
  cors: {
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
      'Accept-Charset',
      'X-Debug-Mode',
      'X-Test-Request'
    ]
  },
  security: {
    contentTypeOptions: true,
    frameOptions: 'SAMEORIGIN',
    xssProtection: true,
    strictTransportSecurity: false, // 개발환경에서는 HTTPS 강제하지 않음
    referrerPolicy: 'strict-origin-when-cross-origin',
    contentSecurityPolicy: {
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
    }
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15분
    max: 1000, // 개발환경에서는 넉넉하게
    skipSuccessfulRequests: true
  },
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24시간
    httpOnly: true,
    secure: false, // 개발환경에서는 HTTP 허용
    sameSite: 'lax'
  }
};

/**
 * 프로덕션 환경 보안 설정
 */
export const productionConfig: SecurityConfig = {
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['https://your-domain.com'], // 실제 도메인으로 교체 필요
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Accept',
      'Authorization',
      'Content-Type',
      'X-Requested-With',
      'Accept-Language',
      'Accept-Charset'
    ]
  },
  security: {
    contentTypeOptions: true,
    frameOptions: 'DENY',
    xssProtection: true,
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    referrerPolicy: 'strict-origin-when-cross-origin',
    contentSecurityPolicy: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", 'https://fonts.googleapis.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
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
    }
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15분
    max: 100, // API 호출 제한
    skipSuccessfulRequests: false
  },
  session: {
    maxAge: 8 * 60 * 60 * 1000, // 8시간
    httpOnly: true,
    secure: true, // HTTPS 환경에서만
    sameSite: 'strict'
  }
};

/**
 * 테스트 환경 보안 설정
 */
export const testConfig: SecurityConfig = {
  cors: {
    origin: true, // 테스트에서는 모든 origin 허용
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['*']
  },
  security: {
    contentTypeOptions: false,
    frameOptions: 'SAMEORIGIN',
    xssProtection: false,
    strictTransportSecurity: false,
    referrerPolicy: 'unsafe-url'
  },
  rateLimit: {
    windowMs: 1 * 60 * 1000, // 1분
    max: 10000, // 테스트에서는 매우 관대하게
    skipSuccessfulRequests: true
  },
  session: {
    maxAge: 30 * 60 * 1000, // 30분
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
};

/**
 * 현재 환경에 맞는 보안 설정 반환
 */
export function getSecurityConfig(): SecurityConfig {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

/**
 * API 라우트별 보안 설정 오버라이드
 */
export const routeSecurityConfig: Record<string, Partial<SecurityConfig>> = {
  // 공개 API (더 관대한 CORS)
  '/api/public': {
    cors: {
      origin: true,
      credentials: false
    }
  },

  // 인증 API (엄격한 설정)
  '/api/auth': {
    cors: {
      credentials: true,
      methods: ['POST', 'GET']
    },
    security: {
      frameOptions: 'DENY',
      referrerPolicy: 'no-referrer'
    }
  },

  // 관리자 API (최대 보안)
  '/api/admin': {
    cors: {
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    security: {
      frameOptions: 'DENY',
      referrerPolicy: 'no-referrer',
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'connect-src': ["'self'"]
      }
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50 // 더 엄격한 제한
    }
  },

  // 파일 업로드 API
  '/api/upload': {
    cors: {
      credentials: true,
      methods: ['POST'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length']
    },
    rateLimit: {
      windowMs: 60 * 60 * 1000, // 1시간
      max: 10 // 업로드 제한
    }
  },

  // 다운로드 API
  '/api/download': {
    cors: {
      credentials: true,
      methods: ['GET']
    },
    security: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'img-src': ["'self'", 'data:']
      }
    }
  }
};

/**
 * 특정 라우트에 대한 보안 설정 가져오기
 */
export function getRouteSecurityConfig(pathname: string): SecurityConfig {
  const baseConfig = getSecurityConfig();

  // 라우트별 오버라이드 찾기
  const routeOverride = Object.entries(routeSecurityConfig).find(([route]) =>
    pathname.startsWith(route)
  )?.[1];

  if (routeOverride) {
    return {
      cors: { ...baseConfig.cors, ...routeOverride.cors },
      security: { ...baseConfig.security, ...routeOverride.security },
      rateLimit: {
        windowMs: baseConfig.rateLimit?.windowMs ?? 60000,
        max: baseConfig.rateLimit?.max ?? 100,
        ...routeOverride.rateLimit
      },
      session: {
        maxAge: baseConfig.session?.maxAge ?? 86400000,
        httpOnly: baseConfig.session?.httpOnly ?? true,
        secure: baseConfig.session?.secure ?? false,
        sameSite: baseConfig.session?.sameSite ?? 'lax',
        ...routeOverride.session
      }
    };
  }

  return baseConfig;
}

/**
 * 환경변수 기반 설정 오버라이드
 */
export function applyEnvironmentOverrides(config: SecurityConfig): SecurityConfig {
  // CORS 오버라이드
  if (process.env.CORS_ORIGINS) {
    config.cors.origin = process.env.CORS_ORIGINS.split(',').map(o => o.trim());
  }

  // Rate limiting 오버라이드
  if (process.env.RATE_LIMIT_MAX) {
    config.rateLimit = {
      windowMs: config.rateLimit?.windowMs ?? 60000,
      max: parseInt(process.env.RATE_LIMIT_MAX, 10),
      skipSuccessfulRequests: config.rateLimit?.skipSuccessfulRequests
    };
  }

  // Session 보안 오버라이드
  if (process.env.SESSION_MAX_AGE) {
    config.session = {
      maxAge: parseInt(process.env.SESSION_MAX_AGE, 10),
      httpOnly: config.session?.httpOnly ?? true,
      secure: config.session?.secure ?? false,
      sameSite: config.session?.sameSite ?? 'lax'
    };
  }

  return config;
}