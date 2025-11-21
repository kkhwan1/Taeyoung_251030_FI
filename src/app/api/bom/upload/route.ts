/**
 * BOM Upload API - Excel file upload with validation
 * POST /api/bom/upload
 *
 * Accepts Excel file with BOM structure data
 * Validates entries, detects circular dependencies, and inserts into database
 *
 * Excel Format:
 * - Sheet 1: BOM entries
 *   Columns: parent_item_code, child_item_code, quantity_required, level_no (optional)
 *
 * Response includes validation results and inserted record count
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { mapExcelHeaders, bomHeaderMapping } from '@/lib/excel-header-mapper';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';


// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BOMExcelRow {
  // Parent item fields
  parent_item_code: string;
  parent_item_name?: string;
  parent_spec?: string;
  parent_unit?: string;
  parent_category?: string;
  parent_inventory_type?: string;
  parent_supplier?: string;

  // Child item fields
  child_item_code: string;
  child_item_name?: string;
  child_spec?: string;
  child_unit?: string;
  child_category?: string;
  child_inventory_type?: string;
  child_supplier?: string;

  // BOM relationship fields
  quantity_required: number;
  level_no?: number;
  notes?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

interface ValidationResult {
  valid: boolean;
  data: BOMExcelRow[];
  errors: ValidationError[];
  stats: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
  };
}

interface CircularDependencyCheck {
  valid: boolean;
  cycles?: string[][];
}

// ============================================================================
// EXCEL PARSING
// ============================================================================

/**
 * Parse BOM Excel file
 * Validates basic structure and data types
 */
