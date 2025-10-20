import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-unified';
import * as XLSX from 'xlsx';
import {
  mappings,
  mapEnglishToKorean,
  mapCompanyType,
  createTemplate,
  ColumnMapping
} from '@/lib/import-map';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await context.params;
    const { searchParams } = new URL(request.url);
    const isTemplate = searchParams.get('template') === 'true';

    // Validate entity
    if (!mappings[entity as keyof typeof mappings]) {
      return NextResponse.json({
        success: false,
        error: '지원하지 않는 엔티티입니다.'
      }, { status: 400 });
    }

    const mapping = mappings[entity as keyof typeof mappings];

    // If template is requested, return template file
    if (isTemplate) {
      return generateTemplate(entity, mapping);
    }

    // Get data based on entity type
    let data: Record<string, any>[] = [];
    let fileName = '';

    switch (entity) {
      case 'items':
        data = await getItemsData(searchParams);
        fileName = '품목목록';
        break;
      case 'companies':
        data = await getCompaniesData(searchParams);
        fileName = '회사목록';
        break;
      case 'bom':
        data = await getBomData(searchParams);
        fileName = 'BOM목록';
        break;
      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 엔티티입니다.'
        }, { status: 400 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: false,
        error: '출력할 데이터가 없습니다.'
      });
    }

    // Convert data to Korean headers
    const koreanData = mapEnglishToKorean(data, mapping);

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(koreanData);

    // Set column widths based on entity type
    const colWidths = getColumnWidths(entity);
    if (colWidths) {
      worksheet['!cols'] = colWidths;
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, fileName);

    // Add summary sheet
    const summaryData = getSummaryData(data, entity);
    if (summaryData.length > 0) {
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 20 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, '요약정보');
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    // Create filename with current date
    const today = new Date().toISOString().split('T')[0];
    const fullFileName = `${fileName}_${today}.xlsx`;

    // Set response headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fullFileName)}`);
    headers.set('Content-Length', excelBuffer.length.toString());

    return new NextResponse(excelBuffer, {
      status: 200,
      headers
    });

  } catch (error) {
    const { entity } = await context.params;
    console.error(`Export error for ${entity}:`, error);
    return NextResponse.json({
      success: false,
      error: 'Excel 파일 생성 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// Get items data
async function getItemsData(searchParams: URLSearchParams): Promise<any[]> {
  const category = searchParams.get('category');
  const isActive = searchParams.get('isActive');

  let sql = `
    SELECT
      item_code,
      item_name,
      spec,
      unit,
      category,
      safety_stock,
      current_stock,
      is_active
    FROM items
    WHERE 1=1
  `;

  const params: unknown[] = [];
  let paramCount = 0;

  if (category) {
    paramCount++;
    sql += ` AND category = $${paramCount}`;
    params.push(category);
  }

  if (isActive !== null) {
    paramCount++;
    sql += ` AND is_active = $${paramCount}`;
    params.push(isActive === 'true' ? 1 : 0);
  }

  sql += ` ORDER BY item_code`;

  const result = await db.query(sql, params);
  return result.success && result.data ? result.data : [];
}

// Get companies data
async function getCompaniesData(searchParams: URLSearchParams): Promise<any[]> {
  const companyType = searchParams.get('companyType');
  const isActive = searchParams.get('isActive');

  let sql = `
    SELECT
      company_code,
      company_name,
      company_type,
      representative,
      phone,
      email,
      address,
      is_active
    FROM companies
    WHERE 1=1
  `;

  const params: unknown[] = [];
  let paramCount = 0;

  if (companyType && companyType !== 'ALL') {
    paramCount++;
    sql += ` AND company_type = $${paramCount}`;
    params.push(companyType);
  }

  if (isActive !== null) {
    paramCount++;
    sql += ` AND is_active = $${paramCount}`;
    params.push(isActive === 'true' ? 1 : 0);
  }

  sql += ` ORDER BY company_code`;

  const result = await db.query(sql, params);
  const results = result.success && result.data ? result.data : [];

  // Convert company type to Korean
  return results.map((company: any) => ({
    ...company,
    company_type: mapCompanyType(company.company_type)
  }));
}

// Get BOM data
async function getBomData(searchParams: URLSearchParams): Promise<any[]> {
  const parentItemCode = searchParams.get('parentItemCode');

  let sql = `
    SELECT
      pi.item_code as parent_item_code,
      pi.item_name as parent_item_name,
      ci.item_code as child_item_code,
      ci.item_name as child_item_name,
      b.quantity,
      b.unit,
      b.remarks
    FROM bom b
    LEFT JOIN items pi ON b.parent_item_id = pi.item_id
    LEFT JOIN items ci ON b.child_item_id = ci.item_id
    WHERE 1=1
  `;

  const params: unknown[] = [];
  let paramCount = 0;

  if (parentItemCode) {
    paramCount++;
    sql += ` AND pi.item_code LIKE $${paramCount}`;
    params.push(`%${parentItemCode}%`);
  }

  sql += ` ORDER BY pi.item_code, ci.item_code`;

  const result = await db.query(sql, params);
  return result.success && result.data ? result.data : [];
}

// Get column widths based on entity type
function getColumnWidths(entity: string): any[] | null {
  switch (entity) {
    case 'items':
      return [
        { wch: 15 }, // 품목코드
        { wch: 25 }, // 품목명
        { wch: 20 }, // 규격
        { wch: 8 },  // 단위
        { wch: 12 }, // 품목분류
        { wch: 12 }, // 안전재고
        { wch: 12 }, // 현재고
        { wch: 10 }  // 활성여부
      ];
    case 'companies':
      return [
        { wch: 15 }, // 회사코드
        { wch: 25 }, // 회사명
        { wch: 10 }, // 회사구분
        { wch: 15 }, // 담당자
        { wch: 15 }, // 전화번호
        { wch: 20 }, // 이메일
        { wch: 30 }, // 주소
        { wch: 10 }  // 활성여부
      ];
    case 'bom':
      return [
        { wch: 15 }, // 상위품목코드
        { wch: 25 }, // 상위품목명
        { wch: 15 }, // 하위품목코드
        { wch: 25 }, // 하위품목명
        { wch: 10 }, // 소요량
        { wch: 8 },  // 단위
        { wch: 20 }  // 비고
      ];
    default:
      return null;
  }
}

// Get summary data
function getSummaryData(data: Record<string, any>[], entity: string): any[][] {
  const summary: any[][] = [
    ['내보내기 정보', ''],
    ['내보낸 날짜', new Date().toLocaleString('ko-KR')],
    ['총 레코드 수', data.length],
    ['', '']
  ];

  switch (entity) {
    case 'items':
      const activeItems = data.filter(item => item.is_active).length;
      const categories = [...new Set(data.map(item => item.category).filter(Boolean))];
      const totalStock = data.reduce((sum, item) => sum + (item.current_stock || 0), 0);

      summary.push(
        ['활성 품목 수', activeItems],
        ['비활성 품목 수', data.length - activeItems],
        ['총 분류 수', categories.length],
        ['총 재고량', totalStock.toLocaleString('ko-KR')]
      );
      break;

    case 'companies':
      const customers = data.filter(company => company.company_type === '고객사').length;
      const suppliers = data.filter(company => company.company_type === '공급사').length;
      const activeCompanies = data.filter(company => company.is_active).length;

      summary.push(
        ['고객사 수', customers],
        ['공급사 수', suppliers],
        ['활성 회사 수', activeCompanies],
        ['비활성 회사 수', data.length - activeCompanies]
      );
      break;

    case 'bom':
      const parentItems = [...new Set(data.map(bom => bom.parent_item_code))].length;
      const childItems = [...new Set(data.map(bom => bom.child_item_code))].length;
      const totalQuantity = data.reduce((sum, bom) => sum + (bom.quantity || 0), 0);

      summary.push(
        ['상위 품목 수', parentItems],
        ['하위 품목 수', childItems],
        ['총 소요량', totalQuantity.toLocaleString('ko-KR')]
      );
      break;
  }

  summary.push(['', ''], ['태창 ERP 시스템', `${getEntityName(entity)} 내보내기`]);

  return summary;
}

// Get entity name in Korean
function getEntityName(entity: string): string {
  const names: { [key: string]: string } = {
    items: '품목',
    companies: '회사',
    bom: 'BOM'
  };
  return names[entity] || entity;
}

// Generate template file
function generateTemplate(entity: string, mapping: ColumnMapping[]): NextResponse {
  try {
    // Create template with sample data
    const templateData = [createTemplate(mapping)];

    // Add sample data based on entity type
    switch (entity) {
      case 'items':
        templateData[0] = {
          '품목코드': 'ITEM001',
          '품목명': '샘플 품목',
          '규격': '100x50',
          '단위': 'EA',
          '품목분류': '완제품',
          '안전재고': '10',
          '현재고': '100',
          '활성여부': 'true'
        };
        break;
      case 'companies':
        templateData[0] = {
          '회사코드': 'COMP001',
          '회사명': '샘플 회사',
          '회사구분': '고객사',
          '담당자': '홍길동',
          '전화번호': '02-1234-5678',
          '이메일': 'contact@sample.com',
          '주소': '서울시 강남구',
          '활성여부': 'true'
        };
        break;
      case 'bom':
        templateData[0] = {
          '상위품목코드': 'PARENT001',
          '하위품목코드': 'CHILD001',
          '소요량': '2',
          '단위': 'EA',
          '비고': '조립용'
        };
        break;
    }

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    const colWidths = getColumnWidths(entity);
    if (colWidths) {
      worksheet['!cols'] = colWidths;
    }

    // Add data validation info
    const infoData: any[][] = [
      ['컬럼명', '설명', '필수여부', '예시값']
    ];

    mapping.forEach(col => {
      infoData.push([
        col.korean,
        col.type === 'date' ? '날짜 형식 (YYYY-MM-DD)' :
        col.type === 'number' ? '숫자' :
        col.type === 'boolean' ? 'true/false' : '텍스트',
        col.required ? '필수' : '선택',
        col.default !== undefined ? String(col.default) : ''
      ]);
    });

    const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
    infoSheet['!cols'] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 10 },
      { wch: 15 }
    ];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, infoSheet, '입력 가이드');
    XLSX.utils.book_append_sheet(workbook, worksheet, `${getEntityName(entity)} 템플릿`);

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    // Create filename
    const fileName = `${getEntityName(entity)}_업로드_템플릿.xlsx`;

    // Set response headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    headers.set('Content-Length', excelBuffer.length.toString());

    return new NextResponse(excelBuffer, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json({
      success: false,
      error: '템플릿 생성 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}