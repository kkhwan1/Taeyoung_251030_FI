'use client';

import { useState } from 'react';
import LOTTracker from '@/components/process/LOTTracker';

export default function LOTTrackerPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold dark:text-white mb-2">
          LOT 추적 시스템
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          LOT 번호로 전체 공정 흐름과 재고 이동 내역을 추적합니다
        </p>
      </div>

      <LOTTracker />
    </div>
  );
}
