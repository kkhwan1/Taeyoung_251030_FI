# Phase 2: 계획 수정 (Codex 피드백 반영)

**예상 시간**: 10분
**상태**: 완료
**의존성**: Phase 1 완료

---

## 📋 Codex 분석 결과 요약

### 우선순위 (Codex 권고)

1. **Performance Issues** (Priority 1 - **CRITICAL**) ⚠️
   - Severity: Critical
   - Impact: "Risks production outages during traffic spikes"
   - 권고사항: SSG/ISR 복원, bundle 분석, lazy loading 확대

2. **Data Fetching** (Priority 2 - High)
   - Severity: High
   - 73개 manual fetch → TanStack Query 마이그레이션

3. **API Routes** (Priority 3 - High)
   - Severity: High
   - 128개 routes 표준화

4. **Code Quality** (Priority 3 - High)
   - Severity: High
   - Strict Mode 활성화, Supabase client 통합

5. **State Management** (Priority 4 - Medium)
   - Severity: Medium
   - Zustand 도입, props drilling 해소

6. **Legacy Modules** (Priority 5 - Medium)
   - Severity: Medium
   - 2,365줄 제거

---

## 🔄 Wave 전략 조정

### 원래 계획 (Phase 1 이전)

**Wave 1** (Parallel):
- API 표준화 (Priority 3)
- Zustand + Context (Priority 4)
- Legacy 제거 + Bundle 최적화 (Priority 5 + 1 일부)

**Wave 2** (Parallel):
- TanStack Query (Priority 2)
- Routing 최적화 (Priority 1 일부)

**Wave 3**:
- 코드 품질 (Priority 3)

### 🎯 조정된 계획 (Codex Priority 1 Critical 반영)

**Wave 1** (Parallel) - Foundation Layer (8시간):
- **Agent 2** (backend-architect): API 표준화 (Priority 3) - 변경 없음
- **Agent 3** (architect-reviewer): Zustand + Context (Priority 4) - 변경 없음
- **Agent 4** (frontend-developer): Bundle 최적화 (Priority 1 일부 + Priority 5)
  - ✅ Legacy 제거 (transactionManager.ts 1,617줄, query-optimizer.ts 748줄)
  - ✅ Lazy loading 확대 (4개 → 60개)
  - ✅ React.memo 적용 (25개 컴포넌트)
  - **NEW**: Bundle analyzer 실행 및 리포트 생성

**Wave 2** (Parallel with Dependencies) - **Performance Critical Layer** (6시간):
- **Agent 1** (frontend-developer): TanStack Query 마이그레이션 (Priority 2)
  - 의존성: Wave 1의 API 표준화 완료 필요
- **Agent 5** (architect-reviewer): **ISR + SSG 복원** (Priority 1 - **CRITICAL ELEVATED**)
  - **SCOPE 확대**:
    - ✅ force-dynamic 제거 (필요한 페이지만 유지)
    - ✅ ISR 구현 (items, companies 등 static 페이지)
    - ✅ SSG 구현 (landing, about 등)
    - ✅ 캐시 무효화 전략 수립
    - ✅ Routing 최적화
    - **NEW**: Performance budget CI 설정

**Wave 3** (Sequential) - Quality Assurance (4시간):
- **Agent 6** (code-reviewer): 코드 품질 향상 (Priority 3)
  - ✅ Strict Mode 활성화
  - ✅ Supabase client 통합 (단일 factory 패턴)
  - ✅ 에러 핸들링 표준화
  - **NEW**: 전체 통합 테스트

---

## 📊 변경사항 상세

### 1. Wave 2 Agent 5 Scope 확대

**기존**:
- Routing 최적화
- 일부 ISR 구현

**조정 후**:
- **전체 페이지 렌더링 전략 재설계**
- SSG/ISR/force-dynamic 분류
- 캐시 무효화 전략
- Performance budget 설정

**근거**: Codex Critical Warning - "Risks production outages during traffic spikes"

### 2. Wave 1 Agent 4 Bundle Analyzer 추가

**기존**:
- Legacy 제거
- Lazy loading 확대
- React.memo 적용

**조정 후**:
- 위 항목 + **Bundle analyzer 실행**
- webpack-bundle-analyzer 리포트 생성
- 미사용 코드 식별 및 제거 계획 수립

**근거**: Codex 권고 - "Run bundle analyzer to identify dead code"

### 3. Wave 3 통합 테스트 추가

**기존**:
- Strict Mode, Supabase client, 에러 핸들링

**조정 후**:
- 위 항목 + **전체 통합 테스트**
- Wave 1, 2의 변경사항 통합 검증
- 성능 벤치마크 비교 (baseline vs. post-optimization)

**근거**: 품질 게이트 강화

---

## ⚠️ Codex Critical Warning 대응

### Warning 내용
> "Continuing to force dynamic rendering with a bloated bundle risks production outages during traffic spikes; address SSG/ISR and bundle hygiene immediately."

### 대응 전략

1. **Wave 1 Agent 4** (즉시):
   - Bundle 분석 및 legacy 제거
   - 초기 번들 크기 감소 (500KB → 목표 350KB)

2. **Wave 2 Agent 5** (우선순위 격상):
   - ISR/SSG 전면 복원
   - force-dynamic을 dashboard 등 필수 페이지만 유지
   - 캐시 전략으로 서버 부하 감소

3. **검증**:
   - Codex Wave 2 리뷰에서 Critical Warning 해소 확인
   - Performance budget CI 통과 확인

---

## 🎯 성공 지표 (조정)

### Wave 1 완료 시
- ✅ API routes: 128개 → 60개
- ✅ Bundle size: 500KB → 350KB (30% 감소)
- ✅ Lazy loaded components: 4개 → 60개
- **NEW**: ✅ Bundle analyzer 리포트 생성

### Wave 2 완료 시
- ✅ Manual fetches: 73개 → 0개
- ✅ SSG/ISR pages: 0개 → 15개 이상
- **NEW**: ✅ Page load time: 2.3s → 1.0s (56% 개선)
- **NEW**: ✅ Performance budget CI 통과

### Wave 3 완료 시
- ✅ React Strict Mode 활성화
- ✅ 통합 테스트 통과
- **NEW**: ✅ Performance metrics 개선 검증

---

## 📝 다음 단계

Phase 2 완료 후:
1. Codex에 조정된 계획 검증 요청 (Phase 3)
2. Go/No-Go 결정 대기
3. 승인 시 Wave 1 실행 (Phase 4)

---

**작성 시간**: 2025-02-01
**Codex 피드백 반영**: Priority 1 Critical 대응 완료
**검증 대기**: Phase 3 Codex Plan Validation
