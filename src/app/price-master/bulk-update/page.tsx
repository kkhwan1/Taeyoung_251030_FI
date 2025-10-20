'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Home, ChevronRight } from 'lucide-react';
import { FileUploadZone } from './components/FileUploadZone';
import { DataPreviewTable } from './components/DataPreviewTable';
import { ValidationResultPanel } from './components/ValidationResultPanel';
import { BulkUpdateButton } from './components/BulkUpdateButton';
import type { 
  BulkPriceItem, 
  BulkUploadRequest, 
  BulkUploadResponse,
  FileUploadMetadata 
} from '@/types/api/price-master';

export default function BulkUpdatePage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileMetadata, setFileMetadata] = useState<FileUploadMetadata | null>(null);
  const [parsedData, setParsedData] = useState<BulkPriceItem[]>([]);
  const [validationResult, setValidationResult] = useState<BulkUploadResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadedFile(file);
    setFileMetadata({
      filename: file.name,
      size: file.size,
      type: file.type,
      uploaded_at: new Date().toISOString()
    });

    // Parse file content
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', 'preview');

      const response = await fetch('/api/price-master/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setParsedData(result.data.preview || []);
        setValidationResult(result.data);
      } else {
        throw new Error(result.error || '파일 파싱에 실패했습니다');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '파일 처리 오류',
        description: error.message || '파일을 처리하는 중 오류가 발생했습니다'
      });
      setParsedData([]);
      setValidationResult(null);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleValidation = useCallback(async () => {
    if (parsedData.length === 0) return;

    setValidating(true);
    try {
      const requestData: BulkUploadRequest = {
        items: parsedData,
        validate_only: true
      };

      const response = await fetch('/api/price-master/bulk-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (result.success) {
        setValidationResult(result.data);
        toast({
          title: '검증 완료',
          description: `유효: ${result.data.valid_count}개, 오류: ${result.data.error_count}개`
        });
      } else {
        throw new Error(result.error || '검증에 실패했습니다');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '검증 오류',
        description: error.message || '검증 중 오류가 발생했습니다'
      });
    } finally {
      setValidating(false);
    }
  }, [parsedData, toast]);

  const handleUpdateSuccess = useCallback((result: BulkUploadResponse) => {
    toast({
      title: '대량 업데이트 완료',
      description: (
        <div className="space-y-1">
          <p>{result.data.valid_count}개 항목이 성공적으로 업데이트되었습니다.</p>
          {result.data.error_count > 0 && (
            <p className="text-sm text-orange-600">
              {result.data.error_count}개 항목은 오류로 인해 제외되었습니다.
            </p>
          )}
        </div>
      ),
    });

    // Reset form
    setUploadedFile(null);
    setFileMetadata(null);
    setParsedData([]);
    setValidationResult(null);
  }, [toast]);

  const handleUpdateError = useCallback((error: string) => {
    toast({
      variant: 'destructive',
      title: '업데이트 실패',
      description: error
    });
  }, [toast]);

  const resetForm = () => {
    setUploadedFile(null);
    setFileMetadata(null);
    setParsedData([]);
    setValidationResult(null);
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {/* Breadcrumb */}
            <nav className="flex items-center space-x-2 text-sm text-gray-500">
              <button
                onClick={() => router.push('/price-master')}
                className="flex items-center space-x-1 hover:text-gray-700"
              >
                <Home className="h-4 w-4" />
                <span>가격 마스터</span>
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="text-gray-900 font-medium">대량 업데이트</span>
            </nav>

            <h1 className="text-3xl font-bold tracking-tight">대량 가격 업데이트</h1>
            <p className="text-muted-foreground">
              CSV 또는 Excel 파일을 업로드하여 여러 품목의 단가를 한 번에 업데이트합니다
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => router.push('/price-master')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              돌아가기
            </Button>
            {(uploadedFile || parsedData.length > 0) && (
              <Button
                variant="outline"
                onClick={resetForm}
              >
                초기화
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - File Upload */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. 파일 업로드</CardTitle>
                <CardDescription>
                  CSV 또는 Excel 파일을 업로드하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUploadZone
                  onFileSelect={handleFileSelect}
                  disabled={loading}
                />
              </CardContent>
            </Card>

            {/* Validation Button */}
            {parsedData.length > 0 && !validationResult && (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <p className="text-sm text-gray-600">
                      {parsedData.length}개 항목이 파싱되었습니다.
                    </p>
                    <Button
                      onClick={handleValidation}
                      disabled={validating}
                      className="w-full"
                    >
                      {validating ? '검증 중...' : '데이터 검증'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Middle Column - Data Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>2. 데이터 미리보기</CardTitle>
                <CardDescription>
                  업로드된 데이터를 확인하고 검증하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataPreviewTable
                  data={parsedData}
                  errors={validationResult?.errors || []}
                  loading={loading}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Validation & Update */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>3. 검증 및 업데이트</CardTitle>
                <CardDescription>
                  검증 결과를 확인하고 업데이트를 실행하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ValidationResultPanel
                  validationResult={validationResult}
                  loading={validating}
                />

                {validationResult && (
                  <BulkUpdateButton
                    items={parsedData}
                    validationResult={validationResult}
                    onSuccess={handleUpdateSuccess}
                    onError={handleUpdateError}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>사용 방법</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold text-blue-600">1. 파일 준비</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• CSV 또는 Excel (.xlsx) 형식</li>
                  <li>• 최대 파일 크기: 5MB</li>
                  <li>• 필수 컬럼: 품목코드, 단가, 적용일</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-green-600">2. 데이터 검증</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• 품목코드 존재 여부 확인</li>
                  <li>• 단가 유효성 검사</li>
                  <li>• 적용일 형식 검증</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-purple-600">3. 업데이트 실행</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• 유효한 항목만 업데이트</li>
                  <li>• 이전 단가는 자동 이력 전환</li>
                  <li>• 실시간 진행 상황 표시</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
