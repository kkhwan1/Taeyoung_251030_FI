# 병렬 구현 계획서 (Parallel Implementation Plan)

**프로젝트**: FITaeYoungERP
**작성일**: 2025년 2월 1일
**현재 완성도**: 80% → 목표 100%
**예상 소요 시간**: 30시간 (순차 4일) → **18-22시간 (병렬 2-3일)**

---

## 📋 Executive Summary

### 병렬화 전략
순차적 우선순위 방식(Priority #1 → #2 → #3)을 **5개 독립 실행 스트림**으로 재구성하여 총 소요 시간을 **40% 단축** (4일 → 2.5일)

### 핵심 인사이트
- **Critical Path**: Database (Stream A) → API (Stream B) → Frontend (Stream C) - 16시간
- **Independent Streams**: Enhancements (Stream D) + Quality (Stream E) - 병렬 실행 가능
- **Time Savings**: 12시간 절감 (30시간 → 18-22시간)

---

## 🔍 의존성 분석 (Dependency Analysis)

### 의존성 매트릭스

| Stream | 의존 관계 | 시작 가능 시점 | 소요 시간 |
|--------|----------|--------------|----------|
| **A: Database** | 없음 (즉시 시작) | Day 1, Hour 0 | 4시간 |
| **B: API Layer** | Stream A 완료 후 | Day 1, Hour 4 | 8시간 |
| **C: Frontend** | Stream B 완료 후 | Day 2, Hour 4 | 4시간 |
| **D: Enhancements** | 없음 (즉시 시작) | Day 1, Hour 0 | 8시간 |
| **E: Code Quality** | 없음 (즉시 시작) | Day 1, Hour 0 | 6시간 |

### Critical Path
```
Stream A (4h) → Stream B (8h) → Stream C (4h) = 16시간 (Critical Path)
```

### 병렬 실행 가능 조합
```
Day 1:
  Track 1: Stream A (4h) → Stream B (8h) → (대기)
  Track 2: Stream D (8h) → (완료)
  Track 3: Stream E (6h) → (완료)

Day 2:
  Track 1: Stream B 완료 (4h) → Stream C (4h)
```

**총 소요 시간**: 20시간 (2.5일) vs 순차 30시간 (4일) = **33% 시간 단축**

---

## 🚀 Work Stream 정의

## Stream A: Database Schema Changes (재고 분류 스키마)

### 📌 우선순위: CRITICAL (모든 것의 기반)
### ⏱️ 예상 소요: 4시간
### 👤 담당: Database Specialist
### 🔗 의존성: 없음 (즉시 시작 가능)

### 구현 내용

#### 1. Migration 파일 생성 (1시간)
**파일**: `supabase/migrations/20250202_add_inventory_classification.sql`

```sql
-- ============================================
-- Migration: Add Inventory Classification
-- Purpose: Support 4 inventory types (완제품/반제품/고객재고/원재료)
-- Author: ERP Team
-- Date: 2025-02-02
-- ============================================

-- Step 1: Add new columns to items table
ALTER TABLE items
ADD COLUMN inventory_type TEXT
CHECK (inventory_type IN ('완제품', '반제품', '고객재고', '원재료'));

ALTER TABLE items
ADD COLUMN warehouse_zone TEXT;

ALTER TABLE items
ADD COLUMN quality_status TEXT DEFAULT '검수중'
CHECK (quality_status IN ('검수중', '합격', '불합격', '보류'));

COMMENT ON COLUMN items.inventory_type IS '재고 분류: 완제품/반제품/고객재고/원재료';
COMMENT ON COLUMN items.warehouse_zone IS '보관 구역 (예: A-01, B-03)';
COMMENT ON COLUMN items.quality_status IS '품질 검수 상태';

-- Step 2: Create indexes for performance
CREATE INDEX idx_items_inventory_type ON items(inventory_type)
WHERE is_active = true;

CREATE INDEX idx_items_warehouse_zone ON items(warehouse_zone)
WHERE is_active = true;

CREATE INDEX idx_items_quality_status ON items(quality_status)
WHERE is_active = true;

-- Step 3: Migrate existing data based on product_type
UPDATE items
SET inventory_type = CASE
  WHEN product_type = 'FINISHED' THEN '완제품'
  WHEN product_type = 'SEMI_FINISHED' THEN '반제품'
  WHEN category = 'RAW_MATERIAL' THEN '원재료'
  ELSE '반제품'  -- Default for uncertain cases
END
WHERE inventory_type IS NULL;

-- Step 4: Make inventory_type NOT NULL after migration
ALTER TABLE items ALTER COLUMN inventory_type SET NOT NULL;

-- Step 5: Add validation trigger for quality workflows
CREATE OR REPLACE FUNCTION validate_inventory_classification()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure finished goods have quality status
  IF NEW.inventory_type = '완제품' AND NEW.quality_status IS NULL THEN
    NEW.quality_status := '검수중';
  END IF;

  -- Customer stock must have warehouse zone
  IF NEW.inventory_type = '고객재고' AND NEW.warehouse_zone IS NULL THEN
    RAISE EXCEPTION '고객재고는 보관 구역이 필수입니다';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_inventory_classification
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION validate_inventory_classification();
```

#### 2. Migration 검증 (1시간)
```bash
# Local test first
npm run db:migrate:up

# Verify schema changes
npm run db:check-schema

# Test queries
psql -c "SELECT inventory_type, COUNT(*) FROM items GROUP BY inventory_type;"
```

#### 3. Production 적용 (1시간)
```bash
# Backup first
supabase db dump --data-only > backup_before_classification.sql

# Apply migration
supabase db push

# Verify production
supabase db remote-query "SELECT COUNT(*) FROM items WHERE inventory_type IS NULL;"
# Expected: 0 rows
```

#### 4. TypeScript 타입 생성 (1시간)
```bash
npm run db:types
```

**출력 검증**:
```typescript
// src/types/database.types.ts should now include:
export type InventoryType = '완제품' | '반제품' | '고객재고' | '원재료';
export type QualityStatus = '검수중' | '합격' | '불합격' | '보류';

export interface ItemsRow {
  // ... existing fields
  inventory_type: InventoryType;
  warehouse_zone: string | null;
  quality_status: QualityStatus;
}
```

### 완료 기준
- ✅ Migration 파일 생성 및 테스트 완료
- ✅ 모든 기존 items 레코드에 inventory_type 할당됨 (NULL 없음)
- ✅ 인덱스 생성 완료 (쿼리 성능 확인)
- ✅ TypeScript 타입 정의 생성됨
- ✅ Production 데이터베이스 적용 완료

### Stream B로의 전달사항
- `inventory_type` 컬럼 사용 가능
- TypeScript 타입 정의 경로: `@/types/database.types.ts`
- CHECK 제약조건: 4가지 값만 허용

---

## Stream B: API Layer Updates (Domain Helpers & Validation)

### 📌 우선순위: HIGH (Frontend의 기반)
### ⏱️ 예상 소요: 8시간
### 👤 담당: Backend Developer
### 🔗 의존성: Stream A 완료 필수

### 구현 내용

#### 1. Domain Helper 확장 (3시간)
**파일**: `src/lib/db-unified.ts` (Lines 400-500 추가)

```typescript
// ============================================
// ItemDomainHelpers Extension: Inventory Classification
// ============================================

export class ItemDomainHelpers {
  // ... existing methods

  /**
   * 재고 분류별 품목 조회
   * @param inventoryType - 완제품/반제품/고객재고/원재료
   * @param options - QueryOptions (filters, pagination, orderBy)
   */
  async getByInventoryType(
    inventoryType: InventoryType,
    options?: QueryOptions
  ): Promise<ItemsRow[]> {
    const result = await this.queryBuilder.select('items', {
      filters: {
        inventory_type: inventoryType,
        is_active: true
      },
      ...options
    });

    return result.data || [];
  }

  /**
   * 재고 분류 통계 조회
   * @returns Array of { type, count, total_stock, total_value }
   */
  async getInventoryClassificationStats(): Promise<{
    type: InventoryType;
    count: number;
    total_stock: number;
    total_value: number;
  }[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('items')
      .select('inventory_type, current_stock, unit_price')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get inventory stats: ${error.message}`);
    }

    // Aggregate by inventory_type
    const statsMap = new Map<InventoryType, {
      type: InventoryType;
      count: number;
      total_stock: number;
      total_value: number;
    }>();

    data.forEach(item => {
      const type = item.inventory_type;
      if (!statsMap.has(type)) {
        statsMap.set(type, {
          type,
          count: 0,
          total_stock: 0,
          total_value: 0
        });
      }

      const stats = statsMap.get(type)!;
      stats.count++;
      stats.total_stock += item.current_stock || 0;
      stats.total_value += (item.current_stock || 0) * (item.unit_price || 0);
    });

    return Array.from(statsMap.values());
  }

  /**
   * 보관 구역별 품목 조회
   * @param warehouseZone - 구역 코드 (예: A-01)
   */
  async getByWarehouseZone(
    warehouseZone: string,
    options?: QueryOptions
  ): Promise<ItemsRow[]> {
    const result = await this.queryBuilder.select('items', {
      filters: {
        warehouse_zone: warehouseZone,
        is_active: true
      },
      ...options
    });

    return result.data || [];
  }

  /**
   * 품질 검수 상태별 품목 조회
   * @param qualityStatus - 검수중/합격/불합격/보류
   */
  async getByQualityStatus(
    qualityStatus: QualityStatus,
    options?: QueryOptions
  ): Promise<ItemsRow[]> {
    const result = await this.queryBuilder.select('items', {
      filters: {
        quality_status: qualityStatus,
        is_active: true
      },
      ...options
    });

    return result.data || [];
  }
}
```

#### 2. Validation Schema 업데이트 (2시간)
**파일**: `src/lib/validation.ts` (Lines 100-150 추가)

```typescript
import { z } from 'zod';

