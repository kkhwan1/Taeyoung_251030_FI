import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();

    // Define column headers in Korean - Enhanced with item details
    const headers = [
      // Parent item fields
      '모품목코드',
      '모품목명',
      '모품목규격',
      '모품목단위',
      '모품목카테고리',
      '모품목재고타입',
      '모품목공급사',
      // Child item fields
      '자품목코드',
      '자품목명',
      '자품목규격',
      '자품목단위',
      '자품목카테고리',
      '자품목재고타입',
      '자품목공급사',
      // BOM relationship fields
      '소요량',
      '레벨',
      '비고'
    ];

    // Sample data rows - Enhanced with item details
    const sampleData = [
      [
        // Parent item
        '50007278B', 'GLASS PANEL', 'SPEC-001', 'EA', '부품', 'SEMI_FINISHED', '태창공업',
        // Child item
        '65630-L2000', 'REINFORCEMENT', 'SPEC-002', 'EA', '부품', 'RAW_MATERIAL', '태창공업',
        // BOM relationship
        1, 1, '주요 구성 부품'
      ],
      [
        // Parent item
        '50007278B', 'GLASS PANEL', 'SPEC-001', 'EA', '부품', 'SEMI_FINISHED', '태창공업',
        // Child item
        '13194-08220', 'BOLT ASSEMBLY', 'M8x20', 'EA', '부품', 'RAW_MATERIAL', '협력사A',
        // BOM relationship
        2, 2, '조립용 볼트'
      ],
      [
        // Parent item
        '50007300D', 'PANEL ASSEMBLY', 'SPEC-003', 'EA', '부품', 'FINISHED_PRODUCT', '태창공업',
        // Child item
        '65630-L2000', 'REINFORCEMENT', 'SPEC-002', 'EA', '부품', 'RAW_MATERIAL', '태창공업',
        // BOM relationship
        1, 1, 'GLASS PANEL REINFORCEMENT 구성 부품'
      ]
    ];

    // Add notes row explaining valid values - Enhanced for 17 columns
    const notesRow = [
      '※ 입력 규칙:',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow2 = [
      '※ 모품목코드: 부모 품목의 품목코드 (필수) - 품목이 없으면 자동 생성됩니다',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow3 = [
      '※ 모품목명: 부모 품목의 이름 (필수)',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow4 = [
      '※ 모품목재고타입: RAW_MATERIAL, SEMI_FINISHED, FINISHED_PRODUCT, SUPPLIES 중 선택 (선택)',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow5 = [
      '※ 모품목공급사: 거래처 회사명 또는 코드 (선택) - 거래처가 존재해야 합니다',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow6 = [
      '※ 자품목코드: 자식 품목의 품목코드 (필수) - 품목이 없으면 자동 생성됩니다',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow7 = [
      '※ 자품목명: 자식 품목의 이름 (필수)',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow8 = [
      '※ 자품목재고타입: RAW_MATERIAL, SEMI_FINISHED, FINISHED_PRODUCT, SUPPLIES 중 선택 (선택)',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow9 = [
      '※ 자품목공급사: 거래처 회사명 또는 코드 (선택) - 거래처가 존재해야 합니다',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow10 = [
      '※ 소요량: 필요한 수량 (필수, 숫자)',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow11 = [
      '※ 레벨: BOM 레벨 (선택, 기본값: 1)',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const notesRow12 = [
      '※ 처리 방식: 품목 순차 등록 → BOM 등록 (실패 시 이미 등록된 품목은 유지됨)',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];

    // Combine headers, sample data, and notes - Enhanced with additional notes
    const worksheetData = [
      headers,
      ...sampleData,
      [],
      notesRow,
      notesRow2,
      notesRow3,
      notesRow4,
      notesRow5,
      notesRow6,
      notesRow7,
      notesRow8,
      notesRow9,
      notesRow10,
      notesRow11,
      notesRow12
    ];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths for better readability - Enhanced for 17 columns
    worksheet['!cols'] = [
      { wch: 15 }, // 모품목코드
      { wch: 20 }, // 모품목명
      { wch: 15 }, // 모품목규격
      { wch: 10 }, // 모품목단위
      { wch: 12 }, // 모품목카테고리
      { wch: 15 }, // 모품목재고타입
      { wch: 15 }, // 모품목공급사
      { wch: 15 }, // 자품목코드
      { wch: 20 }, // 자품목명
      { wch: 15 }, // 자품목규격
      { wch: 10 }, // 자품목단위
      { wch: 12 }, // 자품목카테고리
      { wch: 15 }, // 자품목재고타입
      { wch: 15 }, // 자품목공급사
      { wch: 10 }, // 소요량
      { wch: 8 },  // 레벨
      { wch: 30 }  // 비고
    ];

    // Create a validation rules sheet - Enhanced for auto-creation
    const validationSheet = XLSX.utils.aoa_to_sheet([
      ['데이터 검증 규칙 - 자동 품목 생성 지원'],
      [''],
      ['필수 필드 (모품목):'],
      ['- 모품목코드: 부모 품목의 품목코드 (필수)'],
      ['- 모품목명: 부모 품목의 이름 (필수)'],
      [''],
      ['필수 필드 (자품목):'],
      ['- 자품목코드: 자식 품목의 품목코드 (필수)'],
      ['- 자품목명: 자식 품목의 이름 (필수)'],
      [''],
      ['필수 필드 (BOM 관계):'],
      ['- 소요량: 필요한 수량 (필수, 숫자)'],
      [''],
      ['선택 필드:'],
      ['- 모품목규격: 부모 품목 규격 (선택)'],
      ['- 모품목단위: 부모 품목 단위 (선택, 예: EA, KG, M)'],
      ['- 모품목카테고리: 부모 품목 카테고리 (선택)'],
      ['- 모품목재고타입: RAW_MATERIAL, SEMI_FINISHED, FINISHED_PRODUCT, SUPPLIES (선택)'],
      ['- 모품목공급사: 거래처 회사명 또는 코드 (선택, companies 테이블에 존재해야 함)'],
      ['- 자품목규격: 자식 품목 규격 (선택)'],
      ['- 자품목단위: 자식 품목 단위 (선택, 예: EA, KG, M)'],
      ['- 자품목카테고리: 자식 품목 카테고리 (선택)'],
      ['- 자품목재고타입: RAW_MATERIAL, SEMI_FINISHED, FINISHED_PRODUCT, SUPPLIES (선택)'],
      ['- 자품목공급사: 거래처 회사명 또는 코드 (선택, companies 테이블에 존재해야 함)'],
      ['- 레벨: BOM 레벨 (선택, 기본값: 1)'],
      ['- 비고: 메모 (선택)'],
      [''],
      ['자동 생성 기능:'],
      ['1. 품목코드가 존재하지 않으면 품목이 자동으로 생성됩니다'],
      ['2. 품목코드가 이미 존재하면 제공된 정보로 업데이트됩니다'],
      ['3. 공급사는 회사명 또는 company_code로 조회됩니다'],
      ['4. 품목은 순차적으로 등록되며, BOM은 이후 일괄 등록됩니다'],
      ['5. 품목 등록에 실패해도 이미 등록된 품목은 유지됩니다 (재업로드 시 자동 병합)'],
      [''],
      ['주의사항:'],
      ['1. 소요량은 0보다 큰 숫자여야 합니다'],
      ['2. 동일한 모품목-자품목 조합은 중복될 수 없습니다'],
      ['3. 모품목과 자품목이 동일할 수 없습니다 (순환 참조 방지)'],
      ['4. inventory_type은 반드시 지정된 4가지 값 중 하나여야 합니다'],
      ['5. 공급사를 지정하는 경우 companies 테이블에 존재하는 거래처여야 합니다'],
      ['6. BOM 등록 실패 시에도 이미 등록된 품목은 유지되므로 재업로드가 안전합니다']
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

