import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import type {
  BulkUploadRequest,
  BulkUploadResponse,
  BulkPriceItem,
  ValidationError
} from '@/types/api/price-master';

/**
 * POST /api/price-master/bulk-upload
 * Bulk upload price master entries from CSV/Excel
 *
 * Body: {
 *   items: Array<BulkPriceItem>,
 *   validate_only?: boolean
 * }
 *
 * Returns:
 * - Valid/error counts
 * - Validation errors
 * - Preview of data (max 10 items)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type');
    
    let items: BulkPriceItem[] = [];
    let validate_only = true;

    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const mode = formData.get('mode') as string;
      
      if (!file) {
        return NextResponse.json({
          success: false,
          error: '파일이 제공되지 않았습니다.'
        }, { status: 400 });
      }

      // Parse CSV file
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return NextResponse.json({
          success: false,
          error: 'CSV 파일에 헤더와 최소 1개의 데이터 행이 필요합니다.'
        }, { status: 400 });
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dataRows = lines.slice(1);

      // Validate headers
      const requiredHeaders = ['품목코드', '단가', '적용일'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h.toLowerCase()));
      
      if (missingHeaders.length > 0) {
        return NextResponse.json({
          success: false,
          error: `필수 컬럼이 누락되었습니다: ${missingHeaders.join(', ')}`
        }, { status: 400 });
      }

      // Parse data rows
      items = dataRows.map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });

        return {
          item_code: row['품목코드'] || '',
          item_name: row['품목명'] || '',
          unit_price: parseFloat(row['단가']) || 0,
          effective_date: row['적용일'] || '',
          notes: row['비고'] || ''
        };
      });

      validate_only = mode === 'preview';
    } else {
      // Handle JSON request
      const text = await request.text();
      const requestData: BulkUploadRequest = JSON.parse(text);
      items = requestData.items;
      validate_only = requestData.validate_only ?? true;
    }

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '업로드할 항목이 없습니다.'
      }, { status: 400 });
    }

    // Limit check
    if (items.length > 10000) {
      return NextResponse.json({
        success: false,
        error: '한 번에 최대 10,000개 항목까지 업로드할 수 있습니다.'
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Validate all items
    const errors: ValidationError[] = [];
    const validItems: BulkPriceItem[] = [];

    // Get all item codes for validation
    const itemCodes = [...new Set(items.map(item => item.item_code))];
    const { data: existingItems, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name')
      .in('item_code', itemCodes);

    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    const itemCodeMap = new Map(
      (existingItems || []).map(item => [item.item_code, item])
    );

    // Validate each item
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNumber = i + 2; // Excel row (1-based + header row)

      // Required fields
      if (!item.item_code || item.item_code.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'item_code',
          message: '품목 코드는 필수입니다.',
          value: item.item_code
        });
        continue;
      }

      if (item.unit_price === undefined || item.unit_price === null) {
        errors.push({
          row: rowNumber,
          field: 'unit_price',
          message: '단가는 필수입니다.',
          value: String(item.unit_price)
        });
        continue;
      }

      if (!item.effective_date || item.effective_date.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'effective_date',
          message: '적용일은 필수입니다.',
          value: item.effective_date
        });
        continue;
      }

      // Check item exists
      const existingItem = itemCodeMap.get(item.item_code.trim());
      if (!existingItem) {
        errors.push({
          row: rowNumber,
          field: 'item_code',
          message: '품목을 찾을 수 없습니다.',
          value: item.item_code
        });
        continue;
      }

      // Validate unit_price
      const unitPrice = Number(item.unit_price);
      if (isNaN(unitPrice) || unitPrice < 0) {
        errors.push({
          row: rowNumber,
          field: 'unit_price',
          message: '단가는 0 이상의 숫자여야 합니다.',
          value: String(item.unit_price)
        });
        continue;
      }

      // Validate effective_date format and not in future
      const effectiveDate = new Date(item.effective_date);
      if (isNaN(effectiveDate.getTime())) {
        errors.push({
          row: rowNumber,
          field: 'effective_date',
          message: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)',
          value: item.effective_date
        });
        continue;
      }

      if (effectiveDate > today) {
        errors.push({
          row: rowNumber,
          field: 'effective_date',
          message: '적용일은 미래일 수 없습니다.',
          value: item.effective_date
        });
        continue;
      }

      // Validate item_name if provided
      if (item.item_name && item.item_name.trim() !== existingItem.item_name) {
        errors.push({
          row: rowNumber,
          field: 'item_name',
          message: `품목명 불일치: 실제 "${existingItem.item_name}"`,
          value: item.item_name
        });
        // This is a warning, not a blocker - continue
      }

      // Add to valid items
      validItems.push({
        ...item,
        item_code: item.item_code.trim(),
        unit_price: unitPrice,
        item_name: existingItem.item_name // Use correct item_name from DB
      });
    }

    const validCount = validItems.length;
    const errorCount = errors.length;

    // If validate_only, return validation results
    if (validate_only) {
      const preview = validItems.slice(0, 10).map(item => ({
        item_code: item.item_code,
        item_name: item.item_name || '',
        unit_price: item.unit_price,
        effective_date: item.effective_date,
        status: 'valid' as const
      }));

      // Add some error previews
      const errorPreview = items
        .slice(0, 10)
        .filter((_, index) => errors.some(e => e.row === index + 2))
        .map((item, index) => ({
          item_code: item.item_code || '',
          item_name: item.item_name || '',
          unit_price: item.unit_price,
          effective_date: item.effective_date || '',
          status: 'error' as const
        }));

      const response: BulkUploadResponse = {
        success: true,
        data: {
          valid_count: validCount,
          error_count: errorCount,
          errors: errors.slice(0, 100), // Limit errors to 100
          preview: [...preview, ...errorPreview].slice(0, 10)
        }
      };

      return NextResponse.json(response);
    }

    // Actual upload (validate_only = false)
    if (errorCount > 0) {
      return NextResponse.json({
        success: false,
        error: `검증 실패: ${errorCount}개 항목에 오류가 있습니다.`
      }, { status: 400 });
    }

    // Prepare bulk insert data
    const insertData = validItems.map(item => {
      const existingItem = itemCodeMap.get(item.item_code)!;
      return {
        item_id: existingItem.item_id,
        unit_price: item.unit_price,
        effective_date: item.effective_date,
        is_current: true,
        price_type: 'manual' as const,
        notes: item.notes || null
      };
    });

    // Group by item_id and effective_date to handle duplicates
    const groupedData = new Map<string, typeof insertData[0]>();
    for (const data of insertData) {
      const key = `${data.item_id}_${data.effective_date}`;
      // Keep the last one (latest in file)
      groupedData.set(key, data);
    }

    const uniqueInsertData = Array.from(groupedData.values());

    // Insert in batches (1000 at a time)
    const batchSize = 1000;
    let insertedCount = 0;

    for (let i = 0; i < uniqueInsertData.length; i += batchSize) {
      const batch = uniqueInsertData.slice(i, i + batchSize);

      const { error: insertError, count } = await supabase
        .from('price_master')
        .insert(batch) as any;

      if (insertError) {
        // Rollback is not possible, but return error
        throw new Error(`Bulk insert failed at batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
      }

      insertedCount += count || batch.length;
    }

    // Note: Database trigger automatically sets previous prices' is_current = false

    const preview = validItems.slice(0, 10).map(item => ({
      item_code: item.item_code,
      item_name: item.item_name || '',
      unit_price: item.unit_price,
      effective_date: item.effective_date,
      status: 'valid' as const
    }));

    const response: BulkUploadResponse = {
      success: true,
      data: {
        valid_count: insertedCount,
        error_count: 0,
        errors: [],
        preview
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in bulk upload:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '대량 업로드에 실패했습니다.'
    }, { status: 500 });
  }
}
