// Excel Import/Export 헤더 매핑 및 데이터 변환 유틸리티

export interface ColumnMapping {
  korean: string;
  english: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required?: boolean;
  default?: any;
}

// 아이템 매핑
export const itemsMapping: ColumnMapping[] = [
  { korean: '품목코드', english: 'item_code', type: 'string', required: true },
  { korean: '품목명', english: 'item_name', type: 'string', required: true },
  { korean: '규격', english: 'spec', type: 'string' },
  { korean: '단위', english: 'unit', type: 'string', required: true },
  { korean: '품목분류', english: 'category', type: 'string' },
  { korean: '안전재고', english: 'safety_stock', type: 'number', default: 0 },
  { korean: '현재고', english: 'current_stock', type: 'number', default: 0 },
  { korean: '활성여부', english: 'is_active', type: 'boolean', default: true }
];

// 회사 매핑
export const companiesMapping: ColumnMapping[] = [
  { korean: '회사코드', english: 'company_code', type: 'string', required: true },
  { korean: '회사명', english: 'company_name', type: 'string', required: true },
  { korean: '회사구분', english: 'company_type', type: 'string', required: true },
  { korean: '담당자', english: 'contact_person', type: 'string' },
  { korean: '전화번호', english: 'phone', type: 'string' },
  { korean: '이메일', english: 'email', type: 'string' },
  { korean: '주소', english: 'address', type: 'string' },
  { korean: '활성여부', english: 'is_active', type: 'boolean', default: true }
];

// BOM 매핑
export const bomMapping: ColumnMapping[] = [
  { korean: '상위품목코드', english: 'parent_item_code', type: 'string', required: true },
  { korean: '하위품목코드', english: 'child_item_code', type: 'string', required: true },
  { korean: '소요량', english: 'quantity', type: 'number', required: true },
  { korean: '단위', english: 'unit', type: 'string', required: true },
  { korean: '비고', english: 'remarks', type: 'string' }
];

// 재고 트랜잭션 매핑
export const inventoryMapping: ColumnMapping[] = [
  { korean: '거래일자', english: 'transaction_date', type: 'date', required: true },
  { korean: '거래유형', english: 'transaction_type', type: 'string', required: true },
  { korean: '품목코드', english: 'item_code', type: 'string', required: true },
  { korean: '수량', english: 'quantity', type: 'number', required: true },
  { korean: '단위', english: 'unit', type: 'string', required: true },
  { korean: '회사코드', english: 'company_code', type: 'string' },
  { korean: '참조번호', english: 'reference_number', type: 'string' },
  { korean: '비고', english: 'remarks', type: 'string' }
];

// 매핑 맵
export const mappings = {
  items: itemsMapping,
  companies: companiesMapping,
  bom: bomMapping,
  inventory: inventoryMapping
};

// 데이터 변환 함수
export function convertExcelData(data: Record<string, any>[], mapping: ColumnMapping[]): Record<string, any>[] {
  return data.map(row => {
    const converted: Record<string, any> = {};

    mapping.forEach(col => {
      const koreanValue = row[col.korean];
      let value = koreanValue;

      // 빈 값 처리
      if (value === undefined || value === null || value === '') {
        if (col.required) {
          throw new Error(`필수 항목이 비어있습니다: ${col.korean}`);
        }
        value = col.default;
      }

      // 타입 변환
      switch (col.type) {
        case 'number':
          if (typeof value === 'string') {
            value = parseFloat(value.replace(/,/g, ''));
            if (isNaN(value)) {
              throw new Error(`숫자 형식이 올바르지 않습니다: ${col.korean} = ${koreanValue}`);
            }
          }
          break;

        case 'date':
          if (typeof value === 'string') {
            // Excel 날짜 형식 처리 (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD)
            const dateStr = value.replace(/[.\/]/g, '-');
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              throw new Error(`날짜 형식이 올바르지 않습니다: ${col.korean} = ${koreanValue}`);
            }
            value = date.toISOString().split('T')[0];
          }
          break;

        case 'boolean':
          if (typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            if (['true', '참', 'y', 'yes', '1', 'o', 'x'].includes(lowerValue)) {
              value = lowerValue === 'true' || lowerValue === '참' || lowerValue === 'y' ||
                     lowerValue === 'yes' || lowerValue === '1' || lowerValue === 'o';
            } else {
              value = Boolean(value);
            }
          }
          break;

        case 'string':
          if (value !== null && value !== undefined) {
            value = String(value).trim();
          }
          break;
      }

      converted[col.english] = value;
    });

    return converted;
  });
}

// 한글 헤더를 영문 필드로 매핑
export function mapKoreanToEnglish(data: Record<string, any>[], mapping: ColumnMapping[]): any[] {
  return data.map(row => {
    const mapped: any = {};
    mapping.forEach(col => {
      if (row.hasOwnProperty(col.korean)) {
        mapped[col.english] = row[col.korean];
      }
    });
    return mapped;
  });
}

// 영문 필드를 한글 헤더로 매핑 (Export용)
export function mapEnglishToKorean(data: Record<string, any>[], mapping: ColumnMapping[]): any[] {
  return data.map(row => {
    const mapped: any = {};
    mapping.forEach(col => {
      if (row.hasOwnProperty(col.english)) {
        mapped[col.korean] = row[col.english];
      }
    });
    return mapped;
  });
}

// 회사 구분 매핑
export function mapCompanyType(type: string): string {
  const mapping: { [key: string]: string } = {
    'CUSTOMER': '고객사',
    'SUPPLIER': '공급사',
    '고객사': 'CUSTOMER',
    '공급사': 'SUPPLIER'
  };
  return mapping[type] || type;
}

// 거래 유형 매핑
export function mapTransactionType(type: string): string {
  const mapping: { [key: string]: string } = {
    'RECEIVING': '입고',
    'PRODUCTION': '생산',
    'SHIPPING': '출고',
    '입고': 'RECEIVING',
    '생산': 'PRODUCTION',
    '출고': 'SHIPPING'
  };
  return mapping[type] || type;
}

// Excel 템플릿 생성용 빈 데이터
export function createTemplate(mapping: ColumnMapping[]): Record<string, string> {
  const template: Record<string, string> = {};
  mapping.forEach(col => {
    template[col.korean] = '';
  });
  return template;
}

// 유효성 검사
export function validateData(data: Record<string, any>[], mapping: ColumnMapping[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  data.forEach((row, index) => {
    mapping.forEach(col => {
      const value = row[col.english];

      // 필수 필드 검사
      if (col.required && (value === undefined || value === null || value === '')) {
        errors.push(`행 ${index + 1}: ${col.korean}은(는) 필수 항목입니다.`);
      }

      // 타입 검사
      if (value !== null && value !== undefined && value !== '') {
        switch (col.type) {
          case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
              errors.push(`행 ${index + 1}: ${col.korean}은(는) 숫자여야 합니다.`);
            }
            break;
          case 'date':
            if (typeof value === 'string') {
              const date = new Date(value);
              if (isNaN(date.getTime())) {
                errors.push(`행 ${index + 1}: ${col.korean}은(는) 올바른 날짜 형식이어야 합니다.`);
              }
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              errors.push(`행 ${index + 1}: ${col.korean}은(는) true/false 값이어야 합니다.`);
            }
            break;
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}