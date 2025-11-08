# Phase 1: Codex 초기 검증

**예상 시간**: 5분
**상태**: 대기 중
**의존성**: Phase 0 완료

---

## 📋 목표

Codex를 사용하여 현재 FITaeYoungERP 아키텍처를 심층 분석하고 개선 우선순위를 결정합니다.

---

## 🔍 검증 항목

1. **데이터 페칭 아키텍처**
   - 73개 수동 fetch 패턴 분석
   - Race condition 위험 평가
   - 메모리 누수 가능성

2. **API 라우트 설계**
   - 128개 라우트 구조 분석
   - 코드 중복 패턴 식별
   - 표준화 부재 문제

3. **상태 관리 전략**
   - 로컬 상태 과다 사용
   - Props drilling 문제
   - Context API 부족

4. **성능 병목**
   - 번들 크기 (500KB)
   - 레거시 코드 (2,365줄)
   - Lazy loading 부족

5. **보안 취약점**
   - 인증/권한 미구현
   - 입력 검증 완전성
   - SQL injection 방지

6. **코드 품질**
   - TypeScript 타입 안전성
   - 사용하지 않는 import
   - 일관성 부재

---

## 🛠️ Codex 실행 명령어

```bash
cd /c/Users/USER/claude_code/FITaeYoungERP

echo "Analyze FITaeYoungERP architecture and provide detailed recommendations:

## Current Architecture State

### Data Fetching Patterns
- 73 manual fetch patterns using useState + useEffect
- TanStack Query configured but completely unused (0 occurrences of useQuery)
- No caching strategy implemented
- Potential race conditions in parallel requests

### API Route Structure
- 128 API routes with significant duplication
- Inconsistent error handling across routes
- No unified response format
- Code duplication in validation and normalization

### State Management
- Heavy reliance on local useState (90+ components)
- Only 3 Context providers (FontSize, Theme, Toast)
- Props drilling in deep component trees
- No global state management library

### Performance Issues
- force-dynamic on ALL pages (no SSG/ISR)
- 500KB bundle size with unused code
- Legacy code: transactionManager.ts (1,617 lines), query-optimizer.ts (748 lines)
- Only 4 components use lazy loading out of 90+

### Code Quality
- React Strict Mode disabled
- Inconsistent error handling patterns
- Multiple Supabase client creation patterns
- Unused MCP integration (TanStack Query provider exists but unused)

## Analysis Required

For each area above, provide:

1. **Severity Assessment** (Critical/High/Medium/Low)
2. **Root Cause Analysis** - Why these issues exist
3. **Impact Assessment** - How it affects performance, maintainability, security
4. **Specific Recommendations** - Concrete steps to fix each issue
5. **Implementation Priority** - Which to fix first and why
6. **Risk Evaluation** - Risks of fixing vs not fixing

## Expected Output Format

Please structure your analysis as:

### 1. Data Fetching Architecture
- Severity: [Level]
- Root Cause: [Analysis]
- Impact: [Performance/Memory/UX impacts]
- Recommendations: [Specific fixes]
- Priority: [1-5, 1=highest]
- Risks: [What could go wrong]

[Repeat for all 6 areas]

### Implementation Sequence
Based on your analysis, provide an optimal sequence for addressing these issues, considering:
- Dependencies between fixes
- Risk mitigation
- Performance impact
- Development effort

### Critical Warnings
Highlight any issues that could cause production failures if not addressed.

Please be thorough and specific in your analysis." | codex exec -m gpt-5-codex --config model_reasoning_effort=high --sandbox read-only > .plan7/logs/codex-initial.log 2>&1
```

---

## 📊 예상 Codex 출력

### 1. Data Fetching Architecture
**Severity**: Critical
**Root Cause**:
- No centralized data fetching strategy
- Manual useState + useEffect patterns prone to errors
- TanStack Query configured but never adopted

**Impact**:
- Race conditions causing stale data (High)
- Memory leaks from unmounted component fetches (High)
- Network request duplication (Medium)
- Poor UX from no loading state consistency (Medium)

**Recommendations**:
1. Migrate all 73 fetch patterns to TanStack Query
2. Implement queryKey hierarchy for cache management
3. Add optimistic updates for mutations
4. Configure staleTime per domain (items: 5min, dashboard: 30s)

**Priority**: 1 (Highest - affects user experience directly)

**Risks**:
- Migration effort high (73 files)
- Potential breaking changes during migration
- Learning curve for team

---

### 2. API Route Structure
**Severity**: High
**Root Cause**:
- No API abstraction layer
- Each route implements own validation/normalization
- Copy-paste development leading to inconsistency

