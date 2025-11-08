# Phase 4: Wave 1 실행 계획 (Codex Go 승인)

**예상 시간**: 10시간
**상태**: 실행 대기 (Codex Go 승인 완료)
**의존성**: Phase 3 완료

---

## ✅ Codex Go 승인 내용

### Decision
> **"Decision: Go"**
>
> "Plan now addresses the Critical Warning immediately (ISR/SSG kicked off in Wave 1) while keeping bundle work and API standardization in sync."

### Remaining Watchpoints
1. **API 계약 고정**: Wave 1 종료 시 API 계약 변경 금지 (Wave 3까지 대기)
2. **ISR 캐시 무효화 로깅**: revalidation 이벤트 로깅하여 QA 검증 가능하도록
3. **Bundle 모듈화 커버리지**: 각 모듈 이동 시 smoke tests로 Wave 2 디버깅 방지

### Risks (관리 필요)
- **Wave 1 범위 넓음**: API + Bundle + ISR 동시 작업 → 매일 동기화 필수
- **TanStack Query 회귀**: Feature flags + 에러율 모니터링

---

## 🎯 Wave 1 목표 (10시간)

### 전략
"Critical Performance + Foundation"

4개 에이전트 병렬 실행:
- **Agent 2** (backend-architect): API 표준화
- **Agent 4** (frontend-developer): Bundle 최적화
- **Agent 5** (architect-reviewer): ISR/SSG 복원 (CRITICAL)
- **Agent 6** (qa): Wave 1 검증

### 성공 지표
- API routes: 128 → 60 (53% 감소)
- Bundle size: 500KB → 400KB (20% 감소)
- Lazy loaded components: 4 → 60
- SSG/ISR pages: 0 → 8+
- Page load time: 2.3s → 1.3s (43% 개선)
- TTFB: ≤1.5s
- **Wave 1 성능 리포트 생성** (Wave 2 baseline)

---

## 🤖 Agent 2: API Standardization (backend-architect)

### 담당자
`backend-architect` agent (Task tool)

### 목표
128개 API routes를 60개로 표준화, 일관된 응답 형식, 중앙집중식 에러 처리

### 세부 작업 (6시간)

#### 1. CRUDHandler 기본 클래스 생성 (2시간)
**파일**: `src/lib/api/CRUDHandler.ts`

```typescript
export abstract class CRUDHandler<T> {
  protected tableName: string;
  protected supabase: SupabaseClient;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.supabase = getSupabaseClient();
  }

  async getAll(filters?: Record<string, any>): Promise<APIResponse<T[]>> {
    try {
      let query = this.supabase.from(this.tableName).select('*');

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data, error } = await query;

      if (error) return this.handleError('getAll', error);
      return this.createSuccessResponse(data);
    } catch (error) {
      return this.handleError('getAll', error);
    }
  }

  async getById(id: string | number): Promise<APIResponse<T>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) return this.handleError('getById', error);
      return this.createSuccessResponse(data);
    } catch (error) {
      return this.handleError('getById', error);
    }
  }

  async create(data: Partial<T>): Promise<APIResponse<T>> {
    try {
      const { data: created, error } = await this.supabase
        .from(this.tableName)
        .insert(data)
        .select()
        .single();

      if (error) return this.handleError('create', error);
      return this.createSuccessResponse(created);
    } catch (error) {
      return this.handleError('create', error);
    }
  }

  async update(id: string | number, data: Partial<T>): Promise<APIResponse<T>> {
    try {
      const { data: updated, error } = await this.supabase
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) return this.handleError('update', error);
      return this.createSuccessResponse(updated);
    } catch (error) {
      return this.handleError('update', error);
    }
  }

  async delete(id: string | number): Promise<APIResponse<void>> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) return this.handleError('delete', error);
      return this.createSuccessResponse(undefined);
    } catch (error) {
      return this.handleError('delete', error);
    }
  }

  protected createSuccessResponse<D>(data: D): APIResponse<D> {
    return {
      success: true,
      data
    };
  }

  protected handleError(operation: string, error: any): APIResponse<any> {
    console.error(`[${this.tableName}] ${operation} error:`, error);
    return {
      success: false,
      error: error.message || 'An error occurred'
    };
  }
}
```

#### 2. APIResponse 인터페이스 표준화 (1시간)
**파일**: `src/lib/api/types.ts`

```typescript
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface FilterParams {
  [key: string]: any;
}

export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}
```

