'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertCircle, CheckCircle, Download, ChevronDown, ChevronRight } from 'lucide-react';
import type { ValidationError, BulkUploadResponse } from '@/types/api/price-master';

interface ValidationResultPanelProps {
  validationResult: BulkUploadResponse['data'] | null;
  loading?: boolean;
}

export function ValidationResultPanel({ validationResult, loading = false }: ValidationResultPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-gray-600">검증 중...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!validationResult) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">검증할 데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  const { valid_count, error_count, errors, preview } = validationResult;
  const totalCount = valid_count + error_count;
  const hasErrors = error_count > 0;
  const hasWarnings = preview.some(item => item.status === 'error');

  // Group errors by type
  const errorGroups = errors.reduce((groups, error) => {
    const type = error.field;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(error);
    return groups;
  }, {} as Record<string, ValidationError[]>);

  const downloadErrorsCSV = () => {
    if (errors.length === 0) return;

    const headers = ['행 번호', '필드', '메시지', '값'];
    const csvContent = [
      headers.join(','),
      ...errors.map(error => [
        error.row,
        `"${error.field}"`,
        `"${error.message}"`,
        `"${error.value || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `검증_오류_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>검증 결과</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
            <div className="text-sm text-gray-500">총 항목</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{valid_count}</div>
            <div className="text-sm text-green-600">유효 항목</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{error_count}</div>
            <div className="text-sm text-red-600">오류 항목</div>
          </div>
        </div>

        {/* Main Alert */}
        {hasErrors ? (
          <Alert variant="destructive" data-testid="validation-error-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>검증 오류 발견</AlertTitle>
            <AlertDescription>
              {error_count}개의 항목에서 오류가 발견되었습니다. 
              오류를 수정한 후 다시 업로드해주세요.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert data-testid="validation-success-alert">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>검증 완료</AlertTitle>
            <AlertDescription>
              모든 {valid_count}개 항목이 유효합니다. 업데이트를 진행할 수 있습니다.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Details */}
        {hasErrors && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">오류 상세</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadErrorsCSV}
                disabled={errors.length === 0}
                data-testid="download-errors-button"
              >
                <Download className="h-4 w-4 mr-2" />
                오류 CSV 다운로드
              </Button>
            </div>

            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-0 h-auto"
                  data-testid="expand-errors-button"
                >
                  <span className="text-sm">
                    {isExpanded ? '오류 목록 접기' : '오류 목록 보기'}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-3">
                {Object.entries(errorGroups).map(([field, fieldErrors]) => (
                  <Card key={field} className="border-red-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-red-800">
                          {field === 'item_code' ? '품목코드' :
                           field === 'unit_price' ? '단가' :
                           field === 'effective_date' ? '적용일' :
                           field === 'item_name' ? '품목명' : field} 오류
                        </CardTitle>
                        <Badge variant="destructive" className="text-xs">
                          {fieldErrors.length}개
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {fieldErrors.slice(0, 5).map((error, index) => (
                          <div 
                            key={index}
                            className="text-sm p-2 bg-red-50 rounded border-l-2 border-red-300"
                            data-testid={`error-item-${error.row}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">행 {error.row}</span>
                              {error.value && (
                                <span className="text-xs text-gray-500">
                                  값: {error.value}
                                </span>
                              )}
                            </div>
                            <div className="text-red-700 mt-1">
                              {error.message}
                            </div>
                          </div>
                        ))}
                        {fieldErrors.length > 5 && (
                          <div className="text-xs text-gray-500 text-center py-2">
                            ... 및 {fieldErrors.length - 5}개 더
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Preview Summary */}
        {preview.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">미리보기 요약</h4>
            <div className="text-sm text-gray-600">
              처음 10개 항목 중 유효: {preview.filter(p => p.status === 'valid').length}개, 
              오류: {preview.filter(p => p.status === 'error').length}개
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
