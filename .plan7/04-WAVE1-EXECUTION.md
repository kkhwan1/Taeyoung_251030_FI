# Phase 4: Wave 1 실행 (병렬)

**예상 시간**: 8시간
**상태**: 대기 중
**의존성**: Phase 0, 1, 2, 3 완료

---

## 📋 목표

3개 에이전트를 **병렬로** 실행하여 기반 작업을 완료합니다.

---

## 🤖 에이전트 구성

### Agent 2: API 표준화 (`backend-architect`)
**시간**: 6-8시간
**우선순위**: Critical
**범위**: 128개 API 라우트 → 60개로 통합

### Agent 3: 상태 관리 (`architect-reviewer`)
**시간**: 3-4시간
**우선순위**: High
**범위**: Zustand 도입 + Context 확장

### Agent 4: 번들 최적화 (`frontend-developer`)
**시간**: 4-5시간
**우선순위**: High
**범위**: 레거시 코드 제거 + Lazy Loading 확대

---

## 🚀 병렬 실행 전략

### 타임라인
```
Hour   0   1   2   3   4   5   6   7   8
─────────────────────────────────────────
Agent2 ████████████████████████████████  (6-8h)
Agent3 ████████████                      (3-4h)
Agent4 ████████████████                  (4-5h)
```

### 실행 방법
```typescript
// Task tool로 3개 에이전트 동시 실행
const wave1Results = await Promise.all([
  // Agent 2: API 표준화
  Task({
    subagent_type: 'backend-architect',
    description: 'API 표준화 및 통합 (128→60 라우트)',
    prompt: `[Agent 2 프롬프트 - 아래 참조]`,
    model: 'sonnet'
  }),

  // Agent 3: 상태 관리
  Task({
    subagent_type: 'architect-reviewer',
    description: 'Zustand 도입 및 Context 확장',
    prompt: `[Agent 3 프롬프트 - 아래 참조]`,
    model: 'sonnet'
  }),

  // Agent 4: 번들 최적화
  Task({
    subagent_type: 'frontend-developer',
    description: '레거시 코드 제거 및 Lazy Loading',
    prompt: `[Agent 4 프롬프트 - 아래 참조]`,
    model: 'sonnet'
  })
]);
```

---

## 📝 Agent 2: API 표준화 프롬프트

```markdown
# Agent 2: API 표준화 및 통합

## 목표
128개 API 라우트를 60개로 통합하고 표준화된 패턴을 적용합니다.

## 작업 범위

### 1. 기반 클래스 생성
Create `src/lib/api/base/CRUDHandler.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class CRUDHandler<T> {
  constructor(
    private tableName: string,
    private schema?: ZodSchema
  ) {}

  async list(request: NextRequest): Promise<NextResponse<APIResponse<T[]>>> {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabase = getSupabaseClient();
    const { data, count, error } = await supabase
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .range((page - 1) * limit, page * limit - 1);

    if (error) return this.handleError(error);

    return NextResponse.json({
      success: true,
      data: data as T[],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  }

  async get(id: string): Promise<NextResponse<APIResponse<T>>> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) return this.handleError(error);
    return NextResponse.json({ success: true, data: data as T });
  }

  async create(request: NextRequest): Promise<NextResponse<APIResponse<T>>> {
    const text = await request.text();
    const body = JSON.parse(text);

    if (this.schema) {
      const validated = this.schema.parse(body);
      // ... create logic
    }
  }

  private handleError(error: unknown): NextResponse {
    // Centralized error handling
    return NextResponse.json({
      success: false,
      error: { code: 'API_ERROR', message: String(error) }
    }, { status: 500 });
  }
}
```

### 2. API 핸들러 생성
Create handler classes for each domain:
- `src/lib/api/handlers/ItemsAPI.ts`
- `src/lib/api/handlers/CompaniesAPI.ts`
- `src/lib/api/handlers/BOMAPI.ts`
- ... (20 total handlers)

### 3. 라우트 리팩토링
Update all 128 routes to use handlers:

Before:
```typescript
// src/app/api/items/route.ts (100+ lines)
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  // ... 50 lines of logic
}
```

After:
```typescript
// src/app/api/items/route.ts (10 lines)
import { ItemsAPI } from '@/lib/api/handlers/ItemsAPI';

const api = new ItemsAPI();

export const GET = api.list.bind(api);
export const POST = api.create.bind(api);
```

### 4. 표준화 체크리스트
- [ ] All routes return standardized APIResponse format
- [ ] All POST/PUT use `request.text() + JSON.parse()` for Korean encoding
- [ ] Centralized error handling applied
- [ ] Validation middleware integrated
- [ ] Type safety maintained (no `any` types)

## 성공 기준
- 128 routes → 60 routes
- Code duplication reduced by 70%
- All routes return consistent response format
- No breaking changes (backward compatible)

## 로그 기록
모든 변경사항을 `.plan7/logs/wave1-agent2.log`에 기록하세요.
```

