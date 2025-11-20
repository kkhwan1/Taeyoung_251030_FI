# Phase 3 UI 일관성 개선 상세 계획

**작성일**: 2025-11-19
**현재 상태**: 일관성 점수 58/100 (Codex 분석)
**목표 상태**: 일관성 점수 90+/100
**실행 전략**: 병렬 에이전트 기반 순차적 실행

---

## 📊 분석 요약

### Codex 분석 결과
- **일관성 점수**: 58/100
- **주요 문제**: Phase 3가 Phase 2의 디자인 시스템을 따르지 않음
- **영향 범위**: 6개 주요 영역

### 불일치 발견 항목

1. **아이콘 시스템** (HIGH)
   - Phase 2: Lucide 아이콘 통일
   - Phase 3: 텍스트 이모티콘, 브라우저 기본 UI

2. **테이블 레이아웃** (MEDIUM)
   - Phase 2: 의미론적 `<table>` + pill 필터
   - Phase 3: VirtualTable + 별도 필터 카드

3. **폼 컴포넌트** (HIGH)
   - Phase 2: 다크모드 표준화 스타일
   - Phase 3: 브라우저 prompt, 다크 토큰 없음

4. **다이얼로그** (HIGH)
   - Phase 2: 공유 Modal 컴포넌트
   - Phase 3: window.confirm, 맞춤형 오버레이

5. **상태 배지** (MEDIUM)
   - Phase 2: ProcessStatusBadge + 다크모드
   - Phase 3: 평면 배지 재구현, 다크 지원 없음

6. **다크모드** (HIGH)
   - Phase 2: 모든 컴포넌트 dark: variants
   - Phase 3: 주요 view에 다크 스타일 전혀 없음

---

## 🎯 병렬 실행 계획

### Wave 1: HIGH Priority - 기반 시스템 통일 (병렬 실행)

#### Agent 1: Modal & Dialog System
**목표**: 브라우저 기본 UI 제거 및 공유 Modal 컴포넌트 적용

**작업 파일**:
- `src/components/process/CoilProcessForm.tsx`
- `src/components/process/CoilProcessDetail.tsx`
- `src/components/process/CoilTraceabilityView.tsx`

**구체적 작업**:
1. `window.confirm()` 호출 찾기 및 제거
   - CoilProcessForm.tsx:72 (high yield alert)
   - CoilProcessForm.tsx:153 (source item selection)
   - CoilProcessForm.tsx:194 (target item selection)

2. `window.prompt()` 호출 찾기 및 제거
   - CoilTraceabilityView.tsx:35 (item selection)

3. 공유 Modal 컴포넌트 적용
   - `src/components/Modal.tsx` import
   - 확인 다이얼로그 구현
   - 아이템 선택 모달 구현

4. CoilProcessDetail 완료 오버레이 개선
   - CoilProcessDetail.tsx:338 (닫기 버튼 추가, 다크 클래스 추가)

**예상 산출물**:
- 3개 파일 수정
- 브라우저 기본 UI 0개
- Modal 컴포넌트 재사용 100%

---

#### Agent 2: Dark Mode Implementation
**목표**: 모든 Phase 3 컴포넌트에 다크모드 스타일 적용

**작업 파일**:
- `src/components/process/CoilProcessList.tsx`
- `src/components/process/CoilProcessForm.tsx`
- `src/components/process/CoilProcessDetail.tsx`
- `src/components/process/CoilTraceabilityView.tsx`

**구체적 작업**:
1. Phase 2 다크모드 패턴 분석
   - `src/components/ReceivingForm.tsx:289` 참조
   - `src/app/inventory/page.tsx:1014` 참조

2. 다크모드 utility classes 적용
   - CoilProcessList.tsx:165 - 메인 컨테이너
   - CoilProcessForm.tsx:131,173,209,226,244,283 - 모든 input 필드
   - CoilProcessDetail.tsx:180 - 상세 페이지 레이아웃
   - CoilTraceabilityView.tsx:94 - 추적성 페이지

3. 색상 토큰 통일
   - `bg-white` → `bg-white dark:bg-gray-800`
   - `text-gray-900` → `text-gray-900 dark:text-gray-100`
   - `border-gray-300` → `border-gray-300 dark:border-gray-600`

**예상 산출물**:
- 4개 파일 수정
- 다크모드 커버리지 100%
- Phase 2 일관성 확보

---

