# 프론트엔드 성능 최적화 계획

## 현재 상태 분석

### 성능 지표
- **번들 크기**: 493MB (목표: <200MB) ⚠️
- **접근성**: ARIA 커버리지 11% (목표: 80%) ⚠️
- **React 최적화**: 9/10 ✅
- **모바일 반응형**: 9/10 ✅
- **다크 모드**: 10/10 ✅

### 우수한 구현 (유지)
- Virtual Scrolling: >100행 자동 활성화, 60-80% 렌더링 감소
- Code Splitting: ~535KB 지연 로딩
- useMemo/useCallback 적극 활용
- safeFetchJson 재시도 로직 (3회, 지수 백오프)

## Stage 1: Quick Wins (2시간 15분)

### 1. Search Debouncing (45분)
**목표**: 검색 입력 시 불필요한 리렌더링 방지 → +15% 체감 성능

**구현 파일**: `src/lib/utils.ts`
```typescript
/**
 * Debounce function for search inputs
 * @param func - Function to debounce
 * @param wait - Delay in milliseconds (default: 300ms)
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

**적용 파일**: `src/components/ui/VirtualTable.tsx` (Line 188)
```typescript
import { useMemo } from 'react';
import { debounce } from '@/lib/utils';

// Before:
// onChange={(e) => setSearchTerm(e.target.value)}

// After:
const debouncedSearch = useMemo(
  () => debounce((value: string) => setSearchTerm(value), 300),
  []
);

<input
  type="text"
  placeholder={searchPlaceholder}
  onChange={(e) => debouncedSearch(e.target.value)}
  className="..."
/>
```

**검증 질문**:
1. React 19에서 useMemo와 debounce 조합이 메모리 누수 없이 작동하는가?
2. 300ms 지연이 사용자 경험에 부정적 영향을 주지 않는가?
3. 컴포넌트 언마운트 시 clearTimeout 처리가 필요한가?

---

### 2. React.memo Application (60분)
**목표**: 불필요한 리렌더링 방지 → -20% 리렌더링

**적용 대상 컴포넌트 (10개)**:

#### 2.1 Dashboard Components
**파일**: `src/app/dashboard/page.tsx`
```typescript
import { memo } from 'react';

const RealTimeDashboard = memo(function RealTimeDashboard({
  statsData,
  inventoryData,
  transactionData,
  topSellingData
}) {
  // ... existing code
}, (prevProps, nextProps) => {
  // Shallow comparison for primitive values
  return prevProps.statsData === nextProps.statsData &&
         prevProps.inventoryData === nextProps.inventoryData &&
         prevProps.transactionData === nextProps.transactionData &&
         prevProps.topSellingData === nextProps.topSellingData;
});

export default RealTimeDashboard;
```

#### 2.2 Chart Components (3개)
**파일**:
- `src/components/dashboard/MonthlyInventoryTrends.tsx`
- `src/components/dashboard/TransactionDistribution.tsx`
- `src/components/dashboard/TopSellingItems.tsx`

```typescript
import { memo } from 'react';

const MonthlyInventoryTrends = memo(function MonthlyInventoryTrends({ data }) {
  // ... existing code
}, (prevProps, nextProps) => {
  // Deep comparison for array data
  return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});

export default MonthlyInventoryTrends;
```

#### 2.3 Accounting Components (2개)
**파일**:
- `src/components/accounting/KPICard.tsx`
- `src/app/accounting/summary/page.tsx` (내부 CompanyTable 컴포넌트)

```typescript
// KPICard.tsx
import { memo } from 'react';

const KPICard = memo(function KPICard({ title, value, icon, color, trend }) {
  // ... existing code
}, (prevProps, nextProps) => {
  return prevProps.title === nextProps.title &&
         prevProps.value === nextProps.value &&
         prevProps.color === nextProps.color &&
         JSON.stringify(prevProps.trend) === JSON.stringify(nextProps.trend);
});

