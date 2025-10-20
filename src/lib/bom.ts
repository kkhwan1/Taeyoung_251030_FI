/**
 * BOM Utility Functions
 * 순환 참조 검사, BOM 전개, 트리 구조 변환 등
 */

import { supabaseAdmin } from './db-unified';
import { mcp__supabase__execute_sql } from './supabase-mcp';

/**
 * BOM 구조 관련 타입 정의
 */
export interface BOMNode {
  bom_id: number;
  parent_item_id: number;
  child_item_id: number;
  item_code: string;
  item_name: string;
  spec?: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  total_price?: number;
  level: number;
  path?: string;
  accumulated_quantity?: number;
  notes?: string;
  children?: BOMNode[];
}

/**
 * BOM 순환 참조 검사 (CTE 사용)
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @param childId - 하위 품목 ID
 * @param excludeBomId - 제외할 BOM ID (수정 시 사용)
 * @returns 순환 참조 여부
 */
export async function checkBomCircular(
  conn: any,
  parentId: number,
  childId: number,
  excludeBomId?: number
): Promise<boolean> {
  try {
    // WITH RECURSIVE CTE를 사용하여 순환 참조 검사
    const sql = excludeBomId ? `
      WITH RECURSIVE bom_hierarchy AS (
        -- 초기값: 추가하려는 하위 품목에서 시작
        SELECT
          $1::int as check_item_id,
          child_item_id,
          parent_item_id,
          1 as depth,
          $2::text as path
        FROM bom
        WHERE parent_item_id = $3
          AND is_active = 1
          AND bom_id != $4

        UNION ALL

        -- 재귀: BOM 계층 따라가기
        SELECT
          bh.check_item_id,
          b.child_item_id,
          b.parent_item_id,
          bh.depth + 1,
          bh.path || ',' || b.child_item_id
        FROM bom b
        INNER JOIN bom_hierarchy bh ON b.parent_item_id = bh.child_item_id
        WHERE b.is_active = 1
          AND bh.depth < 20
          AND b.child_item_id != ALL(string_to_array(bh.path, ',')::int[])
          AND b.bom_id != $5
      )
      SELECT COUNT(*) as has_circular
      FROM bom_hierarchy
      WHERE child_item_id = $6
    ` : `
      WITH RECURSIVE bom_hierarchy AS (
        -- 초기값: 추가하려는 하위 품목에서 시작
        SELECT
          $1::int as check_item_id,
          child_item_id,
          parent_item_id,
          1 as depth,
          $2::text as path
        FROM bom
        WHERE parent_item_id = $3
          AND is_active = 1

        UNION ALL

        -- 재귀: BOM 계층 따라가기
        SELECT
          bh.check_item_id,
          b.child_item_id,
          b.parent_item_id,
          bh.depth + 1,
          bh.path || ',' || b.child_item_id
        FROM bom b
        INNER JOIN bom_hierarchy bh ON b.parent_item_id = bh.child_item_id
        WHERE b.is_active = 1
          AND bh.depth < 20
          AND b.child_item_id != ALL(string_to_array(bh.path, ',')::int[])
      )
      SELECT COUNT(*) as has_circular
      FROM bom_hierarchy
      WHERE child_item_id = $4
    `;

    const projectId = process.env.SUPABASE_PROJECT_ID || '';

    // Note: MCP doesn't support parameterized queries, so we use string interpolation
    // Params: [parentId, childId.toString(), childId, excludeBomId, excludeBomId, parentId]
    // or: [parentId, childId.toString(), childId, parentId]
    const sqlWithParams = excludeBomId
      ? sql.replace(/\$1/g, parentId.toString())
             .replace(/\$2/g, `'${childId.toString()}'`)
             .replace(/\$3/g, childId.toString())
             .replace(/\$4/g, excludeBomId.toString())
             .replace(/\$5/g, excludeBomId.toString())
             .replace(/\$6/g, parentId.toString())
      : sql.replace(/\$1/g, parentId.toString())
             .replace(/\$2/g, `'${childId.toString()}'`)
             .replace(/\$3/g, childId.toString())
             .replace(/\$4/g, parentId.toString());

    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: sqlWithParams
    });

    const rows = result.rows as Array<{has_circular: number}> | undefined;
    return (rows?.[0]?.has_circular || 0) > 0;

  } catch (error) {
    console.error('Error checking BOM circular reference:', error);
    // 오류 시 안전을 위해 순환 참조가 있다고 가정
    return true;
  }
}

/**
 * BOM 전개 (재귀적 조회)
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @param level - 현재 레벨 (재귀 깊이)
 * @param maxLevel - 최대 레벨 제한
 * @param parentQuantity - 부모의 수량 (누적 계산용)
 * @returns 전개된 BOM 노드 배열
 */
