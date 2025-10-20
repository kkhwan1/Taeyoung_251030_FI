'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReceivingRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main inventory page with receiving tab
    router.replace('/inventory');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">입고 관리 페이지로 이동 중...</p>
      </div>
    </div>
  );
}