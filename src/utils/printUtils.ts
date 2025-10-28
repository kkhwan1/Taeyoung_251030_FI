/**
 * Print Utilities for Korean ERP System
 * 태창 자동차 부품 제조 ERP 시스템 인쇄 유틸리티
 */

export interface PrintOptions {
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'A3';
  includeHeader?: boolean;
  includeFooter?: boolean;
  showPageNumbers?: boolean;
  title?: string;
  subtitle?: string;
}

export interface PrintPreviewOptions extends PrintOptions {
  onPrint?: () => void;
  onCancel?: () => void;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  type?: 'text' | 'number' | 'currency' | 'date';
}

/**
 * 한국어 날짜/시간 포맷팅
 */
export function formatKoreanDateTime(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}`;
}

/**
 * 한국어 날짜 포맷팅
 */
export function formatKoreanDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 숫자 한국어 포맷팅 (천 단위 쉼표)
 */
export function formatKoreanNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return num.toLocaleString('ko-KR');
}

/**
 * 통화 한국어 포맷팅
 */
export function formatKoreanCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `₩${num.toLocaleString('ko-KR')}`;
}

/**
 * 회사 정보 헤더 생성
 */
function createCompanyHeader(title: string, subtitle?: string): string {
  const printDate = formatKoreanDateTime();

  return `
    <div class="print-header">
      <h1>태창 자동차 부품 제조 ERP 시스템</h1>
      <div class="company-info">경기도 안산시 단원구 신길동 1234-5 | TEL: 031-123-4567</div>
      <div class="report-title">${title}</div>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
      <div class="print-date">인쇄일시: ${printDate}</div>
    </div>
  `;
}

/**
 * 테이블 HTML 생성
 */
function createTableHTML(
  data: Record<string, any>[],
  columns: TableColumn[],
  className: string = 'print-table'
): string {
  if (data.length === 0) {
    return `<div class="no-data">인쇄할 데이터가 없습니다.</div>`;
  }

  const tableHeader = columns.map(col =>
    `<th class="text-${col.align || 'left'}" ${col.width ? `style="width: ${col.width}"` : ''}>${col.label}</th>`
  ).join('');

  const tableRows = data.map((row: Record<string, any>) => {
    const cells = columns.map(col => {
      let value = row[col.key] || '-';

      // 타입별 포맷팅
      switch (col.type) {
        case 'number':
          value = formatKoreanNumber(value);
          break;
        case 'currency':
          value = formatKoreanCurrency(value);
          break;
        case 'date':
          if (value && value !== '-') {
            const date = new Date(value);
            value = formatKoreanDate(date);
          }
          break;
      }

      return `<td class="text-${col.align || 'left'} ${col.type || ''}">${value}</td>`;
    }).join('');

    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <table class="${className}">
      <thead>
        <tr>${tableHeader}</tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
}

/**
 * 인쇄용 콘텐츠 생성
 */
export function generatePrintableContent(
  content: string,
  options: PrintOptions = {}
): string {
  const {
    orientation = 'portrait',
    includeHeader = true,
    includeFooter = true,
    title = '보고서',
    subtitle
  } = options;

  const layoutClass = orientation === 'landscape' ? 'print-landscape' : 'print-portrait';
  const header = includeHeader ? createCompanyHeader(title, subtitle) : '';
  const footer = includeFooter ? `
    <div class="print-footer">
      <div>태창 자동차 부품 제조 © ${new Date().getFullYear()} | 기밀문서</div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - 태창 ERP</title>
      <link rel="stylesheet" href="/styles/print.css">
      <style>
        body { margin: 0; padding: 0; }
        .print-container {
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
        }
      </style>
    </head>
    <body class="${layoutClass}">
      <div class="print-container">
        ${header}
        <div class="content">
          ${content}
        </div>
        ${footer}
      </div>
    </body>
    </html>
  `;
}

/**
 * 기본 페이지 인쇄
 */
export async function printPage(options: PrintOptions = {}): Promise<void> {
  const {
    title = '페이지 인쇄'
  } = options;

  // 현재 페이지의 인쇄 가능한 내용 추출
  const printContent = document.body.innerHTML;
  const fullHtmlContent = generatePrintableContent(printContent, { ...options, title });

  // 새 창에서 인쇄
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('팝업이 차단되었습니다. 팝업을 허용하고 다시 시도해 주세요.');
  }

  printWindow.document.write(fullHtmlContent);
  printWindow.document.close();

  // 스타일시트 로드 완료 후 인쇄
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };
}

/**
 * 테이블 데이터 인쇄
 */
export async function printTable(
  data: Record<string, any>[],
  columns: TableColumn[],
  options: PrintOptions = {}
): Promise<void> {
  const {
    title = '데이터 목록',
    orientation = 'landscape'
  } = options;

  const tableHTML = createTableHTML(data, columns,
    orientation === 'landscape' ? 'print-table print-landscape-table' : 'print-table'
  );

  const summary = `
    <div class="print-summary">
      <h3>요약 정보</h3>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">총 항목 수:</span>
          <span class="summary-value">${formatKoreanNumber(data.length)}건</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">인쇄일시:</span>
          <span class="summary-value">${formatKoreanDateTime()}</span>
        </div>
      </div>
    </div>
  `;

  const content = summary + tableHTML;
  const htmlContent = generatePrintableContent(content, { ...options, title });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('팝업이 차단되었습니다. 팝업을 허용하고 다시 시도해 주세요.');
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };
}

/**
 * 인쇄 미리보기 모달 생성
 */
export function createPrintPreview(
  content: string,
  options: PrintPreviewOptions = {}
): HTMLElement {
  const {
    title = '인쇄 미리보기',
    orientation = 'portrait',
    onPrint,
    onCancel
  } = options;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-sm max-w-4xl max-h-[90vh] overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b">
        <h3 class="text-lg font-semibold text-gray-900">${title}</h3>
        <div class="flex gap-2">
          <select id="orientation-select" class="px-3 py-1 border rounded text-sm">
            <option value="portrait" ${orientation === 'portrait' ? 'selected' : ''}>세로</option>
            <option value="landscape" ${orientation === 'landscape' ? 'selected' : ''}>가로</option>
          </select>
          <button id="print-btn" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
            인쇄
          </button>
          <button id="cancel-btn" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
            취소
          </button>
        </div>
      </div>

      <div class="p-4 overflow-auto max-h-[70vh]">
        <div class="print-preview" id="preview-content">
          ${content}
        </div>
      </div>
    </div>
  `;

  // 이벤트 핸들러
  const printBtn = modal.querySelector('#print-btn');
  const cancelBtn = modal.querySelector('#cancel-btn');
  const orientationSelect = modal.querySelector('#orientation-select') as HTMLSelectElement;

  printBtn?.addEventListener('click', () => {
    const currentOrientation = orientationSelect.value as 'portrait' | 'landscape';
    printTable([], [], { ...options, orientation: currentOrientation });
    onPrint?.();
    document.body.removeChild(modal);
  });

  cancelBtn?.addEventListener('click', () => {
    onCancel?.();
    document.body.removeChild(modal);
  });

  // ESC 키로 닫기
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  return modal;
}

