import * as XLSX from 'xlsx';

// Generic interfaces for export data
interface ExportColumn {
  key: string;
  header: string;
  width?: number;
  format?: 'text' | 'number' | 'currency' | 'date';
}

interface ExportOptions {
  filename?: string;
  sheetName?: string;
  columns?: ExportColumn[];
  format?: 'xlsx' | 'csv';
  includeTimestamp?: boolean;
}

// Format date for Korean locale
const formatKoreanDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format currency for Korean locale
const formatKoreanCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount);
};

// Generic export function
export const exportToExcel = (
  data: Record<string, any>[],
  options: ExportOptions = {}
): void => {
  const {
    filename = '데이터_내보내기',
    sheetName = 'Sheet1',
    columns = [],
    format = 'xlsx',
    includeTimestamp = true
  } = options;

  if (!data || data.length === 0) {
    throw new Error('내보낼 데이터가 없습니다.');
  }

  // Process data based on columns configuration
  let processedData = data;

  if (columns.length > 0) {
    processedData = data.map((row: Record<string, any>) => {
      const processedRow: Record<string, any> = {};
      columns.forEach(col => {
        let value = row[col.key];

        // Apply formatting based on column type
        switch (col.format) {
          case 'date':
            value = value ? formatKoreanDate(value) : '';
            break;
          case 'currency':
            value = typeof value === 'number' ? formatKoreanCurrency(value) : value;
            break;
          case 'number':
            value = typeof value === 'number' ? value.toLocaleString('ko-KR') : value;
            break;
          default:
            // Keep original value for text
            break;
        }

        processedRow[col.header] = value;
      });
      return processedRow;
    });
  }

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(processedData);

  // Set column widths
  if (columns.length > 0) {
    const colWidths = columns.map(col => ({
      wch: col.width || 15
    }));
    ws['!cols'] = colWidths;
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate filename with timestamp
  const timestamp = includeTimestamp
    ? `_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_')}`
    : '';

  const finalFilename = `${filename}${timestamp}.${format}`;

  // Write and download file
  XLSX.writeFile(wb, finalFilename);
};

// Specialized export functions

// Export items with Korean headers
export const exportItems = (items: any[]): void => {
  const columns: ExportColumn[] = [
    { key: 'item_id', header: '품번', width: 15 },
    { key: 'item_name', header: '품명', width: 25 },
    { key: 'item_type', header: '타입', width: 12 },
    { key: 'car_model', header: '차종', width: 15 },
    { key: 'spec', header: '규격', width: 20 },
    { key: 'unit', header: '단위', width: 10 },
    { key: 'current_stock', header: '현재고', width: 12, format: 'number' },
    { key: 'min_stock', header: '최소재고', width: 12, format: 'number' },
    { key: 'unit_price', header: '단가', width: 15, format: 'currency' },
    { key: 'location', header: '위치', width: 15 },
    { key: 'created_at', header: '등록일시', width: 18, format: 'date' }
  ];

  exportToExcel(items, {
    filename: '품목_목록',
    sheetName: '품목',
    columns,
    format: 'xlsx'
  });
};

// Export companies with Korean headers
export const exportCompanies = (companies: any[]): void => {
  const columns: ExportColumn[] = [
    { key: 'company_id', header: '거래처코드', width: 15 },
    { key: 'company_name', header: '거래처명', width: 25 },
    { key: 'company_type', header: '타입', width: 12 },
    { key: 'business_number', header: '사업자등록번호', width: 18 },
    { key: 'contact_person', header: '담당자', width: 15 },
    { key: 'phone', header: '전화번호', width: 15 },
    { key: 'email', header: '이메일', width: 20 },
    { key: 'address', header: '주소', width: 30 },
    { key: 'created_at', header: '등록일시', width: 18, format: 'date' }
  ];

  exportToExcel(companies, {
    filename: '거래처_목록',
    sheetName: '거래처',
    columns,
    format: 'xlsx'
  });
};

// Export BOM with Korean headers
export const exportBOM = (bomData: any[]): void => {
  const columns: ExportColumn[] = [
    { key: 'parent_item_name', header: '모품목', width: 25 },
    { key: 'child_item_name', header: '자품목', width: 25 },
    { key: 'quantity', header: '소요량', width: 12, format: 'number' },
    { key: 'unit', header: '단위', width: 10 },
    { key: 'notes', header: '비고', width: 20 },
    { key: 'created_at', header: '등록일시', width: 18, format: 'date' }
  ];

  exportToExcel(bomData, {
    filename: 'BOM_목록',
    sheetName: 'BOM',
    columns,
    format: 'xlsx'
  });
};

// Export inventory transactions with Korean headers
export const exportTransactions = (transactions: Record<string, any>[]): void => {
  const columns: ExportColumn[] = [
    { key: 'transaction_id', header: '거래번호', width: 15 },
    { key: 'item_name', header: '품목명', width: 25 },
    { key: 'transaction_type', header: '거래유형', width: 12 },
    { key: 'quantity', header: '수량', width: 12, format: 'number' },
    { key: 'unit_price', header: '단가', width: 15, format: 'currency' },
    { key: 'total_amount', header: '총금액', width: 15, format: 'currency' },
    { key: 'company_name', header: '거래처', width: 20 },
    { key: 'reference_number', header: '참조번호', width: 15 },
    { key: 'notes', header: '비고', width: 20 },
    { key: 'transaction_date', header: '거래일시', width: 18, format: 'date' },
    { key: 'created_at', header: '등록일시', width: 18, format: 'date' }
  ];

  exportToExcel(transactions, {
    filename: '재고_거래내역',
    sheetName: '거래내역',
    columns,
    format: 'xlsx'
  });
};

// Export stock status with Korean headers
export const exportStockStatus = (stockData: any[]): void => {
  const columns: ExportColumn[] = [
    { key: 'item_name', header: '품목명', width: 25 },
    { key: 'current_stock', header: '현재고', width: 12, format: 'number' },
    { key: 'min_stock', header: '최소재고', width: 12, format: 'number' },
    { key: 'stock_status', header: '재고상태', width: 12 },
    { key: 'unit_price', header: '단가', width: 15, format: 'currency' },
    { key: 'stock_value', header: '재고가치', width: 15, format: 'currency' },
    { key: 'location', header: '위치', width: 15 },
    { key: 'last_updated', header: '최종업데이트', width: 18, format: 'date' }
  ];

  exportToExcel(stockData, {
    filename: '재고_현황',
    sheetName: '재고현황',
    columns,
    format: 'xlsx'
  });
};

// Multi-sheet export function
export const exportMultipleSheets = (
  sheetsData: { data: Record<string, any>[], options: ExportOptions }[]
): void => {
  const wb = XLSX.utils.book_new();

  sheetsData.forEach(({ data, options }) => {
    if (!data || data.length === 0) return;

    const {
      sheetName = 'Sheet',
      columns = []
    } = options;

    // Process data based on columns configuration
    let processedData = data;

    if (columns.length > 0) {
      processedData = data.map((row: Record<string, any>) => {
        const processedRow: Record<string, any> = {};
        columns.forEach(col => {
          let value = row[col.key];

          // Apply formatting based on column type
          switch (col.format) {
            case 'date':
              value = value ? formatKoreanDate(value) : '';
              break;
            case 'currency':
              value = typeof value === 'number' ? formatKoreanCurrency(value) : value;
              break;
            case 'number':
              value = typeof value === 'number' ? value.toLocaleString('ko-KR') : value;
              break;
            default:
              break;
          }

          processedRow[col.header] = value;
        });
        return processedRow;
      });
    }

    const ws = XLSX.utils.json_to_sheet(processedData);

    // Set column widths
    if (columns.length > 0) {
      const colWidths = columns.map(col => ({
        wch: col.width || 15
      }));
      ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
  const filename = `종합_데이터_${timestamp}.xlsx`;

  XLSX.writeFile(wb, filename);
};