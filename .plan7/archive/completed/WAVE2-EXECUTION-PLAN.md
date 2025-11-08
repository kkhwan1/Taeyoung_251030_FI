# Wave 2 실행 계획: Data & State Layer

**작성일시**: 2025-11-08
**의존성**: Wave 1 완료 (API 표준화 ✅, ISR/SSG 복원 ✅, Bundle 최적화 ✅)
**예상 시간**: 8시간
**실행 전략**: 병렬 실행 (Agent 1 + Agent 3) → Sequential (Agent 6)

---

## 🎯 Wave 2 목표

### 성능 목표
- **Manual fetches**: 73 → 0 (100% 제거)
- **캐시 적중률**: 70%+ (TanStack Query)
- **페이지 로드**: 2.3s → 1.0s (56% 개선)
- **Props drilling**: 25개 컴포넌트 해소

### 기술 목표
- TanStack Query 완전 마이그레이션
- Zustand 전역 상태 관리 구축
- 캐싱 전략 최적화
- 컴포넌트 결합도 감소

---

## 📋 Task Breakdown

### Agent 1: TanStack Query Migration (frontend-developer)

**의존성**: ✅ Wave 1 API 표준화 완료 (표준 계약 사용 가능)

#### Task 1.1: TanStack Query 설치 및 설정
- [ ] `@tanstack/react-query` 설치
- [ ] QueryClient 설정 (staleTime, cacheTime, retry)
- [ ] QueryClientProvider를 app layout에 추가
- [ ] React Query DevTools 설정 (개발 환경)

**검증**:
```typescript
// src/app/layout.tsx에 QueryClientProvider 추가
// DevTools가 개발 환경에서 표시되는지 확인
```

#### Task 1.2: queryKey 계층 구조 설계
- [ ] 도메인별 queryKey factory 생성
- [ ] items, companies, bom, transactions, dashboard 각 도메인
- [ ] Hierarchical keys: `['items']`, `['items', 'detail', id]`, `['items', 'filters', {...}]`

**검증**:
```typescript
// src/lib/query-keys.ts
export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (filters: ItemFilters) => [...itemKeys.lists(), { filters }] as const,
  details: () => [...itemKeys.all, 'detail'] as const,
  detail: (id: number) => [...itemKeys.details(), id] as const,
};
```

#### Task 1.3: Items 도메인 마이그레이션 (Phase 1 - 20개 fetch)
- [ ] `src/app/master/items/page.tsx` - useQuery로 변환
- [ ] `src/components/ItemSelector.tsx` - useQuery 적용
- [ ] 관련 15-18개 파일 마이그레이션
- [ ] staleTime: 5분 (items 카탈로그)
- [ ] Optimistic updates for create/update/delete

**검증**:
- Items 페이지 로딩 성공
- React Query DevTools에서 캐시 확인
- 생성/수정/삭제 시 즉시 UI 반영

#### Task 1.4: Companies & BOM 도메인 (Phase 2 - 15개 fetch)
- [ ] Companies 마이그레이션
- [ ] BOM 마이그레이션
- [ ] staleTime: 5분
- [ ] Optimistic updates

**검증**: 동일

#### Task 1.5: Transactions 도메인 (Phase 3 - 20개 fetch)
- [ ] Sales, Purchases, Collections, Payments 마이그레이션
- [ ] staleTime: 2분 (트랜잭션 데이터)
- [ ] Optimistic updates

**검증**: 동일

#### Task 1.6: Dashboard 도메인 (Phase 4 - 18개 fetch)
- [ ] Dashboard stats, charts, alerts 마이그레이션
- [ ] staleTime: 30초 (실시간 대시보드)
- [ ] refetchInterval: 1분 (auto-refresh)

**검증**:
- Dashboard 실시간 업데이트 확인
- DevTools에서 refetch 주기 확인

#### Task 1.7: Feature Flags 및 점진적 롤아웃
- [ ] Feature flag 시스템 구축 (간단한 환경변수 기반)
- [ ] `ENABLE_REACT_QUERY_ITEMS=true` 등
- [ ] 도메인별 on/off 가능하도록

**검증**:
- 환경변수로 기능 on/off 확인
- 기존 fetch와 useQuery 공존 테스트

---

### Agent 3: State Management (architect-reviewer)

**의존성**: ✅ Wave 1 API 표준화 완료 (안정된 응답 형식)

#### Task 3.1: Zustand 설치 및 기본 설정
- [ ] `zustand` 설치
- [ ] TypeScript 설정 확인
- [ ] Devtools 미들웨어 설정

**검증**:
```typescript
// 기본 store 생성 및 테스트
```

#### Task 3.2: useAppStore 생성
- [ ] 앱 전역 설정: locale, theme, sidebar 상태
- [ ] Persist to localStorage
- [ ] 5-8개 컴포넌트에서 props drilling 제거

**검증**:
```typescript
// src/stores/useAppStore.ts
interface AppState {
  locale: string;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  setLocale: (locale: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
}
```

#### Task 3.3: useUserStore 생성
- [ ] 현재 사용자 정보
- [ ] 권한 관리
- [ ] 5개 컴포넌트에서 props drilling 제거