/**
 * 인쇄 미리보기와 함께 인쇄
 */
export async function printWithPreview(
  data: Record<string, any>[],
  columns: TableColumn[],
  options: PrintPreviewOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tableHTML = createTableHTML(data, columns);
      const modal = createPrintPreview(tableHTML, {
        ...options,
        onPrint: () => {
          printTable(data, columns, options);
          resolve();
        },
        onCancel: () => {
          resolve();
        }
      });

      document.body.appendChild(modal);
    } catch (error) {
      reject(error);
    }
  });
}

// 특화된 인쇄 함수들

/**
 * 품목 목록 인쇄
 */
export async function printItems(items: any[], options: PrintOptions = {}): Promise<void> {
  const columns: TableColumn[] = [
    { key: 'item_code', label: '품번', align: 'left', width: '12%' },
    { key: 'item_name', label: '품명', align: 'left', width: '20%' },
    { key: 'car_model', label: '차종', align: 'left', width: '12%' },
    { key: 'spec', label: '규격', align: 'left', width: '15%' },
    { key: 'item_type', label: '타입', align: 'center', width: '8%' },
    { key: 'unit', label: '단위', align: 'center', width: '6%' },
    { key: 'current_stock', label: '현재고', align: 'right', width: '8%', type: 'number' },
    { key: 'min_stock_level', label: '최소재고', align: 'right', width: '8%', type: 'number' },
    { key: 'unit_price', label: '단가', align: 'right', width: '11%', type: 'currency' }
  ];

  await printTable(items, columns, {
    ...options,
    title: '품목 목록',
    orientation: 'landscape'
  });
}