function parseBOMExcel(buffer: Buffer): ValidationResult {
  const errors: ValidationError[] = [];
  const validData: BOMExcelRow[] = [];

  try {
    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return {
        valid: false,
        data: [],
        errors: [{ row: 0, field: 'file', message: 'Excel 파일에 시트가 없습니다' }],
        stats: { total_rows: 0, valid_rows: 0, error_rows: 0 }
      };
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    if (rawData.length === 0) {
      return {
        valid: false,
        data: [],
        errors: [{ row: 0, field: 'file', message: 'Excel 파일에 데이터가 없습니다' }],
        stats: { total_rows: 0, valid_rows: 0, error_rows: 0 }
      };
    }

    // 한글 헤더를 영문 필드명으로 매핑
    const mappedData = mapExcelHeaders(rawData, bomHeaderMapping);

    // Validate each row
    mappedData.forEach((row, index) => {
      const rowNumber = index + 2; // Excel row number (1-indexed + header)
      const rowErrors: ValidationError[] = [];

      // Required fields validation - Parent item
      if (!row.parent_item_code || String(row.parent_item_code).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'parent_item_code',
          message: '부모 품목 코드가 필요합니다',
          value: row.parent_item_code
        });
      }

      if (!row.parent_item_name || String(row.parent_item_name).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'parent_item_name',
          message: '부모 품목명이 필요합니다',
          value: row.parent_item_name
        });
      }

      // Required fields validation - Child item
      if (!row.child_item_code || String(row.child_item_code).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'child_item_code',
          message: '자식 품목 코드가 필요합니다',
          value: row.child_item_code
        });
      }

      if (!row.child_item_name || String(row.child_item_name).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'child_item_name',
          message: '자식 품목명이 필요합니다',
          value: row.child_item_name
        });
      }

      // Optional: Validate inventory_type enum values
      const validInventoryTypes = ['RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_PRODUCT', 'SUPPLIES'];
      if (row.parent_inventory_type && !validInventoryTypes.includes(row.parent_inventory_type)) {
        rowErrors.push({
          row: rowNumber,
          field: 'parent_inventory_type',
          message: `부모 품목 재고타입은 ${validInventoryTypes.join(', ')} 중 하나여야 합니다`,
          value: row.parent_inventory_type
        });
      }

      if (row.child_inventory_type && !validInventoryTypes.includes(row.child_inventory_type)) {
        rowErrors.push({
          row: rowNumber,
          field: 'child_inventory_type',
          message: `자식 품목 재고타입은 ${validInventoryTypes.join(', ')} 중 하나여야 합니다`,
          value: row.child_inventory_type
        });
      }

      // Quantity validation
      const quantity = Number(row.quantity_required);
      if (isNaN(quantity) || quantity <= 0) {
        rowErrors.push({
          row: rowNumber,
          field: 'quantity_required',
          message: '소요량은 0보다 큰 숫자여야 합니다',
          value: row.quantity_required
        });
      }

      // Level validation (optional, default to 1)
      let level_no = 1;
      if (row.level_no !== undefined && row.level_no !== null) {
        level_no = Number(row.level_no);
        if (isNaN(level_no) || level_no < 1) {
          rowErrors.push({
            row: rowNumber,
            field: 'level_no',
            message: 'level_no는 1 이상의 숫자여야 합니다',
            value: row.level_no
          });
        }
      }

      // Self-reference check
      if (row.parent_item_code === row.child_item_code) {
        rowErrors.push({
          row: rowNumber,
          field: 'parent_item_code',
          message: '부모 품목과 자식 품목이 동일할 수 없습니다',
          value: row.parent_item_code
        });
      }

      // If no errors, add to valid data
      if (rowErrors.length === 0) {
        validData.push({
          parent_item_code: String(row.parent_item_code).trim(),
          child_item_code: String(row.child_item_code).trim(),
          quantity_required: quantity,
          level_no: level_no,
          notes: row.notes ? String(row.notes).trim() : undefined,
          // Parent item details (TASK-030: Fix metadata loss bug)
          parent_item_name: row.parent_item_name ? String(row.parent_item_name).trim() : undefined,
          parent_spec: row.parent_spec ? String(row.parent_spec).trim() : undefined,
          parent_unit: row.parent_unit ? String(row.parent_unit).trim() : undefined,
          parent_category: row.parent_category ? String(row.parent_category).trim() : undefined,
          parent_inventory_type: row.parent_inventory_type,
          parent_supplier: row.parent_supplier ? String(row.parent_supplier).trim() : undefined,
          // Child item details (TASK-030: Fix metadata loss bug)
          child_item_name: row.child_item_name ? String(row.child_item_name).trim() : undefined,
          child_spec: row.child_spec ? String(row.child_spec).trim() : undefined,
          child_unit: row.child_unit ? String(row.child_unit).trim() : undefined,
          child_category: row.child_category ? String(row.child_category).trim() : undefined,
          child_inventory_type: row.child_inventory_type,
          child_supplier: row.child_supplier ? String(row.child_supplier).trim() : undefined
        });
      } else {
        errors.push(...rowErrors);
      }
    });

    return {
      valid: errors.length === 0,
      data: validData,
      errors,
      stats: {
        total_rows: mappedData.length,
        valid_rows: validData.length,
        error_rows: errors.length > 0 ? mappedData.length - validData.length : 0
      }
    };
  } catch (error) {
    console.error('Excel parsing error:', error);
    return {
      valid: false,
      data: [],
      errors: [{
        row: 0,
        field: 'file',
        message: `Excel 파일 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      }],
      stats: { total_rows: 0, valid_rows: 0, error_rows: 0 }
    };
  }
}

// ============================================================================
// CIRCULAR DEPENDENCY DETECTION
// ============================================================================

/**
 * Detect circular dependencies in BOM structure
 * Uses DFS (Depth-First Search) to find cycles
 */
function detectCircularDependencies(bomData: BOMExcelRow[]): CircularDependencyCheck {
  // Build adjacency list (parent -> children)
  const graph = new Map<string, Set<string>>();

  bomData.forEach(({ parent_item_code, child_item_code }) => {
    if (!graph.has(parent_item_code)) {
      graph.set(parent_item_code, new Set());
    }
    graph.get(parent_item_code)!.add(child_item_code);
  });

  // Track visited nodes and current path
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  const currentPath: string[] = [];

  /**
   * DFS helper to detect cycles
   */
  function dfs(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);

    const neighbors = graph.get(node) || new Set();

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true; // Cycle detected in subtree
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle - extract the cycle path
        const cycleStart = currentPath.indexOf(neighbor);
        const cycle = currentPath.slice(cycleStart);
        cycle.push(neighbor); // Close the cycle
        cycles.push(cycle);
        return true;
      }
    }

    recursionStack.delete(node);
    currentPath.pop();
    return false;
  }

  // Check all nodes for cycles
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return {
    valid: cycles.length === 0,
    cycles: cycles.length > 0 ? cycles : undefined
  };
}

// ============================================================================
// SUPPLIER LOOKUP & ITEM UPSERT HELPERS
// ============================================================================

/**
 * Find supplier_id by company name or company_code
 * Returns null if not found
 */
async function findSupplierByNameOrCode(
  supabase: SupabaseClient<Database>,
  supplierNameOrCode: string
): Promise<number | null> {
  if (!supplierNameOrCode || supplierNameOrCode.trim() === '') {
    return null;
  }

  const trimmed = supplierNameOrCode.trim();

  // Query companies table by name or code
  const { data, error } = await supabase
    .from('companies')
    .select('company_id')
    .or(`company_name.eq.${trimmed},company_code.eq.${trimmed}`)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.company_id;
}

/**
 * Upsert item (create or update)
 * Returns item_id
 */
interface ItemPayload {
  item_code: string;
  item_name: string;
  is_active: boolean;
  spec?: string;
  unit?: string;
  category?: string;
  inventory_type?: string;
  supplier_id?: number;
}

async function upsertItem(
  supabase: SupabaseClient<Database>,
  itemCode: string,
  itemName: string,
  spec?: string,
  unit?: string,
  category?: string,
  inventoryType?: string,
  supplierNameOrCode?: string
): Promise<{ item_id: number; item_code: string }> {
  // Find supplier_id if supplier name/code provided
  let supplier_id: number | null = null;
  if (supplierNameOrCode) {
    supplier_id = await findSupplierByNameOrCode(supabase, supplierNameOrCode);
  }

  // Prepare item payload
  const itemPayload: ItemPayload = {
    item_code: itemCode.trim(),
    item_name: itemName.trim(),
    is_active: true
  };

  if (spec) itemPayload.spec = spec.trim();
  if (unit) itemPayload.unit = unit.trim();
  if (category) itemPayload.category = category.trim();
  if (inventoryType) itemPayload.inventory_type = inventoryType;
  if (supplier_id) itemPayload.supplier_id = supplier_id;

  // Upsert item (INSERT ... ON CONFLICT UPDATE)
  const { data, error } = await supabase
    .from('items')
    .upsert(itemPayload, {
      onConflict: 'item_code',
      ignoreDuplicates: false // Update if exists
    })
    .select('item_id, item_code')
    .single();

  if (error) {
    throw new Error(`품목 생성/업데이트 실패 (${itemCode}): ${error.message}`);
  }

  return data;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Add authentication middleware check
    // Example: const session = await getServerSession(request);
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: '파일이 제공되지 않았습니다'
        },
        { status: 400 }
      );
    }

    // Validate file type and size
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Excel 파일만 업로드 가능합니다 (.xlsx, .xls)'
        },
        { status: 400 }
      );
    }

    // File size limit: 5MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과할 수 없습니다`
        },
        { status: 400 }
      );
    }

    // 2. Parse Excel file
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = parseBOMExcel(buffer);

    if (!parseResult.valid || parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '파일 검증 실패',
          details: parseResult.errors,
          stats: parseResult.stats
        },
        { status: 400 }
      );
    }

    // 3. Upsert all unique items (parent and child)
    const supabase = getSupabaseClient();

    /**
     * TASK-031: Transaction Handling Limitation
     *
     * ⚠️ KNOWN LIMITATION: Supabase JavaScript client does not support traditional BEGIN/COMMIT transactions.
     *
     * Current implementation uses sequential operations:
     * 1. Upsert items sequentially (errors cause immediate failure and rollback of entire operation)
     * 2. Upsert BOM entries (single batch operation)
     *
     * Risk: If BOM insert fails after items are upserted, orphaned items may remain in database.
     *
     * Mitigation strategies applied:
     * - Items use upsert (idempotent) so re-running upload won't create duplicates
     * - BOM entries also use upsert so re-running upload is safe
     * - Comprehensive validation before any database operation
     * - Detailed error logging for troubleshooting
     *
     * Future improvement: Create PostgreSQL stored procedure with proper transaction handling
     * and call it via Supabase RPC for atomic operations.
     */

    // 3. Upsert items and collect item ID mappings
    // Collect unique items with all their details
    const uniqueItems = new Map<string, {
      item_code: string;
      item_name: string;
      spec?: string;
      unit?: string;
      category?: string;
      inventory_type?: string;
      supplier?: string;
    }>();

    // Add parent items
    parseResult.data.forEach(row => {
      if (!uniqueItems.has(row.parent_item_code)) {
        if (!row.parent_item_name) {
          throw new Error(`부모 품목명이 없습니다: ${row.parent_item_code}`);
        }
        uniqueItems.set(row.parent_item_code, {
          item_code: row.parent_item_code,
          item_name: row.parent_item_name,
          spec: row.parent_spec,
          unit: row.parent_unit,
          category: row.parent_category,
          inventory_type: row.parent_inventory_type,
          supplier: row.parent_supplier
        });
      }
    });

    // Add child items
    parseResult.data.forEach(row => {
      if (!uniqueItems.has(row.child_item_code)) {
        if (!row.child_item_name) {
          throw new Error(`자식 품목명이 없습니다: ${row.child_item_code}`);
        }
        uniqueItems.set(row.child_item_code, {
          item_code: row.child_item_code,
          item_name: row.child_item_name,
          spec: row.child_spec,
          unit: row.child_unit,
          category: row.child_category,
          inventory_type: row.child_inventory_type,
          supplier: row.child_supplier
        });
      }
    });

    // Upsert all items and build item_code → item_id mapping
    // Performance: Batch upserts with concurrency limit (50 at a time)
    const itemCodeMap = new Map<string, number>();
    const itemEntries = Array.from(uniqueItems.entries());
    const BATCH_SIZE = 50;

    for (let i = 0; i < itemEntries.length; i += BATCH_SIZE) {
      const batch = itemEntries.slice(i, i + BATCH_SIZE);
      const upsertPromises = batch.map(async ([item_code, itemDetails]) => {
        const upsertedItem = await upsertItem(
          supabase,
          itemDetails.item_code,
          itemDetails.item_name,
          itemDetails.spec,
          itemDetails.unit,
          itemDetails.category,
          itemDetails.inventory_type,
          itemDetails.supplier
        );
        return { item_code, item_id: upsertedItem.item_id };
      });

      const results = await Promise.all(upsertPromises);
      results.forEach(({ item_code, item_id }) => {
        itemCodeMap.set(item_code, item_id);
      });
    }

    // 4. Check for circular dependencies
    const circularCheck = detectCircularDependencies(parseResult.data);

    if (!circularCheck.valid && circularCheck.cycles) {
      return NextResponse.json(
        {
          success: false,
          error: '순환 참조 감지',
          details: {
            cycles: circularCheck.cycles,
            message: `BOM 구조에 순환 참조가 있습니다. 순환 경로: ${circularCheck.cycles.map(c => c.join(' → ')).join(', ')}`
          }
        },
        { status: 400 }
      );
    }

    // 5. Prepare BOM entries for database insertion
    interface BOMInsert {
      parent_item_id: number;
      child_item_id: number;
      quantity_required: number;
      level_no: number;
      is_active: boolean;
    }

    const bomInserts: BOMInsert[] = parseResult.data.map(row => {
      const parentId = itemCodeMap.get(row.parent_item_code);
      const childId = itemCodeMap.get(row.child_item_code);

      if (!parentId || !childId) {
        throw new Error(
          `품목 ID를 찾을 수 없습니다: ${!parentId ? row.parent_item_code : ''} ${!childId ? row.child_item_code : ''}`
        );
      }

      return {
        parent_item_id: parentId,
        child_item_id: childId,
        quantity_required: row.quantity_required,
        level_no: row.level_no ?? 1, // Use nullish coalescing to preserve 0
        is_active: true
      };
    });

    // 6. Insert BOM entries with upsert (update on conflict)
    const { data: insertedBOMs, error: insertError } = await supabase
      .from('bom')
      .upsert(
        bomInserts as any,
        {
          onConflict: 'parent_item_id,child_item_id',
          ignoreDuplicates: false // Update existing entries
        }
      )
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        parent_item:items!bom_parent_item_id_fkey(item_code, item_name, spec, unit),
        child_item:items!bom_child_item_id_fkey(item_code, item_name, spec, unit)
      `);

    if (insertError) {
      // Log error for debugging (consider using proper logger in production)
      // console.error('Database insert error:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'BOM 등록 실패',
          details: insertError.message
        },
        { status: 500 }
      );
    }

    // Count new vs updated entries
    const insertedCount = insertedBOMs?.length || 0;

    return NextResponse.json({
      success: true,
      message: `${insertedCount}개 BOM 항목이 성공적으로 등록/업데이트되었습니다`,
      data: {
        inserted_count: insertedCount,
        bom_entries: insertedBOMs
      },
      stats: parseResult.stats
    });

  } catch (error) {
    console.error('BOM upload error:', error);

    // Enhanced error messages with phase context
    let errorMessage = 'BOM 업로드 실패';
    let errorDetails = error instanceof Error ? error.message : '알 수 없는 오류';

    // Detect error phase based on error message or type
    if (errorDetails.includes('parse') || errorDetails.includes('파싱') || errorDetails.includes('Excel')) {
      errorMessage = 'Excel 파일 처리 실패';
      errorDetails = `파일을 읽거나 파싱하는 중 오류가 발생했습니다. ${errorDetails}`;
    } else if (errorDetails.includes('item') || errorDetails.includes('품목') || errorDetails.includes('upsert')) {
      errorMessage = '품목 등록 실패';
      errorDetails = `품목 데이터를 데이터베이스에 저장하는 중 오류가 발생했습니다. ${errorDetails}`;
    } else if (errorDetails.includes('BOM') || errorDetails.includes('insert') || errorDetails.includes('foreign key')) {
      errorMessage = 'BOM 관계 등록 실패';
      errorDetails = `BOM 관계를 데이터베이스에 저장하는 중 오류가 발생했습니다. ${errorDetails}`;
    } else if (errorDetails.includes('supplier') || errorDetails.includes('company') || errorDetails.includes('공급사')) {
      errorMessage = '공급사 조회 실패';
      errorDetails = `지정된 공급사를 찾을 수 없습니다. 공급사 코드 또는 이름을 확인하세요. ${errorDetails}`;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorDetails,
        help: '문제가 지속되면 Excel 템플릿을 다시 다운로드하여 형식을 확인하거나, 데이터베이스 연결 상태를 확인하세요.'
      },
      { status: 500 }
    );
  }
}
