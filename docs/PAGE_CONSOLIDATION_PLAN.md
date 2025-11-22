# 페이지 통합 구현 계획서

**작성일**: 2025-11-22
**목표**: 39개 페이지 → 16-18개 페이지 (54% 감소)
**예상 소요**: 8-9시간

---

## 실행 방법론

1. **요구사항을 독립적인 TASK로 분해**
2. **각 TASK에 적절한 에이전트 배치**
3. **병렬 처리 가능한 작업은 --spawn으로 동시 실행**
4. **각 단계에서 Codex Skill로 코드 품질 검증**
5. **에이전트 간 상호 보완 및 리뷰**
6. **모든 진행 내용을 문서화**

---

## Wave 1: 고아 페이지 삭제 (병렬 실행)

### 상태: ⏳ 대기

| TASK ID | 대상 | 에이전트 | 상태 |
|---------|------|----------|------|
| 1.1 | `/companies` 폴더 삭제 | code-reviewer | ⏳ |
| 1.2 | `/items` 폴더 삭제 | code-reviewer | ⏳ |
| 1.3 | `/bom` 폴더 삭제 | code-reviewer | ⏳ |
| 1.4 | `/sales-transactions` 폴더 삭제 | code-reviewer | ⏳ |
| 1.5 | `/basic/*` 폴더 삭제 | code-reviewer | ⏳ |
| 1.6 | `/production` 폴더 삭제 | code-reviewer | ⏳ |

**예상 시간**: 30분 (병렬 실행)

---

## Wave 2: 거래 페이지 통합 (4→1)

### 상태: ⏳ 대기

**통합 대상**:
- `/sales` (매출관리)
- `/purchases` (매입관리)
- `/collections` (수금관리)
- `/payments` (지급관리)

**통합 결과**: `/transactions` (거래관리)

| TASK ID | 내용 | 에이전트 | 의존성 | 상태 |
|---------|------|----------|--------|------|
| 2.1 | 통합 페이지 스캐폴딩 | frontend-developer | - | ⏳ |
| 2.2 | 탭 UI 구현 (매출/매입/수금/지급) | frontend-developer | 2.1 | ⏳ |
| 2.3 | 공통 컴포넌트 추출 (TransactionTable) | architect-reviewer | 2.1 | ⏳ |
| 2.4 | API 통합 (필터 파라미터 통일) | backend-architect | 2.1 | ⏳ |
| 2.5 | Codex 품질 검증 | codex | 2.2-2.4 | ⏳ |
| 2.6 | 기존 페이지 삭제 | code-reviewer | 2.5 | ⏳ |

**예상 시간**: 2.5시간

---

## Wave 3: 재고 페이지 통합 (7→1)

### 상태: ⏳ 대기

**통합 대상**:
- `/inventory` (재고관리)
- `/stock` (재고현황 - 3개 탭)
- `/batch-registration` (배치등록)
- `/production` (생산관리) - Wave 1에서 이미 삭제

**통합 결과**: `/inventory` (재고통합관리)

| TASK ID | 내용 | 에이전트 | 의존성 | 상태 |
|---------|------|----------|--------|------|
| 3.1 | 통합 페이지 설계 (6개 탭) | architect-reviewer | Wave 2 | ⏳ |
| 3.2 | 현재재고 탭 구현 | frontend-developer | 3.1 | ⏳ |
| 3.3 | 입출고이력 탭 구현 | frontend-developer | 3.1 | ⏳ |
| 3.4 | 재고조정 탭 구현 | frontend-developer | 3.1 | ⏳ |
| 3.5 | 입고등록 탭 구현 | frontend-developer | 3.1 | ⏳ |
| 3.6 | 출고등록 탭 구현 | frontend-developer | 3.1 | ⏳ |
| 3.7 | 생산배치 탭 구현 | frontend-developer | 3.1 | ⏳ |
| 3.8 | Codex 품질 검증 | codex | 3.2-3.7 | ⏳ |
| 3.9 | 기존 페이지 삭제 (/stock, /batch-registration) | code-reviewer | 3.8 | ⏳ |

**예상 시간**: 3시간

---

## Wave 4: 기준정보 페이지 통합 (4→1)

### 상태: ⏳ 대기

**통합 대상**:
- `/master/items` (품목관리)
- `/master/companies` (거래처관리)
- `/master/bom` (BOM관리)
- `/master/price-management` (단가관리)

**통합 결과**: `/master` (기준정보통합)

| TASK ID | 내용 | 에이전트 | 의존성 | 상태 |
|---------|------|----------|--------|------|
| 4.1 | 통합 페이지 설계 (4개 탭) | architect-reviewer | Wave 3 | ⏳ |
| 4.2 | 품목관리 탭 마이그레이션 | frontend-developer | 4.1 | ⏳ |
| 4.3 | 거래처관리 탭 마이그레이션 | frontend-developer | 4.1 | ⏳ |
| 4.4 | BOM관리 탭 마이그레이션 | frontend-developer | 4.1 | ⏳ |
| 4.5 | 단가관리 탭 마이그레이션 | frontend-developer | 4.1 | ⏳ |
| 4.6 | Codex 품질 검증 | codex | 4.2-4.5 | ⏳ |
| 4.7 | 기존 하위 폴더 삭제 | code-reviewer | 4.6 | ⏳ |

