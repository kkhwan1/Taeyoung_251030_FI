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
import { getSupabaseClient, handleSupabaseError, createSuccessResponse } from '@/lib/db-unified';
import * as XLSX from 'xlsx';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BOMExcelRow {
  parent_item_code: string;
  child_item_code: string;
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
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    if (rawData.length === 0) {
      return {
        valid: false,
        data: [],
        errors: [{ row: 0, field: 'file', message: 'Excel 파일에 데이터가 없습니다' }],
        stats: { total_rows: 0, valid_rows: 0, error_rows: 0 }
      };
    }

    // Validate each row
    rawData.forEach((row, index) => {
      const rowNumber = index + 2; // Excel row number (1-indexed + header)
      const rowErrors: ValidationError[] = [];

      // Required fields validation
      if (!row.parent_item_code || String(row.parent_item_code).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'parent_item_code',
          message: '부모 품목 코드가 필요합니다',
          value: row.parent_item_code
        });
      }

      if (!row.child_item_code || String(row.child_item_code).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'child_item_code',
          message: '자식 품목 코드가 필요합니다',
          value: row.child_item_code
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
          notes: row.notes ? String(row.notes).trim() : undefined
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
        total_rows: rawData.length,
        valid_rows: validData.length,
        error_rows: errors.length > 0 ? rawData.length - validData.length : 0
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
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
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

    // Validate file type
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

    // 3. Validate item codes exist in database
    const supabase = getSupabaseClient();

    const itemCodes = new Set([
      ...parseResult.data.map(row => row.parent_item_code),
      ...parseResult.data.map(row => row.child_item_code)
    ]);

    const { data: items, error: itemError } = await supabase
      .from('items')
      .select('item_code, item_id, item_name')
      .in('item_code', Array.from(itemCodes))
      .eq('is_active', true) as any;

    if (itemError) {
      return NextResponse.json(
        {
          success: false,
          error: '품목 조회 실패',
          details: itemError.message
        },
        { status: 500 }
      );
    }

    // Build item code to ID mapping
    const itemCodeMap = new Map<string, { item_id: number; item_name: string }>(
      items?.map((i: any) => [i.item_code, { item_id: i.item_id, item_name: i.item_name }]) || []
    );

    // Check for missing item codes
    const missingCodes: string[] = [];
    itemCodes.forEach(code => {
      if (!itemCodeMap.has(code)) {
        missingCodes.push(code);
      }
    });

    if (missingCodes.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '존재하지 않는 품목 코드',
          details: {
            missing_codes: missingCodes,
            message: `다음 품목 코드가 데이터베이스에 없습니다: ${missingCodes.join(', ')}`
          }
        },
        { status: 400 }
      );
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
    const bomInserts = parseResult.data.map(row => ({
      parent_item_id: itemCodeMap.get(row.parent_item_code)!.item_id,
      child_item_id: itemCodeMap.get(row.child_item_code)!.item_id,
      quantity_required: row.quantity_required,
      level_no: row.level_no || 1,
      is_active: true
    }));

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
      `) as any;

    if (insertError) {
      console.error('Database insert error:', insertError);
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
    return NextResponse.json(
      {
        success: false,
        error: 'BOM 업로드 실패',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