export async function explodeBom(
  conn: any,
  parentId: number,
  level: number = 0,
  maxLevel: number = 10,
  parentQuantity: number = 1
): Promise<BOMNode[]> {
  try {
    if (level >= maxLevel) {
      console.warn(`Max BOM level (${maxLevel}) reached for item ${parentId}`);
      return [];
    }

    // 현재 레벨의 BOM 항목 조회
    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const sql = `
      SELECT
        b.bom_id,
        b.parent_item_id,
        b.child_item_id,
        b.quantity,
        b.unit,
        b.notes,
        i.item_code,
        i.item_name,
        i.spec,
        i.unit_price
      FROM bom b
      INNER JOIN items i ON b.child_item_id = i.item_id
      WHERE b.parent_item_id = ${parentId}
        AND b.is_active = true
        AND i.is_active = true
      ORDER BY i.item_code
    `;

    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: sql
    });

    const rows = result.rows as Array<{
      bom_id: number;
      parent_item_id: number;
      child_item_id: number;
      quantity: number;
      unit: string | null;
      notes: string | null;
      item_code: string;
      item_name: string;
      spec: string | null;
      unit_price: number | null;
    }> | undefined;

    const nodes: BOMNode[] = [];

    for (const row of rows || []) {
      const accumulatedQuantity = row.quantity * parentQuantity;

      const node: BOMNode = {
        bom_id: row.bom_id,
        parent_item_id: row.parent_item_id,
        child_item_id: row.child_item_id,
        item_code: row.item_code,
        item_name: row.item_name,
        spec: row.spec || undefined,
        quantity: row.quantity,
        unit: row.unit || 'EA',
        unit_price: row.unit_price || 0,
        total_price: (row.unit_price || 0) * accumulatedQuantity,
        level: level + 1,
        accumulated_quantity: accumulatedQuantity,
        notes: row.notes || undefined
      };

      // 재귀적으로 하위 BOM 조회
      const children = await explodeBom(
        conn,
        row.child_item_id,
        level + 1,
        maxLevel,
        accumulatedQuantity
      );

      if (children.length > 0) {
        node.children = children;
      }

      nodes.push(node);
    }

    return nodes;

  } catch (error) {
    console.error('Error exploding BOM:', error);
    return [];
  }
}

/**
 * BOM 트리 구조로 변환
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @param includeInactive - 비활성 항목 포함 여부
 * @returns BOM 트리 구조
 */
export async function getBomTree(
  conn: any,
  parentId: number,
  includeInactive: boolean = false
): Promise<BOMNode | null> {
  try {
    // 상위 품목 정보 조회
    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const parentSql = `
      SELECT
        item_id,
        item_code,
        item_name,
        spec,
        unit_price
      FROM items
      WHERE item_id = ${parentId} ${includeInactive ? '' : 'AND is_active = true'}
    `;

    const parentResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: parentSql
    });

    const parentRows = parentResult.rows as Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      spec: string | null;
      unit_price: number | null;
    }> | undefined;

    if (!parentRows || parentRows.length === 0) {
      return null;
    }

    const parent = parentRows[0];

    // BOM 전개하여 하위 구조 가져오기
    const children = await explodeBom(conn, parentId, 0, 10, 1);

    const rootNode: BOMNode = {
      bom_id: 0,
      parent_item_id: 0,
      child_item_id: parent.item_id,
      item_code: parent.item_code,
      item_name: parent.item_name,
      spec: parent.spec || undefined,
      quantity: 1,
      unit: 'EA',
      unit_price: parent.unit_price || 0,
      total_price: parent.unit_price || 0,
      level: 0,
      accumulated_quantity: 1,
      children: children.length > 0 ? children : undefined
    };

    return rootNode;

  } catch (error) {
    console.error('Error getting BOM tree:', error);
    return null;
  }
}

/**
 * 최하위 품목들의 총 원가 계산
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @returns 총 원가
 */
