'use client';

import { useEffect } from 'react';
import {
  RefreshCw,
  Home
} from 'lucide-react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // 에러 로깅 (클라이언트에서만 실행)
    if (typeof window !== 'undefined') {
      console.error('Application Error:', {
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }
  }, [error]);

  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 text-center">
        <div className="flex justify-center mb-4">
          
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          오류가 발생했습니다
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg text-left">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              개발자 정보:
            </h3>
            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {error.message}
            </pre>
            {error.digest && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </button>
          
          <button
            onClick={handleGoHome}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Home className="h-4 w-4" />
            홈으로 이동
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          <p>문제가 지속되면 관리자에게 문의해주세요.</p>
          <p className="mt-1">
            오류 ID: {error.digest || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}
