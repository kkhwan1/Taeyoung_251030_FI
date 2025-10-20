'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import type { BulkUploadRequest, BulkUploadResponse } from '@/types/api/price-master';

interface BulkUpdateButtonProps {
  items: BulkUploadRequest['items'];
  validationResult: BulkUploadResponse['data'] | null;
  onSuccess?: (result: BulkUploadResponse) => void;
  onError?: (error: string) => void;
}

export function BulkUpdateButton({ 
  items, 
  validationResult, 
  onSuccess, 
  onError 
}: BulkUpdateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const canUpdate = validationResult && validationResult.valid_count > 0 && !loading;
  const hasErrors = validationResult && validationResult.error_count > 0;

  const handleUpdate = async () => {
    if (!canUpdate) return;

    setLoading(true);

    try {
      const requestData: BulkUploadRequest = {
        items: items.filter((_, index) => {
          // Only include items that passed validation
          const rowNumber = index + 1;
          const hasError = validationResult.errors.some(error => error.row === rowNumber);
          return !hasError;
        }),
        validate_only: false // Actually perform the update
      };

      const response = await fetch('/api/price-master/bulk-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '대량 업데이트에 실패했습니다');
      }

      if (result.success) {
        onSuccess?.(result);
        setShowConfirmDialog(false);
      } else {
        throw new Error(result.error || '알 수 없는 오류가 발생했습니다');
      }
    } catch (error: any) {
      onError?.(error.message || '대량 업데이트 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const calculateTotalAmount = () => {
    if (!validationResult) return 0;
    
    return items
      .filter((_, index) => {
        const rowNumber = index + 1;
        const hasError = validationResult.errors.some(error => error.row === rowNumber);
        return !hasError;
      })
      .reduce((sum, item) => sum + item.unit_price, 0);
  };

  return (
    <>
      <Button
        onClick={() => setShowConfirmDialog(true)}
        disabled={!canUpdate}
        className="w-full"
        data-testid="bulk-update-button"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? '업데이트 중...' : '대량 업데이트 실행'}
      </Button>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>대량 업데이트 확인</DialogTitle>
            <DialogDescription>
              다음 항목들을 업데이트하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">업데이트 항목:</span>
                <span className="font-semibold">{validationResult?.valid_count}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">총 금액:</span>
                <span className="font-semibold">{formatCurrency(calculateTotalAmount())}원</span>
              </div>
              {hasErrors && (
                <div className="flex justify-between text-red-600">
                  <span className="text-sm">제외된 항목:</span>
                  <span className="font-semibold">{validationResult?.error_count}개</span>
                </div>
              )}
            </div>

            {/* Warning for errors */}
            {hasErrors && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {validationResult?.error_count}개의 항목에 오류가 있어 제외됩니다.
                  오류를 수정한 후 다시 시도하시거나, 유효한 항목만 업데이트하실 수 있습니다.
                </AlertDescription>
              </Alert>
            )}

            {/* Success message */}
            {!hasErrors && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  모든 항목이 유효합니다. 업데이트를 진행합니다.
                </AlertDescription>
              </Alert>
            )}

            {/* Preview of items to be updated */}
            {validationResult?.preview && validationResult.preview.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">업데이트 예정 항목 (샘플):</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {validationResult.preview
                    .filter(item => item.status === 'valid')
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={index} className="text-xs p-2 bg-green-50 rounded border-l-2 border-green-300">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.item_code}</span>
                          <span>{formatCurrency(item.unit_price)}원</span>
                        </div>
                        <div className="text-gray-600">{item.item_name}</div>
                      </div>
                    ))}
                  {validationResult.preview.filter(item => item.status === 'valid').length > 5 && (
                    <div className="text-xs text-gray-500 text-center py-1">
                      ... 및 {validationResult.preview.filter(item => item.status === 'valid').length - 5}개 더
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={loading}
            >
              취소
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="confirm-update-button"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? '업데이트 중...' : '업데이트 실행'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
