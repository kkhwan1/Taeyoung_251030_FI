# Phase 3: 최종 계획 (Codex Required Adjustments 반영)

**예상 시간**: 15분
**상태**: 완료
**의존성**: Phase 2 완료, Codex No-Go with Adjustments 피드백

---

## 🚨 Codex Decision: No-Go with Adjustments

### 결정 근거
> "Plan needs sequencing changes to mitigate the Critical Warning, plus dependency clarifications."

### 핵심 문제
1. **ISR/SSG 지연**: Wave 2까지 8시간 동안 force-dynamic 유지 → 프로덕션 위험
2. **병렬 작업 충돌**: API + State 동시 작업 시 계약 불일치 위험
3. **Legacy 삭제 위험**: 대체 구현 없이 2,365줄 삭제 → 기능 손실 가능
4. **검증 부족**: Wave 간 성능 검증 없음 → 회귀 발견 지연

---

## 📋 Codex Required Adjustments

### Adjustment 1: ISR/SSG를 Wave 1로 이동 ✅
**Codex 권고**:
> "Start ISR/SSG restoration in Wave 1 (shared between Agent 4 & Agent 5 or assign a new lead) so Critical Warning is addressed as soon as possible."

**조치**:
- Wave 1에 **Agent 5 (ISR/SSG Lead)** 신규 추가
- Agent 4 (Bundle)와 협업하여 즉시 force-dynamic 제거 시작

### Adjustment 2: State Management를 Wave 2로 연기 ✅
**Codex 권고**:
> "Defer bulk state-management migrations until after API standardization stabilizes (either end of Wave 1 or Wave 2) to avoid conflicting rewrites."

**조치**:
- Wave 1에서 Zustand/Context 작업 제거
- Wave 2로 이동하여 API 표준화 완료 후 진행

### Adjustment 3: Legacy 모듈 "분리" 전략 ✅
**Codex 권고**:
> "Replace 'delete legacy modules' with 'modularize/split + lazy-load' milestone unless replacement coverage exists and tests prove safety."

**조치**:
- transactionManager.ts, query-optimizer.ts 즉시 삭제 금지
- 모듈화 → lazy-load → 사용 여부 검증 → 단계적 제거

### Adjustment 4: Wave 간 성능 검증 추가 ✅
**Codex 권고**:
> "Add early smoke/perf validation after each wave (not only Wave 3) so regressions are caught before dependency work proceeds."

**조치**:
- Wave 1 종료 시: 번들 크기, TTFB, 초기 로딩 체크
- Wave 2 종료 시: 페이지 로드 시간, 캐시 적중률, API 응답 시간
- Wave 3: 전체 통합 + 최종 성능 벤치마크

---

## 🎯 조정된 최종 Wave 전략

### Wave 1 (Parallel) - Critical Performance + Foundation (10시간)

**Agent 2** (backend-architect): API Standardization (Priority 3)
- ✅ 128 routes → 60 routes 통합
- ✅ CRUDHandler base class 생성
- ✅ APIResponse 표준 인터페이스
- ✅ 중앙집중식 에러 핸들링
- **NEW**: 표준화된 API 계약 문서 생성 (Wave 2 의존성)

**Agent 4** (frontend-developer): Bundle Optimization (Priority 1 일부 + Priority 5)
- ✅ Legacy 모듈 분리 및 lazy-load (삭제 X)
  - transactionManager.ts → 모듈 분리 + dynamic import
  - query-optimizer.ts → 사용 여부 검증 + 단계적 제거
- ✅ Lazy loading 확대: 4개 → 60개 컴포넌트
- ✅ React.memo 적용: 25개 컴포넌트
- ✅ webpack-bundle-analyzer 실행 및 리포트
- **목표**: 500KB → 400KB (20% 감소, 조정됨)

**Agent 5** (architect-reviewer): **ISR/SSG Restoration** (Priority 1 - **CRITICAL**) 🆕
- ✅ force-dynamic 제거 (dashboard 제외 모든 페이지)
- ✅ ISR 구현: items, companies, bom (5분 revalidate)
- ✅ SSG 구현: landing, about, static pages
- ✅ 캐시 무효화 전략 설계 및 구현
- ✅ 라우팅 최적화 (prefetch, parallel routes)
- **목표**: TTFB 감소, 동적 렌더링 제거

