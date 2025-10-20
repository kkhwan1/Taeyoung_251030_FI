# Phase P3: Wave 2 & Wave 3 병렬 실행 전략 v2

## 📋 문서 개요

- **작성일**: 2025-10-17 (v2 업데이트)
- **목적**: 실제 MCP 도구 사용 + 기존 컴포넌트 패턴 활용으로 Wave 2 & 3 완료
- **전략**: 3-Agent 협업 + 4-MCP 실제 도구 호출 + 기존 UI 패턴 재사용
- **예상 소요**: 2.5일 (순차 실행 대비 70% 단축)
- **완료 목표**: Phase P3 100% 달성

---

## 🎯 현재 상태 (Wave 2 Day 1 완료)

### ✅ 완료된 작업 (2025-10-17 08:00-08:45)

**완료 항목**:
1. ✅ Price History Inquiry API - `/api/price-history/route.ts` (171줄)
2. ✅ Price History Detail API - `/api/price-history/[id]/route.ts` (200줄)
3. ✅ Price History Frontend Page - `src/app/price-history/page.tsx` (624줄)
   - Chart.js Line Chart with Korean locale
   - Modal pattern for chart display
   - Tailwind CSS styling
   - useState/useEffect hooks
4. ✅ Chart.js 의존성 설치 및 구성

**기존 컴포넌트 구조 확인**:
```
src/components/
├── ui/              # Toast.tsx, Modal.tsx, ConfirmModal.tsx, Button, Card, Input, Label, Table
├── forms/           # CompanyForm.tsx, ItemForm.tsx, CollectionForm.tsx, PurchaseForm.tsx
├── dashboard/       # KPICards.tsx, StockSummaryCard.tsx, TransactionChart.tsx, AlertPanel.tsx
├── charts/          # LowStockAlerts.tsx, StockLevelsByCategory.tsx, MonthlyInventoryTrends.tsx
└── price-master/    # PriceMasterForm.tsx, PriceHistoryTable.tsx
```

---

## 🤖 3-Agent 협업 전략 (실제 MCP 도구 사용)

### Agent 역할 분담

#### Agent 1: Backend Architect + Database Specialist

**실제 MCP 도구 사용**:
```bash
# Sequential MCP로 복잡한 로직 분석
mcp__sequential-thinking__sequentialthinking {
  thought: "가격 계산 로직 설계 - 인상률 계산, 반올림 정책, 최소/최대 제약",
  thoughtNumber: 1,
  totalThoughts: 10,
  nextThoughtNeeded: true
}

# Context7 MCP로 PostgreSQL 패턴 참조
mcp__context7__resolve-library-id {
  libraryName: "postgresql"
}
mcp__context7__get-library-docs {
  context7CompatibleLibraryID: "/postgresql/docs",
  topic: "query optimization, indexing strategies"
}
```

**책임 범위**:
- API 엔드포인트 설계 및 구현
- PostgreSQL 쿼리 최적화
- 비즈니스 로직 구현
- 캐싱 전략 구현

**핵심 작업**:
- Price Analysis API (`/api/price-analysis/route.ts`)
- Price Calculation API (`/api/price-master/calculate`)
- Bulk Update API (`/api/price-master/bulk-update`)
- Analytics API (trend, volatility, correlation)

#### Agent 2: Frontend Developer + UX Specialist

**실제 MCP 도구 사용**:
```bash
# Magic MCP로 UI 컴포넌트 생성
mcp__magic__21st_magic_component_builder {
  message: "Create price calculation modal with form inputs",
  searchQuery: "modal form calculation",
  absolutePathToCurrentFile: "c:\\Users\\USER\\claude_code\\FITaeYoungERP\\src\\components\\forms\\PriceCalculationModal.tsx",
  absolutePathToProjectDirectory: "c:\\Users\\USER\\claude_code\\FITaeYoungERP",
  standaloneRequestQuery: "Create a modal component for price calculation following existing Modal.tsx pattern with form validation"
}

# Context7 MCP로 Chart.js 패턴 참조
mcp__context7__get-library-docs {
  context7CompatibleLibraryID: "/chartjs/chartjs",
  topic: "heatmap, multi-line charts, scatter plots"
}
```

