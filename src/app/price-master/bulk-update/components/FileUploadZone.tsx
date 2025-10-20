'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UploadCloud, File, X, AlertCircle, CheckCircle } from 'lucide-react';
import type { FileUploadMetadata, ApiErrorResponse } from '@/types/api/price-master';

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string[];
  maxSize?: number;
  disabled?: boolean;
}

export function FileUploadZone({
  onFileSelect,
  acceptedTypes = ['.csv', '.xlsx'],
  maxSize = 5 * 1024 * 1024, // 5MB
  disabled = false
}: FileUploadZoneProps) {
  const [uploadedFile, setUploadedFile] = useState<FileUploadMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('파일 크기가 5MB를 초과합니다.');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('CSV 또는 Excel 파일만 업로드 가능합니다.');
      } else {
        setError('파일 업로드 중 오류가 발생했습니다.');
      }
      return;
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const fileMetadata: FileUploadMetadata = {
        filename: file.name,
        size: file.size,
        type: file.type,
        uploaded_at: new Date().toISOString()
      };

      setUploadedFile(fileMetadata);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxSize,
    multiple: false,
    disabled
  });

  const removeFile = () => {
    setUploadedFile(null);
    setError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <Card
        {...getRootProps()}
        className={`
          cursor-pointer transition-all duration-200 border-2 border-dashed
          ${isDragActive && !isDragReject ? 'border-primary bg-primary/5' : ''}
          ${isDragReject ? 'border-destructive bg-destructive/5' : ''}
          ${!isDragActive && !isDragReject ? 'border-gray-300 hover:border-gray-400' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        data-testid="file-upload-zone"
      >
        <CardContent className="p-8 text-center">
          <input {...getInputProps()} aria-label="파일 업로드" />
          
          <div className="space-y-4">
            <div className="flex justify-center">
              <UploadCloud 
                className={`h-12 w-12 ${
                  isDragActive && !isDragReject ? 'text-primary' : 
                  isDragReject ? 'text-destructive' : 
                  'text-gray-400'
                }`} 
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {isDragActive && !isDragReject ? '파일을 놓아주세요' : 
                 isDragReject ? '지원하지 않는 파일 형식입니다' :
                 '파일을 드래그하거나 클릭하여 업로드'}
              </h3>
              
              <p className="text-sm text-gray-500">
                CSV 또는 Excel 파일 (최대 5MB)
              </p>
              
              <p className="text-xs text-gray-400">
                지원 형식: .csv, .xlsx
              </p>
            </div>

            {!disabled && (
              <Button 
                type="button" 
                variant="outline" 
                className="mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  // Trigger file input
                  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                  input?.click();
                }}
              >
                파일 선택
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" data-testid="upload-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* File Preview */}
      {uploadedFile && (
        <Card className="border-green-200 bg-green-50" data-testid="file-preview">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <File className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadedFile.filename}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    크기: {formatFileSize(uploadedFile.size)} | 
                    업로드: {new Date(uploadedFile.uploaded_at).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeFile}
                className="text-gray-400 hover:text-gray-600"
                aria-label="파일 제거"
                data-testid="remove-file-button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
