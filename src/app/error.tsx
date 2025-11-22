'use client';

/**
 * Error Boundary Page (App Router)
 *
 * This file handles runtime errors within the application.
 * Must be a Client Component with error and reset props.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md">
        <h1 className="text-6xl font-bold text-orange-500 mb-4">오류</h1>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          문제가 발생했습니다
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          페이지를 로드하는 중 오류가 발생했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-sm text-red-500 mb-4 p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error.message}
          </p>
        )}
        <div className="space-x-4">
          <button
            onClick={reset}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            다시 시도
          </button>
          <a
            href="/"
            className="inline-block px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            홈으로 이동
          </a>
        </div>
      </div>
    </div>
  );
}
