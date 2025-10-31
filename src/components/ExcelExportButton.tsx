'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

interface ExcelExportButtonProps {
  onExport: () => Promise<void> | void;
  data?: any[];
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  tooltip?: string;
  showIcon?: boolean;
  className?: string;
}

export const ExcelExportButton: React.FC<ExcelExportButtonProps> = ({
  onExport,
  data = [],
  disabled = false,
  variant = 'outline',
  size = 'md',
  children,
  tooltip = 'Excel 파일로 내보내기',
  showIcon = true,
  className = ''
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleExport = async () => {
    if (disabled || isExporting) return;

    // Check if there's data to export
    if (data.length === 0) {
      showToastMessage('내보낼 데이터가 없습니다.', 'error');
      return;
    }

    setIsExporting(true);

    try {
      await onExport();
      showToastMessage(
        `${data.length}개 항목이 Excel 파일로 내보내기 완료되었습니다.`,
        'success'
      );
    } catch (error) {
      console.error('Excel export failed:', error);
      showToastMessage(
        'Excel 내보내기 중 오류가 발생했습니다.',
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Style variants
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantStyles = {
    primary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-green-500 shadow-sm',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 shadow-sm',
    outline: 'border border-gray-600 text-gray-600 hover:bg-gray-50 focus:ring-green-500 hover:border-gray-700'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const disabledStyles = 'opacity-50 cursor-not-allowed';

  const buttonClasses = [
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    (disabled || isExporting) && disabledStyles,
    className
  ].filter(Boolean).join(' ');

  return (
    <>
      <button
        onClick={handleExport}
        disabled={disabled || isExporting}
        className={buttonClasses}
        title={tooltip}
        aria-label={tooltip}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            내보내는 중...
          </>
        ) : (
          <>
            {showIcon && (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            {children || 'Excel 내보내기'}
          </>
        )}
      </button>

      {/* Toast Notification */}
      {showToast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-sm transition-all duration-300 ${
            toastType === 'success'
              ? 'bg-gray-500 text-white'
              : 'bg-gray-500 text-white'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            {toastType === 'success' ? (
              <Download className="w-5 h-5" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm font-bold">!</span>
              </div>
            )}
            <span className="font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
    </>
  );
};

// Specialized export buttons for different data types
interface ItemsExportButtonProps {
  items: any[];
  filtered?: boolean;
  className?: string;
}

export const ItemsExportButton: React.FC<ItemsExportButtonProps> = ({
  items,
  filtered = false,
  className
}) => {
  const handleExport = async () => {
    try {
      // Use the server-side API endpoint for better Korean character support
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch('/api/export/items', {}, {
        timeout: 60000,
        maxRetries: 2,
        retryDelay: 1000
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || '품목목록.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export failed:', error);
      throw error;
    }
  };

  return (
    <ExcelExportButton
      onExport={handleExport}
      data={items}
      tooltip={`품목 목록 Excel 내보내기 (${items.length}개)`}
      className={className}
    >
      품목 내보내기
    </ExcelExportButton>
  );
};

interface CompaniesExportButtonProps {
  companies: any[];
  filtered?: boolean;
  className?: string;
}

export const CompaniesExportButton: React.FC<CompaniesExportButtonProps> = ({
  companies,
  filtered = false,
  className
}) => {
  const handleExport = async () => {
    try {
      // Use the server-side API endpoint for better Korean character support
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch('/api/export/companies', {}, {
        timeout: 60000,
        maxRetries: 2,
        retryDelay: 1000
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || '회사목록.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export failed:', error);
      throw error;
    }
  };

  return (
    <ExcelExportButton
      onExport={handleExport}
      data={companies}
      tooltip={`거래처 목록 Excel 내보내기 (${companies.length}개)`}
      className={className}
    >
      거래처 내보내기
    </ExcelExportButton>
  );
};

interface BOMExportButtonProps {
  bomData: any[];
  filtered?: boolean;
  className?: string;
}

export const BOMExportButton: React.FC<BOMExportButtonProps> = ({
  bomData,
  filtered = false,
  className
}) => {
  const handleExport = async () => {
    const { exportBOM } = await import('../utils/excelExport');
    exportBOM(bomData);
  };

  return (
    <ExcelExportButton
      onExport={handleExport}
      data={bomData}
      tooltip={`BOM 목록 Excel 내보내기 (${bomData.length}개)`}
      className={className}
    >
      BOM 내보내기
    </ExcelExportButton>
  );
};

interface TransactionsExportButtonProps {
  transactions: unknown[];
  type?: string;
  className?: string;
}

export const TransactionsExportButton: React.FC<TransactionsExportButtonProps> = ({
  transactions,
  type = '전체',
  className
}) => {
  const handleExport = async () => {
    try {
      // Use the server-side API endpoint for better Korean character support
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch('/api/export/inventory', {}, {
        timeout: 60000,
        maxRetries: 2,
        retryDelay: 1000
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || '재고거래.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export failed:', error);
      throw error;
    }
  };

  return (
    <ExcelExportButton
      onExport={handleExport}
      data={transactions}
      tooltip={`${type} 거래내역 Excel 내보내기 (${transactions.length}개)`}
      className={className}
    >
      거래내역 내보내기
    </ExcelExportButton>
  );
};

interface StockExportButtonProps {
  stockData: any[];
  className?: string;
}

export const StockExportButton: React.FC<StockExportButtonProps> = ({
  stockData,
  className
}) => {
  const handleExport = async () => {
    try {
      // Use the server-side API endpoint for better Korean character support
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch('/api/export/stock', {}, {
        timeout: 60000,
        maxRetries: 2,
        retryDelay: 1000
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || '재고현황.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export failed:', error);
      throw error;
    }
  };

  return (
    <ExcelExportButton
      onExport={handleExport}
      data={stockData}
      tooltip={`재고 현황 Excel 내보내기 (${stockData.length}개)`}
      className={className}
    >
      재고현황 내보내기
    </ExcelExportButton>
  );
};