#### 3. 20개 핸들러 클래스 생성 (2시간)
**파일들**:
- `src/lib/api/handlers/ItemsHandler.ts`
- `src/lib/api/handlers/CompaniesHandler.ts`
- `src/lib/api/handlers/BOMHandler.ts`
- `src/lib/api/handlers/InventoryHandler.ts`
- `src/lib/api/handlers/SalesHandler.ts`
- `src/lib/api/handlers/PurchasesHandler.ts`
- ... (총 20개)

**예시**: `ItemsHandler.ts`
```typescript
import { CRUDHandler } from '../CRUDHandler';
import { Item } from '@/types/database';

export class ItemsHandler extends CRUDHandler<Item> {
  constructor() {
    super('items');
  }

  async checkDuplicateCode(code: string): Promise<boolean> {
    const { data } = await this.supabase
      .from(this.tableName)
      .select('item_id')
      .eq('item_code', code)
      .single();

    return !!data;
  }

  async getActiveItems(): Promise<APIResponse<Item[]>> {
    return this.getAll({ is_active: true });
  }
}
```

#### 4. API Routes 리팩토링 (1시간)
**128개 routes → 60개 routes로 통합**

**Before** (`src/app/api/items/route.ts`):
```typescript
export async function GET(request: Request) {
  const text = await request.text();
  const filters = JSON.parse(text);

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('is_active', filters.is_active || true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
```

**After**:
```typescript
import { ItemsHandler } from '@/lib/api/handlers/ItemsHandler';

export async function GET(request: Request) {
  const handler = new ItemsHandler();
  const result = await handler.getActiveItems();

  return NextResponse.json(result, {
    status: result.success ? 200 : 500
  });
}
```

#### 5. API 계약 문서 생성 (Codex Watchpoint) (1시간)
**파일**: `.plan7/api-contracts.md`

```markdown
# API 계약 (Wave 1 고정)

## 표준 응답 형식

모든 API는 다음 형식을 따릅니다:

### 성공 응답
\`\`\`json
{
  "success": true,
  "data": { /* ... */ },
  "pagination": { /* optional */ }
}
\`\`\`

### 에러 응답
\`\`\`json
{
  "success": false,
  "error": "Error message"
}
\`\`\`

## 엔드포인트별 계약

### GET /api/items
- Request: Query params (filters)
- Response: APIResponse<Item[]>

### POST /api/items
- Request: Body (Item data)
- Response: APIResponse<Item>

... (모든 60개 routes 문서화)
```

**중요**: Wave 1 종료 시 이 계약은 **고정**되며, Wave 2 중 변경 금지

### 완료 조건
- ✅ CRUDHandler 기본 클래스 작동
- ✅ 60개 routes가 표준 형식 사용
- ✅ 모든 기존 기능 보존 (회귀 없음)
- ✅ API 계약 문서 생성
- ✅ Agent 6 통합 테스트 통과

---

## 🤖 Agent 4: Bundle Optimization (frontend-developer)

### 담당자
`frontend-developer` agent (Task tool)

### 목표
Bundle 크기 500KB → 400KB (20% 감소), Legacy 모듈 안전 제거, Lazy loading 확대

### 세부 작업 (6시간)

#### 1. Legacy 모듈 분석 및 모듈화 (Codex Watchpoint) (3시간)

**transactionManager.ts (1,617 lines) 처리**:

**Step 1**: 사용 여부 분석
```bash
# 모든 import 확인
grep -r "from '@/lib/transactionManager'" src/
```

**Step 2**: 모듈 분리
```typescript
// src/lib/transaction/transactionCore.ts (핵심 기능만)
export function validateTransaction(data: any) {
  // 실제 사용 중인 함수만 추출
}

// src/lib/transaction/transactionHelpers.ts (헬퍼 함수)
export function formatTransactionDate(date: Date) {
  // ...
}
```

**Step 3**: Dynamic import로 전환
```typescript
// Before
import { validateTransaction } from '@/lib/transactionManager';

// After
const { validateTransaction } = await import('@/lib/transaction/transactionCore');
```

**query-optimizer.ts (748 lines) 처리**:
- 동일한 프로세스: 분석 → 모듈화 → Dynamic import → 검증

**Coverage 추가** (Codex Watchpoint):
```typescript
// tests/smoke/legacy-modules.test.ts
describe('Legacy Module Smoke Tests', () => {
  it('transactionCore validates correctly', async () => {
    const { validateTransaction } = await import('@/lib/transaction/transactionCore');
    expect(validateTransaction({ amount: 100 })).toBeTruthy();
  });
});
```

