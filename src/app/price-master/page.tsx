'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PriceMasterForm from '@/components/price-master/PriceMasterForm';
import PriceHistoryTable from '@/components/price-master/PriceHistoryTable';
import BOMCostCalculator from './components/BOMCostCalculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import { 
  Trash2, 
  AlertTriangle, 
  Loader2, 
  CheckCircle,
  FileSpreadsheet,
  Calculator,
  RefreshCw
} from 'lucide-react';
import type { 
  DuplicateGroup, 
  DuplicatesDetectionResponse,
  DuplicatesCleanupRequest,
  DuplicatesCleanupResponse 
} from '@/types/api/price-master';

export default function PriceMasterPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupStrategy, setCleanupStrategy] = useState<'keep_latest' | 'keep_oldest' | 'custom'>('keep_latest');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const handlePriceSuccess = () => {
    // Refresh history table after successful price entry
    setRefreshKey(prev => prev + 1);
  };

  const handleDetectDuplicates = async () => {
    setDuplicateLoading(true);
    try {
      const response = await fetch('/api/price-master/duplicates');
      const result = await response.json();

      if (result.success) {
        setDuplicates(result.data.duplicate_groups || []);
        setShowDuplicateDialog(true);
        
        if (result.data.duplicate_groups.length === 0) {
          toast({
            title: '중복 없음',
            description: '중복된 가격 데이터가 없습니다.'
          });
        } else {
          toast({
            title: '중복 감지 완료',
            description: `${result.data.duplicate_groups.length}개 그룹에서 중복이 발견되었습니다.`
          });
        }
      } else {
        throw new Error(result.error || '중복 감지에 실패했습니다');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: error.message || '중복 감지를 수행하는 중 오류가 발생했습니다'
      });
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleCleanupDuplicates = async (dryRun: boolean = true) => {
    if (duplicates.length === 0) return;

    setCleanupLoading(true);
    try {
      const requestData: DuplicatesCleanupRequest = {
        duplicate_groups: duplicates.map(group => ({
          item_code: group.item_code,
          effective_date: group.effective_date,
          cleanup_strategy: cleanupStrategy,
          keep_price_ids: cleanupStrategy === 'custom' ? 
            Array.from(selectedItems).map(id => parseInt(id)) : 
            undefined
        })),
        dry_run: dryRun
      };

      const response = await fetch('/api/price-master/duplicates/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (result.success) {
        if (dryRun) {
          toast({
            title: '시뮬레이션 완료',
            description: `${result.data.deleted_count}개 항목이 삭제될 예정입니다.`
          });
        } else {
          toast({
            title: '중복 정리 완료',
            description: `${result.data.deleted_count}개 항목이 삭제되었습니다.`
          });
          setShowDuplicateDialog(false);
          setDuplicates([]);
          setSelectedItems(new Set());
          setRefreshKey(prev => prev + 1); // Refresh the table
        }
      } else {
        throw new Error(result.error || '중복 정리에 실패했습니다');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: error.message || '중복 정리를 수행하는 중 오류가 발생했습니다'
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleItemSelection = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">단가 관리</h1>
            <p className="text-muted-foreground mt-2">
              품목별 단가 이력 관리 및 현재 단가 설정
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleDetectDuplicates}
              disabled={duplicateLoading}
              data-testid="detect-duplicates-button"
            >
              {duplicateLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              중복 감지
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/price-master/bulk-update', '_blank')}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              대량 업데이트
            </Button>
          </div>
        </div>

        <Tabs defaultValue="entry" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="entry">단가 등록</TabsTrigger>
            <TabsTrigger value="history">단가 이력</TabsTrigger>
            <TabsTrigger value="bom">BOM 계산</TabsTrigger>
          </TabsList>

          <TabsContent value="entry" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>단가 등록</CardTitle>
                <CardDescription>
                  품목의 단가를 등록하면 자동으로 현재 단가로 설정됩니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PriceMasterForm onSuccess={handlePriceSuccess} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>단가 이력</CardTitle>
                <CardDescription>
                  품목별 단가 변경 이력 및 현재 단가 조회
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PriceHistoryTable key={refreshKey} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bom" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calculator className="h-5 w-5" />
                  <span>BOM 원가 계산</span>
                </CardTitle>
                <CardDescription>
                  BOM 구조를 기반으로 한 품목의 원가를 자동 계산합니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BOMCostCalculator onApplyPrice={(price) => {
                  toast({
                    title: 'BOM 계산 완료',
                    description: `계산된 원가: ${formatCurrency(price)}원`
                  });
                }} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Duplicate Cleanup Dialog */}
        <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span>중복 가격 정리</span>
              </DialogTitle>
              <DialogDescription>
                동일한 품목코드와 적용일을 가진 중복 가격들을 정리합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Cleanup Strategy */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">정리 전략</Label>
                <RadioGroup
                  value={cleanupStrategy}
                  onValueChange={(value) => setCleanupStrategy(value as any)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="keep_latest" id="keep_latest" />
                    <Label htmlFor="keep_latest">최신 가격 유지 (권장)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="keep_oldest" id="keep_oldest" />
                    <Label htmlFor="keep_oldest">최초 가격 유지</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom">수동 선택</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Duplicate Groups */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">
                  중복 그룹 ({duplicates.length}개)
                </Label>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {duplicates.map((group, groupIndex) => (
                    <Card key={`${group.item_code}-${group.effective_date}`} className="border-orange-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm">
                              [{group.item_code}] {group.item_name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              적용일: {formatDate(group.effective_date)} | 중복 수: {group.duplicate_prices.length}개
                            </CardDescription>
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            {group.duplicate_prices.length}개 중복
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {group.duplicate_prices.map((price, priceIndex) => (
                            <div 
                              key={price.price_id}
                              className={`flex items-center justify-between p-2 rounded border ${
                                cleanupStrategy === 'custom' && selectedItems.has(price.price_id.toString()) 
                                  ? 'bg-green-50 border-green-300' 
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                {cleanupStrategy === 'custom' && (
                                  <Checkbox
                                    id={`price-${price.price_id}`}
                                    checked={selectedItems.has(price.price_id.toString())}
                                    onCheckedChange={(checked) => 
                                      handleItemSelection(price.price_id.toString(), checked as boolean)
                                    }
                                  />
                                )}
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {formatCurrency(price.unit_price)}원
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    등록일: {formatDate(price.created_at)} | 
                                    타입: {price.price_type === 'purchase' ? '매입' : 
                                           price.price_type === 'production' ? '생산' : '수동'}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                ID: {price.price_id}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Custom Selection Info */}
              {cleanupStrategy === 'custom' && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    수동 선택 모드: 체크된 항목만 유지되고 나머지는 삭제됩니다.
                    현재 {selectedItems.size}개 항목이 선택되었습니다.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDuplicateDialog(false)}
                disabled={cleanupLoading}
              >
                취소
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCleanupDuplicates(true)}
                disabled={cleanupLoading}
                data-testid="simulate-cleanup-button"
              >
                {cleanupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                시뮬레이션
              </Button>
              <Button
                onClick={() => handleCleanupDuplicates(false)}
                disabled={cleanupLoading || (cleanupStrategy === 'custom' && selectedItems.size === 0)}
                className="bg-red-600 hover:bg-red-700"
                data-testid="execute-cleanup-button"
              >
                {cleanupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                실제 삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