**책임 범위**:
- React 컴포넌트 개발 (기존 패턴 재사용)
- Chart.js 시각화 구현
- 사용자 경험 개선
- 반응형 디자인

**핵심 작업**:
- Price Analysis Dashboard (`/price-analysis/page.tsx`)
- `src/components/forms/PriceCalculationModal.tsx` (Modal.tsx 패턴)
- `src/components/charts/TrendChart.tsx` (MonthlyInventoryTrends.tsx 패턴)
- `src/components/charts/VolatilityHeatMap.tsx` (신규)
- `src/components/dashboard/PriceDashboardWidget.tsx` (KPICards.tsx 패턴)
- `src/components/ui/Toast.tsx` 재사용 (알림용)

#### Agent 3: QA + Performance Specialist

**실제 MCP 도구 사용**:
```bash
# Playwright MCP로 E2E 테스트
mcp__playwright__playwright_navigate {
  url: "http://localhost:5000/price-analysis",
  headless: false,
  timeout: 30000
}
mcp__playwright__playwright_screenshot {
  name: "price-analysis-page",
  fullPage: true,
  savePng: true
}
mcp__playwright__playwright_evaluate {
  function: "async () => { const response = await fetch('/api/price-analysis/trends'); return response.json(); }"
}

# Sequential MCP로 테스트 시나리오 설계
mcp__sequential-thinking__sequentialthinking {
  thought: "Edge case 시나리오 - 100% 인상, 음수 단가, NULL 값, 대량 데이터",
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true
}
```

**책임 범위**:
- Edge Case 테스트
- 성능 벤치마크
- 부하 테스트
- E2E 시나리오 검증

---

## 🔧 실제 MCP 도구 오케스트레이션

### 1. Sequential MCP (복잡한 분석 및 로직)

**도구 호출 예시**:
```typescript
// 가격 계산 로직 설계
mcp__sequential-thinking__sequentialthinking({
  thought: "1단계: 인상률 계산 - (신규단가 - 기존단가) / 기존단가 * 100",
  thoughtNumber: 1,
  totalThoughts: 10,
  nextThoughtNeeded: true
})

// 다음 단계
mcp__sequential-thinking__sequentialthinking({
  thought: "2단계: 반올림 정책 - 10원 단위 반올림, 100원 단위 절사",
  thoughtNumber: 2,
  totalThoughts: 10,
  nextThoughtNeeded: true,
  isRevision: false
})

// ... 10단계까지 반복
```

**Agent 활용**:
- Agent 1: 계산 로직 설계 시 필수 사용
- Agent 3: 복잡한 테스트 시나리오 설계 시 사용

### 2. Context7 MCP (패턴 참조 및 문서)

**도구 호출 예시**:
```typescript
// PostgreSQL 쿼리 최적화 패턴
mcp__context7__resolve-library-id({
  libraryName: "postgresql"
})
// 결과: "/postgresql/docs"

mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/postgresql/docs",
  topic: "indexing, query optimization, GIN index for JSONB",
  tokens: 10000
})

// Chart.js 히트맵 패턴
mcp__context7__resolve-library-id({
  libraryName: "chart.js"
})
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/chartjs/chartjs",
  topic: "heatmap, matrix chart, custom tooltips",
  tokens: 5000
})
```

**Agent 활용**:
- Agent 1: PostgreSQL 인덱싱 전략 참조
- Agent 2: Chart.js 고급 차트 패턴 (히트맵, 멀티라인)

### 3. Magic MCP (UI 컴포넌트 생성)

