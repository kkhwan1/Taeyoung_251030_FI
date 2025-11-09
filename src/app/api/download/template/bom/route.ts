import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();

    // Define column headers in Korean
    const headers = [
      '모품목코드',
      '자품목코드',
      '소요량',
      '단위',
      '레벨',
      '비고'
    ];

    // Sample data rows
    const sampleData = [
      [
        '50007278B',
        '65630-L2000',
        1,
        'EA',
        1,
        '주요 구성 부품'
      ],
      [
        '50007278B',
        '13194-08220',
        2,
        'EA',
        2,
        '조립용 볼트'
      ],
      [
        '50007300D',
        '65630-L2000',
        1,
        'EA',
        1,
        'GLASS PANEL REINFORCEMENT 구성 부품'
      ]
    ];

    // Add notes row explaining valid values
    const notesRow = [
      '※ 입력 규칙:',
      '',
      '',
      '',
      '',
      ''
    ];
    const notesRow2 = [
      '※ 모품목코드: 부모 품목의 품목코드 (필수)',
      '',
      '',
      '',
      '',
      ''
    ];
    const notesRow3 = [
      '※ 자품목코드: 자식 품목의 품목코드 (필수)',
      '',
      '',
      '',
      '',
      ''
    ];
    const notesRow4 = [
      '※ 소요량: 필요한 수량 (필수, 숫자)',
      '',
      '',
      '',
      '',
      ''
    ];
    const notesRow5 = [
      '※ 단위: 단위 (필수, 예: EA, KG, M)',
      '',
      '',
      '',
      '',
      ''
    ];
    const notesRow6 = [
      '※ 레벨: BOM 레벨 (선택, 기본값: 1)',
      '',
      '',
      '',
      '',
      ''
    ];

    // Combine headers, sample data, and notes
    const worksheetData = [
      headers,
      ...sampleData,
      [],
      notesRow,
      notesRow2,
      notesRow3,
      notesRow4,
      notesRow5,
      notesRow6
    ];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 20 }, // 모품목코드
      { wch: 20 }, // 자품목코드
      { wch: 12 }, // 소요량
      { wch: 10 }, // 단위
      { wch: 8 },  // 레벨
      { wch: 30 }  // 비고
    ];

    // Create a validation rules sheet
    const validationSheet = XLSX.utils.aoa_to_sheet([
      ['데이터 검증 규칙'],
      [''],
      ['필수 필드:'],
      ['- 모품목코드: 부모 품목의 품목코드 (필수)'],
      ['- 자품목코드: 자식 품목의 품목코드 (필수)'],
      ['- 소요량: 필요한 수량 (필수, 숫자)'],
      ['- 단위: 단위 (필수)'],
      [''],
      ['선택 필드:'],
      ['- 레벨: BOM 레벨 (선택, 기본값: 1)'],
      ['- 비고: 메모 (선택)'],
      [''],
      ['주의사항:'],
      ['1. 모품목코드와 자품목코드는 items 테이블에 존재하는 품목코드여야 합니다'],
      ['2. 소요량은 0보다 큰 숫자여야 합니다'],
      ['3. 동일한 모품목-자품목 조합은 중복될 수 없습니다'],
      ['4. 모품목과 자품목이 동일할 수 없습니다 (순환 참조 방지)']
    ]);

    // Set column width for validation sheet
    validationSheet['!cols'] = [{ wch: 60 }];

    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM템플릿');
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
        'Content-Disposition': 'attachment; filename="bom_template.xlsx"; filename*=UTF-8\'\'%42%4F%4D_%ED%85%9C%ED%94%8C%EB%A6%BF.xlsx',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Error generating BOM template:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Excel 템플릿 생성에 실패했습니다'
      },
      { status: 500 }
    );
  }
}