#### 2. Lazy Loading 확대 (4개 → 60개) (2시간)

**현재 lazy loaded**: 4개 컴포넌트
**목표**: 60개 컴포넌트

**우선순위**:
1. **Large Components** (>200 lines): Dashboard charts, complex forms
2. **Modal Components**: All modals and dialogs
3. **Route Components**: Page-specific components

**패턴**:
```typescript
// Before
import DashboardChart from '@/components/dashboard/DashboardChart';

// After
const DashboardChart = dynamic(
  () => import('@/components/dashboard/DashboardChart'),
  { loading: () => <LoadingSpinner /> }
);
```

**대상 컴포넌트 예시**:
- `components/dashboard/TransactionChart.tsx`
- `components/dashboard/SalesChart.tsx`
- `components/inventory/InventoryTable.tsx`
- `components/modals/*` (모든 모달)
- `components/forms/ComplexForm.tsx`
- ... (총 56개 추가)

#### 3. React.memo 적용 (25개) (30분)

**대상**: 자주 리렌더링되는 컴포넌트

```typescript
// Before
export default function TableRow({ data }: Props) {
  return <tr>...</tr>;
}

// After
export default React.memo(function TableRow({ data }: Props) {
  return <tr>...</tr>;
}, (prevProps, nextProps) => {
  return prevProps.data.id === nextProps.data.id;
});
```

**적용 대상**:
- `VirtualTable` 내부 Row 컴포넌트
- Dashboard 차트 컴포넌트
- Form input 컴포넌트
- ... (총 25개)

#### 4. webpack-bundle-analyzer 실행 및 리포트 (30분)

```bash
npm run build
npm run analyze
```

**리포트 파일**: `.plan7/reports/wave1-bundle-analysis.html`

**분석 항목**:
- 가장 큰 번들 식별
- 중복 의존성 찾기
- Tree-shaking 기회
- 미사용 코드

### 완료 조건
- ✅ Legacy 모듈 안전 모듈화 (삭제 X)
- ✅ Smoke tests 통과
- ✅ 60개 컴포넌트 lazy loading 적용
- ✅ 25개 컴포넌트 React.memo 적용
- ✅ Bundle 크기: 500KB → 400KB (20%)
- ✅ webpack-bundle-analyzer 리포트 생성

---

## 🤖 Agent 5: ISR/SSG Restoration (architect-reviewer) - CRITICAL

### 담당자
`architect-reviewer` agent (Task tool)

### 목표
Codex Priority 1 Critical Warning 즉시 해소: force-dynamic 제거, ISR/SSG 구현

### 세부 작업 (6시간)

#### 1. force-dynamic 제거 계획 (1시간)

**현재 상태** (`src/app/layout.tsx`):
```typescript
export const dynamic = 'force-dynamic'; // 모든 페이지 동적 렌더링
```

**조정 후**:
```typescript
// layout.tsx에서 제거
// 각 페이지별로 필요한 경우만 설정
```

**페이지별 분류**:

| 페이지 | 전략 | 근거 |
|--------|------|------|
| `/dashboard` | force-dynamic | 실시간 데이터 필요 |
| `/master/items` | ISR (5min) | 자주 변경되지 않음 |
| `/master/companies` | ISR (5min) | 자주 변경되지 않음 |
| `/master/bom` | ISR (5min) | 정적 데이터 |
| `/` (landing) | SSG | 완전 정적 |
| `/about` | SSG | 완전 정적 |

#### 2. ISR 구현 (items, companies, bom) (2시간)

**파일**: `src/app/master/items/page.tsx`
```typescript
export const revalidate = 300; // 5분 (300초)

export default async function ItemsPage() {
  // 서버 컴포넌트로 전환
  const items = await getItems(); // 서버 사이드 fetch

  return (
    <div>
      <ItemsTable items={items} />
    </div>
  );
}

// Server-side 데이터 fetching
async function getItems() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('items').select('*');
  return data;
}
```

**동일 패턴 적용**:
- `src/app/master/companies/page.tsx`
- `src/app/master/bom/page.tsx`
- ... (총 5개 페이지)

#### 3. SSG 구현 (landing, about) (1시간)

**파일**: `src/app/page.tsx`
```typescript
export const dynamic = 'force-static'; // SSG

export default function LandingPage() {
  return (
    <div>
      <h1>태창 ERP 시스템</h1>
      {/* 정적 콘텐츠 */}
    </div>
  );
}
```

