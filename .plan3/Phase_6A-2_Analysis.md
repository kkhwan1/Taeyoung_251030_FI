# Phase 6A-2: 도장 공정 관리 (워크플로우 자동화) - 구현 분석

**분석 날짜**: 2025-01-19
**상태**: 제안 단계 (Phase 6A-1 완료 후 후속 작업)
**복잡도**: Phase 6A-1 대비 5-6배 증가
**예상 기간**: 1.5-4일 (실행 방식에 따라)

---

## 📊 작업 시간 요약

### Sequential 실행 (단일 에이전트)
- **총 시간**: 17-24시간 (3-4일, 6-8h/day)
- **장점**: 일관성 유지, 단순 관리
- **단점**: 긴 개발 기간

### Parallel 실행 (Multi-Agent)
- **총 시간**: 8-12시간 (1.5-2일)
- **효율성**: ~50% 시간 절감
- **장점**: 빠른 출시, 동시 테스트
- **단점**: 조율 복잡도 증가

---

## 🎯 구현 옵션

### Option A: MVP (최소 기능)
**예상 시간**: 11-14시간
**포함 기능**:
- ✅ 상태 변경 이력 추적 (coating_process_history)
- ✅ 기본 상태 전이 검증 (no_coating → before_coating → after_coating)
- ✅ 단순 이력 조회 UI
- ❌ 배치 관리 제외
- ❌ 품질 검사 제외

**추천 대상**: 빠른 출시가 중요한 경우

---

### Option B: Full Feature (완전 기능)
**예상 시간**: 15-20시간
**포함 기능**:
- ✅ 상태 변경 이력 추적
- ✅ 배치 관리 (coating_batches, coating_batch_items)
- ✅ 품질 검사 워크플로우 (pass/fail/rework)
- ✅ 대시보드 + 이력 조회 + 배치 관리 UI
- ⚠️ 고급 분석 제외

**추천 대상**: 완전한 도장 공정 관리가 필요한 경우 (권장)

---

### Option C: Complete System (완전 시스템)
**예상 시간**: 17-24시간
**포함 기능**:
- ✅ Full Feature 모든 기능
- ✅ 고급 분석 및 리포팅
- ✅ Excel 가져오기/내보내기 통합
- ✅ 실시간 알림 시스템
- ✅ 비용 분석 (도장 전후 비용 추적)

**추천 대상**: 장기적 완성도가 중요한 경우

---

## 🗄️ Layer 1: Database Schema (2-3시간)

### 1. coating_process_history (이력 추적 테이블)
```sql
CREATE TABLE coating_process_history (
  history_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  transaction_id INTEGER REFERENCES inventory_transactions(transaction_id),
  from_status VARCHAR(20) CHECK (from_status IN ('no_coating', 'before_coating', 'after_coating')),
  to_status VARCHAR(20) NOT NULL CHECK (to_status IN ('no_coating', 'before_coating', 'after_coating')),
  changed_at TIMESTAMP DEFAULT NOW(),
  changed_by INTEGER,  -- 추후 인증 시스템 연동
  change_reason TEXT,
  batch_no VARCHAR(50),
  quality_check BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_coating_history_item ON coating_process_history(item_id);
CREATE INDEX idx_coating_history_batch ON coating_process_history(batch_no);
CREATE INDEX idx_coating_history_date ON coating_process_history(changed_at);

-- 자동 이력 생성 트리거
CREATE OR REPLACE FUNCTION log_coating_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.coating_status IS DISTINCT FROM NEW.coating_status THEN
    INSERT INTO coating_process_history (
      item_id,
      from_status,
      to_status,
      changed_at,
      notes
    ) VALUES (
      NEW.item_id,
      OLD.coating_status,
      NEW.coating_status,
      NOW(),
      'Auto-logged by trigger'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coating_status_change
  AFTER UPDATE ON items
  FOR EACH ROW
  WHEN (OLD.coating_status IS DISTINCT FROM NEW.coating_status)
  EXECUTE FUNCTION log_coating_status_change();
```

