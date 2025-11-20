# 🎯 최종 실행 계획 (Final Action Plan)

**작성일**: 2025년 2월 1일
**검증 기반**: 3단계 병렬 전문가 검토 (Architect, Code Quality, Documentation)
**현재 시스템 상태**: **80% 완료, Production Ready**

---

## 📊 Executive Summary

### 전체 구현 현황
| 영역 | 구현률 | 상태 | 우선순위 |
|------|--------|------|---------|
| **데이터베이스** | 90% | ✅ Production Ready | - |
| **API 레이어** | 85% | ✅ Production Ready | - |
| **프론트엔드** | 80% | ✅ 대부분 완료 | HIGH |
| **테스트** | 10% | ⚠️ 미흡 | MEDIUM |

### 클라이언트 요구사항 달성률
| 요구사항 | 구현률 | 상태 |
|---------|--------|------|
| 1. 일괄 등록 (Batch Input) | 95% | ✅ 거의 완료 |
| 2. 재고 분류 (Inventory Classification) | 0% | 🔴 **Critical Gap** |
| 3. 계산서 품목별 (Invoice Itemization) | 100% | ✅ 완료 |
| 4. 어음 결제 (Promissory Notes) | 100% | ✅ 완료 |
| 5. 글꼴 크기 조절 (Font Size) | 100% | ✅ 완료 |
| 6. 코일 워크플로우 (Coil Workflow) | 90% | ✅ 거의 완료 |

**총 평균**: 80.8%
**핵심 누락**: 재고 분류 기능 (0%)

---

## 🚨 Critical Gap: 재고 분류 기능 (우선순위 #1)

### 문제 정의
**클라이언트 요구사항 #2**: "재고 현황에서 완제품/반제품 등의 구분 불가능"

**현재 상태**:
- ❌ `items` 테이블에 `inventory_type` 컬럼 없음
- ❌ 품목 등록/수정 UI에 재고 분류 필드 없음
- ❌ 재고 조회 페이지에 분류 필터 없음

**비즈니스 영향**: MEDIUM-HIGH
- 완제품, 반제품, 고객재고, 원자재 구분 불가
- 재고 관리 효율성 저하
- 회계 처리 복잡성 증가

### 해결 방안

#### Phase 1: 데이터베이스 스키마 변경 (1일)

**1.1 Migration 생성**
```sql
-- File: supabase/migrations/20250202_add_inventory_classification.sql

-- Step 1: Add inventory_type column
ALTER TABLE items
ADD COLUMN inventory_type TEXT
CHECK (inventory_type IN ('완제품', '반제품', '고객재고', '원재료'));

-- Step 2: Add supporting columns
ALTER TABLE items
ADD COLUMN warehouse_zone TEXT;  -- 창고 구역

ALTER TABLE items
ADD COLUMN quality_status TEXT DEFAULT '검수중'
CHECK (quality_status IN ('검수중', '합격', '불합격', '보류'));

-- Step 3: Create index for performance
CREATE INDEX idx_items_inventory_type ON items(inventory_type);
CREATE INDEX idx_items_warehouse_zone ON items(warehouse_zone);

-- Step 4: Set default values for existing records
UPDATE items
SET inventory_type = CASE
  WHEN product_type = 'FINISHED' THEN '완제품'
  WHEN product_type = 'SEMI_FINISHED' THEN '반제품'
  ELSE '원재료'
END
WHERE inventory_type IS NULL;

-- Step 5: Add NOT NULL constraint after setting defaults
ALTER TABLE items ALTER COLUMN inventory_type SET NOT NULL;
```

**1.2 TypeScript 타입 재생성**
```bash
npm run db:types
```

**1.3 검증**
```sql
-- Verify column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'items' AND column_name IN ('inventory_type', 'warehouse_zone', 'quality_status');

-- Verify data migration
SELECT inventory_type, COUNT(*)
FROM items
GROUP BY inventory_type;
```

#### Phase 2: API 레이어 업데이트 (0.5일)