// ============================================
// Inventory Classification Schemas
// ============================================

export const InventoryTypeSchema = z.enum([
  '완제품',
  '반제품',
  '고객재고',
  '원재료'
]);

export const QualityStatusSchema = z.enum([
  '검수중',
  '합격',
  '불합격',
  '보류'
]);

// Extend existing ItemCreateSchema
export const ItemCreateSchema = z.object({
  // ... existing fields
  item_name: z.string().min(1),
  item_code: z.string().min(1),

  // NEW: Required inventory classification
  inventory_type: InventoryTypeSchema,

  // NEW: Optional warehouse zone (required for 고객재고)
  warehouse_zone: z.string().optional(),

  // NEW: Quality status (defaults to 검수중)
  quality_status: QualityStatusSchema.default('검수중'),

}).refine(
  (data) => {
    // Validation: 고객재고 requires warehouse_zone
    if (data.inventory_type === '고객재고' && !data.warehouse_zone) {
      return false;
    }
    return true;
  },
  {
    message: '고객재고는 보관 구역이 필수입니다',
    path: ['warehouse_zone']
  }
);

export const ItemUpdateSchema = ItemCreateSchema.partial();

// Query parameter schema for filtering
export const InventoryFilterSchema = z.object({
  inventory_type: InventoryTypeSchema.optional(),
  warehouse_zone: z.string().optional(),
  quality_status: QualityStatusSchema.optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});