### 2. coating_batches (배치 관리 테이블)
```sql
CREATE TABLE coating_batches (
  batch_id SERIAL PRIMARY KEY,
  batch_no VARCHAR(50) UNIQUE NOT NULL,
  batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (batch_status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  rework_items INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  supervisor VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_coating_batches_no ON coating_batches(batch_no);
CREATE INDEX idx_coating_batches_status ON coating_batches(batch_status);
CREATE INDEX idx_coating_batches_date ON coating_batches(batch_date);

-- 자동 batch_no 생성 함수
CREATE OR REPLACE FUNCTION generate_batch_no()
RETURNS VARCHAR(50) AS $$
DECLARE
  today VARCHAR(8);
  seq_num INTEGER;
BEGIN
  today := TO_CHAR(NOW(), 'YYYYMMDD');

  SELECT COALESCE(MAX(CAST(SUBSTRING(batch_no FROM 10) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM coating_batches
  WHERE batch_no LIKE 'COAT' || today || '%';

  RETURN 'COAT' || today || LPAD(seq_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
```

### 3. coating_batch_items (배치 품목 상세)
```sql
CREATE TABLE coating_batch_items (
  batch_item_id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES coating_batches(batch_id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  coating_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (coating_status IN ('pending', 'in_progress', 'completed', 'failed')),
  quality_result VARCHAR(20)
    CHECK (quality_result IN ('pass', 'fail', 'rework', 'pending')),
  coated_at TIMESTAMP,
  inspector VARCHAR(100),
  defect_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_batch_items_batch ON coating_batch_items(batch_id);
CREATE INDEX idx_batch_items_item ON coating_batch_items(item_id);
CREATE INDEX idx_batch_items_quality ON coating_batch_items(quality_result);

-- 배치 통계 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_batch_statistics()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE coating_batches
  SET
    completed_items = (
      SELECT COUNT(*)
      FROM coating_batch_items
      WHERE batch_id = NEW.batch_id
        AND coating_status = 'completed'
    ),
    failed_items = (
      SELECT COUNT(*)
      FROM coating_batch_items
      WHERE batch_id = NEW.batch_id
        AND quality_result = 'fail'
    ),
    rework_items = (
      SELECT COUNT(*)
      FROM coating_batch_items
      WHERE batch_id = NEW.batch_id
        AND quality_result = 'rework'
    ),
    updated_at = NOW()
  WHERE batch_id = NEW.batch_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_batch_stats
  AFTER INSERT OR UPDATE ON coating_batch_items
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_statistics();
```

### Migration Files
- `20250120_create_coating_workflow_tables.sql`
- `20250120_create_coating_workflow_tables_rollback.sql`

---

## 🔧 Layer 2: Types & Business Logic (3-4시간)

### TypeScript Interfaces
```typescript
// src/types/coating.ts

export type CoatingStatus = 'no_coating' | 'before_coating' | 'after_coating';
export type BatchStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type QualityResult = 'pass' | 'fail' | 'rework' | 'pending';

export interface CoatingProcessHistory {
  history_id: number;
  item_id: number;
  transaction_id?: number;
  from_status: CoatingStatus | null;
  to_status: CoatingStatus;
  changed_at: string;
  changed_by?: number;
  change_reason?: string;
  batch_no?: string;
  quality_check: boolean;
  notes?: string;
  created_at: string;
}

export interface CoatingBatch {
  batch_id: number;
  batch_no: string;
  batch_date: string;
  batch_status: BatchStatus;
  total_items: number;
  completed_items: number;
  failed_items: number;
  rework_items: number;
  started_at?: string;
  completed_at?: string;
  supervisor?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CoatingBatchItem {
  batch_item_id: number;
  batch_id: number;
  item_id: number;
  quantity: number;
  coating_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  quality_result?: QualityResult;
  coated_at?: string;
  inspector?: string;
  defect_type?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 상태 전이 규칙
export const COATING_STATUS_TRANSITIONS: Record<CoatingStatus, CoatingStatus[]> = {
  'no_coating': ['before_coating'],
  'before_coating': ['after_coating', 'no_coating'],  // 롤백 허용
  'after_coating': ['before_coating']  // 재도장 허용
};

// 상태 전이 검증 함수
export function isValidCoatingTransition(
  fromStatus: CoatingStatus | null,
  toStatus: CoatingStatus
): boolean {
  if (!fromStatus) return true;  // 초기 설정
  if (fromStatus === toStatus) return true;  // 변경 없음

  const allowedTransitions = COATING_STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions.includes(toStatus);
}
```