**Impact**:
- High maintenance cost (128 routes to update individually)
- Inconsistent error responses confusing frontend
- Code duplication increases bug surface

**Recommendations**:
1. Create base CRUDHandler class
2. Standardize APIResponse interface
3. Centralize error handling
4. Consolidate routes: 128 → 60 estimated

**Priority**: 2 (High - affects maintainability)

**Risks**:
- Breaking changes to response format
- Frontend needs updates
- Regression risk during consolidation

---

### 3. State Management Strategy
**Severity**: Medium
**Root Cause**:
- Project started small, never refactored as it grew
- No decision made on state management library
- Context API underutilized

**Impact**:
- Props drilling makes refactoring difficult
- Component coupling high
- Hard to track state changes

**Recommendations**:
1. Introduce Zustand for global state
2. Expand Context for domain state (User, Filter, Modal)
3. Migrate 25 components away from props drilling

**Priority**: 3 (After data fetching - enables better patterns)

**Risks**:
- Team needs to learn Zustand
- Migration effort moderate
- Potential over-engineering if not careful

---

### 4. Performance Bottlenecks
**Severity**: High
**Root Cause**:
- force-dynamic set globally without consideration
- Legacy code never cleaned up
- Lazy loading added ad-hoc, not systematically

**Impact**:
- Page load 2-3s (should be <1s)
- 500KB bundle (should be <300KB)
- No caching benefits from SSG/ISR

**Recommendations**:
1. Remove legacy code immediately (2,365 lines)
2. Expand lazy loading to 60 components
3. Introduce ISR for static pages (items, companies)
4. Keep force-dynamic only for dashboard

**Priority**: 2 (Directly improves UX)

**Risks**:
- ISR might break if not tested properly
- Lazy loading boundaries need careful planning

---

### 5. Security Vulnerabilities
**Severity**: Medium
**Root Cause**:
- Authentication intentionally deferred
- Input validation relies on Zod but not comprehensive
- Supabase RLS not fully utilized

**Impact**:
- No access control (all routes public)
- Potential XSS if validation gaps exist
- Data exposure risk

**Recommendations**:
1. Implement authentication (defer if intentional)
2. Audit all API routes for input validation
3. Review Supabase RLS policies
4. Add rate limiting

**Priority**: 4 (Important but currently mitigated by controlled access)

**Risks**:
- Authentication adds complexity
- RLS policies can impact performance

---

### 6. Code Quality Issues
**Severity**: Low-Medium
**Root Cause**:
- Strict Mode disabled for development convenience
- Incremental development without cleanup
- Multiple developers with different patterns

**Impact**:
- Harder to catch bugs in development
- Inconsistent codebase increases onboarding time
- Technical debt accumulating

**Recommendations**:
1. Enable Strict Mode
2. Add cleanup functions to all useEffect
3. Standardize error handling
4. Remove unused imports

**Priority**: 5 (After major refactorings)

**Risks**:
- Strict Mode might reveal existing issues
- Cleanup effort moderate

---

### Implementation Sequence

**Wave 1**: Foundation (Parallel)
1. API standardization (Priority 2) - 6-8 hours
2. State management setup (Priority 3) - 3-4 hours
3. Remove legacy code (Priority 2) - 4-5 hours

**Wave 2**: Integration (After Wave 1)
1. TanStack Query migration (Priority 1) - 4-6 hours (needs state management)
2. ISR implementation (Priority 2) - 2-3 hours (needs API standardization)

**Wave 3**: Quality (Final)
1. Code quality cleanup (Priority 5) - 3-4 hours
2. Security audit (Priority 4) - defer to Phase 4

---

### Critical Warnings

🚨 **HIGH RISK**:
- TanStack Query migration could break existing functionality if not careful
- API response format changes are BREAKING - frontend must update simultaneously
- Removing force-dynamic might break pages that rely on dynamic rendering

⚠️ **MEDIUM RISK**:
- ISR requires careful cache invalidation strategy
- Zustand introduction adds new dependency and learning curve

✅ **LOW RISK**:
- Legacy code removal (confirmed unused)
- Lazy loading expansion (incremental benefit)
- Code quality improvements (no functional changes)

---

## 📝 다음 단계

Codex 검증 완료 후:
1. 로그 검토 (`.plan7/logs/codex-initial.log`)
2. 우선순위 재평가
3. Phase 2로 진행: 계획 수정

---

**시작 시간**: (기록 예정)
**완료 시간**: (기록 예정)
**Codex 모델**: gpt-5-codex
**Reasoning Effort**: high
**로그 파일**: `.plan7/logs/codex-initial.log`
