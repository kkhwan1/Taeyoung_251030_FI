import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-unified';
import {
  handleError,
  createSuccessResponse,
  handleNotFoundError,
  handleValidationError,
  ErrorType,
  ERPError
} from '@/lib/errorHandler';
import { errorLoggingManager } from '@/lib/errorLogger';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 특정 아이템 조회
 * GET /api/items/[id]
 */
export async function GET(
  request: NextRequest,
  routeContext: RouteContext
) {
  const context = {
    resource: 'items',
    action: 'read',
    userId: request.headers.get('x-user-id') || undefined,
    requestId: request.headers.get('x-request-id') || undefined
  };

  try {
    const { id } = await routeContext.params;
    const itemId = parseInt(id);

    // ID 유효성 검사
    if (isNaN(itemId) || itemId <= 0) {
      return handleValidationError(['유효하지 않은 아이템 ID입니다'], context);
    }

    const sql = `
      SELECT
        item_id, item_code, item_name, item_type, car_model, spec,
        unit, current_stock, min_stock_level, unit_price, location,
        description, is_active, created_at, updated_at, safety_stock
      FROM items
      WHERE item_id = ? AND is_active = 1
    `;

    const items = await query<any[]>(sql, [itemId]);

    if (items.length === 0) {
      return handleNotFoundError('아이템', itemId, context);
    }

    return createSuccessResponse(items[0], '아이템을 성공적으로 조회했습니다');
  } catch (error) {
    return handleError(error, context);
  }
}

/**
 * 아이템 수정
 * PUT /api/items/[id]
 */
export async function PUT(
  request: NextRequest,
  routeContext: RouteContext
) {
  const context = {
    resource: 'items',
    action: 'update',
    userId: request.headers.get('x-user-id') || undefined,
    requestId: request.headers.get('x-request-id') || undefined
  };

  try {
    const { id } = await routeContext.params;
    const itemId = parseInt(id);

    // ID 유효성 검사
    if (isNaN(itemId) || itemId <= 0) {
      return handleValidationError(['유효하지 않은 아이템 ID입니다'], context);
    }

    // 요청 본문 파싱 (한글 지원)
    const text = await request.text();
    const body = JSON.parse(text);

    // 필수 필드 검사
    const requiredFields = ['item_name', 'unit'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return handleValidationError(
        missingFields.map(field => `${field}는 필수 입력 항목입니다`),
        context
      );
    }

    // 아이템 존재 여부 확인
    const existsCheck = await query<any[]>(
      'SELECT item_id FROM items WHERE item_id = ? AND is_active = 1',
      [itemId]
    );

    if (existsCheck.length === 0) {
      return handleNotFoundError('아이템', itemId, context);
    }

    // 중복 코드 검사 (다른 아이템이 같은 코드 사용)
    if (body.item_code) {
      const duplicateCheck = await query<{ item_id: number }>(
        'SELECT item_id FROM items WHERE item_code = ? AND item_id != ? AND is_active = 1',
        [body.item_code, itemId]
      );

      if (Array.isArray(duplicateCheck) && duplicateCheck.length > 0) {
        throw new ERPError(
          ErrorType.DUPLICATE_ENTRY,
          '다른 아이템이 이미 해당 코드를 사용 중입니다',
          { item_code: body.item_code, existing_item_id: duplicateCheck[0].item_id },
          context
        );
      }
    }

    // 업데이트 가능한 필드들
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    const allowedFields = [
      'item_code', 'item_name', 'item_type', 'car_model', 'spec',
      'unit', 'min_stock_level', 'unit_price', 'location', 'description', 'safety_stock'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(body[field]);
      }
    });

    if (updateFields.length === 0) {
      throw new ERPError(
        ErrorType.VALIDATION,
        '업데이트할 필드가 없습니다',
        { provided_fields: Object.keys(body) },
        context
      );
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(itemId);

    const updateSql = `
      UPDATE items
      SET ${updateFields.join(', ')}
      WHERE item_id = ? AND is_active = 1
    `;

    const result = await query(updateSql, updateValues);

    if ((result as any).affectedRows === 0) {
      return handleNotFoundError('아이템', itemId, context);
    }

    // 업데이트된 아이템 정보 조회
    const updatedItem = await query<any[]>(
      `SELECT item_id, item_code, item_name, item_type, car_model, spec,
       unit, current_stock, min_stock_level, unit_price, location,
       description, safety_stock, updated_at
       FROM items WHERE item_id = ?`,
      [itemId]
    );

    return createSuccessResponse(
      updatedItem[0],
      '아이템이 성공적으로 수정되었습니다'
    );
  } catch (error) {
    return handleError(error, context);
  }
}

/**
 * 아이템 삭제 (소프트 삭제)
 * DELETE /api/items/[id]
 */
export async function DELETE(
  request: NextRequest,
  routeContext: RouteContext
) {
  const context = {
    resource: 'items',
    action: 'delete',
    userId: request.headers.get('x-user-id') || undefined,
    requestId: request.headers.get('x-request-id') || undefined
  };

  try {
    const { id } = await routeContext.params;
    const itemId = parseInt(id);

    // ID 유효성 검사
    if (isNaN(itemId) || itemId <= 0) {
      return handleValidationError(['유효하지 않은 아이템 ID입니다'], context);
    }

    // 아이템 존재 여부 확인
    const existsCheck = await query<{ item_id: number; item_code: string; item_name: string }>(
      'SELECT item_id, item_code, item_name FROM items WHERE item_id = ? AND is_active = 1',
      [itemId]
    );

    if (!Array.isArray(existsCheck) || existsCheck.length === 0) {
      return handleNotFoundError('아이템', itemId, context);
    }

    const item = existsCheck[0];

    // BOM에서 사용 중인지 확인
    const bomCheck = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM bom WHERE parent_item_id = ? OR child_item_id = ?',
      [itemId, itemId]
    );

    if (Array.isArray(bomCheck) && bomCheck.length > 0 && bomCheck[0].count > 0) {
      throw new ERPError(
        ErrorType.DATABASE_CONSTRAINT,
        'BOM에서 사용 중인 아이템은 삭제할 수 없습니다',
        {
          item_id: itemId,
          item_code: item.item_code,
          bom_usage_count: bomCheck[0].count
        },
        context
      );
    }

    // 재고 이동 기록이 있는지 확인
    const transactionCheck = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM inventory_transactions WHERE item_id = ?',
      [itemId]
    );

    if (Array.isArray(transactionCheck) && transactionCheck.length > 0 && transactionCheck[0].count > 0) {
      throw new ERPError(
        ErrorType.DATABASE_CONSTRAINT,
        '재고 이동 기록이 있는 아이템은 삭제할 수 없습니다',
        {
          item_id: itemId,
          item_code: item.item_code,
          transaction_count: transactionCheck[0].count
        },
        context
      );
    }

    // 소프트 삭제 실행
    const deleteSql = `
      UPDATE items
      SET is_active = 0, updated_at = NOW()
      WHERE item_id = ? AND is_active = 1
    `;

    const result = await query(deleteSql, [itemId]);

    if ((result as any).affectedRows === 0) {
      return handleNotFoundError('아이템', itemId, context);
    }

    return createSuccessResponse(
      { item_id: itemId, item_code: item.item_code },
      '아이템이 성공적으로 삭제되었습니다'
    );
  } catch (error) {
    return handleError(error, context);
  }
}