**검증**:
```typescript
// src/stores/useUserStore.ts
interface UserState {
  user: User | null;
  permissions: string[];
  isAuthenticated: boolean;
  setUser: (user: User) => void;
}
```

#### Task 3.4: useFilterStore 생성
- [ ] 품목/거래처/거래 필터 상태
- [ ] URL 동기화 (queryParams)
- [ ] 10개 컴포넌트에서 props drilling 제거

**검증**:
```typescript
// src/stores/useFilterStore.ts
interface FilterState {
  itemFilters: ItemFilters;
  companyFilters: CompanyFilters;
  transactionFilters: TransactionFilters;
  setItemFilters: (filters: ItemFilters) => void;
  resetFilters: (domain: string) => void;
}
```

#### Task 3.5: useModalStore 생성
- [ ] 모달/다이얼로그 상태 관리
- [ ] 5개 컴포넌트에서 props drilling 제거

**검증**:
```typescript
// src/stores/useModalStore.ts
interface ModalState {
  modals: Record<string, boolean>;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
}
```

#### Task 3.6: React Context 3개 생성
- [ ] UserContext (fallback for legacy)
- [ ] FilterContext (fallback)
- [ ] ModalContext (fallback)
- [ ] Zustand와 통합 (Context는 Zustand 래퍼)

**검증**:
- Context API로도 접근 가능
- Zustand store와 동기화

#### Task 3.7: 컴포넌트 마이그레이션
- [ ] 25개 컴포넌트 props drilling 제거
- [ ] useAppStore, useUserStore, useFilterStore, useModalStore 사용
- [ ] Props 단순화

**검증**:
- 각 컴포넌트에서 props 개수 감소
- 상태 변경 시 정상 동작

---

### Agent 6: Wave 2 Validation (qa)

**의존성**: Agent 1 + Agent 3 완료

#### Task 6.1: TanStack Query 통합 테스트
- [ ] 모든 도메인의 useQuery 동작 확인
- [ ] 캐시 적중률 측정 (DevTools 활용)
- [ ] Optimistic updates 검증

**검증 기준**:
- 73개 fetch → 0개 (100% 마이그레이션)
- 캐시 적중률 ≥ 70%
- Optimistic updates 정상 동작

#### Task 6.2: State Management 통합 테스트
- [ ] 4개 Zustand store 동작 확인
- [ ] Props drilling 제거 확인 (25개 컴포넌트)
- [ ] State 변경 회귀 테스트

**검증 기준**:
- 모든 store 정상 동작
- Props 개수 감소 확인
- 기존 기능 정상 동작

#### Task 6.3: 성능 벤치마크
- [ ] 페이지 로드 시간 측정
- [ ] API 응답 시간 측정
- [ ] 캐시 적중률 측정
- [ ] Wave 1 대비 개선 확인

**검증 기준**:
- 페이지 로드: 2.3s → 1.0s (56% 개선)
- 캐시 적중률: 70%+
- API 응답 시간: Wave 1 수준 유지

#### Task 6.4: 회귀 테스트
- [ ] 기존 기능 모두 정상 동작 확인
- [ ] Items, Companies, BOM, Transactions, Dashboard 모두 테스트
- [ ] Chrome DevTools MCP로 실제 웹사이트 확인

**검증 기준**:
- 모든 페이지 200 OK
- 모든 기능 정상 동작
- 콘솔 에러 없음

#### Task 6.5: 성능 리포트 생성
- [ ] Wave 2 완료 리포트 작성
- [ ] 성능 메트릭 비교 (Wave 1 vs Wave 2)
- [ ] 목표 달성 여부 확인

**검증 기준**:
- 리포트 완성도
- 모든 목표 달성 확인

---

## 🔄 실행 전략

### Phase 1: 병렬 실행 (Agent 1 + Agent 3)
- Agent 1과 Agent 3을 동시에 실행
- 서로 독립적이므로 충돌 없음
- 각 Agent 완료 후 code-reviewer로 리뷰

### Phase 2: Sequential 실행 (Agent 6)
- Agent 1, 3 모두 완료 후 시작
- 전체 통합 테스트 및 검증
- 성능 리포트 생성

---

## ✅ 성공 기준

### 기술 기준
- [ ] 73개 manual fetch → 0개 (100% TanStack Query)
- [ ] 4개 Zustand stores 생성
- [ ] 25개 컴포넌트 props drilling 제거
- [ ] 캐시 적중률 ≥ 70%

### 성능 기준
- [ ] 페이지 로드: 2.3s → 1.0s (56% 개선)
- [ ] API 응답 시간: Wave 1 수준 유지
- [ ] 회귀 테스트: 100% 통과

### 문서 기준
- [ ] Wave 2 완료 리포트 작성
- [ ] 성능 벤치마크 문서화
- [ ] Codex 검증 통과

---

**작성 시간**: 2025-11-08
**다음 단계**: TodoWrite로 작업 목록 생성 → Agent 1, 3 병렬 실행 → Agent 6 검증