**적용 페이지**:
- `/` (landing)
- `/about`
- `/docs` (if exists)

#### 4. 캐시 무효화 전략 설계 및 로깅 (Codex Watchpoint) (1시간)

**전략 1**: Time-based revalidation (Wave 1)
```typescript
export const revalidate = 300; // 5분마다 자동 재생성
```

**전략 2**: On-demand revalidation (Wave 2 고려)
```typescript
// API route에서 호출
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  // 데이터 업데이트 후
  await updateItem(data);

  // 캐시 무효화
  revalidatePath('/master/items');

  return NextResponse.json({ success: true });
}
```

**로깅 추가** (Codex Watchpoint):
```typescript
// src/lib/revalidation-logger.ts
export function logRevalidation(path: string, reason: string) {
  console.log(`[Revalidation] ${new Date().toISOString()} - ${path} - ${reason}`);

  // QA 검증용: revalidation 이벤트 추적
  // Wave 1 검증 시 확인 가능
}
```

#### 5. 라우팅 최적화 (1시간)

**Prefetch 활성화**:
```typescript
// src/components/layout/Sidebar.tsx
<Link href="/master/items" prefetch={true}>
  품목 관리
</Link>
```

**Parallel Routes** (필요 시):
```
app/
├── @modal/
├── @sidebar/
└── page.tsx
```

### 완료 조건
- ✅ force-dynamic 제거 (dashboard 제외)
- ✅ ISR 구현: 5개 페이지 (5min revalidate)
- ✅ SSG 구현: 3개 페이지
- ✅ 캐시 무효화 로깅 구현
- ✅ TTFB ≤1.5s (Agent 6 측정)
- ✅ Revalidation 이벤트 로그 확인 가능

---

## 🤖 Agent 6: Wave 1 Validation & Smoke Tests (qa)

### 담당자
`qa` agent (Task tool)

### 목표
Wave 1 변경사항 통합 검증, 성능 측정, 회귀 방지

### 세부 작업 (4시간)

#### 1. API 통합 테스트 (1.5시간)

**파일**: `tests/integration/wave1-api.test.ts`

```typescript
describe('Wave 1 API Integration Tests', () => {
  describe('Standard Response Format', () => {
    it('GET /api/items returns APIResponse<Item[]>', async () => {
      const res = await fetch('http://localhost:5000/api/items');
      const json = await res.json();

      expect(json).toHaveProperty('success');
      expect(json.success).toBe(true);
      expect(json).toHaveProperty('data');
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('POST /api/items returns APIResponse<Item>', async () => {
      const res = await fetch('http://localhost:5000/api/items', {
        method: 'POST',
        body: JSON.stringify({ item_name: 'Test', item_code: 'TEST001' })
      });
      const json = await res.json();

      expect(json).toHaveProperty('success');
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('item_id');
    });

    it('Error response follows standard format', async () => {
      const res = await fetch('http://localhost:5000/api/items/9999999');
      const json = await res.json();

      expect(json).toHaveProperty('success');
      expect(json.success).toBe(false);
      expect(json).toHaveProperty('error');
    });
  });

  describe('API Contract Compliance', () => {
    it('All 60 routes use CRUDHandler pattern', async () => {
      // 각 route 검증
      const routes = [
        '/api/items',
        '/api/companies',
        '/api/bom',
        // ... 총 60개
      ];

      for (const route of routes) {
        const res = await fetch(`http://localhost:5000${route}`);
        const json = await res.json();
        expect(json).toHaveProperty('success');
      }
    });
  });
});
```

#### 2. ISR/SSG 동작 검증 (1시간)

**파일**: `tests/integration/wave1-isr.test.ts`

```typescript
describe('Wave 1 ISR/SSG Validation', () => {
  it('Items page uses ISR with 5min revalidate', async () => {
    const res1 = await fetch('http://localhost:5000/master/items');
    const html1 = await res1.text();

    // 5분 내 재요청 시 동일한 HTML (캐시됨)
    const res2 = await fetch('http://localhost:5000/master/items');
    const html2 = await res2.text();

    expect(html1).toBe(html2);
    expect(res2.headers.get('x-nextjs-cache')).toBe('HIT');
  });

  it('Dashboard uses force-dynamic (no cache)', async () => {
    const res = await fetch('http://localhost:5000/dashboard');
    expect(res.headers.get('x-nextjs-cache')).toBe('MISS');
  });

  it('Landing page is SSG (static)', async () => {
    const res = await fetch('http://localhost:5000/');
    expect(res.headers.get('x-nextjs-cache')).toBe('HIT');
  });
});
```

**Revalidation 로그 확인** (Codex Watchpoint):
```bash
# 서버 로그에서 revalidation 이벤트 확인
grep "\[Revalidation\]" .next/server.log
```

#### 3. 번들 크기 측정 (30분)

**측정 스크립트**: `scripts/measure-bundle.sh`
```bash
#!/bin/bash