**도구 호출 예시**:
```typescript
// 가격 계산 모달 생성 (기존 Modal.tsx 패턴 참조)
mcp__magic__21st_magic_component_builder({
  message: "Create price calculation modal with form inputs for item selection, price adjustment percentage, rounding policy",
  searchQuery: "modal form calculation",
  absolutePathToCurrentFile: "c:\\Users\\USER\\claude_code\\FITaeYoungERP\\src\\components\\forms\\PriceCalculationModal.tsx",
  absolutePathToProjectDirectory: "c:\\Users\\USER\\claude_code\\FITaeYoungERP",
  standaloneRequestQuery: "Create a modal component following src/components/ui/Modal.tsx pattern with form validation, submit/cancel buttons, and loading states"
})

// 트렌드 차트 컴포넌트 생성 (MonthlyInventoryTrends.tsx 패턴 참조)
mcp__magic__21st_magic_component_builder({
  message: "Create trend chart component using Chart.js Line chart with Korean locale",
  searchQuery: "chart line trend",
  absolutePathToCurrentFile: "c:\\Users\\USER\\claude_code\\FITaeYoungERP\\src\\components\\charts\\TrendChart.tsx",
  absolutePathToProjectDirectory: "c:\\Users\\USER\\claude_code\\FITaeYoungERP",
  standaloneRequestQuery: "Create line chart following src/components/charts/MonthlyInventoryTrends.tsx pattern with responsive design and Korean time scale"
})

// 히트맵 컴포넌트 생성
mcp__magic__21st_magic_component_builder({
  message: "Create volatility heatmap using Chart.js matrix chart",
  searchQuery: "heatmap matrix chart",
  absolutePathToCurrentFile: "c:\\Users\\USER\\claude_code\\FITaeYoungERP\\src\\components\\charts\\VolatilityHeatMap.tsx",
  absolutePathToProjectDirectory: "c:\\Users\\USER\\claude_code\\FITaeYoungERP",
  standaloneRequestQuery: "Create heatmap component with color gradients for volatility visualization using Chart.js"
})
```

**Agent 활용**:
- Agent 2: 모든 신규 UI 컴포넌트 생성 시 사용

### 4. Playwright MCP (E2E 테스트 및 성능)

**도구 호출 예시**:
```typescript
// 페이지 네비게이션
mcp__playwright__playwright_navigate({
  url: "http://localhost:5000/price-analysis",
  headless: false,
  width: 1920,
  height: 1080,
  timeout: 30000
})

// 스크린샷 캡처
mcp__playwright__playwright_screenshot({
  name: "price-analysis-dashboard",
  fullPage: true,
  format: "png",
  savePng: true,
  downloadsDir: "c:\\Users\\USER\\claude_code\\FITaeYoungERP\\tests\\screenshots"
})

// API 응답 시간 측정
mcp__playwright__playwright_evaluate({
  function: `async () => {
    const start = performance.now();
    const response = await fetch('/api/price-analysis/trends?limit=100');
    const end = performance.now();
    const data = await response.json();
    return { responseTime: end - start, dataCount: data.data.length };
  }`
})

// 폼 입력 및 제출
mcp__playwright__playwright_fill({
  selector: "input[name='priceAdjustment']",
  value: "10"
})
mcp__playwright__playwright_click({
  selector: "button[type='submit']"
})
mcp__playwright__playwright_wait_for({
  text: "계산 완료",
  timeout: 5000
})
```

**Agent 활용**:
- Agent 3: 모든 E2E 테스트 및 성능 검증

---

## 📅 Wave 2 병렬 실행 타임라인 (1.5일)

### Day 2 오후 (14:00-18:00) - 4시간

| 시간 | Agent 1 (Backend) | Agent 2 (Frontend) | Agent 3 (QA) |
|------|------------------|-------------------|--------------|
| **14:00-16:00** | **단가 분석 API 구현** | **분석 대시보드 레이아웃** | **API 테스트 시나리오** |
| MCP 도구 | `mcp__sequential-thinking` (분석 로직)<br>`mcp__context7` (PostgreSQL 패턴) | `mcp__magic__21st_magic_component_builder` (페이지 레이아웃)<br>기존 `src/app/price-history/page.tsx` 참조 | `mcp__sequential-thinking` (시나리오 설계) |
| 산출물 | `/api/price-analysis/route.ts` (2개 엔드포인트) | `/price-analysis/page.tsx` (레이아웃 + 차트 틀) | 테스트 케이스 20개 |
| | | | |
| **16:00-18:00** | **가격 계산 API 구현** | **분석 차트 구현** | **분석 API 테스트** |
| MCP 도구 | `mcp__sequential-thinking` (계산 로직 10단계)<br>`mcp__context7` (반올림 패턴) | `mcp__magic__21st_magic_component_builder` (차트 2개)<br>`mcp__context7` (Chart.js 멀티라인) | `mcp__playwright__playwright_evaluate` (API 호출)<br>`mcp__playwright__playwright_screenshot` |
| 산출물 | `/api/price-master/calculate` | `src/components/charts/TrendChart.tsx`<br>`src/components/charts/ComparisonBarChart.tsx` | 테스트 통과 리포트 |

