import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * GET /api/download/template/batch
 *
 * 배치 등록용 Excel 템플릿 다운로드
 * 3-Sheet 구조: 사용방법 + 템플릿 + 입력값 예시
 */
export async function GET(request: NextRequest) {
  try {
    const workbook = XLSX.utils.book_new();

    // ============================================
    // Sheet 1: 사용방법 (Instructions)
    // ============================================
    const instructionsData = [
      ['배치 등록 템플릿 사용방법', ''],
      ['', ''],
      ['1. 개요', ''],
      ['', '이 템플릿은 여러 품목을 한 번에 입력하여 배치 등록할 수 있도록 지원합니다.'],
      ['', '템플릿 시트에서 데이터를 입력한 후 업로드하면 자동으로 시스템에 등록됩니다.'],
      ['', ''],
      ['2. 입력 방법', ''],
      ['', '① "템플릿" 시트로 이동'],
      ['', '② 3행부터 데이터 입력 시작 (헤더는 수정하지 마세요)'],
      ['', '③ 필수 항목: 품목코드, 품목명, 수량, 단위'],
      ['', '④ 선택 항목: 단가, LOT번호, 비고'],
      ['', ''],
      ['3. 필수 입력 규칙', ''],
      ['', '• 품목코드: 시스템에 등록된 정확한 코드 입력'],
      ['', '• 품목명: 품목코드와 일치하는 정식 명칭'],
      ['', '• 수량: 0보다 큰 숫자만 가능'],
      ['', '• 단위: 예) EA, KG, M, BOX 등'],
      ['', '• 단가: 숫자만 입력 (쉼표 없이)'],
      ['', ''],
      ['4. 주의사항', ''],
      ['', '[주의] 품목코드가 시스템에 없으면 업로드가 실패합니다'],
      ['', '[주의] 수량은 0보다 커야 합니다'],
      ['', '[주의] 숫자 필드에 텍스트를 입력하면 오류가 발생합니다'],
      ['', '[주의] 헤더 행(2행)은 절대 수정하지 마세요'],
      ['', ''],
      ['5. 업로드 방법', ''],
      ['', '① 데이터 입력 완료 후 파일 저장'],
      ['', '② 재고 관리 > 생산 탭 > "Excel 업로드" 버튼 클릭'],
      ['', '③ 저장한 파일 선택'],
      ['', '④ 업로드 완료 후 결과 확인'],
      ['', ''],
      ['문의사항', 'ERP 관리자에게 문의하세요']
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);

    // Column widths for instructions
    instructionsSheet['!cols'] = [
      { wch: 30 },
      { wch: 80 }
    ];

    // ============================================
    // Sheet 2: 템플릿 (Template)
    // ============================================
    const templateHeaders = [
      '순번',
      '품목코드',
      '품목명',
      '수량',
      '단위',
      '단가',
      'LOT번호',
      '비고'
    ];

    const templateData = [
      ['배치 등록 템플릿', '', '', '', '', '', '', ''],
      templateHeaders,
      // Empty rows for data input (start from row 3)
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '']
    ];

    const templateSheet = XLSX.utils.aoa_to_sheet(templateData);

    // Column widths
    templateSheet['!cols'] = [
      { wch: 8 },  // 순번
      { wch: 15 }, // 품목코드
      { wch: 30 }, // 품목명
      { wch: 10 }, // 수량
      { wch: 8 },  // 단위
      { wch: 12 }, // 단가
      { wch: 20 }, // LOT번호
      { wch: 30 }  // 비고
    ];

    // Freeze header row
    templateSheet['!freeze'] = { xSplit: 0, ySplit: 2 };

    // ============================================
    // Sheet 3: 입력값 예시 (Sample Data)
    // ============================================
    const sampleHeaders = [
      '순번',
      '품목코드',
      '품목명',
      '수량',
      '단위',
      '단가',
      'LOT번호',
      '비고'
    ];

    const sampleData = [
      ['입력값 예시 (참고용)', '', '', '', '', '', '', ''],
      sampleHeaders,
      [1, 'P-001', '스틸 플레이트 A', 100, 'EA', 5000, 'LOT-20250202-001', '정상'],
      [2, 'P-002', '알루미늄 시트 B', 50, 'KG', 12000, 'LOT-20250202-002', '긴급'],
      [3, 'M-001', '볼트 M8x20', 500, 'EA', 100, '', ''],
      [4, 'M-002', '너트 M8', 500, 'EA', 80, '', ''],
      [5, 'R-001', '냉연 코일 1.2T', 1000, 'KG', 8000, 'LOT-20250202-003', ''],
      ['', '', '', '', '', '', '', ''],
      ['※ 위 데이터는 예시이며, 실제 시스템 데이터와 다를 수 있습니다', '', '', '', '', '', '', ''],
      ['※ 품목코드는 반드시 시스템에 등록된 정확한 코드를 입력하세요', '', '', '', '', '', '', '']
    ];

    const sampleSheet = XLSX.utils.aoa_to_sheet(sampleData);

    // Column widths (same as template)
    sampleSheet['!cols'] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 30 },
      { wch: 10 },
      { wch: 8 },
      { wch: 12 },
      { wch: 20 },
      { wch: 30 }
    ];

    // ============================================
    // Assemble Workbook
    // ============================================
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, '사용방법');
    XLSX.utils.book_append_sheet(workbook, templateSheet, '템플릿');
    XLSX.utils.book_append_sheet(workbook, sampleSheet, '입력값 예시');

    // Generate Excel file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    const filename = `배치등록_템플릿_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '템플릿 생성 중 오류가 발생했습니다'
      },
      { status: 500 }
    );
  }
}