npm run build

# .next/static 크기 측정
BUNDLE_SIZE=$(du -sh .next/static/chunks | awk '{print $1}')

echo "Bundle Size: $BUNDLE_SIZE"
echo "Target: 400KB"

# 목표 달성 확인
if [ "$BUNDLE_SIZE" -gt 400 ]; then
  echo "❌ Bundle size exceeds target"
  exit 1
else
  echo "✅ Bundle size meets target"
fi
```

#### 4. TTFB & Page Load 측정 (30분)

**측정 스크립트**: `scripts/measure-performance.js`
```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const metrics = {};

  for (const route of ['/master/items', '/master/companies', '/dashboard']) {
    await page.goto(`http://localhost:5000${route}`);

    // TTFB 측정
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes(route)),
      page.goto(`http://localhost:5000${route}`)
    ]);
    const ttfb = response.request().timing().responseStart;

    // Page Load 측정
    await page.waitForLoadState('networkidle');
    const loadTime = await page.evaluate(() =>
      performance.timing.loadEventEnd - performance.timing.navigationStart
    );

    metrics[route] = {
      ttfb: ttfb + 'ms',
      loadTime: loadTime + 'ms'
    };
  }

  console.log('Performance Metrics:');
  console.log(JSON.stringify(metrics, null, 2));

  await browser.close();
})();
```

**Target**:
- TTFB ≤ 1.5s
- Page Load ≤ 1.3s

#### 5. 회귀 테스트 (30분)

**기존 기능 보존 확인**:
```typescript
describe('Wave 1 Regression Tests', () => {
  it('Items CRUD operations still work', async () => {
    // Create
    const created = await fetch('/api/items', { method: 'POST', ... });
    expect(created.status).toBe(200);

    // Read
    const read = await fetch('/api/items/1');
    expect(read.status).toBe(200);

    // Update
    const updated = await fetch('/api/items/1', { method: 'PUT', ... });
    expect(updated.status).toBe(200);

    // Delete
    const deleted = await fetch('/api/items/1', { method: 'DELETE' });
    expect(deleted.status).toBe(200);
  });
});
```

#### 6. 성능 리포트 생성 (Codex Watchpoint) (30분)

**파일**: `.plan7/reports/wave1-performance-report.md`

```markdown
# Wave 1 Performance Report

**Date**: 2025-02-01
**Duration**: 10 hours

## Baseline (Before Wave 1)
- Bundle Size: 500KB
- Page Load: 2.3s
- TTFB: Not measured
- SSG/ISR Pages: 0

## Wave 1 Results
- Bundle Size: **400KB** (-20%)
- Page Load: **1.3s** (-43%)
- TTFB: **1.2s** (meets ≤1.5s target)
- SSG/ISR Pages: **8**

## Detailed Metrics
| Page | Load Time | TTFB | Cache Status |
|------|-----------|------|--------------|
| /master/items | 1.1s | 1.0s | HIT (ISR) |
| /master/companies | 1.2s | 1.1s | HIT (ISR) |
| /dashboard | 1.5s | 1.3s | MISS (dynamic) |
| / (landing) | 0.8s | 0.7s | HIT (SSG) |

## API Contract Validation
- ✅ 60 routes migrated to CRUDHandler
- ✅ Standard APIResponse format
- ✅ Integration tests: 100% pass

## Bundle Analysis
- ✅ Legacy modules modularized (not deleted)
- ✅ 60 components lazy loaded
- ✅ 25 components memoized

