import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();

    // Define column headers in Korean
    const headers = [
      '거래처명',
      '거래처구분',
      '사업자번호',
      '대표자',
      '연락처',
      '이메일',
      '주소',
      '메모'
    ];

    // Sample data rows
    const sampleData = [
      [
        '한국자동차부품(주)',
        '공급사',
        '123-45-67890',
        '김철수',
        '02-1234-5678',
        'contact@koreaparts.com',
        '서울시 강남구 테헤란로 123',
        '주요 브레이크 부품 공급업체'
      ],
      [
        '현대모터스',
        '고객사',
        '987-65-43210',
        '이영희',
        '031-987-6543',
        'orders@hyundaimotors.co.kr',
        '경기도 화성시 현대로 456',
        'OEM 고객사, 월 정기 주문'
      ],
      [
        '대성물류센터',
        '협력사',
        '555-44-33221',
        '박민수',
        '032-555-4433',
        'logistics@daesung.co.kr',
        '인천시 연수구 물류단지로 789',
        '물류 및 배송 협력업체'
      ]
    ];

    // Combine headers and sample data
    const worksheetData = [headers, ...sampleData];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 20 }, // 거래처명
      { wch: 12 }, // 거래처구분
      { wch: 15 }, // 사업자번호
      { wch: 12 }, // 대표자
      { wch: 15 }, // 연락처
      { wch: 25 }, // 이메일
      { wch: 35 }, // 주소
      { wch: 25 }  // 메모
    ];
    worksheet['!cols'] = columnWidths;

    // Create a validation rules sheet
    const validationSheet = XLSX.utils.aoa_to_sheet([
      ['데이터 검증 규칙'],
      [''],
      ['거래처구분 허용값:'],
      ['- 고객사'],
      ['- 공급사'],
      ['- 협력사'],
      ['- 기타'],
      [''],
      ['주의사항:'],
      ['1. 거래처명은 필수 입력입니다'],
      ['2. 거래처구분은 위의 4가지 값 중 하나여야 합니다'],
      ['3. 사업자번호는 "000-00-00000" 형식으로 입력하세요'],
      ['4. 이메일은 올바른 이메일 형식이어야 합니다']
    ]);

    // Set column width for validation sheet
    validationSheet['!cols'] = [{ wch: 40 }];

    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, '거래처템플릿');
    XLSX.utils.book_append_sheet(workbook, validationSheet, '입력규칙');

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      type: 'array',
      bookType: 'xlsx'
    });

    // Convert to Uint8Array to handle binary data properly
    const uint8Array = new Uint8Array(excelBuffer);

    // Set response headers for file download
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="companies_template.xlsx"; filename*=UTF-8\'\'%EA%B1%B0%EB%9E%98%EC%B2%98_%ED%85%9C%ED%94%8C%EB%A6%BF.xlsx',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Error generating companies template:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Excel 템플릿 생성에 실패했습니다'
      },
      { status: 500 }
    );
  }
}