export async function calculateTotalCost(
  conn: any,
  parentId: number
): Promise<number> {
  try {
    // WITH RECURSIVE를 사용하여 모든 최하위 품목과 수량 계산
    const sql = `
      WITH RECURSIVE bom_costs AS (
        -- 초기값: 직접 하위 품목
        SELECT
          b.child_item_id,
          b.quantity,
          b.quantity as accumulated_qty,
          i.unit_price,
          CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM bom b2
              WHERE b2.parent_item_id = b.child_item_id
                AND b2.is_active = 1
            ) THEN 1
            ELSE 0
          END as is_leaf
        FROM bom b
        INNER JOIN items i ON b.child_item_id = i.item_id
        WHERE b.parent_item_id = $1
          AND b.is_active = 1
          AND i.is_active = 1

        UNION ALL

        -- 재귀: 하위 품목들
        SELECT
          b.child_item_id,
          b.quantity,
          bc.accumulated_qty * b.quantity as accumulated_qty,
          i.unit_price,
          CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM bom b2
              WHERE b2.parent_item_id = b.child_item_id
                AND b2.is_active = 1
            ) THEN 1
            ELSE 0
          END as is_leaf
        FROM bom b
        INNER JOIN bom_costs bc ON b.parent_item_id = bc.child_item_id
        INNER JOIN items i ON b.child_item_id = i.item_id
        WHERE b.is_active = 1
          AND i.is_active = 1
          AND bc.is_leaf = 0
      )
      SELECT
        SUM(accumulated_qty * COALESCE(unit_price, 0)) as total_cost
      FROM bom_costs
      WHERE is_leaf = 1
    `;

    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const sqlWithParams = sql.replace(/\$1/g, parentId.toString());

    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: sqlWithParams
    });

    const rows = result.rows as Array<{total_cost: number | null}> | undefined;
    return rows?.[0]?.total_cost || 0;

  } catch (error) {
    console.error('Error calculating total cost:', error);
    return 0;
  }
}

/**
 * BOM 역전개 (Where-Used)
 * 특정 품목이 어느 상위 품목에 사용되는지 조회
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param childId - 하위 품목 ID
 * @returns 상위 품목 목록
 */
export async function getWhereUsed(
  conn: any,
  childId: number
): Promise<any[]> {
  try {
    const sql = `
      WITH RECURSIVE where_used AS (
        -- 초기값: 직접 상위 품목
        SELECT
          b.bom_id,
          b.parent_item_id,
          b.child_item_id,
          b.quantity,
          i.item_code,
          i.item_name,
          i.spec,
          1 as level,
          b.parent_item_id::text as path
        FROM bom b
        INNER JOIN items i ON b.parent_item_id = i.item_id
        WHERE b.child_item_id = $1
          AND b.is_active = 1
          AND i.is_active = 1

        UNION ALL

        -- 재귀: 상위의 상위 품목들
        SELECT
          b.bom_id,
          b.parent_item_id,
          b.child_item_id,
          b.quantity * wu.quantity as quantity,
          i.item_code,
          i.item_name,
          i.spec,
          wu.level + 1,
          wu.path || ',' || b.parent_item_id
        FROM bom b
        INNER JOIN where_used wu ON b.child_item_id = wu.parent_item_id
        INNER JOIN items i ON b.parent_item_id = i.item_id
        WHERE b.is_active = 1
          AND i.is_active = 1
          AND wu.level < 10
          AND b.parent_item_id != ALL(string_to_array(wu.path, ',')::int[])
      )
      SELECT * FROM where_used
      ORDER BY level, item_code
    `;

    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const sqlWithParams = sql.replace(/\$1/g, childId.toString());

    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: sqlWithParams
    });

    return result.rows || [];

  } catch (error) {
    console.error('Error getting where-used:', error);
    return [];
  }
}

/**
 * BOM 레벨별 요약 정보
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @returns 레벨별 품목 수와 원가 정보
 */
export async function getBomLevelSummary(
  conn: any,
  parentId: number
): Promise<any[]> {
  try {
    const sql = `
      WITH RECURSIVE bom_levels AS (
        -- 초기값
        SELECT
          b.child_item_id,
          b.quantity,
          b.quantity as accumulated_qty,
          1 as level,
          i.unit_price
        FROM bom b
        INNER JOIN items i ON b.child_item_id = i.item_id
        WHERE b.parent_item_id = $1
          AND b.is_active = 1
          AND i.is_active = 1

        UNION ALL

        -- 재귀
        SELECT
          b.child_item_id,
          b.quantity,
          bl.accumulated_qty * b.quantity,
          bl.level + 1,
          i.unit_price
        FROM bom b
        INNER JOIN bom_levels bl ON b.parent_item_id = bl.child_item_id
        INNER JOIN items i ON b.child_item_id = i.item_id
        WHERE b.is_active = 1
          AND i.is_active = 1
          AND bl.level < 10
      )
      SELECT
        level,
        COUNT(DISTINCT child_item_id) as item_count,
        SUM(accumulated_qty) as total_quantity,
        SUM(accumulated_qty * COALESCE(unit_price, 0)) as level_cost
      FROM bom_levels
      GROUP BY level
      ORDER BY level
    `;

    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const sqlWithParams = sql.replace(/\$1/g, parentId.toString());

    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: sqlWithParams
    });

    return result.rows || [];

  } catch (error) {
    console.error('Error getting BOM level summary:', error);
    return [];
  }
}