/**
 * 회사 목록 인쇄
 */
export async function printCompanies(companies: any[], options: PrintOptions = {}): Promise<void> {
  const columns: TableColumn[] = [
    { key: 'company_code', label: '회사코드', align: 'left', width: '15%' },
    { key: 'company_name', label: '회사명', align: 'left', width: '25%' },
    { key: 'company_type', label: '구분', align: 'center', width: '10%' },
    { key: 'contact_person', label: '담당자', align: 'left', width: '15%' },
    { key: 'phone', label: '전화번호', align: 'left', width: '15%' },
    { key: 'address', label: '주소', align: 'left', width: '20%' }
  ];

  await printTable(companies, columns, {
    ...options,
    title: '거래처 목록',
    orientation: 'portrait'
  });
}

/**
 * BOM 구조 인쇄
 */
export async function printBOM(bomData: any[], options: PrintOptions = {}): Promise<void> {
  const columns: TableColumn[] = [
    { key: 'level_display', label: '레벨', align: 'left', width: '8%' },
    { key: 'item_code', label: '품번', align: 'left', width: '15%' },
    { key: 'item_name', label: '품명', align: 'left', width: '25%' },
    { key: 'quantity', label: '소요량', align: 'right', width: '10%', type: 'number' },
    { key: 'unit', label: '단위', align: 'center', width: '8%' },
    { key: 'unit_price', label: '단가', align: 'right', width: '12%', type: 'currency' },
    { key: 'total_cost', label: '총비용', align: 'right', width: '12%', type: 'currency' },
    { key: 'notes', label: '비고', align: 'left', width: '10%' }
  ];

  await printTable(bomData, columns, {
    ...options,
    title: 'BOM 구조도',
    orientation: 'landscape'
  });
}

/**
 * 재고 거래 내역 인쇄
 */
export async function printTransactions(transactions: Record<string, any>[], options: PrintOptions = {}): Promise<void> {
  const columns: TableColumn[] = [
    { key: 'transaction_date', label: '거래일', align: 'center', width: '12%', type: 'date' },
    { key: 'transaction_type', label: '구분', align: 'center', width: '8%' },
    { key: 'item_code', label: '품번', align: 'left', width: '12%' },
    { key: 'item_name', label: '품명', align: 'left', width: '18%' },
    { key: 'quantity', label: '수량', align: 'right', width: '10%', type: 'number' },
    { key: 'unit_price', label: '단가', align: 'right', width: '12%', type: 'currency' },
    { key: 'total_amount', label: '금액', align: 'right', width: '12%', type: 'currency' },
    { key: 'company_name', label: '거래처', align: 'left', width: '12%' },
    { key: 'notes', label: '비고', align: 'left', width: '14%' }
  ];

  await printTable(transactions, columns, {
    ...options,
    title: '재고 거래 내역',
    orientation: 'landscape'
  });
}

/**
 * 재고 현황 보고서 인쇄
 */
export async function printStockReport(stockData: any[], options: PrintOptions = {}): Promise<void> {
  const columns: TableColumn[] = [
    { key: 'item_code', label: '품번', align: 'left', width: '15%' },
    { key: 'item_name', label: '품명', align: 'left', width: '25%' },
    { key: 'current_stock', label: '현재고', align: 'right', width: '12%', type: 'number' },
    { key: 'min_stock_level', label: '최소재고', align: 'right', width: '12%', type: 'number' },
    { key: 'stock_value', label: '재고금액', align: 'right', width: '15%', type: 'currency' },
    { key: 'location', label: '위치', align: 'left', width: '10%' },
    { key: 'status', label: '상태', align: 'center', width: '11%' }
  ];

  await printTable(stockData, columns, {
    ...options,
    title: '재고 현황 보고서',
    orientation: 'landscape'
  });
}

const printUtils = {
  printPage,
  printTable,
  printWithPreview,
  printItems,
  printCompanies,
  printBOM,
  printTransactions,
  printStockReport,
  formatKoreanDateTime,
  formatKoreanDate,
  formatKoreanNumber,
  formatKoreanCurrency
};

export default printUtils;