```

#### 3. 새 API 엔드포인트 생성 (3시간)

**파일 1**: `src/app/api/inventory/classification/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { db, createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';
import { InventoryFilterSchema } from '@/lib/validation';

/**
 * GET /api/inventory/classification
 * Purpose: Get inventory classification statistics and filtered items
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    // Validate query parameters
    const validation = InventoryFilterSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }

    const { inventory_type, warehouse_zone, quality_status, page, limit } = validation.data;

    // Get statistics
    const stats = await db.items.getInventoryClassificationStats();

    // Get filtered items if specific type requested
    let items = [];
    if (inventory_type) {
      items = await db.items.getByInventoryType(inventory_type, {
        pagination: page && limit ? {
          page: parseInt(page),
          limit: parseInt(limit)
        } : undefined,
        orderBy: { field: 'item_name', ascending: true }
      });
    }

    return createSuccessResponse({
      stats,
      items,
      filters: { inventory_type, warehouse_zone, quality_status }
    });

  } catch (error) {
    return handleSupabaseError('select', 'inventory classification', error);
  }
}

/**
 * POST /api/inventory/classification/update
 * Purpose: Bulk update inventory classifications
 */
export async function POST(request: Request) {
  try {
    const text = await request.text();
    const { item_ids, inventory_type, warehouse_zone } = JSON.parse(text);

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'item_ids 배열이 필요합니다' },
        { status: 400 }
      );
    }

    // Bulk update
    const supabase = getSupabaseClient();
    const updateData: any = {};
    if (inventory_type) updateData.inventory_type = inventory_type;
    if (warehouse_zone) updateData.warehouse_zone = warehouse_zone;

    const { data, error } = await supabase
      .from('items')
      .update(updateData)
      .in('item_id', item_ids)
      .select();

    if (error) {
      return handleSupabaseError('update', 'items', error);
    }

    return createSuccessResponse({
      updated_count: data.length,
      items: data
    });

  } catch (error) {
    return handleSupabaseError('update', 'inventory classification', error);
  }
}
```

**파일 2**: `src/app/api/items/route.ts` 업데이트 (기존 파일 수정)

```typescript
// Add query parameter handling for inventory_type filter
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inventory_type = searchParams.get('inventory_type');
    const warehouse_zone = searchParams.get('warehouse_zone');

    let items;

    if (inventory_type) {
      // Use new Domain Helper method
      items = await db.items.getByInventoryType(inventory_type as InventoryType);
    } else if (warehouse_zone) {
      items = await db.items.getByWarehouseZone(warehouse_zone);
    } else {
      // Existing logic for all items
      items = await db.items.getAll();
    }

    return createSuccessResponse({ items });
  } catch (error) {
    return handleSupabaseError('select', 'items', error);
  }
}
```

### 완료 기준
- ✅ 4개 새 Domain Helper 메서드 테스트 완료
- ✅ Validation 스키마로 잘못된 입력 차단 확인
- ✅ `/api/inventory/classification` 엔드포인트 작동 확인
- ✅ 기존 `/api/items` 엔드포인트에 필터 추가 완료
- ✅ Postman/Thunder Client로 API 테스트 완료

### Stream C로의 전달사항
- API 엔드포인트: `GET /api/inventory/classification`
- 필터 지원: `?inventory_type=완제품&page=1&limit=20`
- 응답 형식: `{ stats: [...], items: [...], filters: {...} }`

---

## Stream C: Frontend UI Components (재고 분류 UI)

### 📌 우선순위: HIGH (사용자에게 보이는 부분)
### ⏱️ 예상 소요: 4시간
### 👤 담당: Frontend Developer
### 🔗 의존성: Stream B 완료 필수

### 구현 내용

#### 1. 품목 등록/수정 폼에 분류 필드 추가 (1.5시간)
**파일**: `src/components/ItemForm.tsx` (기존 파일 수정)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { InventoryType, QualityStatus } from '@/types/database.types';

export default function ItemForm({ item, onSave, onCancel }: ItemFormProps) {
  const [formData, setFormData] = useState({
    item_name: item?.item_name || '',
    item_code: item?.item_code || '',
    inventory_type: item?.inventory_type || '반제품' as InventoryType,
    warehouse_zone: item?.warehouse_zone || '',
    quality_status: item?.quality_status || '검수중' as QualityStatus,
    // ... existing fields
  });

  const [showWarehouseZone, setShowWarehouseZone] = useState(
    formData.inventory_type === '고객재고'
  );

  useEffect(() => {
    setShowWarehouseZone(formData.inventory_type === '고객재고');
  }, [formData.inventory_type]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Existing fields: item_name, item_code, etc. */}

      {/* NEW: Inventory Classification */}
      <div className="space-y-1">
        <label className="text-sm font-medium">
          재고 분류 <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.inventory_type}
          onChange={(e) => setFormData({
            ...formData,
            inventory_type: e.target.value as InventoryType
          })}
          className="w-full px-3 py-2 border rounded-lg"
          required
        >
          <option value="완제품">완제품 (Finished Goods)</option>
          <option value="반제품">반제품 (Semi-Finished)</option>
          <option value="고객재고">고객재고 (Customer Stock)</option>
          <option value="원재료">원재료 (Raw Materials)</option>
        </select>
      </div>

      {/* NEW: Warehouse Zone (conditional) */}
      {showWarehouseZone && (
        <div className="space-y-1">
          <label className="text-sm font-medium">
            보관 구역 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.warehouse_zone}
            onChange={(e) => setFormData({
              ...formData,
              warehouse_zone: e.target.value
            })}
            placeholder="예: A-01, B-03"
            className="w-full px-3 py-2 border rounded-lg"
            required={showWarehouseZone}
          />
          <p className="text-xs text-gray-500">
            고객재고는 보관 구역이 필수입니다
          </p>
        </div>
      )}

      {/* NEW: Quality Status */}
      <div className="space-y-1">
        <label className="text-sm font-medium">
          품질 검수 상태
        </label>
        <select
          value={formData.quality_status}
          onChange={(e) => setFormData({
            ...formData,
            quality_status: e.target.value as QualityStatus
          })}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="검수중">검수중</option>
          <option value="합격">합격</option>
          <option value="불합격">불합격</option>
          <option value="보류">보류</option>
        </select>
      </div>

      {/* Existing save/cancel buttons */}
    </form>
  );
}
```

