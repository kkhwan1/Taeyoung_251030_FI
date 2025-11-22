'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { List, Search } from 'lucide-react';
import dynamicImport from 'next/dynamic';

// Dynamic imports for better code splitting
const ProcessTraceabilityTable = dynamicImport(
  () => import('@/components/process/ProcessTraceabilityTable'),
  {
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">테이블 로딩 중...</span>
      </div>
    )
  }
);

const CoilTraceabilityView = dynamicImport(
  () => import('@/components/process/CoilTraceabilityView'),
  {
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">상세 조회 로딩 중...</span>
      </div>
    )
  }
);

type TabType = 'list' | 'detail';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'list',
    label: '전체 목록',
    icon: <List className="h-4 w-4" />,
    description: '모든 공정 이력을 테이블 형태로 조회'
  },
  {
    id: 'detail',
    label: '품목별 상세',
    icon: <Search className="h-4 w-4" />,
    description: '특정 품목의 상류/하류 공정 추적'
  }
];

export default function TraceabilityPage() {
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);

  // 테이블에서 항목 클릭 시 상세 조회 탭으로 이동
  const handleItemClick = (processId: number) => {
    setSelectedProcessId(processId);
    setActiveTab('detail');
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
          공정 추적성 조회
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          코일 공정 이력 및 추적성 체인을 조회합니다
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700 px-4">
          <nav className="flex space-x-4 overflow-x-auto" aria-label="Tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
                title={tab.description}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-0">
          {activeTab === 'list' && (
            <ProcessTraceabilityTable
              onItemClick={handleItemClick}
              className="rounded-t-none border-0"
            />
          )}

          {activeTab === 'detail' && (
            <div className="p-4">
              <CoilTraceabilityView />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