**예상 시간**: 1.5시간

---

## Wave 5: 공정/회계 페이지 통합

### 상태: ⏳ 대기

### 5A: 공정관리 통합 (3→1)

**통합 대상**:
- `/process` (공정관리)
- `/traceability` (추적성조회)
- `/process/coil-tracking` (코일추적)

**통합 결과**: `/process` (공정통합관리)

| TASK ID | 내용 | 에이전트 | 상태 |
|---------|------|----------|------|
| 5A.1 | 3개 탭 통합 페이지 설계 | architect-reviewer | ⏳ |
| 5A.2 | 기존 traceability 콘텐츠 마이그레이션 | frontend-developer | ⏳ |
| 5A.3 | Codex 품질 검증 | codex | ⏳ |

### 5B: 회계 페이지 통합 (2→1)

**통합 대상**:
- `/accounting` (회계집계)
- `/settlements` (정산관리)

**통합 결과**: `/accounting` (회계통합)

| TASK ID | 내용 | 에이전트 | 상태 |
|---------|------|----------|------|
| 5B.1 | 2개 탭 통합 페이지 설계 | architect-reviewer | ⏳ |
| 5B.2 | settlements 콘텐츠 마이그레이션 | frontend-developer | ⏳ |
| 5B.3 | Codex 품질 검증 | codex | ⏳ |

**예상 시간**: 1시간

---

## Wave 6: 최종 정리

### 상태: ⏳ 대기

| TASK ID | 내용 | 에이전트 | 상태 |
|---------|------|----------|------|
| 6.1 | Sidebar 네비게이션 업데이트 | frontend-developer | ⏳ |
| 6.2 | 전체 빌드 테스트 | qa | ⏳ |
| 6.3 | Codex 최종 품질 검증 | codex | ⏳ |
| 6.4 | 문서화 완료 | documentation-expert | ⏳ |

**예상 시간**: 30분

---

## 참조: 탭 통합 패턴 (검증됨)

`/traceability` 페이지에서 성공적으로 사용된 패턴:

```typescript
'use client';

import { useState } from 'react';
import dynamicImport from 'next/dynamic';

type TabType = 'tab1' | 'tab2' | 'tab3';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TabConfig[] = [
  { id: 'tab1', label: '탭1', icon: <Icon />, description: '설명1' },
  { id: 'tab2', label: '탭2', icon: <Icon />, description: '설명2' },
];

// Dynamic imports for code splitting
const Tab1Component = dynamicImport(() => import('@/components/Tab1'), {
  loading: () => <LoadingSpinner />
});

export default function UnifiedPage() {
  const [activeTab, setActiveTab] = useState<TabType>('tab1');

  return (
    <div>
      <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <TabContent activeTab={activeTab} />
    </div>
  );
}
```

---

## 진행 로그

| 시간 | Wave | TASK | 상태 | 비고 |
|------|------|------|------|------|
| 2025-11-22 | - | 계획 수립 | ✅ 완료 | 본 문서 작성 |

---

## 에이전트 배치 현황

| 에이전트 | 역할 | 할당된 TASK |
|----------|------|-------------|
| architect-reviewer | 아키텍처 설계 및 리뷰 | 3.1, 4.1, 5A.1, 5B.1 |
| frontend-developer | UI 구현 | 2.1-2.2, 3.2-3.7, 4.2-4.5, 5A.2, 5B.2, 6.1 |
| backend-architect | API 통합 | 2.4 |
| code-reviewer | 삭제 및 정리 | 1.1-1.6, 2.6, 3.9, 4.7 |
| codex | 품질 검증 | 2.5, 3.8, 4.6, 5A.3, 5B.3, 6.3 |
| qa | 테스트 | 6.2 |
| documentation-expert | 문서화 | 6.4 |

---

## 예상 결과

### Before (39개 페이지)
```
/dashboard
/sales, /purchases, /collections, /payments (4개)
/inventory, /stock, /batch-registration, /production (4개)
/master/items, /master/companies, /master/bom, /master/price-management (4개)
/process, /traceability, /process/coil-tracking (3개)
/accounting, /settlements (2개)
+ 기타 페이지들
```

### After (16-18개 페이지)
```
/dashboard
/transactions (거래통합)
/inventory (재고통합 - 6개 탭)
/master (기준정보통합 - 4개 탭)
/process (공정통합 - 3개 탭)
/accounting (회계통합 - 2개 탭)
+ 기타 필수 페이지들
```

**코드 감소량**: 약 40-50%
**유지보수성 향상**: 중복 코드 제거로 버그 수정 시 단일 지점 수정