**예상 결과**:
- ✅ 단가 분석 API 완료 (GET /trends, GET /comparisons)
- ✅ 가격 계산 API 완료 (POST /calculate)
- ✅ 분석 대시보드 50% 완료
- ✅ API 테스트 커버리지 80%

### Day 3 오전 (09:00-13:00) - 4시간

| 시간 | Agent 1 (Backend) | Agent 2 (Frontend) | Agent 3 (QA) |
|------|------------------|-------------------|--------------|
| **09:00-11:00** | **이력 관리 API 개선** | **분석 대시보드 완성** | **대시보드 E2E 테스트** |
| MCP 도구 | `mcp__context7` (쿼리 패턴) | `mcp__magic__21st_magic_component_builder` (히트맵)<br>기존 `src/components/ui/Modal.tsx` 재사용 | `mcp__playwright__playwright_navigate`<br>`mcp__playwright__playwright_screenshot` |
| 산출물 | `/api/price-master/history` 개선<br>`/api/price-master/compare` | `src/components/charts/VolatilityHeatMap.tsx`<br>알림 카드 (기존 AlertPanel.tsx 패턴) | E2E 시나리오 5개 |
| | | | |
| **11:00-13:00** | **대량 업데이트 API** | **계산 모달 UI** | **성능 테스트 (Bulk)** |
| MCP 도구 | `mcp__sequential-thinking` (트랜잭션 설계)<br>`mcp__context7` (PostgreSQL 배치 처리) | `mcp__magic__21st_magic_component_builder` (모달)<br>기존 `src/components/ui/Modal.tsx` 패턴 | `mcp__playwright__playwright_evaluate` (성능 측정) |
| 산출물 | `/api/price-master/bulk-update` | `src/components/forms/PriceCalculationModal.tsx` | 100/1000개 성능 리포트 |

**예상 결과**:
- ✅ 이력 관리 API 완료 (기간 필터, 비교)
- ✅ 대량 업데이트 API 완료 (<1초/100개)
- ✅ 분석 대시보드 100% 완료
- ✅ 성능 목표 달성

### Day 3 오후 (14:00-18:00) - 4시간 (Wave 2 마무리)

| 시간 | Agent 1 (Backend) | Agent 2 (Frontend) | Agent 3 (QA) |
|------|------------------|-------------------|--------------|
| **14:00-16:00** | **비즈니스 룰 검증** | **엑셀 업로드 UI (선택)** | **비즈니스 룰 테스트** |
| MCP 도구 | `mcp__sequential-thinking` (룰 검증 로직) | (생략 가능 - 데이터 마이그레이션으로 대체) | `mcp__playwright__playwright_fill`<br>`mcp__playwright__playwright_click` |
| 산출물 | 100% 인상 경고, 음수 단가 검증 | - | 경고 조건 테스트 15개 |
| | | | |
| **16:00-18:00** | **에러 메시지 한글화** | **Wave 2 UI 통합** | **Wave 2 전체 검증** |
| MCP 도구 | `mcp__context7` (한글 메시지 패턴) | 기존 `src/components/ui/Toast.tsx` 재사용 | `mcp__playwright__playwright_navigate` (전체 페이지)<br>`mcp__sequential-thinking` (회귀 테스트) |
| 산출물 | 한글 에러 코드 체계 | 통합 완료 | Wave 2 완료 보고서 |

**Wave 2 산출물**:
- 신규 API: 6개
- 신규 컴포넌트: 5개 (charts 3개, forms 1개, 페이지 1개)
- 테스트: 50+ 케이스
- 코드량: +1,200 줄

---

## 📅 Wave 3 병렬 실행 타임라인 (1.5일)

### Day 4 오전 (09:00-13:00) - 4시간

