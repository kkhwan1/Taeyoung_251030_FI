import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import * as XLSX from 'xlsx';
import {
  mappings,
  convertExcelData,
  validateData,
  mapCompanyType,
  mapTransactionType
} from '@/lib/import-map';
import {
  mapExcelHeaders,
  companiesHeaderMapping,
  itemsHeaderMapping,
  bomHeaderMapping
} from '@/lib/excel-header-mapper';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await context.params;

    // Validate entity
    if (!mappings[entity as keyof typeof mappings]) {
      return NextResponse.json({
        success: false,
        error: '지원하지 않는 엔티티입니다.'
      }, { status: 400 });
    }

    const mapping = mappings[entity as keyof typeof mappings];

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

    // 새 헤더 매핑 규칙 사용 (excel-header-mapper.ts)
    let headerMapping: Record<string, string> | null = null;
    switch (entity) {
      case 'items':
        headerMapping = itemsHeaderMapping;
        break;
      case 'companies':
        headerMapping = companiesHeaderMapping;
        break;
      case 'bom':
        headerMapping = bomHeaderMapping;
        break;
    }

    // 헤더 매핑 적용 (한글 헤더 → 영문 필드명)
    let mappedData: Record<string, any>[];
    if (headerMapping) {
      mappedData = mapExcelHeaders(rawData as Record<string, any>[], headerMapping);
    } else {
      // 기존 방식 사용 (하위 호환성)
      mappedData = rawData as Record<string, any>[];
    }

    // Convert Excel data using mapping (타입 변환 및 기본값 처리)
    let convertedData: Record<string, any>[];
    try {
      convertedData = convertExcelData(mappedData, mapping);
    } catch (error: unknown) {
      return NextResponse.json({
        success: false,
        error: `데이터 변환 오류: ${error instanceof Error ? error.message : String(error)}`
      }, { status: 400 });
    }

    // Validate data
    const validation = validateData(convertedData as Record<string, any>[], mapping);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: '데이터 유효성 검사 실패',
        details: validation.errors
      }, { status: 400 });
    }

    // Process data based on entity type
    let result;
    switch (entity) {
      case 'items':
        result = await processItemsData(convertedData as Record<string, any>[]);
        break;
      case 'companies':
        result = await processCompaniesData(convertedData as Record<string, any>[]);
        break;
      case 'bom':
        result = await processBomData(convertedData as Record<string, any>[]);
        break;
      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 엔티티입니다.'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        entity,
        totalProcessed: convertedData.length,
        successCount: result.insertedRecords.length,
        errorCount: result.errors.length,
        inserted: result.insertedRecords,
        errors: result.errors
      }
    });

  } catch (error) {
    const { entity } = await context.params;
    console.error(`Import error for ${entity}:`, error);
    return NextResponse.json({
      success: false,
      error: 'Excel 파일 처리 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
// Process items data
async function processItemsData(data: Record<string, any>[]): Promise<{ insertedRecords: unknown[]; errors: string[] }> {
  const supabase = getSupabaseClient() as any;
  const insertedRecords = [];
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as Record<string, any>;
    try {
      const itemData = {
        item_code: row.item_code,
        item_name: row.item_name,
        spec: row.spec || null,
        unit: row.unit,
        category: row.category || null,
        safety_stock: row.safety_stock || 0,
        current_stock: row.current_stock || 0,
        is_active: row.is_active !== false
      };

      const { data: result, error } = await supabase
        .from('items')
        .insert(itemData)
        .select()
        .single();

      if (error) {
        errors.push(`행 ${i + 1}: ${error.message}`);
        continue;
      }

      insertedRecords.push({
        action: 'upserted',
        row: i + 1,
        item_code: row.item_code,
        item_name: row.item_name
      });
    } catch (error: unknown) {
      errors.push(`행 ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { insertedRecords, errors };
}

// Process companies data
async function processCompaniesData(data: Record<string, any>[]): Promise<{ insertedRecords: unknown[]; errors: string[] }> {
  const supabase = getSupabaseClient() as any;
  const insertedRecords = [];
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as Record<string, any>;
    try {
      // Convert company type to English
      row.company_type = mapCompanyType(row.company_type);

      const companyData = {
        company_code: row.company_code,
        company_name: row.company_name,
        company_type: row.company_type,
        representative: row.representative || null,
        phone: row.phone || null,
        email: row.email || null,
        address: row.address || null,
        is_active: row.is_active !== false
      };

      const { data: result, error } = await supabase
        .from('companies')
        .insert(companyData)
        .select()
        .single();

      if (error) {
        errors.push(`행 ${i + 1}: ${error.message}`);
        continue;
      }

      insertedRecords.push({
        action: 'upserted',
        row: i + 1,
        company_code: row.company_code,
        company_name: row.company_name
      });
    } catch (error: unknown) {
      errors.push(`행 ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { insertedRecords, errors };
}


// Process BOM data
async function processBomData(data: Record<string, any>[]): Promise<{ insertedRecords: unknown[]; errors: string[] }> {
  const supabase = getSupabaseClient() as any;
  const insertedRecords = [];
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as Record<string, any>;
    try {
      // Get parent item ID
      const { data: parentItem, error: parentError } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_code', row.parent_item_code)
        .eq('is_active', true)
        .single();

      if (parentError || !parentItem) {
        errors.push(`행 ${i + 1}: 상위품목코드 '${row.parent_item_code}'를 찾을 수 없습니다.`);
        continue;
      }

      // Get child item ID
      const { data: childItem, error: childError } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_code', row.child_item_code)
        .eq('is_active', true)
        .single();

      if (childError || !childItem) {
        errors.push(`행 ${i + 1}: 하위품목코드 '${row.child_item_code}'를 찾을 수 없습니다.`);
        continue;
      }

      // Insert BOM relationship
      const bomData = {
        parent_item_id: parentItem.item_id,
        child_item_id: childItem.item_id,
        quantity_required: row.quantity,
        level_no: row.level_no || 1
      };

      const { data: result, error } = await supabase
        .from('bom')
        .insert(bomData)
        .select()
        .single();

      if (error) {
        errors.push(`행 ${i + 1}: ${error.message}`);
        continue;
      }

      insertedRecords.push({
        action: 'upserted',
        row: i + 1,
        parent_item_code: row.parent_item_code,
        child_item_code: row.child_item_code,
        quantity: row.quantity
      });

    } catch (error: unknown) {
      errors.push(`행 ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { insertedRecords, errors };
}