export default KPICard;
```

#### 2.4 VirtualTable Row Component
**파일**: `src/components/ui/VirtualTable.tsx` (내부 TableRow 컴포넌트)
```typescript
const TableRow = memo(function TableRow({ row, columns, onRowClick }) {
  // ... existing code
}, (prevProps, nextProps) => {
  return prevProps.row === nextProps.row &&
         prevProps.columns === nextProps.columns &&
         prevProps.onRowClick === nextProps.onRowClick;
});
```

**검증 질문**:
1. JSON.stringify를 사용한 deep comparison이 성능에 부정적 영향을 주지 않는가?
2. 모든 컴포넌트에 memo를 적용하는 것보다 선택적 적용이 나은가?
3. React 19의 자동 최적화와 충돌하지 않는가?

---

### 3. Route-level Loading States (30분)
**목표**: Suspense 경계로 초기 렌더링 UX 개선

**생성 파일 (8개)**:
- `src/app/dashboard/loading.tsx`
- `src/app/items/loading.tsx`
- `src/app/companies/loading.tsx`
- `src/app/inventory/loading.tsx`
- `src/app/bom/loading.tsx`
- `src/app/stock/loading.tsx`
- `src/app/accounting/loading.tsx`
- `src/app/sales-transactions/loading.tsx`

**템플릿**:
```typescript
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <LoadingSpinner size="lg" />
    </div>
  );
}
```

**검증 질문**:
1. Next.js 15 App Router의 nested layout과 호환되는가?
2. LoadingSpinner 컴포넌트가 이미 존재하고 lg 사이즈를 지원하는가?
3. 다크 모드 배경색이 globals.css와 일치하는가?

---

## Stage 2: Medium Priority (5시간)

### 4. Bundle Size Analysis (2시간)
**목표**: 493MB → <200MB

#### 4.1 Bundle Analyzer 설정 (30분)
**설치**:
```bash
npm install --save-dev @next/bundle-analyzer
```

**수정 파일**: `next.config.ts`
```typescript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... existing config
  webpack: (config, { isServer }) => {
    // Windows 파일 시스템 감시 최적화 유지
    if (process.platform === 'win32') {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
});
```

**실행**:
```bash
ANALYZE=true npm run build
```

#### 4.2 Recharts 최적화 (90분)
**예상 문제**: Recharts 라이브러리가 번들 크기의 주범 (분석 후 확인 필요)

**해결 방안**:
1. Tree-shaking 확인: `import { LineChart } from 'recharts'` 대신 `import LineChart from 'recharts/lib/chart/LineChart'`
2. 대안 라이브러리 검토: Chart.js (더 가벼움) 또는 D3.js (커스터마이징 용이)
3. Dynamic Import로 차트 컴포넌트 지연 로딩

**검증 질문**:
1. Recharts의 실제 번들 기여도가 얼마나 되는가?
2. Tree-shaking이 이미 적용되어 있는가?
3. 차트 라이브러리 교체 시 디자인 일관성 유지가 가능한가?

---

### 5. Accessibility Improvements (3시간)
**목표**: ARIA 커버리지 11% → 80%

#### 5.1 ARIA Labels 추가 (2시간)
**대상 컴포넌트 (우선순위 순)**:

1. **Navigation & Header** (30분)
   - Sidebar 메뉴 항목: `aria-label`, `aria-current`
   - Header 액션 버튼: `aria-label="로그아웃"`, `aria-label="다크 모드 전환"`

2. **Forms & Inputs** (45분)
   - VirtualTable 검색창: `aria-label="테이블 검색"`
   - 필터 셀렉트: `aria-label="필터 기준"`, `aria-describedby`
   - 모든 input 필드: `aria-required`, `aria-invalid`

3. **Buttons & Actions** (45분)
   - 아이콘 버튼: `aria-label="수정"`, `aria-label="삭제"`
   - 모달 닫기 버튼: `aria-label="모달 닫기"`
   - 페이지네이션: `aria-label="이전 페이지"`, `aria-label="다음 페이지"`

**예시 코드**:
```typescript
// Before
<button onClick={handleEdit}>
  <PencilIcon className="w-4 h-4" />
</button>

// After
<button
  onClick={handleEdit}
  aria-label="품목 수정"
  aria-describedby="edit-tooltip"
>
  <PencilIcon className="w-4 h-4" />
</button>
```

#### 5.2 Keyboard Navigation (60분)
**구현 항목**:
1. Skip to main content 링크
2. 모달 트랩 포커스
3. Tab 순서 최적화 (`tabIndex` 정리)
4. Escape 키로 모달 닫기

**검증 질문**:
1. WCAG 2.1 AA 기준을 모두 충족하는가?
2. 스크린 리더 테스트를 어떻게 수행할 것인가?
3. 키보드 네비게이션이 모든 브라우저에서 일관되게 작동하는가?

---

## 위험 분석

### Low Risk
- Debouncing: 표준 패턴, 사이드 이펙트 없음
- Route loading.tsx: Next.js 권장 패턴
- ARIA labels: 점진적 개선 가능

### Medium Risk
- React.memo: 잘못된 비교 함수로 인한 버그 가능
- Bundle analyzer: 빌드 시간 증가

### High Risk
- Recharts 교체: 대규모 리팩토링 필요, 디자인 일관성 위험

---

## 성공 지표

### Stage 1 (Quick Wins)
- [ ] 검색 입력 시 디바운싱 작동 확인
- [ ] 리렌더링 횟수 20% 감소 (React DevTools Profiler)
- [ ] 모든 라우트에 loading.tsx 적용

### Stage 2 (Medium Priority)
- [ ] 번들 크기 493MB → <200MB
- [ ] ARIA 커버리지 11% → 80%
- [ ] Lighthouse 접근성 점수 70 → 95+

---

## Codex 검증 요청 사항

**Architecture Review**:
1. 파일 구조가 Next.js 15 App Router 규칙을 따르는가?
2. 컴포넌트 memo 적용 우선순위가 적절한가?
3. Recharts 대신 다른 차트 라이브러리를 추천하는가?

**Logic Review**:
1. debounce 함수 구현이 메모리 안전한가?
2. React.memo comparator 함수가 올바른가?
3. 300ms debounce 지연이 적절한가?

**Performance Review**:
1. Quick Wins 예상 개선(+15%, -20%)이 현실적인가?
2. Bundle size 목표(<200MB)가 달성 가능한가?
3. 접근성 개선이 성능에 부정적 영향을 주는가?

**Security Review**:
1. debounce에서 clearTimeout 누락으로 인한 메모리 누수 가능성은?
2. ARIA labels에 민감한 정보가 노출될 위험은?

**Edge Cases**:
1. 컴포넌트 언마운트 시 debounce cleanup 필요한가?
2. React.memo comparator에서 함수 props 처리는?
3. nested layouts에서 loading.tsx 충돌 가능성은?

---

## 타임라인

- **Stage 1 (Quick Wins)**: 2시간 15분
  - Day 1 오전: Debouncing + React.memo
  - Day 1 오후: loading.tsx 생성

- **Stage 2 (Medium Priority)**: 5시간
  - Day 2: Bundle analysis + Recharts 최적화
  - Day 3: Accessibility improvements

**총 예상 시간**: 7시간 15분 (2-3일)