## Recommendations for Wave 2
- TanStack Query can now rely on stable API contracts
- Cache hit rate target: 70%+
```

### 완료 조건
- ✅ 모든 통합 테스트 통과
- ✅ Bundle size ≤ 400KB
- ✅ TTFB ≤ 1.5s
- ✅ Page load ≤ 1.3s
- ✅ 회귀 없음 (기존 기능 보존)
- ✅ 성능 리포트 생성 (Wave 2 baseline)

---

## 📊 Wave 1 Complete Checklist

### Agent 2 (API Standardization)
- [ ] CRUDHandler 기본 클래스 작성
- [ ] APIResponse 인터페이스 정의
- [ ] 20개 핸들러 클래스 생성
- [ ] 128 routes → 60 routes 리팩토링
- [ ] API 계약 문서 생성
- [ ] Integration tests 통과

### Agent 4 (Bundle Optimization)
- [ ] transactionManager.ts 모듈화
- [ ] query-optimizer.ts 모듈화
- [ ] Legacy smoke tests 작성 및 통과
- [ ] 60개 컴포넌트 lazy loading
- [ ] 25개 컴포넌트 React.memo
- [ ] webpack-bundle-analyzer 실행
- [ ] Bundle size ≤ 400KB 달성

### Agent 5 (ISR/SSG)
- [ ] force-dynamic 제거 (dashboard 제외)
- [ ] ISR 구현 (5개 페이지, 5min revalidate)
- [ ] SSG 구현 (3개 페이지)
- [ ] Revalidation 로깅 구현
- [ ] Prefetch 최적화
- [ ] TTFB ≤ 1.5s 달성

### Agent 6 (QA)
- [ ] API 통합 테스트 통과
- [ ] ISR/SSG 동작 검증
- [ ] Bundle size 측정 및 확인
- [ ] Performance 측정 (TTFB, Page Load)
- [ ] 회귀 테스트 통과
- [ ] Wave 1 성능 리포트 생성

### Codex Watchpoints
- [ ] API 계약 문서화 및 freeze 준비
- [ ] ISR revalidation 로그 확인 가능
- [ ] Bundle 모듈화 smoke tests 통과

---

## 🚀 Wave 1 실행 명령어

### 1. Agent 2 실행 (Task tool)
```
Use backend-architect agent to:
- Create CRUDHandler base class in src/lib/api/CRUDHandler.ts
- Create APIResponse interface in src/lib/api/types.ts
- Generate 20 handler classes in src/lib/api/handlers/
- Refactor 128 API routes to use handlers (consolidate to 60 routes)
- Generate API contract documentation in .plan7/api-contracts.md
- Run integration tests

Priority: API contract must be stable for Wave 2 dependencies
```

### 2. Agent 4 실행 (Task tool)
```
Use frontend-developer agent to:
- Analyze transactionManager.ts and query-optimizer.ts usage
- Modularize into separate modules (NOT delete)
- Implement dynamic imports for lazy loading
- Write smoke tests for modularized code
- Expand lazy loading to 60 components (from 4)
- Apply React.memo to 25 components
- Run webpack-bundle-analyzer
- Target: Bundle size 500KB → 400KB (20% reduction)

Codex Watchpoint: Include coverage/smoke tests for each module slice
```

### 3. Agent 5 실행 (Task tool)
```
Use architect-reviewer agent to:
- Remove force-dynamic from layout.tsx
- Implement ISR for items, companies, bom (revalidate: 300)
- Implement SSG for landing, about pages
- Add revalidation logging (logRevalidation function)
- Optimize routing with prefetch
- Target: TTFB ≤ 1.5s

CRITICAL Priority: Addresses Codex Priority 1 Warning
Codex Watchpoint: Log revalidation events for QA verification
```

### 4. Agent 6 실행 (Task tool)
```
Use qa agent to:
- Write and run API integration tests (tests/integration/wave1-api.test.ts)
- Write and run ISR/SSG validation tests (tests/integration/wave1-isr.test.ts)
- Measure bundle size (scripts/measure-bundle.sh)
- Measure performance (scripts/measure-performance.js)
- Run regression tests
- Generate Wave 1 performance report (.plan7/reports/wave1-performance-report.md)

Target Metrics:
- Bundle: ≤ 400KB
- TTFB: ≤ 1.5s
- Page Load: ≤ 1.3s
- All tests: PASS
```

---

## ⏭️ 다음 단계

Wave 1 완료 및 Agent 6 검증 통과 후:
1. API 계약 **freeze** (변경 금지)
2. Wave 1 성능 리포트를 Codex에 제출
3. Codex Wave 1 리뷰 대기
4. 승인 시 Wave 2 실행

---

**문서 작성**: 2025-02-01
**Codex Go 승인**: ✅ 완료
**다음 Phase**: Wave 1 실행 (4 agents parallel)