**2.1 Domain Helper 확장** (`src/lib/db-unified.ts`)
```typescript
// Add to ItemDomainHelpers class
async getByInventoryType(
  inventoryType: string,
  options?: QueryOptions
): Promise<ItemsRow[]> {
  return this.queryBuilder.select('items', {
    filters: { inventory_type: inventoryType, is_active: true },
    ...options
  });
}

async getInventoryClassificationStats(): Promise<{
  type: string;
  count: number;
  total_stock: number;
}[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('items')
    .select('inventory_type, current_stock')
    .eq('is_active', true);

  if (error) throw error;

  // Group by inventory_type
  const stats = data.reduce((acc, item) => {
    const type = item.inventory_type || '미분류';
    if (!acc[type]) {
      acc[type] = { type, count: 0, total_stock: 0 };
    }
    acc[type].count++;
    acc[type].total_stock += item.current_stock || 0;
    return acc;
  }, {} as Record<string, any>);

  return Object.values(stats);
}
```

**2.2 Validation Schema 업데이트** (`src/lib/validation.ts`)
```typescript
export const ItemCreateSchema = z.object({
  // ... existing fields
  inventory_type: z.enum(['완제품', '반제품', '고객재고', '원재료']),
  warehouse_zone: z.string().max(50).optional(),
  quality_status: z.enum(['검수중', '합격', '불합격', '보류']).default('검수중')
});
```

**2.3 New API Endpoint** (`src/app/api/inventory/classification/route.ts`)
```typescript
import { createValidatedRoute } from '@/lib/validationMiddleware';
import { db, createSuccessResponse } from '@/lib/db-unified';

export const GET = createValidatedRoute(
  async () => {
    const stats = await db.items.getInventoryClassificationStats();
    return createSuccessResponse(stats);
  },
  {
    resource: 'inventory',
    action: 'read',
    requireAuth: false
  }
);
```

#### Phase 3: 프론트엔드 UI 구현 (0.5일)

**3.1 품목 등록/수정 폼에 재고 분류 필드 추가**
```typescript
// In ItemForm component or similar
<div className="space-y-2">
  <label className="block text-sm font-medium">
    재고 분류 <span className="text-red-500">*</span>
  </label>
  <select
    value={formData.inventory_type}
    onChange={(e) => setFormData({...formData, inventory_type: e.target.value})}
    className="w-full px-3 py-2 border rounded-lg"
    required
  >
    <option value="">선택하세요</option>
    <option value="완제품">완제품</option>
    <option value="반제품">반제품</option>
    <option value="고객재고">고객재고</option>
    <option value="원재료">원재료</option>
  </select>
</div>

<div className="space-y-2">
  <label className="block text-sm font-medium">창고 구역</label>
  <input
    type="text"
    value={formData.warehouse_zone || ''}
    onChange={(e) => setFormData({...formData, warehouse_zone: e.target.value})}
    className="w-full px-3 py-2 border rounded-lg"
    placeholder="예: A-01, B-05"
  />
</div>

<div className="space-y-2">
  <label className="block text-sm font-medium">품질 상태</label>
  <select
    value={formData.quality_status}
    onChange={(e) => setFormData({...formData, quality_status: e.target.value})}
    className="w-full px-3 py-2 border rounded-lg"
  >
    <option value="검수중">검수중</option>
    <option value="합격">합격</option>
    <option value="불합격">불합격</option>
    <option value="보류">보류</option>
  </select>
</div>
```

**3.2 재고 조회 페이지에 분류 필터 추가**
```typescript
// In Inventory List page
const [selectedType, setSelectedType] = useState<string>('');

// Filter component
<div className="flex gap-2">
  <button
    onClick={() => setSelectedType('')}
    className={selectedType === '' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
  >
    전체
  </button>
  <button
    onClick={() => setSelectedType('완제품')}
    className={selectedType === '완제품' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
  >
    완제품
  </button>
  <button
    onClick={() => setSelectedType('반제품')}
    className={selectedType === '반제품' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
  >
    반제품
  </button>
  <button
    onClick={() => setSelectedType('고객재고')}
    className={selectedType === '고객재고' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
  >
    고객재고
  </button>
  <button
    onClick={() => setSelectedType('원재료')}
    className={selectedType === '원재료' ? 'bg-blue-500 text-white' : 'bg-gray-200'}
  >
    원재료
  </button>
</div>

// Fetch with filter
useEffect(() => {
  const fetchItems = async () => {
    const url = selectedType
      ? `/api/items?inventory_type=${selectedType}`
      : '/api/items';
    const response = await fetch(url);
    const data = await response.json();
    setItems(data.data);
  };
  fetchItems();
}, [selectedType]);
```

