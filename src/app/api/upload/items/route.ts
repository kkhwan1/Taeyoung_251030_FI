import { NextRequest, NextResponse } from 'next/server';
import { parseExcelFile } from '@/lib/excel-utils';
import { mapExcelHeaders, itemsHeaderMapping } from '@/lib/excel-header-mapper';
import { ExcelItemData, ValidationError, UploadResult, VALID_ITEM_TYPES, VALID_COATING_STATUSES } from '@/types/upload';
import formidable from 'formidable';
import fs from 'fs';

export const dynamic = 'force-dynamic';

// 데이터 유효성 검증
function validateItemData(data: any, rowIndex: number): {item: ExcelItemData | null, errors: ValidationError[]} {
  const errors: ValidationError[] = [];
  const row = rowIndex + 2; // Excel row number (header = 1, data starts from 2)

  // 필수 필드 검증
  if (!data.item_code || String(data.item_code).trim() === '') {
    errors.push({
      row,
      field: 'item_code',
      value: data.item_code,
      message: '품목코드는 필수입니다'
    });
  }

  if (!data.item_name || String(data.item_name).trim() === '') {
    errors.push({
      row,
      field: 'item_name',
      value: data.item_name,
      message: '품목명은 필수입니다'
    });
  }

  if (!data.item_type || String(data.item_type).trim() === '') {
    errors.push({
      row,
      field: 'item_type',
      value: data.item_type,
      message: '품목유형은 필수입니다'
    });
  } else if (!VALID_ITEM_TYPES.includes(String(data.item_type).trim() as any)) {
    errors.push({
      row,
      field: 'item_type',
      value: data.item_type,
      message: `품목유형은 다음 중 하나여야 합니다: ${VALID_ITEM_TYPES.join(', ')}`
    });
  }

  if (!data.unit || String(data.unit).trim() === '') {
    errors.push({
      row,
      field: 'unit',
      value: data.unit,
      message: '단위는 필수입니다'
    });
  }

  // 숫자 필드 검증
  if (data.unit_price !== undefined && data.unit_price !== null && data.unit_price !== '') {
    const price = Number(data.unit_price);
    if (isNaN(price) || price < 0) {
      errors.push({
        row,
        field: 'unit_price',
        value: data.unit_price,
        message: '단가는 0 이상의 숫자여야 합니다'
      });
    }
  }

  if (data.min_stock_level !== undefined && data.min_stock_level !== null && data.min_stock_level !== '') {
    const minStock = Number(data.min_stock_level);
    if (isNaN(minStock) || minStock < 0) {
      errors.push({
        row,
        field: 'min_stock_level',
        value: data.min_stock_level,
        message: '최소재고는 0 이상의 숫자여야 합니다'
      });
    }
  }

  // coating_status 검증
  if (data.coating_status !== undefined && data.coating_status !== null && data.coating_status !== '') {
    const normalizedCoatingStatus = String(data.coating_status).trim();
    if (!VALID_COATING_STATUSES.includes(normalizedCoatingStatus as any)) {
      errors.push({
        row,
        field: 'coating_status',
        value: data.coating_status,
        message: `유효하지 않은 도장상태 "${data.coating_status}". 가능한 값: no_coating, before_coating, after_coating`
      });
    }
  }

  if (errors.length > 0) {
    return { item: null, errors };
  }

  // coating_status 처리 - 기본값은 'no_coating'
  let coatingStatus: 'no_coating' | 'before_coating' | 'after_coating' = 'no_coating';
  if (data.coating_status && String(data.coating_status).trim() !== '') {
    coatingStatus = String(data.coating_status).trim() as any;
  }

  return {
    item: {
      item_code: String(data.item_code).trim(),
      item_name: String(data.item_name).trim(),
      item_type: String(data.item_type).trim(),
      car_model: data.car_model ? String(data.car_model).trim() : undefined,
      spec: data.spec ? String(data.spec).trim() : undefined,
      unit: String(data.unit).trim(),
      unit_price: data.unit_price ? Number(data.unit_price) : undefined,
      min_stock_level: data.min_stock_level ? Number(data.min_stock_level) : undefined,
      location: data.location ? String(data.location).trim() : undefined,
      coating_status: coatingStatus,
    },
    errors: []
  };
}