#### 2. 재고 목록 페이지에 필터 추가 (1.5시간)
**파일**: `src/app/inventory/page.tsx` (기존 파일 수정)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { InventoryType } from '@/types/database.types';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState([]);
  const [selectedType, setSelectedType] = useState<InventoryType | ''>('');
  const [loading, setLoading] = useState(false);

  // Fetch data when filter changes
  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      try {
        const url = selectedType
          ? `/api/inventory/classification?inventory_type=${selectedType}`
          : '/api/inventory/classification';

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
          setStats(data.data.stats);
          setItems(data.data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, [selectedType]);

  return (
    <div className="p-6 space-y-6">
      {/* Header with Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.type}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedType === stat.type
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedType(
              selectedType === stat.type ? '' : stat.type
            )}
          >
            <div className="text-sm text-gray-600">{stat.type}</div>
            <div className="text-2xl font-bold">{stat.count}</div>
            <div className="text-xs text-gray-500">
              총 재고: {stat.total_stock.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">
              총 금액: ₩{stat.total_value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedType('')}
          className={`px-4 py-2 rounded-lg ${
            selectedType === ''
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setSelectedType('완제품')}
          className={`px-4 py-2 rounded-lg ${
            selectedType === '완제품'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          완제품
        </button>
        <button
          onClick={() => setSelectedType('반제품')}
          className={`px-4 py-2 rounded-lg ${
            selectedType === '반제품'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          반제품
        </button>
        <button
          onClick={() => setSelectedType('고객재고')}
          className={`px-4 py-2 rounded-lg ${
            selectedType === '고객재고'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          고객재고
        </button>
        <button
          onClick={() => setSelectedType('원재료')}
          className={`px-4 py-2 rounded-lg ${
            selectedType === '원재료'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          원재료
        </button>
      </div>

      {/* Items Table */}
      {loading ? (
        <div className="text-center py-8">로딩 중...</div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th>품목명</th>
              <th>품목코드</th>
              <th>재고분류</th>
              <th>보관구역</th>
              <th>검수상태</th>
              <th>현재고</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.item_id} className="border-b">
                <td>{item.item_name}</td>
                <td>{item.item_code}</td>
                <td>
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.inventory_type === '완제품' ? 'bg-green-100 text-green-800' :
                    item.inventory_type === '반제품' ? 'bg-yellow-100 text-yellow-800' :
                    item.inventory_type === '고객재고' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {item.inventory_type}
                  </span>
                </td>
                <td>{item.warehouse_zone || '-'}</td>
                <td>
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.quality_status === '합격' ? 'bg-green-100 text-green-800' :
                    item.quality_status === '불합격' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {item.quality_status}
                  </span>
                </td>
                <td>{item.current_stock?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

#### 3. 대시보드 위젯 추가 (1시간)
**파일**: `src/components/dashboard/InventoryClassificationWidget.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function InventoryClassificationWidget() {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      const response = await fetch('/api/inventory/classification');
      const data = await response.json();
      if (data.success) {
        setStats(data.data.stats);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">재고 분류 현황</h3>

      {stats.length > 0 ? (
        <BarChart width={400} height={300} data={stats}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="type" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#3b82f6" name="품목 수" />
          <Bar dataKey="total_stock" fill="#10b981" name="총 재고" />
        </BarChart>
      ) : (
        <div className="text-center py-8 text-gray-500">
          데이터 로딩 중...
        </div>
      )}
    </div>
  );
}
```

### 완료 기준
- ✅ ItemForm에서 재고 분류 선택 가능
- ✅ 고객재고 선택 시 보관 구역 필수 입력 확인
- ✅ 재고 목록 페이지에서 필터 작동 확인
- ✅ 통계 카드 클릭으로 필터 전환 작동
- ✅ 대시보드 위젯에 차트 정상 표시

---

## Stream D: Minor Enhancements (독립 실행 가능)

### 📌 우선순위: MEDIUM (사용성 개선)
### ⏱️ 예상 소요: 8시간
### 👤 담당: Full-stack Developer
### 🔗 의존성: 없음 (즉시 시작 가능)

### D-1: Excel Template Download (4시간)

#### 구현 내용

**API 엔드포인트**: `src/app/api/download/template/batch/route.ts` (NEW)

```typescript
import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';

/**
 * GET /api/download/template/batch
 * Purpose: Download Excel template for batch registration
 */
export async function GET() {
  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Instructions (사용 방법)
    const instructionsData = [
      ['일괄 등록 템플릿 사용 방법'],
      [''],
      ['1. 이 템플릿에 데이터를 입력하세요'],
      ['2. 필수 항목(*표시)은 반드시 입력해야 합니다'],
      ['3. 품목 유형은 INPUT(입고) 또는 OUTPUT(출고)만 가능합니다'],
      ['4. 입력 완료 후 업로드 버튼을 클릭하세요'],
      [''],
      ['주의사항:'],
      ['- 첫 번째 행(헤더)은 삭제하지 마세요'],
      ['- 날짜 형식: YYYY-MM-DD'],
      ['- 숫자는 콤마(,) 없이 입력하세요']
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, '사용방법');

    // Sheet 2: Template (템플릿)
    const templateHeaders = [
      '품목코드*',
      '품목유형*',
      '수량*',
      '단가',
      '불량수량',
      '비고'
    ];

    const sampleData = [
      ['ITEM001', 'INPUT', '100', '10000', '0', '샘플 데이터'],
      ['ITEM002', 'OUTPUT', '50', '15000', '2', '']
    ];

    const templateSheet = XLSX.utils.aoa_to_sheet([
      templateHeaders,
      ...sampleData
    ]);

    // Set column widths
    templateSheet['!cols'] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(workbook, templateSheet, '템플릿');

    // Sheet 3: Valid Values (입력 가능한 값)
    const validValuesData = [
      ['필드명', '입력 가능한 값'],
      ['품목유형', 'INPUT (입고), OUTPUT (출고)'],
      ['재고분류', '완제품, 반제품, 고객재고, 원재료'],
      ['검수상태', '검수중, 합격, 불합격, 보류']
    ];

    const validValuesSheet = XLSX.utils.aoa_to_sheet(validValuesData);
    XLSX.utils.book_append_sheet(workbook, validValuesSheet, '입력값');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="batch_registration_template_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      { success: false, error: '템플릿 생성 실패' },
      { status: 500 }
    );
  }
}
```

**UI 버튼 추가**: `src/components/batch/BatchRegistrationForm.tsx` (Line 50 추가)

```typescript
<div className="flex justify-between items-center mb-4">
  <h2 className="text-xl font-semibold">일괄 등록</h2>

  {/* NEW: Download template button */}
  <button
    type="button"
    onClick={async () => {
      const response = await fetch('/api/download/template/batch');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch_template_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    }}
    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
  >
    📥 Excel 템플릿 다운로드
  </button>
</div>
```

### D-2: Real-time LOT Dashboard (4시간)

#### 구현 내용

**파일**: `src/app/process/lot-tracker/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import LOTTracker from '@/components/process/LOTTracker';

export default function LOTDashboardPage() {
  const [recentLOTs, setRecentLOTs] = useState([]);
  const [selectedLOT, setSelectedLOT] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch recent LOTs
  useEffect(() => {
    const fetchRecentLOTs = async () => {
      const response = await fetch('/api/process/lot/recent');
      const data = await response.json();
      if (data.success) {
        setRecentLOTs(data.data);
      }
    };

    fetchRecentLOTs();

    // Auto-refresh every 30 seconds
    if (autoRefresh) {
      const interval = setInterval(fetchRecentLOTs, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">실시간 LOT 추적 대시보드</h1>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className="text-sm">자동 새로고침 (30초)</span>
          </label>

          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-600">
              {autoRefresh ? 'LIVE' : 'PAUSED'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent LOTs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {recentLOTs.map((lot) => (
          <div
            key={lot.lot_number}
            onClick={() => setSelectedLOT(lot.lot_number)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedLOT === lot.lot_number
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-mono text-sm font-semibold">
              {lot.lot_number}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {lot.operation_type}
            </div>
            <div className={`mt-2 text-xs px-2 py-1 rounded inline-block ${
              lot.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
              lot.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {lot.status}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {new Date(lot.created_at).toLocaleString('ko-KR')}
            </div>
          </div>
        ))}
      </div>

      {/* LOT Tracker Detail */}
      {selectedLOT && (
        <div className="mt-8">
          <LOTTracker initialLOT={selectedLOT} />
        </div>
      )}
    </div>
  );
}
```

**API 엔드포인트**: `src/app/api/process/lot/recent/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { getSupabaseClient, createSuccessResponse } from '@/lib/db-unified';

