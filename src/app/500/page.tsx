'use client';

import Link from 'next/link';
import { RefreshCw, Home } from 'lucide-react';

export default function Custom500Page() {
  const handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          500
        </h1>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          서버 오류가 발생했습니다
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </button>

          <Link
            href="/"
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Home className="h-4 w-4" />
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