| 시간 | Agent 1 (Backend) | Agent 2 (Frontend) | Agent 3 (QA) |
|------|------------------|-------------------|--------------|
| **09:00-11:00** | **알림 시스템 API** | **대시보드 위젯 구현** | **위젯 렌더링 테스트** |
| MCP 도구 | `mcp__context7` (알림 패턴) | `mcp__magic__21st_magic_component_builder` (위젯)<br>기존 `src/components/dashboard/KPICards.tsx` 패턴 | `mcp__playwright__playwright_screenshot` |
| 산출물 | `/api/notifications/rules` | `src/components/dashboard/PriceDashboardWidget.tsx`<br>`src/components/dashboard/TopNWidget.tsx` | 위젯 성능 리포트 |
| | | | |
| **11:00-13:00** | **트렌드 분석 API** | **알림 UI 구현** | **알림 동작 테스트** |
| MCP 도구 | `mcp__sequential-thinking` (트렌드 분석 로직) | 기존 `src/components/ui/Toast.tsx` 재사용<br>`NotificationCenter` 신규 | `mcp__playwright__playwright_wait_for` (알림 표시) |
| 산출물 | `/api/price-master/analytics/trend` | `src/components/ui/NotificationCenter.tsx` | E2E 알림 테스트 |

### Day 4 오후 (14:00-18:00) - 4시간

| 시간 | Agent 1 (Backend) | Agent 2 (Frontend) | Agent 3 (QA) |
|------|------------------|-------------------|--------------|
| **14:00-16:00** | **변동성 분석 API** | **트렌드 차트 구현** | **분석 정확도 검증** |
| MCP 도구 | `mcp__sequential-thinking` (표준편차 계산) | 기존 `src/components/charts/MonthlyInventoryTrends.tsx` 패턴 | `mcp__sequential-thinking` (정확도 검증) |
| 산출물 | `/api/price-master/analytics/volatility` | 기존 `TrendChart.tsx` 재사용 | 통계 정확도 리포트 |
| | | | |
| **16:00-18:00** | **상관관계 분석 API** | **상관관계 매트릭스** | **분석 페이지 E2E** |
| MCP 도구 | `mcp__sequential-thinking` (상관계수 계산) | `mcp__magic__21st_magic_component_builder` (매트릭스)<br>`mcp__context7` (Chart.js 매트릭스) | `mcp__playwright__playwright_navigate` (전체 시나리오) |
| 산출물 | `/api/price-master/analytics/correlation` | `src/components/charts/CorrelationMatrix.tsx` | E2E 통과 |

### Day 5 오전 (09:00-13:00) - 4시간 (Wave 3 마무리)

| 시간 | Agent 1 (Backend) | Agent 2 (Frontend) | Agent 3 (QA) |
|------|------------------|-------------------|--------------|
| **09:00-11:00** | **캐싱 전략 구현** | **엑셀 내보내기 개선** | **캐싱 효과 검증** |
| MCP 도구 | `mcp__context7` (Node.js 캐싱 패턴) | `mcp__context7` (xlsx 라이브러리) | `mcp__playwright__playwright_evaluate` (성능 측정) |
| 산출물 | In-memory 캐싱 (TTL 1h) | 3-Sheet 구조 개선 | 캐시 히트율 리포트 |
| | | | |
| **11:00-13:00** | **쿼리 최적화** | **UI 폴리싱** | **전체 성능 테스트** |
| MCP 도구 | `mcp__context7` (PostgreSQL 인덱스) | Tailwind CSS 정리 | `mcp__playwright__playwright_evaluate` (API 성능) |
| 산출물 | 최적화된 쿼리 + 인덱스 | 완성된 UI | 최종 성능 리포트 (<200ms) |

**Wave 3 산출물**:
- 신규 API: 5개
- 신규 컴포넌트: 5개 (dashboard 2개, charts 2개, ui 1개)
- 성능 개선: 229ms → <200ms (12.6%)
- 코드량: +1,000 줄

---

## 📊 기존 컴포넌트 패턴 재사용 전략

### 1. Modal 패턴 재사용
**기존**: `src/components/ui/Modal.tsx`, `ConfirmModal.tsx`
**신규**: `src/components/forms/PriceCalculationModal.tsx`