/**
 * GET /api/process/lot/recent
 * Purpose: Get recent LOT numbers (last 24 hours)
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data, error } = await supabase
      .from('process_operations')
      .select('lot_number, operation_type, status, created_at')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return createSuccessResponse(data);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### 완료 기준
- ✅ Excel 템플릿 다운로드 버튼 작동
- ✅ 템플릿 3-Sheet 구조 확인 (사용방법, 템플릿, 입력값)
- ✅ 실시간 LOT 대시보드 표시
- ✅ 자동 새로고침 30초 간격 작동
- ✅ LOT 선택 시 상세 추적 화면 전환

---

## Stream E: Code Quality Improvements (독립 실행 가능)

### 📌 우선순위: LOW (기술부채 해소)
### ⏱️ 예상 소요: 6시간
### 👤 담당: Senior Developer
### 🔗 의존성: 없음 (즉시 시작 가능)

### E-1: BatchRegistrationForm Refactoring (4시간)

#### 문제점
- 현재 276줄로 너무 복잡
- 상태 관리 로직이 컴포넌트에 혼재
- 재사용성 낮음

#### 해결책: Custom Hook 추출

**파일 1**: `src/hooks/useBatchForm.ts` (NEW)

```typescript
import { useState, useCallback } from 'react';

export interface BatchItem {
  item_id: number;
  item_type: 'INPUT' | 'OUTPUT';
  quantity: number;
  unit_price: number;
  defect_quantity: number;
  notes: string;
}

export function useBatchForm(initialItems: BatchItem[] = []) {
  const [items, setItems] = useState<BatchItem[]>(
    initialItems.length > 0 ? initialItems : [{
      item_id: 0,
      item_type: 'INPUT',
      quantity: 0,
      unit_price: 0,
      defect_quantity: 0,
      notes: ''
    }]
  );

  const addItem = useCallback(() => {
    setItems([...items, {
      item_id: 0,
      item_type: 'INPUT',
      quantity: 0,
      unit_price: 0,
      defect_quantity: 0,
      notes: ''
    }]);
  }, [items]);

  const removeItem = useCallback((index: number) => {
    if (items.length === 1) return; // Keep at least one item
    setItems(items.filter((_, i) => i !== index));
  }, [items]);

  const updateItem = useCallback((
    index: number,
    field: keyof BatchItem,
    value: any
  ) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    setItems(newItems);
  }, [items]);

  const validateItems = useCallback((): string | null => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.item_id) {
        return `품목 ${i + 1}: 품목을 선택해주세요`;
      }
      if (item.quantity <= 0) {
        return `품목 ${i + 1}: 수량은 0보다 커야 합니다`;
      }
      if (item.defect_quantity < 0) {
        return `품목 ${i + 1}: 불량수량은 음수일 수 없습니다`;
      }
      if (item.defect_quantity >= item.quantity) {
        return `품목 ${i + 1}: 불량수량이 총 수량보다 클 수 없습니다`;
      }
    }
    return null;
  }, [items]);

  const getTotalQuantity = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const getTotalAmount = useCallback(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [items]);

  const reset = useCallback(() => {
    setItems([{
      item_id: 0,
      item_type: 'INPUT',
      quantity: 0,
      unit_price: 0,
      defect_quantity: 0,
      notes: ''
    }]);
  }, []);

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    validateItems,
    getTotalQuantity,
    getTotalAmount,
    reset
  };
}
```

**파일 2**: `src/components/batch/BatchRegistrationForm.tsx` (대폭 간소화)

```typescript
'use client';

import { useBatchForm } from '@/hooks/useBatchForm';
import { useState } from 'react';

export default function BatchRegistrationForm({ onSubmit, onCancel }) {
  const {
    items,
    addItem,
    removeItem,
    updateItem,
    validateItems,
    getTotalQuantity,
    getTotalAmount,
    reset
  } = useBatchForm();

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const error = validateItems();
    if (error) {
      alert(error);
      return;
    }

    // Submit
    setSubmitting(true);
    try {
      await onSubmit(items);
      reset();
    } catch (error) {
      alert('등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header with template download button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">일괄 등록</h2>
        <button type="button" onClick={downloadTemplate}>
          📥 Excel 템플릿
        </button>
      </div>

      {/* Items Table (simplified, state managed by hook) */}
      <table className="w-full">
        <thead>
          <tr>
            <th>품목</th>
            <th>유형</th>
            <th>수량</th>
            <th>단가</th>
            <th>불량</th>
            <th>비고</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>
                {/* Item selector */}
                <select
                  value={item.item_id}
                  onChange={(e) => updateItem(index, 'item_id', parseInt(e.target.value))}
                >
                  {/* Options */}
                </select>
              </td>
              <td>
                <select
                  value={item.item_type}
                  onChange={(e) => updateItem(index, 'item_type', e.target.value)}
                >
                  <option value="INPUT">입고</option>
                  <option value="OUTPUT">출고</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, 'unit_price', parseInt(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.defect_quantity}
                  onChange={(e) => updateItem(index, 'defect_quantity', parseInt(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => updateItem(index, 'notes', e.target.value)}
                />
              </td>
              <td>
                <button type="button" onClick={() => removeItem(index)}>
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add Item Button */}
      <button type="button" onClick={addItem} className="w-full py-2 border-2 border-dashed">
        + 품목 추가
      </button>

      {/* Summary */}
      <div className="bg-gray-50 p-4 rounded">
        <div>총 수량: {getTotalQuantity().toLocaleString()}</div>
        <div>총 금액: ₩{getTotalAmount().toLocaleString()}</div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}>
          {submitting ? '등록 중...' : '일괄 등록'}
        </button>
        <button type="button" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  );
}
```

### E-2: ConditionalField Helper Component (2시간)

#### 문제점
- PaymentSplitForm에서 조건부 렌더링이 58줄 (lines 185-242)
- 중복된 패턴 (bill_number, bill_date, bill_drawer)
- 다른 폼에서 재사용 불가

#### 해결책: 재사용 가능한 ConditionalField 컴포넌트

**파일**: `src/components/ui/ConditionalField.tsx` (NEW)

```typescript
import React from 'react';

