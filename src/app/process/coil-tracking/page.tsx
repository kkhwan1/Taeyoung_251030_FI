'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 코일 공정 추적 페이지
 * 
 * 공정 작업 페이지로 리다이렉트 (통합됨)
 * URL 파라미터로 코일 추적 모드 활성화
 */
export default function CoilTrackingPage() {
  const router = useRouter();

  useEffect(() => {
    // 공정 작업 페이지로 리다이렉트 (코일 추적 모드)
    router.replace('/process?source=coil_tracking');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 dark:border-gray-300 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">공정 관리 페이지로 이동 중...</p>
      </div>
    </div>
  );
}