**Agent 6** (qa): **Wave 1 Validation & Smoke Tests** 🆕
- ✅ API 통합 테스트 (새 계약 검증)
- ✅ ISR/SSG 동작 검증 (캐시 hit/miss)
- ✅ 번들 크기 측정 (목표: 400KB)
- ✅ TTFB 측정 (목표: 1.5s 이하)
- ✅ 회귀 테스트 (기존 기능 보존)
- **NEW**: 성능 리포트 생성 (baseline 대비)

**Wave 1 예상 결과**:
- API routes: 128 → 60 (53% 감소)
- Bundle size: 500KB → 400KB (20% 감소)
- Lazy loaded: 4 → 60 컴포넌트
- SSG/ISR pages: 0 → 8+ 페이지
- TTFB: 측정 및 개선 확인
- **검증**: 성능 리포트 + smoke tests 통과

---

### Wave 2 (Parallel with Dependencies) - Data & State Layer (8시간)

**Agent 1** (frontend-developer): TanStack Query Migration (Priority 2)
- **의존성**: Wave 1 API 표준화 완료 (표준 계약 필요)
- ✅ 73개 manual fetch → useQuery/useMutation
- ✅ queryKey 계층 구조 설계
- ✅ staleTime 도메인별 설정 (items: 5분, dashboard: 30초)
- ✅ Optimistic updates 구현
- ✅ Feature flags + 점진적 롤아웃
- **목표**: 캐싱 활성화, 중복 요청 제거

**Agent 3** (architect-reviewer): State Management (Priority 4) 🔄 (Wave 1에서 이동)
- **의존성**: Wave 1 API 표준화 완료 (안정된 응답 형식)
- ✅ Zustand 설치 및 설정
- ✅ 4개 stores 생성: useAppStore, useUserStore, useFilterStore, useModalStore
- ✅ 3개 contexts 생성: UserContext, FilterContext, ModalContext
- ✅ 25개 컴포넌트 props drilling 제거
- **목표**: 전역 상태 관리, 컴포넌트 결합도 감소

**Agent 6** (qa): **Wave 2 Validation & Performance Tests** 🆕
- ✅ TanStack Query 통합 테스트
- ✅ 캐시 적중률 측정 (목표: 70%+)
- ✅ API 응답 시간 검증
- ✅ 페이지 로드 시간 측정 (목표: 1.0s)
- ✅ State 변경 회귀 테스트
- **NEW**: 성능 벤치마크 (Wave 1 대비 개선 확인)

**Wave 2 예상 결과**:
- Manual fetches: 73 → 0 (100% 제거)
- 캐시 적중률: 70%+ (새로운 지표)
- 페이지 로드: 2.3s → 1.0s (56% 개선)
- Props drilling: 25개 컴포넌트 해소
- **검증**: 성능 벤치마크 + integration tests 통과

---

### Wave 3 (Sequential) - Quality Assurance & Integration (6시간)

**Agent 6** (code-reviewer): Code Quality & Final Integration (Priority 3)
- ✅ React Strict Mode 활성화
- ✅ Supabase client factory 통합 (browser/server variants)
- ✅ 에러 핸들링 유틸리티 표준화
- ✅ MCP 통합 제거 또는 완성
- ✅ 전체 통합 테스트 (Wave 1 + Wave 2 변경사항)
- ✅ 최종 성능 벤치마크 (baseline vs. post-optimization)
- ✅ 프로덕션 배포 준비
- **NEW**: 성능 예산 CI 설정

**Wave 3 예상 결과**:
- React Strict Mode: 활성화 (개발 중 버그 조기 발견)
- Supabase client: 단일 factory 패턴
- 통합 테스트: 100% 통과
- **최종 성능**:
  - Bundle: 500KB → 400KB (20%)
  - Page load: 2.3s → 1.0s (56%)
  - TTFB: 측정 및 개선
  - 캐시 적중률: 70%+