interface ConditionalFieldProps {
  condition: boolean;
  label: string;
  type?: 'text' | 'date' | 'number' | 'select';
  value: string | number;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export default function ConditionalField({
  condition,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  placeholder,
  options
}: ConditionalFieldProps) {
  if (!condition) return null;

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      {type === 'select' && options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="">선택하세요</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="w-full px-3 py-2 border rounded-lg"
        />
      )}
    </div>
  );
}
```

**파일**: `src/components/PaymentSplitForm.tsx` (58줄 → 15줄로 간소화)

```typescript
import ConditionalField from '@/components/ui/ConditionalField';

// Before: 58 lines of conditional rendering (lines 185-242)
// After: 15 lines using helper component

{payments.map((payment, index) => (
  <div key={index} className="space-y-4">
    {/* Existing fields: payment_method, amount, payment_date */}

    {/* NEW: Use ConditionalField helper */}
    <ConditionalField
      condition={payment.payment_method === 'BILL'}
      label="어음 번호"
      type="text"
      value={payment.bill_number || ''}
      onChange={(value) => updatePayment(index, 'bill_number', value)}
      required
      placeholder="어음 번호를 입력하세요"
    />

    <ConditionalField
      condition={payment.payment_method === 'BILL'}
      label="만기일"
      type="date"
      value={payment.bill_date || ''}
      onChange={(value) => updatePayment(index, 'bill_date', value)}
      required
    />

    <ConditionalField
      condition={payment.payment_method === 'BILL'}
      label="발행자"
      type="text"
      value={payment.bill_drawer || ''}
      onChange={(value) => updatePayment(index, 'bill_drawer', value)}
      required
      placeholder="발행자 이름"
    />
  </div>
))}
```

### 완료 기준
- ✅ useBatchForm 훅 테스트 완료 (단위 테스트)
- ✅ BatchRegistrationForm 줄 수 감소: 276줄 → 150줄 이하
- ✅ ConditionalField 컴포넌트 재사용 확인 (3곳 이상)
- ✅ PaymentSplitForm 간소화: 58줄 → 15줄
- ✅ 기존 기능 모두 정상 작동 (회귀 테스트)

---

## 📅 병렬 실행 타임라인

### Day 1 (8시간)

#### Hour 0-4: 3개 트랙 병렬 시작
```
Track 1 (DB Specialist):
  00:00-01:00  Migration 파일 생성 및 검증
  01:00-02:00  Local 테스트 및 Production 적용
  02:00-03:00  TypeScript 타입 생성
  03:00-04:00  Stream A 완료 확인 ✅