---

## 📝 Agent 3: 상태 관리 프롬프트

```markdown
# Agent 3: Zustand 도입 및 Context 확장

## 목표
전역 상태 관리 라이브러리(Zustand)를 도입하고 Context API를 확장합니다.

## 작업 범위

### 1. Zustand 설치
```bash
npm install zustand
```

### 2. Zustand 스토어 생성
Create 4 main stores:

#### `src/stores/useAppStore.ts`
```typescript
import { create } from 'zustand';

interface AppState {
  isLoading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isLoading: false,
  error: null,
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error })
}));
```

#### `src/stores/useUserStore.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null })
    }),
    { name: 'user-storage' }
  )
);
```

#### `src/stores/useFilterStore.ts`
```typescript
import { create } from 'zustand';

interface FilterState {
  searchTerm: string;
  category: string | null;
  isActive: boolean;
  setSearchTerm: (term: string) => void;
  setCategory: (category: string | null) => void;
  setIsActive: (active: boolean) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  searchTerm: '',
  category: null,
  isActive: true,
  setSearchTerm: (term) => set({ searchTerm: term }),
  setCategory: (category) => set({ category }),
  setIsActive: (active) => set({ isActive: active }),
  resetFilters: () => set({ searchTerm: '', category: null, isActive: true })
}));
```

#### `src/stores/useModalStore.ts`
```typescript
import { create } from 'zustand';

interface ModalState {
  isOpen: boolean;
  modalType: string | null;
  modalProps: Record<string, any>;
  openModal: (type: string, props?: Record<string, any>) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isOpen: false,
  modalType: null,
  modalProps: {},
  openModal: (type, props = {}) => set({ isOpen: true, modalType: type, modalProps: props }),
  closeModal: () => set({ isOpen: false, modalType: null, modalProps: {} })
}));
```

### 3. Context 확장
Create 3 new contexts:

#### `src/contexts/UserContext.tsx`
```typescript
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useUserStore } from '@/stores/useUserStore';

interface UserContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user, setUser, clearUser } = useUserStore();

  const login = (user: User) => setUser(user);
  const logout = () => clearUser();

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};
```

#### `src/contexts/FilterContext.tsx` (similar pattern)
#### `src/contexts/ModalContext.tsx` (similar pattern)

### 4. 컴포넌트 마이그레이션
Migrate 25 components from props drilling to Zustand:

Before:
```typescript
// Parent component
const [filters, setFilters] = useState({});
<ChildComponent filters={filters} onFilterChange={setFilters} />

// Child component
interface Props {
  filters: any;
  onFilterChange: (filters: any) => void;
}
```

After:
```typescript
// Parent component (no props needed)
<ChildComponent />

// Child component
import { useFilterStore } from '@/stores/useFilterStore';

const filters = useFilterStore((state) => state);
const setSearchTerm = useFilterStore((state) => state.setSearchTerm);
```

### 5. Provider 통합
Update `src/app/layout.tsx`:
```typescript
import { UserProvider } from '@/contexts/UserContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { ModalProvider } from '@/contexts/ModalContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryProvider>
          <FontSizeProvider>
            <ToastProvider>
              <UserProvider>
                <FilterProvider>
                  <ModalProvider>
                    {children}
                  </ModalProvider>
                </FilterProvider>
              </UserProvider>
            </ToastProvider>
          </FontSizeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

## 성공 기준
- 4 Zustand stores created
- 3 new contexts added
- 25 components migrated (no props drilling)
- Performance: no unnecessary re-renders

## 로그 기록
모든 변경사항을 `.plan7/logs/wave1-agent3.log`에 기록하세요.
```

---

## 📝 Agent 4: 번들 최적화 프롬프트

```markdown
# Agent 4: 레거시 코드 제거 및 Lazy Loading 확대

## 목표
미사용 코드를 제거하고 Lazy Loading을 60개 컴포넌트로 확대합니다.

## 작업 범위

### 1. 레거시 코드 제거

#### 삭제 대상 (2,365줄)
```bash
# 삭제 파일
rm src/lib/transactionManager.ts     # 1,617 lines (MySQL legacy)
rm src/lib/query-optimizer.ts        # 748 lines (unused)

# Import 검색 및 제거
grep -r "transactionManager" src/
grep -r "query-optimizer" src/
# → 모든 import 제거
```

#### Verification
```bash
# 사용되지 않는지 확인
grep -r "transactionManager\|query-optimizer" src/
# → 결과 없어야 함
```