#### Agent 3: Icon System Unification
**목표**: 텍스트 이모티콘을 Lucide 아이콘으로 교체

**작업 파일**:
- `src/components/process/CoilProcessForm.tsx`
- `src/components/process/CoilProcessDetail.tsx`
- `src/components/process/CoilProcessList.tsx`

**구체적 작업**:
1. 이모티콘 사용 찾기 및 교체
   - CoilProcessForm.tsx:270 (⚠️ → AlertTriangle)
   - CoilProcessDetail.tsx:374 (⚠️ → AlertTriangle)
   - CoilProcessList.tsx:155 ("+" → Plus icon)

2. Lucide 아이콘 import 추가
   ```typescript
   import { AlertTriangle, Plus, CheckCircle, XCircle } from 'lucide-react';
   ```

3. Phase 2 아이콘 패턴 따르기
   - `src/app/inventory/page.tsx:78` 참조
   - `src/components/dashboard/QuickActionsWidget.tsx:37` 참조

**예상 산출물**:
- 3개 파일 수정
- 텍스트 이모티콘 0개
- Lucide 아이콘 100%

---

### Wave 2: HIGH Priority - 상태 및 스타일 통일 (병렬 실행)

#### Agent 4: Status Badge Consolidation
**목표**: ProcessStatusBadge 재사용 및 중복 제거

**작업 파일**:
- `src/components/process/CoilProcessList.tsx`
- `src/components/process/CoilTraceabilityView.tsx`

**구체적 작업**:
1. 기존 ProcessStatusBadge 분석
   - `src/components/process/ProcessStatusBadge.tsx:15` 확인
   - 색상 토큰 및 다크모드 지원 확인

2. 중복 배지 제거
   - CoilProcessList.tsx:58 - getStatusBadge 함수 제거
   - CoilTraceabilityView.tsx:61 - 평면 배지 제거

3. ProcessStatusBadge import 및 적용
   ```typescript
   import ProcessStatusBadge from '@/components/process/ProcessStatusBadge';

   // 사용
   <ProcessStatusBadge status={process.status} />
   ```

4. 아이콘 추가 (있다면)
   - 대기: Clock icon
   - 진행중: RefreshCw icon
   - 완료: CheckCircle icon
   - 취소: XCircle icon

**예상 산출물**:
- 2개 파일 수정
- 중복 배지 코드 0줄
- ProcessStatusBadge 재사용 100%

---

#### Agent 5: Form Component Styling
**목표**: 폼 입력 필드 스타일 통일 및 다크모드 적용

**작업 파일**:
- `src/components/process/CoilProcessForm.tsx`

**구체적 작업**:
1. Phase 2 폼 스타일 분석
   - `src/components/ReceivingForm.tsx:292,316,330` 참조

2. 모든 input 필드에 스타일 적용
   - CoilProcessForm.tsx:131,173,209,226,244,283
   - 스타일 클래스:
     ```typescript
     className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
     ```

3. 날짜 선택기 아이콘 추가
   - CoilProcessList.tsx:178
   - Calendar icon from lucide-react

4. 에러 상태 개선
   - "재고 부족 ⚠️" → AlertTriangle icon + 구조화된 에러 메시지

**예상 산출물**:
- 2개 파일 수정
- 모든 input 필드 통일된 스타일
- 다크모드 완전 지원

---

### Wave 3: MEDIUM Priority - 레이아웃 및 반응형 개선 (병렬 실행)

#### Agent 6: Table Layout Standardization
**목표**: 테이블 레이아웃 및 필터 툴바 통일

**작업 파일**:
- `src/components/process/CoilProcessList.tsx`
- `src/components/ui/VirtualTable.tsx`

**구체적 작업**:
1. 필터 컨트롤 위치 통일
   - CoilProcessList.tsx:166,173 - 별도 카드 → 테이블 위 pill 스타일
   - Phase 2 패턴 참조: `src/app/inventory/page.tsx:890`

2. VirtualTable 헤더 스타일 개선
   - VirtualTable.tsx:223,319,390
   - 대문자 헤더 적용
   - Phase 2 스타일 매칭

3. 고정 600px 뷰포트 제거
   - CoilProcessList.tsx:288
   - 반응형 높이 적용

**예상 산출물**:
- 2개 파일 수정
- 필터 UI 일관성 확보
- 테이블 레이아웃 통일

---

#### Agent 7: Responsive Design Enhancement
**목표**: 모바일/태블릿 반응형 개선