Track 2 (Full-stack Developer - Enhancements):
  00:00-02:00  Excel 템플릿 API 개발
  02:00-04:00  Excel 템플릿 UI 버튼 추가
  04:00-06:00  Real-time LOT Dashboard API
  06:00-08:00  LOT Dashboard UI 개발
  08:00        Stream D 완료 확인 ✅

Track 3 (Senior Developer - Quality):
  00:00-02:00  useBatchForm 훅 개발
  02:00-04:00  BatchRegistrationForm 리팩토링
  04:00-05:00  ConditionalField 컴포넌트 개발
  05:00-06:00  PaymentSplitForm 간소화
  06:00        Stream E 완료 확인 ✅
```

#### Hour 4-8: Track 1 전환 (Backend Developer)
```
Track 1 (Backend Developer - API Layer):
  04:00-07:00  Domain Helper 확장 (4개 메서드)
  07:00-09:00  Validation 스키마 업데이트
  09:00-12:00  새 API 엔드포인트 생성 및 테스트
  12:00        Stream B 완료 확인 ✅
```

### Day 2 (4시간)

#### Hour 0-4: Frontend Development
```
Track 1 (Frontend Developer):
  00:00-01:30  ItemForm에 분류 필드 추가
  01:30-03:00  재고 목록 필터 개발
  03:00-04:00  대시보드 위젯 추가
  04:00        Stream C 완료 확인 ✅
```

### 총 소요 시간 비교

| 방식 | 총 시간 | 설명 |
|------|--------|------|
| **순차 실행** | 30시간 (4일) | Stream A → B → C → D → E |
| **병렬 실행** | 20시간 (2.5일) | Day 1: A+D+E (병렬) → B (의존), Day 2: C (의존) |
| **시간 절감** | **10시간 (33%)** | |

---

## 👥 리소스 할당 전략

### 필요 인력
- **Database Specialist** (1명): Stream A (4시간)
- **Backend Developer** (1명): Stream B (8시간)
- **Frontend Developer** (1명): Stream C (4시간)
- **Full-stack Developer** (1명): Stream D (8시간)
- **Senior Developer** (1명): Stream E (6시간)

### 리소스 공유 시나리오
**팀 규모가 3명일 경우**:
```
Developer 1 (Full-stack):
  - Stream A (4h) → Stream B (8h) = 12시간

Developer 2 (Full-stack):
  - Stream D (8h) → Stream C (4h) = 12시간

Developer 3 (Senior):
  - Stream E (6h) → 코드 리뷰 및 통합 테스트 (6h) = 12시간
```

**총 소요**: 12시간 (1.5일) with 3 developers

---

## ✅ 통합 체크리스트

### Stream 간 통합 포인트

#### Integration Point 1: Stream A → B
- [ ] `inventory_type` 컬럼 존재 확인
- [ ] TypeScript 타입 정의 로드 성공
- [ ] Domain Helper가 새 컬럼 쿼리 가능

#### Integration Point 2: Stream B → C
- [ ] API `/api/inventory/classification` 응답 확인
- [ ] 필터 파라미터 `?inventory_type=완제품` 작동
- [ ] 통계 데이터 형식 일치 (stats 배열)

#### Integration Point 3: Stream D 독립 검증
- [ ] Excel 템플릿 다운로드 독립 작동
- [ ] LOT Dashboard가 기존 API 사용
- [ ] 다른 Stream에 영향 없음

#### Integration Point 4: Stream E 독립 검증
- [ ] useBatchForm 훅 재사용 가능
- [ ] ConditionalField 다른 폼에서 재사용
- [ ] 기존 기능 모두 정상 작동 (회귀 없음)

### 최종 검증 체크리스트

#### Database Layer
- [ ] `items` 테이블에 inventory_type, warehouse_zone, quality_status 컬럼 존재
- [ ] 인덱스 3개 생성됨 (idx_items_inventory_type, warehouse_zone, quality_status)
- [ ] 모든 기존 레코드 inventory_type 할당됨 (NULL 없음)
- [ ] TypeScript 타입 정의 최신화

#### API Layer
- [ ] Domain Helper 4개 메서드 작동 (getByInventoryType, getInventoryClassificationStats, getByWarehouseZone, getByQualityStatus)
- [ ] Validation 스키마 올바른 enum 검증
- [ ] `/api/inventory/classification` 엔드포인트 200 OK
- [ ] `/api/items?inventory_type=완제품` 필터 작동

#### Frontend Layer
- [ ] ItemForm에서 재고 분류 선택 가능
- [ ] 고객재고 선택 시 보관 구역 필수 입력 강제
- [ ] 재고 목록 페이지 필터 버튼 작동
- [ ] 대시보드 위젯 차트 표시
- [ ] Excel 템플릿 다운로드 버튼 작동
- [ ] LOT 대시보드 자동 새로고침 작동

#### Code Quality
- [ ] BatchRegistrationForm 줄 수 150줄 이하
- [ ] useBatchForm 훅 재사용 확인
- [ ] ConditionalField 3곳 이상 재사용
- [ ] PaymentSplitForm 간소화 확인

#### End-to-End Test
- [ ] 품목 생성 시 재고 분류 저장 확인
- [ ] 재고 목록에서 분류별 필터링 확인
- [ ] 대시보드에서 분류 통계 표시 확인
- [ ] Excel 업로드로 일괄 등록 확인
- [ ] LOT 추적 실시간 업데이트 확인

---

## 📊 진행 상황 추적

### Kanban Board 구조

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   TODO      │ IN PROGRESS │   REVIEW    │    DONE     │
├─────────────┼─────────────┼─────────────┼─────────────┤
│             │ Stream A    │             │             │
│ Stream B    │ (Database)  │             │             │
│ Stream C    │             │             │             │
│             │ Stream D    │             │             │
│             │ (Enhance)   │             │             │
│             │             │             │             │
│             │ Stream E    │             │             │
│             │ (Quality)   │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Daily Standup Questions
1. **어제 완료한 Stream**: 어떤 Stream을 완료했나요?
2. **오늘 진행할 Stream**: 어떤 Stream을 시작/계속하나요?
3. **블로커**: 의존성 문제나 기술적 이슈가 있나요?
4. **통합 포인트**: 다른 Stream과의 통합 준비되었나요?

---

## 🚀 실행 가이드

### 시작하기 전에
```bash
# 1. Git branch 생성
git checkout -b feature/inventory-classification

