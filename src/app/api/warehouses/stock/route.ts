import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { APIError, validateRequiredFields } from '@/lib/api-error-handler';
import type { Database } from '@/types/supabase';

type WarehouseStockRow = Database['public']['Tables']['warehouse_stock']['Row'];
type WarehouseStockInsert = Database['public']['Tables']['warehouse_stock']['Insert'];
type WarehouseStockUpdate = Database['public']['Tables']['warehouse_stock']['Update'];
type InventoryTransactionInsert = Database['public']['Tables']['inventory_transactions']['Insert'];

type WarehouseStockWithRelations = WarehouseStockRow & {
  warehouses?: {
    warehouse_code: string | null;
    warehouse_name: string | null;
    warehouse_type: Database['public']['Enums']['warehouse_type'] | null;
  } | null;
  items?: {
    item_code: string | null;
    item_name: string | null;
    spec: string | null;
    unit: string | null;
  } | null;
};

const DEFAULT_USER_ID = 1;

type ParsedStockStatus = '재고부족' | '재고과다' | '정상';

function parseJsonBody<T>(request: NextRequest): Promise<T> {
  return request
    .json()
    .catch(() => {
      throw new APIError('요청 본문을 파싱할 수 없습니다. JSON 형식을 확인해주세요.', 400);
    });
}

function handleRouteError(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof APIError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  console.error('[warehouses/stock] Unexpected error:', error);
  return NextResponse.json(
    {
      success: false,
      error: fallbackMessage,
    },
    { status: 500 }
  );
}

function parseOptionalNumber(value: string | null, field: string): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new APIError(`${field} 파라미터가 올바르지 않습니다.`, 400, { value });
  }

  return numeric;
}

function ensureNumber(value: unknown, field: string): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    throw new APIError(`${field} 값이 올바르지 않습니다.`, 400, { value });
  }

  return numeric;
}

function calculateAvailableQuantity(stock: Pick<WarehouseStockRow, 'current_quantity' | 'reserved_quantity' | 'available_quantity'>): number {
  if (stock.available_quantity !== null && stock.available_quantity !== undefined) {
    return Number(stock.available_quantity);
  }

  const current = stock.current_quantity ?? 0;
  const reserved = stock.reserved_quantity ?? 0;
  return Math.max(0, current - reserved);
}

function determineStockStatus(current: number, min: number, max: number): ParsedStockStatus {
  if (max > 0 && current >= max) {
    return '재고과다';
  }

  if (current <= min) {
    return '재고부족';
  }

  return '정상';
}

