'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ScrapTrackingForm from '@/components/scrap-tracking/ScrapTrackingForm';
import ScrapTrackingTable from '@/components/scrap-tracking/ScrapTrackingTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ScrapTrackingPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleScrapSuccess = () => {
    // Refresh history table after successful scrap entry
    setRefreshKey(prev => prev + 1);
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">스크랩 추적</h1>
            <p className="text-muted-foreground mt-2">
              생산 과정에서 발생한 스크랩 무게 및 수익 추적
            </p>
          </div>
        </div>

        <Tabs defaultValue="entry" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="entry">스크랩 등록</TabsTrigger>
            <TabsTrigger value="history">스크랩 이력</TabsTrigger>
          </TabsList>

          <TabsContent value="entry" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>스크랩 등록</CardTitle>
                <CardDescription>
                  생산 품목별 스크랩 발생량과 단가를 입력하여 수익을 추적합니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrapTrackingForm onSuccess={handleScrapSuccess} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>스크랩 이력</CardTitle>
                <CardDescription>
                  품목별 스크랩 발생 이력 및 수익 조회
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrapTrackingTable key={refreshKey} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