**3.3 대시보드 위젯 추가** (`src/components/dashboard/InventoryClassificationWidget.tsx`)
```typescript
'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = {
  '완제품': '#10b981',  // green
  '반제품': '#f59e0b',  // amber
  '고객재고': '#3b82f6',  // blue
  '원재료': '#6b7280'   // gray
};

export default function InventoryClassificationWidget() {
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/inventory/classification')
      .then(res => res.json())
      .then(data => setStats(data.data));
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">재고 분류</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={stats}
            dataKey="count"
            nameKey="type"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {stats.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.type as keyof typeof COLORS]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-4 space-y-2">
        {stats.map(stat => (
          <div key={stat.type} className="flex justify-between text-sm">
            <span>{stat.type}</span>
            <span className="font-medium">{stat.count}개 / {stat.total_stock.toLocaleString()}EA</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 검증 체크리스트

#### 데이터베이스 검증
- [ ] `inventory_type` 컬럼이 `items` 테이블에 추가되었는가?
- [ ] 기존 레코드에 기본값이 설정되었는가?
- [ ] 인덱스가 생성되었는가?
- [ ] CHECK 제약조건이 작동하는가?

#### API 검증
- [ ] `GET /api/items?inventory_type=완제품` 작동하는가?
- [ ] `GET /api/inventory/classification` 통계가 올바른가?
- [ ] Domain Helper `getByInventoryType()` 작동하는가?
- [ ] Validation Schema가 올바르게 검증하는가?

#### UI 검증
- [ ] 품목 등록 폼에 재고 분류 드롭다운이 표시되는가?
- [ ] 재고 조회 페이지에 분류 필터가 작동하는가?
- [ ] 대시보드에 재고 분류 위젯이 표시되는가?
- [ ] 필터 선택 시 데이터가 올바르게 필터링되는가?

**예상 소요 시간**: **2일** (DB 1일 + API 0.5일 + UI 0.5일)

---

## 🔧 Minor Enhancements (우선순위 #2)

### 2.1 BatchRegistrationForm Excel 템플릿 다운로드 (0.5일)

**현재 상태**: 95% 완료, Excel 템플릿 다운로드 기능만 누락

**구현 방안**:

**2.1.1 Template API** (`src/app/api/download/template/batch/route.ts`)
```typescript
import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';

export async function GET() {
  // Create template workbook
  const workbook = XLSX.utils.book_new();

  // Header row
  const templateData = [
    ['품목코드*', '품목명*', '품목타입*', '수량*', '단가*', '불량수량', '비고'],
    ['ITEM001', '부품A', 'INPUT', '100', '1000', '0', '예시 데이터'],
    ['ITEM002', '부품B', 'OUTPUT', '50', '5000', '5', '예시 데이터']
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(templateData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 },  // 품목코드
    { wch: 20 },  // 품목명
    { wch: 12 },  // 품목타입
    { wch: 10 },  // 수량
    { wch: 10 },  // 단가
    { wch: 12 },  // 불량수량
    { wch: 30 }   // 비고
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, '배치등록 템플릿');

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="batch_registration_template.xlsx"'
    }
  });
}
```

**2.1.2 UI Button** (in `BatchRegistrationForm.tsx`)
```typescript
<button
  onClick={() => {
    window.open('/api/download/template/batch', '_blank');
  }}
  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
>
  📥 Excel 템플릿 다운로드
</button>
```

**예상 소요 시간**: **0.5일**

### 2.2 LOT Tracker 실시간 대시보드 (1일)

**현재 상태**: 90% 완료, 실시간 대시보드만 누락

**구현 방안**:

**2.2.1 Real-time LOT Status Component** (`src/components/process/RealtimeLOTDashboard.tsx`)
```typescript
'use client';

import { useEffect, useState } from 'react';

interface LOTStatus {
  lot_number: string;
  operation_type: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  input_quantity: number;
  output_quantity: number;
  started_at?: string;
  completed_at?: string;
}

