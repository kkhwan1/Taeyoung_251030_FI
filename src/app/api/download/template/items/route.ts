import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();

    // Define column headers in Korean
    const headers = [
      '품목코드',
      '품목명',
      '차종',
      '규격',
      '타입',
      '단위',
      '도장상태',
      '단가',
      '최소재고'
    ];

    // Sample data rows
    const sampleData = [
      [
        'PT001',
        '브레이크 패드',
        '소나타',
        '250mm x 120mm x 15mm',
        '완제품',
        'EA',
        'no_coating',
        25000,
        10
      ],
      [
        'MT002',
        '엔진 마운트',
        '아반떼',
        '고무 타입 A',
        '부품',
        'EA',
        'before_coating',
        45000,
        5
      ],
      [
        'FL003',
        '에어 필터',
        '그랜저',
        '300mm x 200mm',
        '소모품',
        'EA',
        'after_coating',
        15000,
        20
      ]
    ];

    // Add notes row explaining valid coating_status values
    const notesRow = [
      '※ 도장상태 입력값: no_coating (도장 불필요), before_coating (도장 전), after_coating (도장 후)',
      '', '', '', '', '', '', '', ''
    ];

    // Combine headers, sample data, and notes
    const worksheetData = [headers, ...sampleData, [], notesRow];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 12 }, // 품목코드
      { wch: 18 }, // 품목명
      { wch: 12 }, // 차종
      { wch: 20 }, // 규격
      { wch: 12 }, // 타입
      { wch: 8 },  // 단위
      { wch: 15 }, // 도장상태
      { wch: 12 }, // 단가
      { wch: 12 }  // 최소재고
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, '품목템플릿');

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
        'Content-Disposition': 'attachment; filename="items_template.xlsx"; filename*=UTF-8\'\'%ED%92%88%EB%AA%A9_%ED%85%9C%ED%94%8C%EB%A6%BF.xlsx',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Error generating items template:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Excel 템플릿 생성에 실패했습니다'
      },
      { status: 500 }
    );
  }
}