# 2. 의존성 설치 확인
npm install

# 3. 개발 서버 시작
npm run dev:safe

# 4. Supabase 연결 확인
npm run db:check-schema
```

### Stream 별 시작 명령어

#### Stream A (Database)
```bash
# 1. Migration 파일 생성
touch supabase/migrations/20250202_add_inventory_classification.sql

# 2. SQL 작성 (위 코드 참조)

# 3. Local 적용
npm run db:migrate:up

# 4. 검증
npm run db:check-schema

# 5. Production 적용
supabase db push

# 6. TypeScript 타입 생성
npm run db:types
```

#### Stream B (API)
```bash
# Stream A 완료 대기 후 시작

# 1. Domain Helper 확장
# src/lib/db-unified.ts 수정

# 2. Validation 스키마 추가
# src/lib/validation.ts 수정

# 3. 새 API 생성
mkdir -p src/app/api/inventory/classification
touch src/app/api/inventory/classification/route.ts

# 4. 테스트
curl http://localhost:5000/api/inventory/classification
```

#### Stream C (Frontend)
```bash
# Stream B 완료 대기 후 시작

# 1. ItemForm 수정
# src/components/ItemForm.tsx

# 2. Inventory 페이지 수정
# src/app/inventory/page.tsx

# 3. 대시보드 위젯 생성
mkdir -p src/components/dashboard
touch src/components/dashboard/InventoryClassificationWidget.tsx

# 4. 브라우저 확인
open http://localhost:5000/inventory
```

#### Stream D (Enhancements)
```bash
# 의존성 없음, 즉시 시작 가능

# D-1: Excel Template
mkdir -p src/app/api/download/template/batch
touch src/app/api/download/template/batch/route.ts

# D-2: LOT Dashboard
mkdir -p src/app/process/lot-tracker
touch src/app/process/lot-tracker/page.tsx
touch src/app/api/process/lot/recent/route.ts
```

#### Stream E (Quality)
```bash
# 의존성 없음, 즉시 시작 가능

# E-1: useBatchForm Hook
mkdir -p src/hooks
touch src/hooks/useBatchForm.ts

# E-2: ConditionalField Component
touch src/components/ui/ConditionalField.tsx
```

### 통합 테스트
```bash
# 모든 Stream 완료 후

# 1. TypeScript 컴파일
npm run type-check

# 2. Lint 검사
npm run lint

# 3. Production 빌드
npm run build

# 4. E2E 테스트 (필요 시)
npm run test:e2e
```

---

## 🎯 성공 지표

### 정량적 지표
- [x] 시스템 완성도: 80% → **100%**
- [x] 클라이언트 요구사항 충족: 5/6 → **6/6** (100%)
- [x] 코드 복잡도 감소: 276줄 → **150줄** (45% 감소)
- [x] API 엔드포인트: 12개 → **15개** (+3)
- [x] 개발 시간 단축: 30시간 → **20시간** (33% 단축)

### 정성적 지표
- [x] **재고 분류 시스템** 완전 구현
- [x] **사용자 편의성** 향상 (Excel 템플릿, 실시간 대시보드)
- [x] **코드 품질** 개선 (재사용 가능한 Hook & Component)
- [x] **유지보수성** 향상 (명확한 관심사 분리)
- [x] **확장성** 확보 (Domain Helper 패턴)

---

## 📝 문서 업데이트 계획

### 완료 후 업데이트할 문서
1. **CLAUDE.md**: 새 API 엔드포인트 추가, 재고 분류 사용법
2. **README.md**: 완성도 80% → 100% 업데이트
3. **API_REFERENCE.md**: 3개 신규 엔드포인트 문서화
4. **CHANGELOG.md**: 2025-02-02 릴리스 노트 작성

---

**문서 버전**: 1.0
**작성일**: 2025년 2월 1일
**예상 완료일**: 2025년 2월 3일 (병렬 실행 시)
**담당**: FITaeYoungERP Development Team