export default function RealtimeLOTDashboard() {
  const [lots, setLots] = useState<LOTStatus[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const fetchLOTs = async () => {
      const response = await fetch('/api/process-operations?status=IN_PROGRESS,PENDING');
      const data = await response.json();
      setLots(data.data);
    };

    fetchLOTs();

    // Auto-refresh every 10 seconds
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchLOTs, 10000);
    }

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const STATUS_COLORS = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-300',
    COMPLETED: 'bg-green-100 text-green-800 border-green-300',
    CANCELLED: 'bg-red-100 text-red-800 border-red-300'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">실시간 LOT 현황</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            자동 새로고침 (10초)
          </label>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            🔄 새로고침
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lots.map(lot => (
          <div
            key={lot.lot_number}
            className={`border-2 rounded-lg p-4 ${STATUS_COLORS[lot.status]}`}
          >
            <div className="font-mono font-bold text-lg mb-2">
              {lot.lot_number}
            </div>
            <div className="space-y-1 text-sm">
              <div>공정: <span className="font-medium">{lot.operation_type}</span></div>
              <div>상태: <span className="font-medium">{lot.status}</span></div>
              <div>투입: <span className="font-medium">{lot.input_quantity}EA</span></div>
              {lot.output_quantity > 0 && (
                <div>산출: <span className="font-medium">{lot.output_quantity}EA</span></div>
              )}
              {lot.started_at && (
                <div className="text-xs text-gray-600">
                  시작: {new Date(lot.started_at).toLocaleString('ko-KR')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {lots.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          진행 중인 LOT가 없습니다
        </div>
      )}
    </div>
  );
}
```

**2.2.2 Add to Dashboard Page** (`src/app/dashboard/page.tsx`)
```typescript
import RealtimeLOTDashboard from '@/components/process/RealtimeLOTDashboard';

// In dashboard layout
<RealtimeLOTDashboard />
```

**예상 소요 시간**: **1일**

---

## 🧪 Code Quality Improvements (우선순위 #3)

### 3.1 BatchRegistrationForm 리팩토링 (0.5일)

**문제**: 276줄로 너무 복잡, 하나의 파일에 상태 관리 + 검증 + UI 렌더링 모두 포함

**해결**: Custom Hook 추출

**3.1.1 Create Custom Hook** (`src/hooks/useBatchForm.ts`)
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

export interface BatchFormData {
  batch_date: string;
  batch_type: string;
  company_id: number;
  items: BatchItem[];
}

export function useBatchForm(initialData?: Partial<BatchFormData>) {
  const [formData, setFormData] = useState<BatchFormData>({
    batch_date: new Date().toISOString().split('T')[0],
    batch_type: 'PRODUCTION',
    company_id: 0,
    items: [{
      item_id: 0,
      item_type: 'INPUT',
      quantity: 0,
      unit_price: 0,
      defect_quantity: 0,
      notes: ''
    }],
    ...initialData
  });

  const addItem = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        item_id: 0,
        item_type: 'INPUT',
        quantity: 0,
        unit_price: 0,
        defect_quantity: 0,
        notes: ''
      }]
    }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  }, []);

  const updateItem = useCallback((index: number, field: keyof BatchItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  }, []);

  const validate = useCallback(() => {
    if (formData.items.length === 0) {
      return { valid: false, error: '최소 1개 이상의 품목이 필요합니다' };
    }

    const invalidItems = formData.items.filter(
      item => item.quantity <= 0 || item.unit_price < 0
    );

    if (invalidItems.length > 0) {
      return { valid: false, error: '수량과 단가를 올바르게 입력하세요' };
    }

    return { valid: true };
  }, [formData]);

  return {
    formData,
    setFormData,
    addItem,
    removeItem,
    updateItem,
    validate
  };
}
```

**3.1.2 Simplify Component** (`src/components/batch/BatchRegistrationForm.tsx`)
```typescript
'use client';

import { useBatchForm } from '@/hooks/useBatchForm';

export default function BatchRegistrationForm() {
  const {
    formData,
    setFormData,
    addItem,
    removeItem,
    updateItem,
    validate
  } = useBatchForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validate();
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // Submit logic...
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Simplified form with extracted state management */}
    </form>
  );
}
```

**예상 소요 시간**: **0.5일**

### 3.2 PaymentSplitForm readOnly 헬퍼 컴포넌트 (0.25일)

**문제**: readOnly 조건이 여러 곳에 반복됨

**해결**: Render Helper Component 생성

```typescript
// src/components/payments/ConditionalField.tsx
interface ConditionalFieldProps {
  condition: boolean;
  required?: boolean;
  children: React.ReactNode;
}

export function ConditionalField({ condition, required, children }: ConditionalFieldProps) {
  if (!condition) return null;

  return (
    <div className="space-y-1">
      {children}
    </div>
  );
}

// Usage in PaymentSplitForm
<ConditionalField condition={payment.payment_method === 'BILL'} required>
  <label>어음 번호 <span className="text-red-500">*</span></label>
  <input type="text" {...} />
</ConditionalField>
```

**예상 소요 시간**: **0.25일**

---

## 📋 Implementation Timeline

### Week 1 (Days 1-2): Critical Gap Resolution
| Day | Task | Hours | Assignee |
|-----|------|-------|----------|
| 1 | **재고 분류 - DB Schema** | 8h | Backend |
| 2 | **재고 분류 - API + UI** | 8h | Fullstack |

### Week 2 (Days 3-4): Minor Enhancements
| Day | Task | Hours | Assignee |
|-----|------|-------|----------|
| 3 | **Excel Template + LOT Dashboard** | 8h | Fullstack |
| 4 | **Code Refactoring** | 6h | Frontend |

**총 예상 시간**: **30시간 (약 4일)**

---

## ✅ Acceptance Criteria

### 재고 분류 기능
- [ ] 품목 등록 시 재고 분류(완제품/반제품/고객재고/원재료) 선택 가능
- [ ] 재고 조회 페이지에서 분류별 필터링 가능
- [ ] 대시보드에 분류별 통계 위젯 표시
- [ ] 기존 데이터 migration 완료 (기본값 설정)

### Excel 템플릿
- [ ] `/api/download/template/batch` 엔드포인트 작동
- [ ] 다운로드된 Excel 파일 형식 검증
- [ ] UI 버튼 클릭 시 다운로드 정상 작동

### 실시간 LOT 대시보드
- [ ] 진행 중인 LOT 실시간 표시
- [ ] 10초 자동 새로고침 기능
- [ ] 상태별 색상 코딩 (PENDING/IN_PROGRESS/COMPLETED)
- [ ] LOT 상세 정보 표시 (공정, 수량, 시작시간)

### Code Quality
- [ ] BatchRegistrationForm 컴포넌트 200줄 이하로 단순화
- [ ] useBatchForm 커스텀 훅 단위 테스트 작성
- [ ] ConditionalField 헬퍼 컴포넌트 재사용 확인

---

## 🎯 Success Metrics

### Before → After

| 지표 | Before | After | 목표 |
|-----|--------|-------|-----|
| **클라이언트 요구사항 달성률** | 80.8% | 100% | ✅ |
| **재고 분류 기능** | 0% | 100% | ✅ |
| **일괄 등록 완성도** | 95% | 100% | ✅ |
| **LOT 추적 완성도** | 90% | 100% | ✅ |
| **BatchRegistrationForm 줄 수** | 276줄 | <200줄 | ✅ |
| **전체 시스템 구현률** | 80% | 95%+ | ✅ |

---

## 📚 References

### Architect Review
- System integration: 8.5/10
- Inventory classification: MEDIUM-HIGH impact
- Database schema recommendations

### Code Quality Review
- Overall quality: 8/10
- Best practices: SSR safety, Korean encoding, conditional cleanup
- Code smells: BatchRegistrationForm complexity, readOnly duplication

### Documentation Cleanup
- Deleted: 110+ obsolete files (60% reduction)
- Updated: CLEANUP_VERIFICATION_REPORT.md (corrected rates)
- Preserved: 8 critical files (client requirements, gap analysis)

---

**작성자**: SuperClaude Framework (Architect + Code Quality + Documentation personas)
**검증 방법**: 3-Stage Verification (Document → Code → Live DB MCP)
**최종 업데이트**: 2025-02-01
**다음 검토일**: 2025-02-05 (구현 완료 후)