**작업 파일**:
- `src/components/process/CoilProcessForm.tsx`
- `src/components/process/CoilTraceabilityView.tsx`

**구체적 작업**:
1. 고정 그리드 → 반응형 breakpoint
   - CoilProcessForm.tsx:215
   - `grid-cols-2` → `grid-cols-1 md:grid-cols-2`

2. Traceability picker flex wrap
   - CoilTraceabilityView.tsx:96
   - 한 줄 고정 → wrap 허용

3. 모바일 테스트
   - 320px (iPhone SE)
   - 768px (iPad)
   - 1024px (Desktop)

**예상 산출물**:
- 2개 파일 수정
- 모든 breakpoint 대응
- 모바일 UX 개선

---

## 📋 실행 순서

### Phase 1: Wave 1 병렬 실행
```bash
# Agent 1, 2, 3 동시 실행
Task Agent1: Modal & Dialog System
Task Agent2: Dark Mode Implementation
Task Agent3: Icon System Unification
```

**예상 시간**: 15-20분
**완료 조건**: 모든 HIGH Priority 기반 시스템 통일

### Phase 2: Wave 2 병렬 실행
```bash
# Agent 4, 5 동시 실행
Task Agent4: Status Badge Consolidation
Task Agent5: Form Component Styling
```

**예상 시간**: 10-15분
**완료 조건**: 상태 및 스타일 완전 통일

### Phase 3: Wave 3 병렬 실행
```bash
# Agent 6, 7 동시 실행
Task Agent6: Table Layout Standardization
Task Agent7: Responsive Design Enhancement
```

**예상 시간**: 10-15분
**완료 조건**: 레이아웃 및 반응형 개선

---

## 🎯 성공 기준

### 정량적 지표
- ✅ 일관성 점수: 58/100 → 90+/100
- ✅ 다크모드 커버리지: 0% → 100%
- ✅ 브라우저 기본 UI: 6개 → 0개
- ✅ ProcessStatusBadge 재사용: 0% → 100%
- ✅ Lucide 아이콘 사용: 20% → 100%

### 정성적 지표
- ✅ Phase 2와 동일한 UX 패턴
- ✅ 접근성 개선 (ARIA, 키보드 네비게이션)
- ✅ 유지보수성 향상 (공유 컴포넌트 재사용)
- ✅ 테마 일관성 완벽 복원

---

## 🔍 검증 계획

### 각 Wave 완료 후
1. **시각적 검증**
   - 라이트 모드 확인
   - 다크 모드 확인
   - 브라우저 기본 UI 없음 확인

2. **기능 검증**
   - 모든 버튼 작동 확인
   - 모달 열기/닫기 확인
   - 필터링 작동 확인

3. **반응형 검증**
   - 모바일 (320px)
   - 태블릿 (768px)
   - 데스크톱 (1024px+)

### 최종 검증
1. **Codex 재분석**
   - 일관성 점수 재측정
   - 목표: 90+/100

2. **E2E 테스트**
   - Phase3_E2E_Test_Results.md 기준
   - 모든 테스트 케이스 재실행

3. **사용자 시나리오**
   - 공정 등록 → 필터링 → 상세보기 → 완료 전체 플로우

---

## 📝 진행 상황 추적

### Wave 1 (HIGH Priority - 기반)
- [x] Agent 1: Modal & Dialog System ✅ (문서화 완료)
- [x] Agent 2: Dark Mode Implementation ✅ (완료)
- [x] Agent 3: Icon System Unification ✅ (완료)

### Wave 2 (HIGH Priority - 스타일)
- [x] Agent 4: Status Badge Consolidation ✅ (완료 - 42줄 중복 제거)
- [x] Agent 5: Form Component Styling ✅ (완료 - 아이콘 5개 추가)

### Wave 3 (MEDIUM Priority - 레이아웃)
- [x] Agent 6: Table Layout Standardization ✅ (완료 - 필터 pill 스타일, 헤더 uppercase, 반응형 높이)
- [x] Agent 7: Responsive Design Enhancement ✅ (완료 - 그리드 breakpoint, flex-wrap, 버튼 최적화)

### 최종 검증
- [ ] 시각적 검증 완료
- [ ] 기능 검증 완료
- [ ] 반응형 검증 완료
- [ ] Codex 재분석 (목표: 90+/100)
- [ ] E2E 테스트 통과
- [ ] Production 배포 준비

---

**다음 단계**: Wave 1 병렬 에이전트 실행 승인 대기
