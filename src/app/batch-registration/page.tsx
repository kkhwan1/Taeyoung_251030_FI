'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BatchRegistrationForm from '@/components/batch/BatchRegistrationForm';
import BatchListTable from '@/components/batch/BatchListTable';
import { Factory, List } from 'lucide-react';

export default function BatchRegistrationPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('entry');

  const handleBatchRegistered = () => {
    // Refresh the list and switch to history tab
    setRefreshKey(prev => prev + 1);
    setActiveTab('history');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          배치 등록 관리
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          생산 배치 등록 및 투입/산출 품목 관리
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="entry" className="flex items-center gap-2">
                <Factory className="w-4 h-4" />
                배치 등록
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <List className="w-4 h-4" />
                배치 내역
              </TabsTrigger>
            </TabsList>

            <TabsContent value="entry" className="mt-0">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    새 배치 등록
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    생산 배치에 투입되는 원자재(INPUT)와 생산되는 제품(OUTPUT)을 등록하세요.
                  </p>
                </div>
                <BatchRegistrationForm onSuccess={handleBatchRegistered} />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                        배치 상태 안내
                      </h3>
                      <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                        <li>• <strong>진행중</strong>: 배치 등록 완료, 재고 이동 전 상태</li>
                        <li>• <strong>완료</strong>: 배치 완료 처리, 재고가 자동으로 투입/산출 처리됨</li>
                        <li>• <strong>취소</strong>: 배치 취소됨, 재고 이동 없음</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <BatchListTable refreshKey={refreshKey} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