function formatStockRow(row: WarehouseStockWithRelations) {
  const current = row.current_quantity ?? 0;
  const reserved = row.reserved_quantity ?? 0;
  const min = row.min_stock ?? 0;
  const max = row.max_stock ?? 0;
  const available = calculateAvailableQuantity(row);

  return {
    id: row.warehouse_stock_id,
    warehouse_stock_id: row.warehouse_stock_id,
    warehouse_id: row.warehouse_id,
    warehouse_code: row.warehouses?.warehouse_code ?? null,
    warehouse_name: row.warehouses?.warehouse_name ?? null,
    warehouse_type: row.warehouses?.warehouse_type ?? null,
    item_id: row.item_id,
    item_code: row.items?.item_code ?? null,
    item_name: row.items?.item_name ?? null,
    specification: row.items?.spec ?? null,
    unit: row.items?.unit ?? null,
    current_quantity: current,
    reserved_quantity: reserved,
    available_quantity: available,
    location_code: row.location_code,
    min_stock: min,
    max_stock: max,
    last_in_date: row.last_in_date,
    last_out_date: row.last_out_date,
    stock_status: determineStockStatus(current, min, max),
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const warehouseId = parseOptionalNumber(searchParams.get('warehouseId'), 'warehouseId');
    const itemId = parseOptionalNumber(searchParams.get('itemId'), 'itemId');
    const statusFilter = searchParams.get('status');

    let query = supabase
      .from('warehouse_stock')
      .select(
        `
        warehouse_stock_id,
        warehouse_id,
        item_id,
        current_quantity,
        reserved_quantity,
        available_quantity,
        location_code,
        min_stock,
        max_stock,
        last_in_date,
        last_out_date,
        warehouses:warehouses(warehouse_code, warehouse_name, warehouse_type),
        items:items(item_code, item_name, spec, unit)
      `
      );

    if (warehouseId !== null) {
      query = query.eq('warehouse_id', warehouseId);
    }

    if (itemId !== null) {
      query = query.eq('item_id', itemId);
    }

    query = query.order('warehouse_id', { ascending: true }).order('item_id', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new APIError('창고 재고 정보를 조회하지 못했습니다.', 500, error.message);
    }

    const stocks = (data ?? []).map((stock) => formatStockRow(stock as WarehouseStockWithRelations));

    const filtered = statusFilter
      ? stocks.filter((stock) => stock.stock_status === statusFilter)
      : stocks;

    const summary = {
      totalWarehouses: new Set(filtered.map((stock) => stock.warehouse_id)).size,
      totalItems: new Set(filtered.map((stock) => stock.item_id)).size,
      totalQuantity: filtered.reduce((sum, stock) => sum + stock.current_quantity, 0),
      totalReserved: filtered.reduce((sum, stock) => sum + stock.reserved_quantity, 0),
      totalAvailable: filtered.reduce((sum, stock) => sum + stock.available_quantity, 0),
      stockStatusCount: {
        재고부족: filtered.filter((stock) => stock.stock_status === '재고부족').length,
        재고과다: filtered.filter((stock) => stock.stock_status === '재고과다').length,
        정상: filtered.filter((stock) => stock.stock_status === '정상').length,
      },
    };

    return NextResponse.json({
      success: true,
      data: filtered,
      summary,
    });
  } catch (error) {
    return handleRouteError(error, '창고 재고 정보를 조회하지 못했습니다.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await parseJsonBody<Record<string, unknown>>(request);
    const validationErrors = validateRequiredFields(payload, [
      'warehouse_id',
      'item_id',
      'min_stock',
      'max_stock',
    ]);

    if (validationErrors.length > 0) {
      throw new APIError('필수 입력값을 확인해주세요.', 400, validationErrors);
    }

    const warehouseId = ensureNumber(payload.warehouse_id, 'warehouse_id');
    const itemId = ensureNumber(payload.item_id, 'item_id');
    const minStock = ensureNumber(payload.min_stock, 'min_stock');
    const maxStock = ensureNumber(payload.max_stock, 'max_stock');

    if (minStock < 0 || maxStock < 0) {
      throw new APIError('재고 임계값은 0 이상의 값이어야 합니다.', 400);
    }

    if (maxStock > 0 && minStock > maxStock) {
      throw new APIError('최소 재고는 최대 재고보다 클 수 없습니다.', 400);
    }

    const locationCode = payload.location_code ? String(payload.location_code).trim() : null;
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { data: existing, error: existingError } = await supabase
      .from('warehouse_stock')
      .select('warehouse_stock_id, current_quantity, reserved_quantity, available_quantity')
      .eq('warehouse_id', warehouseId)
      .eq('item_id', itemId)
      .maybeSingle();

    if (existingError) {
      throw new APIError('창고 재고 정보를 확인하지 못했습니다.', 500, existingError.message);
    }

    if (existing) {
      const updatePayload: WarehouseStockUpdate = {
        location_code: locationCode,
        min_stock: minStock,
        max_stock: maxStock,
        updated_at: now,
      };

      const { error: updateError } = await supabase
        .from('warehouse_stock')
        .update(updatePayload)
        .eq('warehouse_stock_id', existing.warehouse_stock_id);

      if (updateError) {
        throw new APIError('창고 재고 정보를 수정하지 못했습니다.', 500, updateError.message);
      }
    } else {
      const insertPayload: WarehouseStockInsert = {
        warehouse_id: warehouseId,
        item_id: itemId,
        location_code: locationCode,
        min_stock: minStock,
        max_stock: maxStock,
        current_quantity: 0,
        reserved_quantity: 0,
        available_quantity: 0,
        created_at: now,
        updated_at: now,
        last_in_date: null,
        last_out_date: null,
      };

      const { error: insertError } = await supabase
        .from('warehouse_stock')
        .insert(insertPayload);

      if (insertError) {
        throw new APIError('창고 재고 정보를 생성하지 못했습니다.', 500, insertError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: '창고 재고 설정이 저장되었습니다.',
    });
  } catch (error) {
    return handleRouteError(error, '창고 재고 설정 저장 중 오류가 발생했습니다.');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await parseJsonBody<Record<string, unknown>>(request);
    const validationErrors = validateRequiredFields(payload, [
      'from_warehouse_id',
      'to_warehouse_id',
      'item_id',
      'quantity',
    ]);

    if (validationErrors.length > 0) {
      throw new APIError('필수 입력값을 확인해주세요.', 400, validationErrors);
    }

    const fromWarehouseId = ensureNumber(payload.from_warehouse_id, 'from_warehouse_id');
    const toWarehouseId = ensureNumber(payload.to_warehouse_id, 'to_warehouse_id');
    const itemId = ensureNumber(payload.item_id, 'item_id');
    const quantity = ensureNumber(payload.quantity, 'quantity');

    if (quantity <= 0) {
      throw new APIError('이동 수량은 0보다 커야 합니다.', 400);
    }

    if (fromWarehouseId === toWarehouseId) {
      throw new APIError('동일한 창고 간에는 재고를 이동할 수 없습니다.', 400);
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { data: source, error: sourceError } = await supabase
      .from('warehouse_stock')
      .select('warehouse_stock_id, current_quantity, reserved_quantity, available_quantity')
      .eq('warehouse_id', fromWarehouseId)
      .eq('item_id', itemId)
      .maybeSingle();

    if (sourceError) {
      throw new APIError('출고 창고 재고를 확인하지 못했습니다.', 500, sourceError.message);
    }

    if (!source) {
      throw new APIError('출고 창고에 재고 정보가 없습니다.', 400);
    }

    const sourceAvailable = calculateAvailableQuantity(source);

    if (sourceAvailable < quantity) {
      throw new APIError('출고 창고의 가용 재고가 부족합니다.', 400);
    }

    const updatedSourceCurrent = Math.max(0, (source.current_quantity ?? 0) - quantity);
    const updatedSourceAvailable = Math.max(0, sourceAvailable - quantity);

    const { error: updateSourceError } = await supabase
      .from('warehouse_stock')
      .update({
        current_quantity: updatedSourceCurrent,
        available_quantity: updatedSourceAvailable,
        last_out_date: now,
        updated_at: now,
      })
      .eq('warehouse_stock_id', source.warehouse_stock_id);

    if (updateSourceError) {
      throw new APIError('출고 창고 재고를 갱신하지 못했습니다.', 500, updateSourceError.message);
    }

    const { data: target, error: targetError } = await supabase
      .from('warehouse_stock')
      .select('warehouse_stock_id, current_quantity, reserved_quantity, available_quantity')
      .eq('warehouse_id', toWarehouseId)
      .eq('item_id', itemId)
      .maybeSingle();

    if (targetError) {
      throw new APIError('입고 창고 재고를 확인하지 못했습니다.', 500, targetError.message);
    }

    const targetAvailable = target ? calculateAvailableQuantity(target) : 0;
    const targetCurrent = target?.current_quantity ?? 0;
    const updatedTargetCurrent = targetCurrent + quantity;
    const updatedTargetAvailable = targetAvailable + quantity;

    if (target) {
      const { error: updateTargetError } = await supabase
        .from('warehouse_stock')
        .update({
          current_quantity: updatedTargetCurrent,
          available_quantity: updatedTargetAvailable,
          last_in_date: now,
          updated_at: now,
        })
        .eq('warehouse_stock_id', target.warehouse_stock_id);

      if (updateTargetError) {
        throw new APIError('입고 창고 재고를 갱신하지 못했습니다.', 500, updateTargetError.message);
      }
    } else {
      const insertPayload: WarehouseStockInsert = {
        warehouse_id: toWarehouseId,
        item_id: itemId,
        current_quantity: quantity,
        available_quantity: quantity,
        reserved_quantity: 0,
        min_stock: 0,
        max_stock: null,
        location_code: null,
        last_in_date: now,
        created_at: now,
        updated_at: now,
      };

      const { error: insertTargetError } = await supabase
        .from('warehouse_stock')
        .insert(insertPayload);

      if (insertTargetError) {
        throw new APIError('입고 창고 재고를 생성하지 못했습니다.', 500, insertTargetError.message);
      }
    }

    const creator = payload.created_by ?? payload.user_id ?? DEFAULT_USER_ID;
    const createdBy = ensureNumber(creator, 'created_by');
    const note = payload.note ? String(payload.note).trim() : null;

    const transactionPayload: InventoryTransactionInsert = {
      transaction_date: now,
      transaction_type: '이동',
      item_id: itemId,
      quantity,
      warehouse_id: toWarehouseId,
      notes: note ?? `창고 ${fromWarehouseId} -> ${toWarehouseId} 이동`,
      created_at: now,
      created_by: createdBy,
    };

    const { error: transactionError } = await supabase
      .from('inventory_transactions')
      .insert(transactionPayload);

    if (transactionError) {
      throw new APIError('재고 이동 이력을 기록하지 못했습니다.', 500, transactionError.message);
    }

    return NextResponse.json({
      success: true,
      message: `${quantity}개의 재고가 이동되었습니다.`,
    });
  } catch (error) {
    return handleRouteError(error, '재고 이동 처리 중 오류가 발생했습니다.');
  }
}


