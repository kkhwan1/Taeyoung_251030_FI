'use client';

import { useEffect } from 'react';

interface GlobalErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorBoundary({ error, reset }: GlobalErrorBoundaryProps) {
  useEffect(() => {
    // 글로벌 에러 로깅
    console.error('Global Application Error:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // 실제 환경에서는 외부 로깅 서비스로 전송
    if (process.env.NODE_ENV === 'production') {
      // 예: Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="flex justify-center mb-4">
              <svg className="h-16 w-16 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              시스템 오류
            </h1>
            
            <p className="text-gray-600 mb-6">
              심각한 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>

            <div className="space-y-3">
              <button
                onClick={reset}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                다시 시도
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                홈으로 이동
              </button>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              <p>문제가 지속되면 관리자에게 문의해주세요.</p>
              <p className="mt-1">
                오류 ID: {error.digest || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