### Zod Validation Schemas
```typescript
// src/lib/validation.ts에 추가

import { z } from 'zod';

export const CoatingStatusChangeSchema = z.object({
  item_id: z.number().int().positive(),
  new_status: z.enum(['no_coating', 'before_coating', 'after_coating']),
  change_reason: z.string().optional(),
  batch_no: z.string().max(50).optional(),
  quality_check: z.boolean().default(false),
  notes: z.string().optional()
});

export const CoatingBatchCreateSchema = z.object({
  batch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supervisor: z.string().max(100).optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    item_id: z.number().int().positive(),
    quantity: z.number().positive()
  })).min(1)
});

export const CoatingBatchUpdateSchema = z.object({
  batch_status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']).optional(),
  supervisor: z.string().max(100).optional(),
  notes: z.string().optional()
});

export const QualityCheckSchema = z.object({
  batch_item_id: z.number().int().positive(),
  quality_result: z.enum(['pass', 'fail', 'rework']),
  inspector: z.string().max(100),
  defect_type: z.string().max(100).optional(),
  notes: z.string().optional()
});
```

---

## 🚀 Layer 3: API Routes (4-5시간)

### 1. POST /api/coating/change-status
**목적**: 품목의 도장 상태 변경 (이력 자동 기록)
```typescript
// src/app/api/coating/change-status/route.ts

import { createValidatedRoute } from '@/lib/validationMiddleware';
import { CoatingStatusChangeSchema } from '@/lib/validation';
import { getSupabaseClient, createSuccessResponse, handleSupabaseError } from '@/lib/db-unified';
import { isValidCoatingTransition } from '@/types/coating';

export const POST = createValidatedRoute(
  async (request) => {
    const text = await request.text();
    const data = JSON.parse(text);

    const supabase = getSupabaseClient();

    // 1. 현재 상태 조회
    const { data: item, error: fetchError } = await supabase
      .from('items')
      .select('item_id, coating_status')
      .eq('item_id', data.item_id)
      .single();

    if (fetchError) {
      return handleSupabaseError('select', 'items', fetchError);
    }

    // 2. 상태 전이 검증
    if (!isValidCoatingTransition(item.coating_status, data.new_status)) {
      return Response.json({
        success: false,
        error: `Invalid status transition: ${item.coating_status} → ${data.new_status}`
      }, { status: 400 });
    }

    // 3. 상태 업데이트 (트리거가 자동으로 이력 생성)
    const { error: updateError } = await supabase
      .from('items')
      .update({ coating_status: data.new_status })
      .eq('item_id', data.item_id);

    if (updateError) {
      return handleSupabaseError('update', 'items', updateError);
    }

    // 4. 추가 메타데이터 업데이트 (배치 번호, 품질 검사 등)
    if (data.batch_no || data.quality_check || data.change_reason) {
      await supabase
        .from('coating_process_history')
        .update({
          batch_no: data.batch_no,
          quality_check: data.quality_check,
          change_reason: data.change_reason,
          notes: data.notes
        })
        .eq('item_id', data.item_id)
        .order('changed_at', { ascending: false })
        .limit(1);
    }

    return createSuccessResponse({
      item_id: data.item_id,
      from_status: item.coating_status,
      to_status: data.new_status,
      changed_at: new Date().toISOString()
    });
  },
  {
    bodySchema: CoatingStatusChangeSchema,
    resource: 'coating',
    action: 'change_status',
    requireAuth: false
  }
);
```

