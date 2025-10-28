'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CurrentStockPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main stock page since it already shows current stock
    router.replace('/stock');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">현재고 조회 페이지로 이동 중...</p>
      </div>
    </div>
  );
}