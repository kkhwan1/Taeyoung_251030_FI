import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseClient } from '@/lib/db-unified';
import { IncomingForm } from 'formidable';
import { Readable } from 'stream';
import {
  convertExcelData,
  inventoryMapping,
  validateData,
  mapTransactionType,
  mapCompanyType
} from '@/lib/import-map';
import {
  mapExcelHeaders,
  inventoryHeaderMapping
} from '@/lib/excel-header-mapper';

// Disable body parsing for file upload
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: '파일이 없습니다.'
      }, { status: 400 });
    }

    // Check file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({
        success: false,
        error: 'Excel 파일만 업로드 가능합니다.'
      }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({
        success: false,
        error: '파일에 데이터가 없습니다.'
      }, { status: 400 });
    }

    // 새 헤더 매핑 규칙 적용 (한글 헤더 → 영문 필드명)
    const mappedData = mapExcelHeaders(rawData as Record<string, any>[], inventoryHeaderMapping);

    // Convert Excel data using mapping (타입 변환 및 기본값 처리)
    let convertedData: Record<string, any>[];
    try {
      convertedData = convertExcelData(mappedData, inventoryMapping);
    } catch (error: unknown) {
      return NextResponse.json({
        success: false,
        error: `데이터 변환 오류: ${error instanceof Error ? error.message : String(error)}`
      }, { status: 400 });
    }

    // Validate data
    const validation = validateData(convertedData as Record<string, any>[], inventoryMapping);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: '데이터 유효성 검사 실패',
        details: validation.errors
      }, { status: 400 });
    }

    // Process data and insert into database using Supabase
    const supabase = getSupabaseClient();
    const insertedRecords = [];
    const errors = [];

    for (let i = 0; i < convertedData.length; i++) {
      const row = convertedData[i] as Record<string, any>;
      try {
        // Map transaction type to English
        row.transaction_type = mapTransactionType(row.transaction_type);

        // Get item_id from item_code
        const { data: items, error: itemError } = (await supabase
          .from('items')
          .select('item_id, current_stock')
          .eq('item_code', row.item_code)
          .eq('is_active', true)
          .single()) as any;

        if (itemError || !items) {
          errors.push(`행 ${i + 1}: 품목코드 '${row.item_code}'를 찾을 수 없습니다.`);
          continue;
        }

        const itemId = items.item_id;

        // Get company_id from company_code (if provided)
        let companyId = null;
        if (row.company_code) {
          const { data: companies, error: companyError } = (await supabase
            .from('companies')
            .select('company_id')
            .eq('company_code', row.company_code)
            .eq('is_active', true)
            .single()) as any;

          if (companyError || !companies) {
            errors.push(`행 ${i + 1}: 회사코드 '${row.company_code}'를 찾을 수 없습니다.`);
            continue;
          }

          companyId = companies.company_id;
        }

        // Insert inventory transaction
        const { data: insertedTransaction, error: insertError } = (await supabase
          .from('inventory_transactions')
          .insert({
            transaction_date: row.transaction_date,
            transaction_type: row.transaction_type,
            item_id: itemId,
            quantity: row.quantity,
            unit: row.unit,
            company_id: companyId,
            reference_number: row.reference_number || null,
            remarks: row.remarks || null,
            user_id: 1,
            created_at: new Date().toISOString()
          })
          .select('transaction_id')
          .single()) as any;

        if (insertError) {
          errors.push(`행 ${i + 1}: 거래 입력 실패 - ${insertError.message}`);
          continue;
        }

        // Update item stock based on transaction type
        let stockChange = 0;
        switch (row.transaction_type) {
          case 'RECEIVING':
          case 'PRODUCTION':
            stockChange = row.quantity;
            break;
          case 'SHIPPING':
            stockChange = -row.quantity;
            break;
        }

        if (stockChange !== 0) {
          const currentStock = items.current_stock ?? 0;
          const newStock = currentStock + stockChange;
          const { error: updateError } = (await supabase
            .from('items')
            .update({ current_stock: newStock })
            .eq('item_id', itemId)) as any;

          if (updateError) {
            errors.push(`행 ${i + 1}: 재고 업데이트 실패 - ${updateError.message}`);
            continue;
          }
        }

        insertedRecords.push({
          transaction_id: insertedTransaction?.transaction_id,
          row: i + 1,
          item_code: row.item_code,
          quantity: row.quantity,
          transaction_type: row.transaction_type
        });

      } catch (error: unknown) {
        errors.push(`행 ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const result = { insertedRecords, errors };

    return NextResponse.json({
      success: true,
      data: {
        totalProcessed: convertedData.length,
        successCount: result.insertedRecords.length,
        errorCount: result.errors.length,
        inserted: result.insertedRecords,
        errors: result.errors
      }
    });

  } catch (error) {
    console.error('Excel import error:', error);
    return NextResponse.json({
      success: false,
      error: 'Excel 파일 처리 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// GET method for downloading template
export async function GET() {
  try {
    // 새 헤더 매핑 규칙 사용 (inventoryHeaderMapping과 일치)
    const templateData = [{
      '거래일자': '2024-01-01',
      '거래유형': '입고',
      '품목코드': 'ITEM001',
      '수량': 100,
      '단위': 'EA',
      '회사코드': 'COMP001',
      '참조번호': 'REF001',
      '비고': '샘플 데이터'
    }];

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    const colWidths = [
      { wch: 12 }, // 거래일자
      { wch: 10 }, // 거래유형
      { wch: 15 }, // 품목코드
      { wch: 10 }, // 수량
      { wch: 8 },  // 단위
      { wch: 15 }, // 회사코드
      { wch: 15 }, // 참조번호
      { wch: 20 }  // 비고
    ];
    worksheet['!cols'] = colWidths;

    // Add data validation info sheet
    const infoData = [
      ['컬럼', '설명', '필수여부', '예시'],
      ['거래일자', 'YYYY-MM-DD 형식', '필수', '2024-01-01'],
      ['거래유형', '입고/생산/출고', '필수', '입고'],
      ['품목코드', '등록된 품목코드', '필수', 'ITEM001'],
      ['수량', '숫자', '필수', '100'],
      ['단위', '품목 단위', '필수', 'EA'],
      ['회사코드', '등록된 회사코드', '선택', 'COMP001'],
      ['참조번호', '참조 번호', '선택', 'REF001'],
      ['비고', '추가 메모', '선택', '비고 내용']
    ];

    const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
    infoSheet['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 10 },
      { wch: 15 }
    ];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(workbook, infoSheet, '입력 가이드');
    XLSX.utils.book_append_sheet(workbook, worksheet, '재고거래 템플릿');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    // Return template file
    const fileName = '재고거래_업로드_템플릿.xlsx';
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