### 2. GET /api/coating/history
**목적**: 도장 이력 조회 (필터링 + 페이지네이션)
```typescript
// src/app/api/coating/history/route.ts

export const GET = createValidatedRoute(
  async (request) => {
    const searchParams = request.nextUrl.searchParams;
    const item_id = searchParams.get('item_id');
    const batch_no = searchParams.get('batch_no');
    const from_date = searchParams.get('from_date');
    const to_date = searchParams.get('to_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const supabase = getSupabaseClient();

    let query = supabase
      .from('coating_process_history')
      .select('*, items(item_code, item_name)', { count: 'exact' });

    // 필터 적용
    if (item_id) query = query.eq('item_id', parseInt(item_id));
    if (batch_no) query = query.eq('batch_no', batch_no);
    if (from_date) query = query.gte('changed_at', from_date);
    if (to_date) query = query.lte('changed_at', to_date);

    // 페이지네이션
    const offset = (page - 1) * limit;
    query = query
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return handleSupabaseError('select', 'coating_process_history', error);
    }

    return createSuccessResponse(data, {
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      totalCount: count || 0
    });
  },
  {
    resource: 'coating',
    action: 'read_history',
    requireAuth: false
  }
);
```

### 3. POST /api/coating/batches
**목적**: 새 도장 배치 생성
```typescript
// src/app/api/coating/batches/route.ts

export const POST = createValidatedRoute(
  async (request) => {
    const text = await request.text();
    const data = JSON.parse(text);

    const supabase = getSupabaseClient();

    // 1. batch_no 자동 생성
    const { data: batchNoResult } = await supabase.rpc('generate_batch_no');
    const batch_no = batchNoResult;

    // 2. 배치 생성
    const { data: batch, error: batchError } = await supabase
      .from('coating_batches')
      .insert({
        batch_no,
        batch_date: data.batch_date,
        total_items: data.items.length,
        supervisor: data.supervisor,
        notes: data.notes
      })
      .select()
      .single();

    if (batchError) {
      return handleSupabaseError('insert', 'coating_batches', batchError);
    }

    // 3. 배치 품목 생성
    const batchItems = data.items.map((item: any) => ({
      batch_id: batch.batch_id,
      item_id: item.item_id,
      quantity: item.quantity,
      coating_status: 'pending',
      quality_result: 'pending'
    }));

    const { error: itemsError } = await supabase
      .from('coating_batch_items')
      .insert(batchItems);

    if (itemsError) {
      // 롤백: 배치 삭제
      await supabase.from('coating_batches').delete().eq('batch_id', batch.batch_id);
      return handleSupabaseError('insert', 'coating_batch_items', itemsError);
    }

    return createSuccessResponse(batch, { status: 201 });
  },
  {
    bodySchema: CoatingBatchCreateSchema,
    resource: 'coating_batches',
    action: 'create',
    requireAuth: false
  }
);
```

### 4. GET /api/coating/batches
**목적**: 배치 목록 조회
### 5. GET /api/coating/batches/[id]
**목적**: 배치 상세 조회 (배치 품목 포함)
### 6. PUT /api/coating/batches/[id]/start
**목적**: 배치 작업 시작 (batch_status → 'in_progress')
### 7. PUT /api/coating/batches/[id]/complete
**목적**: 배치 작업 완료 (batch_status → 'completed')
### 8. POST /api/coating/quality-check
**목적**: 품질 검사 결과 입력 (pass/fail/rework)

**Note**: 6-8번 API는 간단한 상태 업데이트 패턴이므로 상세 코드 생략

---

## 🎨 Layer 4: UI Components (5-7시간)

### Page 1: /coating/dashboard (도장 공정 대시보드)
**컴포넌트**: `src/app/coating/dashboard/page.tsx`

**주요 기능**:
- 📊 실시간 도장 현황 카드
  - 총 품목 수 (도장 필요, 도장 전, 도장 후)
  - 진행 중인 배치 수
  - 오늘의 품질 검사 결과 (Pass/Fail/Rework)
- 📈 도장 상태 분포 파이 차트
- 📅 최근 7일간 배치 처리 추이 (라인 차트)
- 🚨 품질 불량 알림 (Fail/Rework 품목 강조)

