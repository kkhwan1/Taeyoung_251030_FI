'use client';

import React from 'react';
import { RealTimeDashboard } from '../components/dashboard/RealTimeDashboard';

export default function Dashboard() {
  return (
    <div className="space-y-16">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">대시보드</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          태창 ERP 시스템 현황을 모니터링하세요
        </p>
      </div>

      {/* Real-Time Dashboard */}
      <RealTimeDashboard />
    </div>
  );
}