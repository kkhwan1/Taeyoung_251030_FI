'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function Custom404Page() {
  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6 text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          404
        </h1>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          페이지를 찾을 수 없습니다
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleGoBack}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            뒤로 가기
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