**주요 컴포넌트**:
```typescript
// src/app/coating/dashboard/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoatingStatusChart } from './components/CoatingStatusChart';
import { BatchTrendChart } from './components/BatchTrendChart';
import { QualityAlertsWidget } from './components/QualityAlertsWidget';

export default function CoatingDashboardPage() {
  const [stats, setStats] = useState({
    total_items: 0,
    no_coating: 0,
    before_coating: 0,
    after_coating: 0,
    active_batches: 0,
    quality_pass: 0,
    quality_fail: 0,
    quality_rework: 0
  });

  useEffect(() => {
    async function fetchStats() {
      const res = await fetch('/api/coating/dashboard-stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // 30초마다 새로고침
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">도장 공정 대시보드</h1>

      {/* 상태 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>도장 필요</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.before_coating}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>도장 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.after_coating}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>진행 중 배치</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {stats.active_batches}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>오늘의 품질 검사</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>합격:</span>
                <span className="font-bold text-green-600">{stats.quality_pass}</span>
              </div>
              <div className="flex justify-between">
                <span>불합격:</span>
                <span className="font-bold text-red-600">{stats.quality_fail}</span>
              </div>
              <div className="flex justify-between">
                <span>재작업:</span>
                <span className="font-bold text-yellow-600">{stats.quality_rework}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>도장 상태 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <CoatingStatusChart data={stats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 7일 배치 처리 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <BatchTrendChart />
          </CardContent>
        </Card>
      </div>

      {/* 품질 알림 */}
      <QualityAlertsWidget />
    </div>
  );
}
```

---

### Page 2: /coating/batches (배치 관리)
**컴포넌트**: `src/app/coating/batches/page.tsx`

**주요 기능**:
- 📋 배치 목록 테이블 (VirtualTable 사용)
- ➕ 신규 배치 생성 버튼 → 모달
- 🔍 필터링: 상태(pending/in_progress/completed), 날짜 범위
- 📊 배치별 진행률 표시 (completed_items / total_items)
- ✅ 배치 시작/완료 액션 버튼

**주요 컴포넌트**:
```typescript
// src/app/coating/batches/components/BatchListTable.tsx

'use client';

import { useState, useEffect } from 'react';
import { VirtualTable } from '@/components/ui/VirtualTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { CoatingBatch } from '@/types/coating';

const BATCH_STATUS_COLORS: Record<string, string> = {
  'pending': 'bg-gray-500',
  'in_progress': 'bg-blue-500',
  'completed': 'bg-green-500',
  'failed': 'bg-red-500',
  'cancelled': 'bg-gray-400'
};

export function BatchListTable() {
  const [batches, setBatches] = useState<CoatingBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBatches();
  }, []);

  async function fetchBatches() {
    setLoading(true);
    const res = await fetch('/api/coating/batches');
    const data = await res.json();
    if (data.success) {
      setBatches(data.data);
    }
    setLoading(false);
  }

  async function handleStartBatch(batchId: number) {
    const res = await fetch(`/api/coating/batches/${batchId}/start`, {
      method: 'PUT'
    });
    if (res.ok) {
      fetchBatches(); // 새로고침
    }
  }

  async function handleCompleteBatch(batchId: number) {
    const res = await fetch(`/api/coating/batches/${batchId}/complete`, {
      method: 'PUT'
    });
    if (res.ok) {
      fetchBatches();
    }
  }

  const columns = [
    {
      key: 'batch_no',
      header: '배치 번호',
      render: (batch: CoatingBatch) => (
        <a href={`/coating/batches/${batch.batch_id}`} className="text-blue-600 hover:underline">
          {batch.batch_no}
        </a>
      )
    },
    {
      key: 'batch_date',
      header: '작업 날짜',
      render: (batch: CoatingBatch) => new Date(batch.batch_date).toLocaleDateString('ko-KR')
    },
    {
      key: 'batch_status',
      header: '상태',
      render: (batch: CoatingBatch) => (
        <Badge className={BATCH_STATUS_COLORS[batch.batch_status]}>
          {batch.batch_status}
        </Badge>
      )
    },
    {
      key: 'progress',
      header: '진행률',
      render: (batch: CoatingBatch) => {
        const percentage = batch.total_items > 0
          ? (batch.completed_items / batch.total_items) * 100
          : 0;
        return (
          <div className="flex items-center gap-2">
            <Progress value={percentage} className="w-24" />
            <span className="text-sm">{batch.completed_items}/{batch.total_items}</span>
          </div>
        );
      }
    },
    {
      key: 'supervisor',
      header: '담당자'
    },
    {
      key: 'actions',
      header: '액션',
      render: (batch: CoatingBatch) => (
        <div className="flex gap-2">
          {batch.batch_status === 'pending' && (
            <Button size="sm" onClick={() => handleStartBatch(batch.batch_id)}>
              시작
            </Button>
          )}
          {batch.batch_status === 'in_progress' && (
            <Button size="sm" variant="success" onClick={() => handleCompleteBatch(batch.batch_id)}>
              완료
            </Button>
          )}
        </div>
      )
    }
  ];

  if (loading) return <div>로딩 중...</div>;

  return <VirtualTable data={batches} columns={columns} height={600} />;
}
```