```typescript
// 기존 Modal.tsx 패턴 따라가기
'use client';
import { useState } from 'react';

export default function PriceCalculationModal({ isOpen, onClose, onSubmit }) {
  // Modal.tsx와 동일한 구조
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        {/* 모달 내용 */}
      </div>
    </div>
  );
}
```

### 2. Chart 패턴 재사용
**기존**: `src/components/charts/MonthlyInventoryTrends.tsx`, `LowStockAlerts.tsx`
**신규**: `src/components/charts/TrendChart.tsx`, `VolatilityHeatMap.tsx`

```typescript
// MonthlyInventoryTrends.tsx 패턴 따라가기
'use client';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, ... } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { ko } from 'date-fns/locale';

ChartJS.register(...);

export default function TrendChart({ data }) {
  const chartData = { ... };
  const options = {
    locale: 'ko-KR',
    scales: { x: { type: 'time', adapters: { date: { locale: ko } } } }
  };

  return <Line data={chartData} options={options} />;
}
```

### 3. Dashboard Widget 패턴 재사용
**기존**: `src/components/dashboard/KPICards.tsx`, `StockSummaryCard.tsx`
**신규**: `src/components/dashboard/PriceDashboardWidget.tsx`, `TopNWidget.tsx`

```typescript
// KPICards.tsx 패턴 따라가기
'use client';
export default function PriceDashboardWidget({ title, value, trend }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="text-3xl font-bold">{value}</div>
      <div className={`text-sm ${trend > 0 ? 'text-red-600' : 'text-blue-600'}`}>
        {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
      </div>
    </div>
  );
}
```

### 4. Toast 알림 재사용
**기존**: `src/components/ui/Toast.tsx`
**사용처**: 가격 계산 완료, 대량 업데이트 완료, 에러 메시지

```typescript
// 기존 Toast.tsx 그대로 사용
import { toast } from '@/components/ui/Toast';

// 성공 알림
toast.success('가격 계산이 완료되었습니다.');

// 에러 알림
toast.error('단가는 0 이상이어야 합니다.');
```

---

## ⚠️ 리스크 관리

### 주요 리스크 및 완화 방안

#### 리스크 1: MCP 도구 호출 실패
**확률**: 15% | **영향도**: 중간 | **지연 시간**: +1-2h

**완화 방안**:
- ✅ Sequential 실패 → 수동 로직 분석
- ✅ Magic 실패 → 수동 컴포넌트 작성 (기존 패턴 참조)
- ✅ Context7 실패 → WebSearch 대체
- ✅ Playwright 실패 → 수동 테스트

#### 리스크 2: 성능 목표 미달
**확률**: 40% | **영향도**: 높음 | **지연 시간**: +4-8h

**완화 방안**:
- ✅ 캐싱 전략 우선 구현 (Day 5 오전)
- ✅ 쿼리 최적화 병렬 진행 (Agent 1)
- ✅ 성능 테스트 실시간 모니터링 (Agent 3)

#### 리스크 3: 컴포넌트 스타일 불일치
**확률**: 25% | **영향도**: 낮음 | **지연 시간**: +1-2h

**완화 방안**:
- ✅ 기존 컴포넌트 패턴 엄격히 준수
- ✅ Tailwind CSS 클래스 일관성 유지
- ✅ Agent 2가 기존 코드 참조 후 작성

---

## ✅ 성공 기준

### Wave 2 완료 기준
- ✅ 단가 분석 API 2개 엔드포인트 작동
- ✅ 가격 계산 API 정확도 100%
- ✅ 이력 관리 API 기간 필터링 작동
- ✅ 대량 업데이트 성능 <1초/100개
- ✅ 분석 대시보드 페이지 완성
- ✅ 모든 API 테스트 통과율 90%+

### Wave 3 완료 기준
- ✅ 대시보드 위젯 2개 작동
- ✅ 실시간 알림 시스템 작동
- ✅ 트렌드/변동성/상관관계 분석 API 작동
- ✅ 고급 분석 페이지 완성
- ✅ API 평균 응답 시간 <200ms
- ✅ 캐싱 적용 후 성능 개선 확인