### 2. Lazy Loading 확대 (4개 → 60개)

#### Template
```typescript
import { lazy, Suspense } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Before
import ItemForm from '@/components/forms/ItemForm';

// After
const ItemForm = lazy(() => import('@/components/forms/ItemForm'));

function MyComponent() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ItemForm />
    </Suspense>
  );
}
```

#### Target Components (60개)

**Forms (15개)**:
- `src/components/forms/ItemForm.tsx`
- `src/components/forms/CompanyForm.tsx`
- `src/components/forms/BOMForm.tsx`
- `src/components/forms/SalesTransactionForm.tsx`
- `src/components/forms/PurchaseForm.tsx`
- ... (10 more)

**Tables (10개)**:
- `src/components/tables/ItemsTable.tsx`
- `src/components/tables/CompaniesTable.tsx`
- ... (8 more)

**Charts (15개)**:
- `src/components/charts/MonthlyInventoryTrends.tsx` (already lazy)
- `src/components/charts/StockLevels.tsx` (already lazy)
- `src/components/charts/SalesDistribution.tsx` (already lazy)
- `src/components/charts/TransactionTrends.tsx` (already lazy)
- `src/components/charts/RevenueChart.tsx`
- ... (10 more)

**Modals (12개)**:
- `src/components/modals/ItemModal.tsx`
- `src/components/modals/CompanyModal.tsx`
- ... (10 more)

**Others (8개)**:
- `src/components/bom/BOMTreeView.tsx`
- `src/components/bom/BOMViewer.tsx`
- `src/components/inventory/InventoryItemGrid.tsx`
- ... (5 more)

### 3. React.memo 적용 (25개 컴포넌트)

#### Template
```typescript
import { memo } from 'react';

// Before
export default function VirtualTable({ data, columns }) {
  return <table>...</table>;
}

// After
export default memo(function VirtualTable({ data, columns }) {
  return <table>...</table>;
}, (prevProps, nextProps) => {
  // Custom comparison for optimization
  return prevProps.data === nextProps.data &&
         prevProps.columns === nextProps.columns;
});
```

#### Target Components
- VirtualTable 계층 컴포넌트 (5개)
- 큰 폼 컴포넌트 (10개)
- 차트 컴포넌트 (10개)

### 4. 번들 분석

#### Before (예상)
```
Total bundle size: 500KB
- Main chunk: 400KB
- Vendor chunks: 50KB
- CSS: 50KB
```

#### After (목표)
```
Total bundle size: 350KB (-30%)
- Main chunk: 250KB (lazy loading)
- Vendor chunks: 50KB
- CSS: 50KB
```

#### Verification
```bash
npm run build
npm run analyze
# → webpack-bundle-analyzer로 확인
```

## 성공 기준
- 2,365 lines removed
- 60 components using lazy loading
- 25 components using React.memo
- Bundle size < 400KB (20% reduction minimum)

## 로그 기록
모든 변경사항을 `.plan7/logs/wave1-agent4.log`에 기록하세요.
```

---

## ✅ Wave 1 완료 조건

### Agent 2 (API)
- [ ] CRUDHandler base class created
- [ ] 20 API handler classes created
- [ ] 128 routes refactored
- [ ] All routes return standard APIResponse
- [ ] Korean encoding pattern maintained
- [ ] No TypeScript errors

### Agent 3 (State)
- [ ] Zustand installed
- [ ] 4 stores created (App, User, Filter, Modal)
- [ ] 3 new contexts created
- [ ] 25 components migrated
- [ ] layout.tsx updated with providers
- [ ] No props drilling in migrated components

### Agent 4 (Bundle)
- [ ] transactionManager.ts deleted
- [ ] query-optimizer.ts deleted
- [ ] All unused imports removed
- [ ] 60 components lazy loaded
- [ ] 25 components use React.memo
- [ ] Bundle size < 400KB

---

## 📊 완료 후 작업

1. **로그 수집**
   ```bash
   cat .plan7/logs/wave1-agent2.log
   cat .plan7/logs/wave1-agent3.log
   cat .plan7/logs/wave1-agent4.log
   ```

2. **체크포인트 생성**
   ```bash
   git add .
   git commit -m "feat(wave1): API standardization, Zustand, bundle optimization"
   git archive -o .plan7/checkpoints/post-wave1/wave1.zip HEAD
   ```

3. **Phase 5로 진행**
   → [05-WAVE1-CODEX-REVIEW.md](./05-WAVE1-CODEX-REVIEW.md)

---

**시작 시간**: (기록 예정)
**완료 시간**: (기록 예정)
**실제 소요**: (기록 예정)
