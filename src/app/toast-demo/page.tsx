'use client';

import { useToast } from '@/contexts/ToastContext';

export default function ToastDemoPage() {
  const { success, error, warning, info } = useToast();

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        Toast Notification Demo
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => success('성공!', '작업이 성공적으로 완료되었습니다.')}
          className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Success Toast
        </button>

        <button
          onClick={() => error('오류 발생', '작업 중 오류가 발생했습니다.')}
          className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Error Toast
        </button>

        <button
          onClick={() => warning('주의', '이 작업은 주의가 필요합니다.')}
          className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Warning Toast
        </button>

        <button
          onClick={() => info('정보', '새로운 정보를 확인하세요.')}
          className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Info Toast
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
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