### Phase P3 전체 완료 기준
- ✅ Phase P3 점수 97/100 → 100/100
- ✅ API 엔드포인트 11개 작동
- ✅ UI 컴포넌트 13개 완성 (기존 패턴 재사용)
- ✅ 테스트 커버리지 90%+

---

## 🎯 실행 명령어 (작업 시작 시)

### Agent 1 (Backend) 시작 명령어

```bash
# Wave 2 Day 2 오후 시작 - 단가 분석 API
/implement "단가 분석 API 엔드포인트 2개 구현 (trends, comparisons)" \
  --persona-backend \
  --seq \
  --c7 \
  --focus performance \
  --validate

# 예상 파일: src/app/api/price-analysis/route.ts
# MCP 도구:
# - mcp__sequential-thinking (분석 로직 설계)
# - mcp__context7 (PostgreSQL 쿼리 패턴)
```

### Agent 2 (Frontend) 시작 명령어

```bash
# Wave 2 Day 2 오후 시작 - 분석 대시보드 UI
/implement "단가 분석 대시보드 페이지 (src/app/price-history/page.tsx 패턴 재사용)" \
  --persona-frontend \
  --magic \
  --c7 \
  --focus accessibility

# 예상 파일: src/app/price-analysis/page.tsx
# MCP 도구:
# - mcp__magic__21st_magic_component_builder (페이지 레이아웃)
# - mcp__context7 (Chart.js 멀티라인 차트)
# 참조: src/app/price-history/page.tsx (기존 Chart.js 설정)
```

### Agent 3 (QA) 시작 명령어

```bash
# Wave 2 Day 2 오후 시작 - API 테스트
/test "단가 분석 API 엔드포인트 테스트 (Edge Case 포함)" \
  --persona-qa \
  --play \
  --seq \
  --focus quality

# 예상 파일: tests/api/price-analysis.test.ts
# MCP 도구:
# - mcp__playwright__playwright_evaluate (API 성능 측정)
# - mcp__sequential-thinking (테스트 시나리오 설계)
```

---

## 📝 체크리스트 (실행 전 확인)

### 환경 준비
- [ ] Node.js 서버 실행 중 (`npm run dev:safe`)
- [ ] Supabase 연결 정상
- [ ] 환경 변수 설정 확인 (`.env`)
- [ ] Git 브랜치 생성 (`feature/phase-p3-wave2-3`)

### MCP 서버 상태
- [ ] Sequential MCP 작동 확인: `mcp__sequential-thinking__sequentialthinking`
- [ ] Context7 MCP 작동 확인: `mcp__context7__resolve-library-id`
- [ ] Magic MCP 작동 확인: `mcp__magic__21st_magic_component_builder`
- [ ] Playwright MCP 작동 확인: `mcp__playwright__playwright_navigate`

### Agent 준비
- [ ] Agent 1: API 스펙 문서 준비
- [ ] Agent 2: 기존 컴포넌트 패턴 숙지 (`src/components/` 구조)
- [ ] Agent 3: 테스트 시나리오 템플릿 준비

### 의존성 확인
- [ ] Chart.js 설치 완료 (Day 1 완료)
- [ ] React Query 설치 확인
- [ ] Tailwind CSS 설정 확인

---

## 🚀 최종 실행 계획

### 즉시 시작 가능 작업 (Day 2 오후 14:00)

**Agent 1**: 단가 분석 API 구현 시작 (Sequential + Context7 MCP)
**Agent 2**: 분석 대시보드 레이아웃 준비 (Magic MCP + 기존 패턴)
**Agent 3**: API 테스트 시나리오 작성 (Sequential + Playwright MCP)

### 예상 완료 일정

- **Wave 2 완료**: 2025-10-18 18:00 (내일 저녁)
- **Wave 3 완료**: 2025-10-20 13:00 (모레 오후)
- **최종 검증**: 2025-10-20 18:00 (모레 저녁)

### 최종 목표

**Phase P3 점수**: 97/100 → **100/100** ✅

---

**문서 버전**: v2.0 (MCP 실제 도구 + 기존 패턴 재사용)
**최종 업데이트**: 2025-10-17 10:00
**작성자**: Claude Code SuperClaude Framework
**상태**: 실행 대기 중 (작업 시작 금지, 사용자 "시작" 명령 대기)
