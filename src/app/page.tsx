'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RealTimeDashboard } from '../components/dashboard/RealTimeDashboard';

export default function Dashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // 인증 비활성화 모드인 경우 바로 대시보드 표시
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true') {
      setIsAuthenticated(true);
      return;
    }

    // 인증 상태 확인
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          router.push('/login');
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        router.push('/login');
      });
  }, [router]);

  // 로딩 중이거나 인증되지 않은 경우
  if (isAuthenticated === null || isAuthenticated === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">로그인 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">대시보드</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          태창 ERP 시스템 현황을 모니터링하세요
        </p>
      </div>

      {/* Real-Time Dashboard */}
      <RealTimeDashboard />
    </div>
  );
}