// 중복 검사
async function checkDuplicates(items: ExcelItemData[]): Promise<string[]> {
  const itemCodes = items.map(item => item.item_code);
  const { mcp__supabase__execute_sql } = await import('@/lib/supabase-mcp');

  // PostgreSQL ARRAY syntax with proper escaping
  const itemCodesArray = `ARRAY[${itemCodes.map(code => `'${code.replace(/'/g, "''")}'`).join(',')}]`;

  const existingItems = await mcp__supabase__execute_sql({
    project_id: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID || 'pybjnkbmtlyaftuiieyq',
    query: `SELECT item_code FROM items WHERE item_code = ANY(${itemCodesArray}) AND is_active = true`
  });

  const existingItemsArray = Array.isArray(existingItems) ? existingItems : [];
  return existingItemsArray.map((item: any) => item.item_code);
}

// 배치 삽입
async function batchInsertItems(items: ExcelItemData[]): Promise<void> {
  // Supabase insert multiple rows at once
  const itemsToInsert = items.map(item => ({
    item_code: item.item_code,
    item_name: item.item_name,
    item_type: item.item_type,
    car_model: item.car_model || null,
    spec: item.spec || null,
    unit: item.unit,
    current_stock: 0, // 초기 재고는 0
    min_stock_level: item.min_stock_level || null,
    unit_price: item.unit_price || null,
    location: item.location || null,
    coating_status: item.coating_status || 'no_coating' // 기본값 no_coating
  }));

  const { mcp__supabase__execute_sql } = await import('@/lib/supabase-mcp');

  await mcp__supabase__execute_sql({
    project_id: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID || 'pybjnkbmtlyaftuiieyq',
    query: `INSERT INTO items (
      item_code, item_name, item_type, car_model, spec,
      unit, current_stock, min_stock_level, unit_price, location, coating_status
    ) SELECT * FROM json_populate_recordset(NULL::items, '${JSON.stringify(itemsToInsert).replace(/'/g, "''")}')`
  });
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // multipart/form-data 파싱
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    });

    const { files } = await new Promise<{files: formidable.Files}>((resolve, reject) => {
      form.parse(request as any, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ files });
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: '파일이 업로드되지 않았습니다'
      }, { status: 400 });
    }

    // Excel 파일 확장자 검증
    const fileName = file.originalFilename || '';
    if (!fileName.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json({
        success: false,
        error: 'Excel 파일(.xlsx, .xls)만 업로드 가능합니다'
      }, { status: 400 });
    }

    tempFilePath = file.filepath;

    // Excel 파일 파싱
    const rawData = await parseExcelFile(tempFilePath);

    if (rawData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Excel 파일에 데이터가 없습니다'
      }, { status: 400 });
    }

    // 한글 헤더를 영문 필드명으로 매핑
    const mappedData = mapExcelHeaders(rawData, itemsHeaderMapping);

    // 데이터 유효성 검증
    const validItems: ExcelItemData[] = [];
    const allErrors: ValidationError[] = [];

    for (let i = 0; i < mappedData.length; i++) {
      const { item, errors } = validateItemData(mappedData[i], i);

      if (errors.length > 0) {
        allErrors.push(...errors);
      } else if (item) {
        validItems.push(item);
      }
    }

    // 중복 검사
    const duplicates = validItems.length > 0 ? await checkDuplicates(validItems) : [];
    const itemsToInsert = validItems.filter(item => !duplicates.includes(item.item_code));

    // 결과 생성
    const result: UploadResult = {
      success: allErrors.length === 0 && duplicates.length === 0,
      total_rows: mappedData.length,
      success_count: 0,
      error_count: allErrors.length + duplicates.length,
      errors: allErrors,
      duplicates
    };

    // 유효한 데이터가 있으면 삽입
    if (itemsToInsert.length > 0) {
      await batchInsertItems(itemsToInsert);
      result.success_count = itemsToInsert.length;
    }

    return NextResponse.json({
      success: true,
      message: '파일 업로드가 완료되었습니다',
      data: result
    });

  } catch (error) {
    console.error('Excel upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'Excel 파일 업로드 중 오류가 발생했습니다'
    }, { status: 500 });

  } finally {
    // 임시 파일 정리
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('임시 파일 삭제 실패:', cleanupError);
      }
    }
  }
}