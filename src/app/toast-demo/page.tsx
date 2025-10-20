'use client';

import { useToast } from '@/contexts/ToastContext';

export default function ToastDemoPage() {
  const { success, error, warning, info } = useToast();

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Toast Notification Demo
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => success('성공!', '작업이 성공적으로 완료되었습니다.')}
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          Success Toast
        </button>

        <button
          onClick={() => error('오류 발생', '작업 중 오류가 발생했습니다.')}
          className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Error Toast
        </button>

        <button
          onClick={() => warning('주의', '이 작업은 주의가 필요합니다.')}
          className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
        >
          Warning Toast
        </button>

        <button
          onClick={() => info('정보', '새로운 정보를 확인하세요.')}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Info Toast
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Toast Features:
        </h2>
        <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
          <li>Auto-dismiss after 3 seconds (5s for errors, 4s for warnings)</li>
          <li>Manual close button</li>
          <li>Smooth slide-in/out animations</li>
          <li>Positioned at top-right of screen</li>
          <li>Support for success, error, warning, info types</li>
          <li>Korean language support</li>
        </ul>
      </div>
    </div>
  );
}