'use client';

/**
 * Global Error Page (App Router)
 *
 * This file handles uncaught errors in the application.
 * It must be a Client Component and must define its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
            <h1 className="text-6xl font-bold text-red-500 mb-4">500</h1>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              서버 오류가 발생했습니다
            </h2>
            <p className="text-gray-600 mb-6">
              죄송합니다. 서버에서 오류가 발생했습니다.
              <br />
              잠시 후 다시 시도해 주세요.
            </p>
            {process.env.NODE_ENV === 'development' && error.message && (
              <p className="text-sm text-red-500 mb-4 p-2 bg-red-50 rounded">
                {error.message}
              </p>
            )}
            <div className="space-x-4">
              <button
                onClick={reset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
      </body>
    </html>
  );
}