---

### Page 3: /coating/history (이력 조회)
**컴포넌트**: `src/app/coating/history/page.tsx`

**주요 기능**:
- 📜 전체 도장 상태 변경 이력 테이블
- 🔍 필터링: 품목, 배치 번호, 날짜 범위, 상태 전이
- 📥 Excel 내보내기 버튼
- 🔗 품목 클릭 → 품목 상세 페이지 이동

---

### Component 4: CreateBatchModal (배치 생성 모달)
**위치**: `src/app/coating/batches/components/CreateBatchModal.tsx`

**주요 기능**:
- 품목 검색 및 추가
- 배치 날짜 선택
- 담당자 입력
- 비고 입력
- 품목별 수량 입력

---

## 📊 복잡도 비교

| 항목 | Phase 6A-1 | Phase 6A-2 | 증가율 |
|------|-----------|-----------|--------|
| 데이터베이스 테이블 | 0 (기존 활용) | 3 (신규) | +300% |
| 마이그레이션 파일 | 2 (추가 컬럼) | 6 (테이블+트리거) | +200% |
| API 엔드포인트 | 2 (수정) | 8 (신규) | +400% |
| TypeScript 인터페이스 | 1 (수정) | 4 (신규) | +400% |
| UI 페이지 | 2 (수정) | 3 (신규) | +150% |
| 컴포넌트 | 2 (수정) | 7 (신규) | +350% |
| 예상 코드 줄 수 | 400줄 | 2,500줄 | +525% |
| **총 복잡도** | **1.0x** | **5.5x** | **+450%** |

---

## 🚀 실행 전략 비교

### Sequential 실행 (단일 에이전트)
```
Day 1 (8h):
├── Database Schema (2.5h)
│   ├── 3 테이블 생성
│   ├── 인덱스 설정
│   ├── 트리거 작성
│   └── 마이그레이션 파일
├── Types & Validation (3.5h)
│   ├── TypeScript 인터페이스
│   ├── Zod 스키마
│   └── 비즈니스 로직 함수
└── API Routes (Part 1) (2h)
    ├── change-status
    └── history

Day 2 (8h):
├── API Routes (Part 2) (3h)
│   ├── batches (CRUD)
│   ├── start/complete
│   └── quality-check
└── UI Components (5h)
    ├── Dashboard 페이지
    ├── 상태 카드
    └── 차트 컴포넌트

Day 3 (6h):
├── UI Components (Part 2) (4h)
│   ├── Batches 페이지
│   ├── History 페이지
│   └── CreateBatchModal
└── Testing & Debugging (2h)
    ├── API 테스트
    └── UI 통합 테스트

Total: 22시간 (3일, ~7h/day)
```

### Parallel 실행 (Multi-Agent)
```
Agent 1 (Database & Backend):
├── Day 1 Morning (4h): Database Schema
│   ├── 3 테이블 생성
│   ├── 트리거 작성
│   └── 마이그레이션
├── Day 1 Afternoon (4h): Types & API (Part 1)
│   ├── TypeScript 인터페이스
│   ├── Zod 스키마
│   └── change-status, history API
└── Day 2 Morning (3h): API (Part 2)
    ├── batches CRUD
    └── quality-check

Agent 2 (Frontend):
├── Day 1 Afternoon (4h): Dashboard
│   ├── 대시보드 페이지
│   ├── 상태 카드
│   └── 차트 컴포넌트 (Mock 데이터)
└── Day 2 Morning (4h): Batches & History
    ├── Batches 페이지
    ├── History 페이지
    └── CreateBatchModal

Coordination (Day 2 Afternoon, 2h):
├── API ↔ UI 통합
├── 실제 데이터 연동
└── 통합 테스트

Total: 11시간 (Agent1: 11h, Agent2: 8h, Coordination: 2h)
실제 달력 시간: 1.5일 (~8h/day)
```