- **검증**: Codex 최종 Go/No-Go 승인

---

## 📊 조정된 성능 목표 (Codex 권고 반영)

### Staged Targets (단계별 목표)

**Wave 1 완료 시** (중간 목표):
- Bundle size: 500KB → **400KB** (20% 감소, 조정됨)
- TTFB: **1.5s 이하** (ISR/SSG 효과)
- Page load: 2.3s → **1.3s** (43% 개선)

**Wave 2 완료 시** (최종 목표 달성):
- Bundle size: 400KB → **350KB** (최종 30% 감소)
- Page load: 1.3s → **1.0s** (최종 56% 개선)
- 캐시 적중률: **70%+** (TanStack Query)

**Wave 3 완료 시** (검증 및 배포 준비):
- 모든 목표 달성 확인
- 프로덕션 배포 승인

### Rationale (Codex 권고)
> "Consider staging target: ≤1.3 s after Wave 1, ≤1.0 s after Wave 2, to avoid labeling Wave 1 a failure despite progress."

---

## ⚠️ 위험 관리 계획

### Wave 1 위험

**Risk 1**: API 표준화 중 기존 클라이언트 깨짐
- **완화**: 표준 계약 문서 생성, 자동 테스트, 점진적 마이그레이션

**Risk 2**: ISR 캐시 무효화 복잡성
- **완화**: 간단한 time-based revalidation (5분) → 검증 후 on-demand로 확대

**Risk 3**: Bundle 작업 중 기능 손실
- **완화**: 삭제 금지, 모듈화 + lazy-load 전략, 커버리지 검증

### Wave 2 위험

**Risk 4**: TanStack Query 마이그레이션 회귀
- **완화**: Feature flags, 점진적 롤아웃, 로깅 per query key

**Risk 5**: State 변경 중 데이터 불일치
- **완화**: Wave 1 API 표준화 완료 대기, 타입 안전성 강화

### Wave 3 위험

**Risk 6**: Strict Mode 활성화 시 기존 경고 발생
- **완화**: 단계별 활성화, 경고 수정 후 프로덕션 적용

---

## 🔄 의존성 관리

### Wave 1 → Wave 2 의존성
1. **API 계약 문서**: Agent 2 → Agent 1, Agent 3
2. **안정된 응답 형식**: Agent 2 완료 후 Agent 1, Agent 3 시작
3. **성능 리포트**: Agent 6 (Wave 1) → Wave 2 목표 설정 기준

### Wave 2 → Wave 3 의존성
1. **TanStack Query 안정화**: Agent 1 → Agent 6 (최종 통합 테스트)
2. **State stores 완성**: Agent 3 → Agent 6 (전체 앱 테스트)

### Schema Locking (Codex 권고)
> "Lock schemas before Wave 2 starts."

- Wave 1 종료 시 API 계약 freeze
- Wave 2 중 계약 변경 금지
- 변경 필요 시 Wave 3에서 처리

---

## 📝 Codex 재검증 질문

다음 항목들이 조정되었습니다:

1. ✅ **ISR/SSG Wave 1 이동**: Agent 5 신규 추가, 즉시 시작
2. ✅ **State Management Wave 2 연기**: API 표준화 완료 후 진행
3. ✅ **Legacy 모듈 분리 전략**: 삭제 대신 모듈화 + lazy-load
4. ✅ **Wave 간 검증 추가**: Agent 6가 각 Wave 종료 시 성능 검증

### 재검증 요청 사항

**Go/No-Go Decision**:
- 위 조정사항이 모두 반영되었는가?
- 추가 조정이 필요한가?
- Wave 1 실행 승인 가능한가?

**확인 필요 사항**:
- Agent 6 역할 명확한가? (각 Wave 종료 시 검증)
- 의존성 관리 계획 충분한가?
- Staged targets (1.3s → 1.0s) 합리적인가?

---

**작성 시간**: 2025-02-01
**Codex Adjustments**: 4/4 반영 완료
**다음 단계**: Codex 재검증 → Go 승인 시 Wave 1 실행
