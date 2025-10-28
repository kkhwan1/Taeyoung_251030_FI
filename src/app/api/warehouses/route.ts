import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { ERPError, ErrorType, handleError as handleErrorResponse } from '@/lib/errorHandler';
import type { Database } from '@/types/supabase';

type WarehouseRow = Database['public']['Tables']['warehouses']['Row'];
type WarehouseInsert = Database['public']['Tables']['warehouses']['Insert'];
type WarehouseUpdate = Database['public']['Tables']['warehouses']['Update'];

type WarehouseWithUser = WarehouseRow & {
  users?: {
    name?: string | null;
  } | null;
};

const DEFAULT_USER_ID = 1;

function parseJsonBody<T>(request: NextRequest): Promise<T> {
  return request
    .json()
    .catch(() => {
      throw new ERPError(ErrorType.VALIDATION, '요청 본문을 파싱할 수 없습니다. JSON 형식을 확인해주세요.');
    });
}

function normalizeBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'y', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'n', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  throw new ERPError(ErrorType.VALIDATION, '올바르지 않은 boolean 값이 전달되었습니다.');
}

function toOptionalNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new ERPError(ErrorType.VALIDATION, `${field} 값이 올바르지 않습니다.`);
  }

  return numeric;
}

function mapWarehouse(row: WarehouseWithUser) {
  const maxCapacity = row.max_capacity ?? 0;
  const currentUsage = row.current_usage ?? 0;
  const usagePercentage = maxCapacity > 0
    ? Math.round((currentUsage / maxCapacity) * 10000) / 100
    : 0;

  return {
    ...row,
    created_by_name: row.users?.name ?? null,
    usage_percentage: usagePercentage,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const warehouseType = searchParams.get('type');
    const activeParam = searchParams.get('active');
    const filterActiveOnly = activeParam !== 'false';

    let query = supabase
      .from('warehouses')
      .select(
        `
        warehouse_id,
        warehouse_code,
        warehouse_name,
        warehouse_type,
        address,
        manager_name,
        manager_phone,
        max_capacity,
        current_usage,
        temperature_controlled,
        is_active,
        created_at,
        updated_at,
        created_by,
        users:users(name)
      `
      );

    if (filterActiveOnly) {
      query = query.eq('is_active', true);
    }

    if (warehouseType) {
      query = query.eq('warehouse_type', warehouseType as NonNullable<WarehouseInsert['warehouse_type']>);
    }

    query = query.order('warehouse_code', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const warehouses = (data ?? []).map((warehouse) =>
      mapWarehouse(warehouse as WarehouseWithUser)
    );

    return NextResponse.json({
      success: true,
      data: warehouses,
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'warehouses', action: 'read' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    const payload = JSON.parse(text) as Partial<WarehouseInsert>;

    // Validate required fields
    const missingFields = [];
    if (!payload.warehouse_code) missingFields.push('warehouse_code');
    if (!payload.warehouse_name) missingFields.push('warehouse_name');
    if (!payload.warehouse_type) missingFields.push('warehouse_type');

    if (missingFields.length > 0) {
      throw new ERPError(ErrorType.VALIDATION, `필수 입력값을 확인해주세요: ${missingFields.join(', ')}`);
    }

    const warehouseCode = String(payload.warehouse_code).trim();
    const warehouseName = String(payload.warehouse_name).trim();
    const warehouseType = payload.warehouse_type as WarehouseInsert['warehouse_type'];
    const temperatureControlled = payload.temperature_controlled !== undefined
      ? normalizeBoolean(payload.temperature_controlled)
      : null;
    const maxCapacity = toOptionalNumber(payload.max_capacity, 'max_capacity');
    const currentUsage = toOptionalNumber(payload.current_usage, 'current_usage');

    const supabase = getSupabaseClient();

    const { data: duplicate, error: duplicateError } = await supabase
      .from('warehouses')
      .select('warehouse_id')
      .eq('warehouse_code', warehouseCode)
      .maybeSingle();

    if (duplicateError) {
      throw duplicateError;
    }

    if (duplicate) {
      throw new ERPError(ErrorType.CONFLICT, '이미 사용 중인 창고 코드입니다.');
    }

    const now = new Date().toISOString();
    const newWarehouse: WarehouseInsert = {
      warehouse_code: warehouseCode,
      warehouse_name: warehouseName,
      warehouse_type: warehouseType,
      address: payload.address ?? null,
      manager_name: payload.manager_name ?? null,
      manager_phone: payload.manager_phone ?? null,
      temperature_controlled: temperatureControlled,
      max_capacity: maxCapacity,
      current_usage: currentUsage ?? 0,
      is_active: true,
      created_at: now,
      updated_at: now,
      created_by: payload.created_by ?? DEFAULT_USER_ID,
    };

    const { data, error } = await supabase
      .from('warehouses')
      .insert(newWarehouse)
      .select(
        `
        warehouse_id,
        warehouse_code,
        warehouse_name,
        warehouse_type,
        address,
        manager_name,
        manager_phone,
        max_capacity,
        current_usage,
        temperature_controlled,
        is_active,
        created_at,
        updated_at,
        created_by,
        users:users(name)
      `
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '창고를 등록하지 못했습니다.');
    }

    return NextResponse.json({
      success: true,
      data: mapWarehouse(data as WarehouseWithUser),
      message: '창고가 성공적으로 등록되었습니다.',
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'warehouses', action: 'create' });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const text = await request.text();
    const payload = JSON.parse(text) as Record<string, unknown>;
    const warehouseId = toOptionalNumber(payload.id ?? payload.warehouse_id, 'warehouse_id');

    if (!warehouseId || !Number.isInteger(warehouseId)) {
      throw new ERPError(ErrorType.VALIDATION, '창고 ID가 올바르지 않습니다.');
    }

    const updatedFields: WarehouseUpdate = {};

    if (payload.warehouse_code !== undefined) {
      updatedFields.warehouse_code = String(payload.warehouse_code).trim();
    }
    if (payload.warehouse_name !== undefined) {
      updatedFields.warehouse_name = String(payload.warehouse_name).trim();
    }
    if (payload.warehouse_type !== undefined) {
      updatedFields.warehouse_type = payload.warehouse_type as WarehouseUpdate['warehouse_type'];
    }
    if (payload.address !== undefined) {
      updatedFields.address = payload.address ? String(payload.address) : null;
    }
    if (payload.manager_name !== undefined) {
      updatedFields.manager_name = payload.manager_name ? String(payload.manager_name) : null;
    }
    if (payload.manager_phone !== undefined) {
      updatedFields.manager_phone = payload.manager_phone ? String(payload.manager_phone) : null;
    }
    if (payload.temperature_controlled !== undefined) {
      updatedFields.temperature_controlled = normalizeBoolean(payload.temperature_controlled);
    }
    if (payload.max_capacity !== undefined) {
      updatedFields.max_capacity = toOptionalNumber(payload.max_capacity, 'max_capacity');
    }
    if (payload.current_usage !== undefined) {
      updatedFields.current_usage = toOptionalNumber(payload.current_usage, 'current_usage');
    }
    if (payload.is_active !== undefined) {
      const active = normalizeBoolean(payload.is_active);
      if (active === null) {
        throw new ERPError(ErrorType.VALIDATION, 'is_active 값이 올바르지 않습니다.');
      }
      updatedFields.is_active = active;
    }

    if (Object.keys(updatedFields).length === 0) {
      throw new ERPError(ErrorType.VALIDATION, '수정할 값이 없습니다.');
    }

    const supabase = getSupabaseClient();

    if (updatedFields.warehouse_code) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('warehouses')
        .select('warehouse_id')
        .eq('warehouse_code', updatedFields.warehouse_code)
        .neq('warehouse_id', warehouseId)
        .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (duplicate) {
        throw new ERPError(ErrorType.CONFLICT, '이미 사용 중인 창고 코드입니다.');
      }
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('warehouses')
      .update({
        ...updatedFields,
        updated_at: now,
      })
      .eq('warehouse_id', warehouseId)
      .select(
        `
        warehouse_id,
        warehouse_code,
        warehouse_name,
        warehouse_type,
        address,
        manager_name,
        manager_phone,
        max_capacity,
        current_usage,
        temperature_controlled,
        is_active,
        created_at,
        updated_at,
        created_by,
        users:users(name)
      `
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '수정 대상 창고를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      data: mapWarehouse(data as WarehouseWithUser),
      message: '창고 정보가 수정되었습니다.',
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'warehouses', action: 'update' });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const idParam = request.nextUrl.searchParams.get('id');

    if (!idParam) {
      throw new ERPError(ErrorType.VALIDATION, '창고 ID가 필요합니다.');
    }

    const warehouseId = Number(idParam);

    if (!Number.isInteger(warehouseId)) {
      throw new ERPError(ErrorType.VALIDATION, '창고 ID가 올바르지 않습니다.');
    }

    const supabase = getSupabaseClient();

    const { count, error: stockError } = await supabase
      .from('warehouse_stock')
      .select('warehouse_stock_id', { head: true, count: 'exact' })
      .eq('warehouse_id', warehouseId)
      .gt('current_quantity', 0);

    if (stockError) {
      throw stockError;
    }

    if ((count ?? 0) > 0) {
      throw new ERPError(ErrorType.BUSINESS_RULE, '재고가 남아 있는 창고는 비활성화할 수 없습니다.');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('warehouses')
      .update({
        is_active: false,
        updated_at: now,
      })
      .eq('warehouse_id', warehouseId)
      .select('warehouse_id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ERPError(ErrorType.NOT_FOUND, '대상 창고를 찾을 수 없습니다.');
    }

    return NextResponse.json({
      success: true,
      message: '창고가 비활성화되었습니다.',
    });
  } catch (error) {
    return handleErrorResponse(error, { resource: 'warehouses', action: 'delete' });
  }
}