---

## ⚡ 성능 최적화 고려사항

### Database 최적화
- ✅ **인덱스 전략**: 자주 쿼리되는 컬럼에 인덱스 (item_id, batch_no, changed_at)
- ✅ **트리거 최적화**: 배치 통계 업데이트 트리거는 INSERT/UPDATE 후에만 실행
- ✅ **JSONB 활용 고려**: 품질 검사 상세 정보를 JSONB로 저장하여 유연성 확보
- ⚠️ **파티셔닝 고려**: 이력 테이블이 수백만 행 이상 커지면 날짜 기준 파티셔닝

### API 최적화
- ✅ **Pagination**: 모든 목록 조회 API에 페이지네이션 적용
- ✅ **Select 최적화**: 필요한 컬럼만 SELECT (불필요한 JOIN 제거)
- ✅ **트랜잭션 사용**: 배치 생성 시 batch + batch_items를 하나의 트랜잭션으로
- ⚠️ **Caching**: 대시보드 통계는 Redis 캐싱 고려 (30초 TTL)

### UI 최적화
- ✅ **Virtual Scrolling**: 대용량 목록은 VirtualTable 사용
- ✅ **Lazy Loading**: 차트 컴포넌트는 dynamic import로 지연 로딩
- ✅ **React Query**: 서버 상태 캐싱 및 자동 리페치
- ⚠️ **WebSocket 고려**: 실시간 배치 상태 업데이트가 필요하면 WebSocket 연동

---

## 🔒 보안 고려사항

### 인증/권한 (추후 구현 시)
- ⚠️ **Role-Based Access Control (RBAC)**
  - `coating_operator`: 상태 변경, 품질 검사 권한
  - `coating_supervisor`: 배치 생성/시작/완료 권한
  - `coating_admin`: 전체 권한 + 이력 삭제

### Audit Trail
- ✅ `coating_process_history.changed_by`: 사용자 ID 기록 (현재 null 허용, 추후 인증 연동)
- ✅ 모든 상태 변경 자동 기록 (트리거)
- ✅ 소프트 삭제: 이력은 절대 물리 삭제하지 않음

### Input Validation
- ✅ Zod 스키마로 서버 사이드 검증
- ✅ SQL Injection 방지 (Supabase Prepared Statements)
- ✅ 상태 전이 규칙 강제 (isValidCoatingTransition)

---

## 📝 테스트 전략

### Unit Tests (Jest)
```typescript
// src/types/coating.test.ts
describe('isValidCoatingTransition', () => {
  it('should allow no_coating → before_coating', () => {
    expect(isValidCoatingTransition('no_coating', 'before_coating')).toBe(true);
  });

  it('should allow before_coating → after_coating', () => {
    expect(isValidCoatingTransition('before_coating', 'after_coating')).toBe(true);
  });

  it('should reject no_coating → after_coating (직접 전이 불가)', () => {
    expect(isValidCoatingTransition('no_coating', 'after_coating')).toBe(false);
  });

  it('should allow rollback: before_coating → no_coating', () => {
    expect(isValidCoatingTransition('before_coating', 'no_coating')).toBe(true);
  });
});
```

### Integration Tests (API)
```bash
# API 엔드포인트 테스트 (총 8개)
npm run test:api -- coating

# 예상 테스트 케이스:
# ✅ POST /api/coating/change-status (정상 케이스)
# ✅ POST /api/coating/change-status (잘못된 전이)
# ✅ GET /api/coating/history (필터링)
# ✅ POST /api/coating/batches (배치 생성)
# ✅ PUT /api/coating/batches/[id]/start
# ✅ PUT /api/coating/batches/[id]/complete
# ✅ POST /api/coating/quality-check
# ✅ 트리거 동작 확인 (자동 이력 생성)
```

