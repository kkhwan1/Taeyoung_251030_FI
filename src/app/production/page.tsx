'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ProductionEntryForm from '@/components/production/ProductionEntryForm';
import ProductionHistoryTable from '@/components/production/ProductionHistoryTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProductionPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProductionSuccess = () => {
    // Refresh history table after successful production entry
    setRefreshKey(prev => prev + 1);
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">생산 관리</h1>
            <p className="text-muted-foreground mt-2">
              생산입고 및 생산출고 처리, BOM 자동 차감
            </p>
          </div>
        </div>

        <Tabs defaultValue="entry" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="entry">생산 등록</TabsTrigger>
            <TabsTrigger value="history">생산 내역</TabsTrigger>
          </TabsList>

          <TabsContent value="entry" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>생산 등록</CardTitle>
                <CardDescription>
                  생산입고 또는 생산출고를 등록하면 BOM에 따라 원자재가 자동으로 차감됩니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductionEntryForm onSuccess={handleProductionSuccess} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>생산 내역</CardTitle>
                <CardDescription>
                  생산 거래 내역 및 BOM 차감 결과 조회
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProductionHistoryTable key={refreshKey} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