/**
 * BOM 유효성 검사
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @returns 유효성 검사 결과
 */
export async function validateBom(
  conn: any,
  parentId: number
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const projectId = process.env.SUPABASE_PROJECT_ID || '';

    // 1. 상위 품목 존재 확인
    const parentCheckSql = `
      SELECT item_id, item_code, item_name, is_active
      FROM items WHERE item_id = ${parentId}
    `;
    const parentCheckResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: parentCheckSql
    });

    const parentRows = parentCheckResult.rows as Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      is_active: boolean;
    }> | undefined;

    if (!parentRows || parentRows.length === 0) {
      errors.push(`상위 품목 ID ${parentId}가 존재하지 않습니다.`);
      return { valid: false, errors, warnings };
    }

    if (!parentRows[0].is_active) {
      warnings.push(`상위 품목 '${parentRows[0].item_code}'가 비활성 상태입니다.`);
    }

    // 2. 순환 참조 검사
    const circularCheckSql = `
      WITH RECURSIVE bom_check AS (
        SELECT child_item_id, parent_item_id, 1 as depth
        FROM bom
        WHERE parent_item_id = ${parentId} AND is_active = true

        UNION ALL

        SELECT b.child_item_id, b.parent_item_id, bc.depth + 1
        FROM bom b
        INNER JOIN bom_check bc ON b.parent_item_id = bc.child_item_id
        WHERE b.is_active = true AND bc.depth < 20
      )
      SELECT COUNT(*) as circular_count
      FROM bom_check
      WHERE child_item_id = ${parentId}
    `;

    const circularCheckResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: circularCheckSql
    });

    const circularRows = circularCheckResult.rows as Array<{circular_count: number}> | undefined;

    if (circularRows && circularRows.length > 0 && circularRows[0]?.circular_count > 0) {
      errors.push('BOM 구조에 순환 참조가 존재합니다.');
    }

    // 3. 비활성 하위 품목 확인
    const inactiveCheckSql = `
      SELECT i.item_code, i.item_name
      FROM bom b
      INNER JOIN items i ON b.child_item_id = i.item_id
      WHERE b.parent_item_id = ${parentId}
        AND b.is_active = true
        AND i.is_active = false
    `;

    const inactiveCheckResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: inactiveCheckSql
    });

    const inactiveRows = inactiveCheckResult.rows as Array<{
      item_code: string;
      item_name: string;
    }> | undefined;

    if (inactiveRows && inactiveRows.length > 0) {
      inactiveRows.forEach((item: Record<string, any>) => {
        warnings.push(`하위 품목 '${item.item_code} - ${item.item_name}'가 비활성 상태입니다.`);
      });
    }

    // 4. 중복 BOM 항목 확인
    const duplicateCheckSql = `
      SELECT child_item_id, COUNT(*) as cnt
      FROM bom
      WHERE parent_item_id = $1 AND is_active = 1
      GROUP BY child_item_id
      HAVING COUNT(*) > 1
    `;

    const duplicateResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: duplicateCheckSql
    });

    const duplicateRows = duplicateResult.rows as Array<{child_item_id: number}> | undefined;

    if (duplicateRows && duplicateRows.length > 0) {
      duplicateRows.forEach((item) => {
        errors.push(`하위 품목 ID ${item.child_item_id}에 대한 중복 BOM 항목이 존재합니다.`);
      });
    }

    // 5. 0 수량 확인
    const zeroQtyCheckSql = `
      SELECT i.item_code, i.item_name
      FROM bom b
      INNER JOIN items i ON b.child_item_id = i.item_id
      WHERE b.parent_item_id = $1
        AND b.is_active = 1
        AND (b.quantity IS NULL OR b.quantity <= 0)
    `;

    const zeroQtyResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: zeroQtyCheckSql.replace('$1', parentId.toString())
    });

    const zeroQtyRows = zeroQtyResult.rows as Array<{item_code: string, item_name: string}> | undefined;

    if (zeroQtyRows && zeroQtyRows.length > 0) {
      zeroQtyRows.forEach((item) => {
        errors.push(`품목 '${item.item_code} - ${item.item_name}'의 수량이 0 또는 NULL입니다.`);
      });
    }

    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings
    };

  } catch (error) {
    console.error('Error validating BOM:', error);
    errors.push(`BOM 유효성 검사 중 오류 발생: ${error}`);
    return {
      valid: false,
      errors,
      warnings
    };
  }
}