### E2E Tests (Playwright)
```typescript
// tests/e2e/coating-workflow.spec.ts
test('도장 공정 전체 워크플로우', async ({ page }) => {
  // 1. 배치 생성
  await page.goto('/coating/batches');
  await page.click('button:has-text("배치 생성")');
  await page.fill('[name="batch_date"]', '2025-01-20');
  await page.fill('[name="supervisor"]', '김도장');
  // ... 품목 추가
  await page.click('button:has-text("생성")');

  // 2. 배치 시작
  await page.click('button:has-text("시작")');
  await expect(page.locator('text=in_progress')).toBeVisible();

  // 3. 품질 검사
  await page.goto('/coating/batches/1');
  await page.click('button:has-text("품질 검사")');
  await page.selectOption('[name="quality_result"]', 'pass');
  await page.click('button:has-text("저장")');

  // 4. 배치 완료
  await page.click('button:has-text("완료")');
  await expect(page.locator('text=completed')).toBeVisible();

  // 5. 이력 확인
  await page.goto('/coating/history');
  await expect(page.locator('text=before_coating → after_coating')).toBeVisible();
});
```

---

## 📈 성공 지표 (KPI)

### 기능 완성도
- ✅ 모든 API 엔드포인트 동작 확인 (8/8)
- ✅ 모든 UI 페이지 렌더링 확인 (3/3)
- ✅ 상태 전이 규칙 100% 준수
- ✅ 트리거 자동 동작 확인

### 성능
- ✅ API 응답 시간 <200ms (평균)
- ✅ Dashboard 로딩 시간 <2초
- ✅ 배치 생성 시간 <1초 (품목 10개 기준)
- ✅ 이력 조회 1,000건 <500ms

### 품질
- ✅ 테스트 커버리지 ≥80%
- ✅ TypeScript 타입 에러 0건
- ✅ ESLint 경고 0건
- ✅ 한글 인코딩 문제 0건

---

## 🎯 다음 단계 제안

### 즉시 실행 가능 (Phase 6A-2 구현 후)
1. **Option A (MVP)**: 11-14시간
   - 이력 추적 + 상태 전이 검증만
   - 가장 빠른 출시

2. **Option B (Full Feature)**: 15-20시간 ⭐ **권장**
   - 이력 + 배치 관리 + 품질 검사
   - 완전한 워크플로우 자동화

3. **Option C (Complete System)**: 17-24시간
   - Full Feature + 고급 분석 + Excel 통합

### 장기 계획
4. **Phase 6A-3**: 고급 분석 & 리포팅 (8-10시간)
   - 도장 비용 분석
   - 품질 불량률 분석
   - 배치 효율성 리포트

5. **Phase 6B**: Excel 통합 개선 (6-8시간)
   - 도장 이력 Excel 가져오기
   - 배치 일괄 생성 (Excel)
   - 품질 검사 결과 일괄 업로드

6. **인증/권한 시스템** (우선순위 최상위)
   - 사용자 로그인
   - Role-Based Access Control
   - Audit Trail에 changed_by 자동 연동

---

## 📌 의사결정 필요 사항

### 1. 구현 범위 선택
- [ ] Option A: MVP (11-14h)
- [ ] Option B: Full Feature (15-20h) ⭐ 권장
- [ ] Option C: Complete System (17-24h)
- [ ] 연기 (인증 시스템 우선 개발)

### 2. 실행 방식 선택
- [ ] Sequential (단일 에이전트, 17-24h)
- [ ] Parallel (Multi-Agent, 8-12h) ⭐ 권장

### 3. 우선순위 결정
- [ ] Phase 6A-2 즉시 시작
- [ ] 인증/권한 시스템 우선 (Phase 7)
- [ ] 기타 기능 우선

---

**문서 버전**: 1.0
**작성일**: 2025-01-19
**작성자**: Claude Code SuperClaude Framework
**상태**: ✅ 분석 완료, 의사결정 대기
**다음 단계**: 사용자 선택에 따라 구현 시작
