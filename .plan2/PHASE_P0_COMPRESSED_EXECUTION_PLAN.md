# Phase P0: 2-3일 압축 실행 계획

**생성일**: 2025-01-15
**목표**: 4주 계획을 2-3일로 압축하여 BOM 자동차감 + 일일재고추적 구현
**전략**: 에이전트 병렬 실행 + MCP 서버 활용 + Wave 기반 의존성 관리

---

## 📊 Executive Summary

### 시간 압축 전략
- **원본 일정**: 4주 (160시간)
- **압축 일정**: 2-3일 (14.5시간 실제 작업)
- **시간 절감**: 91% (병렬화를 통한 절감)
- **품질 목표**: 동일 유지 (<100ms 트리거, <200ms API, <3s materialized view)

### 병렬 실행 전략
- **총 6 Waves** across 3 days
- **Wave 내 병렬 실행**: 독립적인 작업을 동시 수행
- **Wave 간 순차 실행**: 의존성 관리를 위한 순차 진행
- **에이전트 활용**: 28개 전문 에이전트 중 7개 핵심 에이전트 투입

---

## 🎯 Day 1: Database Layer (4.5시간)

### Wave 1: BOM Auto-Deduction Foundation (2.5시간) - **병렬 실행** ✅ **완료**

#### Task 1.1: BOM 자동차감 트리거 구현 ✅

**Agent**: `supabase-schema-architect` (신뢰도 91%)
**MCP**: Sequential (로직 분석), Context7 (PostgreSQL 베스트 프랙티스)
**시간**: 1.5시간

**작업 내용**:
```bash
# Agent 명령어
/design --agent supabase-schema-architect \
  "BOM 자동차감 트리거 및 마이그레이션 구현" \
  --c7 --seq --validate
```

**Deliverables**:
- `supabase/migrations/20250115_bom_auto_deduction.sql`
- `auto_deduct_bom_materials()` function
- Performance optimized trigger logic
- Error handling with Korean messages

**성공 기준**:
- 트리거 실행 시간 <100ms
- 다단계 BOM 정확한 차감 (10단계까지)
- 재귀 방지 로직 검증
- 재고 부족 시 에러 처리 정상 작동

---

#### Task 1.2: 쿼리 최적화 및 인덱스 설계 ✅

**Agent**: `database-optimizer` (신뢰도 89%)
**MCP**: Sequential (쿼리 분석), Supabase (성능 검증)
**시간**: 1시간

**작업 내용**:
```bash
# Agent 명령어
/analyze --agent database-optimizer \
  @src/lib/db-unified.ts \
  --focus performance --seq --validate
```

**Deliverables**:
- BOM 조회 쿼리 최적화 (재귀 CTE)
- 복합 인덱스 설계:
  - `idx_bom_parent_child` (parent_item_id, child_item_id)
  - `idx_bom_active_level` (is_active, level_no)
  - `idx_inventory_item_date` (item_id, transaction_date)
- EXPLAIN ANALYZE 성능 보고서

**성공 기준**:
- BOM 조회 시간 <50ms (10단계 BOM 기준)
- 인덱스 적중률 >95%
- 불필요한 인덱스 제거

---

#### Task 1.3: 테스트 데이터 준비 ✅

**Agent**: `erp-specialist` (프로젝트 특화)
**MCP**: Context7 (한글 인코딩)
**시간**: 30분

**작업 내용**:
```bash
# Agent 명령어
/implement --agent erp-specialist \
  "BOM 검증용 한글 테스트 데이터 생성" \
  --c7 --validate
```

**Deliverables**:
- `supabase/seed/test-bom-data.sql`
- 3단계 BOM 구조 (완제품 → 반제품 → 원자재)
- 한글 품목명 포함 (UTF-8 검증)
- 재고 부족 시나리오 포함

**성공 기준**:
- 한글 인코딩 정상 (no �� characters)
- 다양한 BOM 시나리오 커버 (정상, 재고부족, 순환참조)
- 재현 가능한 테스트 케이스

---

### Wave 2: Daily Stock Materialized View (2시간) - **병렬 실행**

#### Task 2.1: mv_daily_stock_calendar 구현 ✅

**Agent**: `supabase-schema-architect` (신뢰도 91%)
**MCP**: Sequential (복잡한 집계 로직), Supabase (materialized view)
**시간**: 1.5시간

**작업 내용**:
```bash
# Agent 명령어
/design --agent supabase-schema-architect \
  "일일 재고 추적 materialized view 구현" \
  --seq --c7 --validate
```

**Deliverables**:
- `supabase/migrations/20250129_daily_stock_tracking.sql`
- `mv_daily_stock_calendar` materialized view
- 자동 갱신 트리거 (INSERT/UPDATE on inventory_transactions)
- 날짜별, 품목별 집계 로직

**View 구조**:
```sql
CREATE MATERIALIZED VIEW mv_daily_stock_calendar AS
SELECT
  calendar_date,
  item_id,
  item_code,
  item_name,
  opening_stock,        -- 기초재고
  receiving_qty,        -- 입고수량
  production_qty,       -- 생산수량
  shipping_qty,         -- 출고수량
  adjustment_qty,       -- 조정수량
  closing_stock,        -- 기말재고
  stock_value,          -- 재고금액
  updated_at
FROM (
  -- 복잡한 집계 쿼리 with window functions
  -- PARTITION BY item_id ORDER BY calendar_date
) AS stock_summary;
```

**성공 기준**:
- View 갱신 시간 <3초 (1개월 데이터 기준)
- 정확한 재고 계산 (기초 + 입고 + 생산 - 출고 ± 조정 = 기말)
- 자동 갱신 정상 작동

---

#### Task 2.2: 성능 튜닝 및 인덱스 ✅

**Agent**: `database-optimizer` (신뢰도 89%)
**MCP**: Supabase (EXPLAIN ANALYZE)
**시간**: 30분

**작업 내용**:
```bash
# Agent 명령어
/improve --agent database-optimizer \
  "materialized view 성능 최적화" \
  --focus performance --seq
```

**Deliverables**:
- 복합 인덱스: `idx_mv_daily_stock` (calendar_date, item_id)
- REFRESH CONCURRENTLY 설정
- 파티셔닝 전략 (월별 파티션)

**성공 기준**:
- View 조회 <200ms (1년 데이터)
- CONCURRENTLY refresh 정상 작동
- 인덱스 크기 최소화

---

## 🎯 Day 2: API + Tests (5시간)

### Wave 3: API Endpoints (2.5시간) - **병렬 실행**

#### Task 3.1: Daily Calendar API 구현 ✅
**Agent**: `backend-architect` (신뢰도 90%)
**MCP**: Context7 (Next.js 15 API routes), Sequential (비즈니스 로직)
**시간**: 1.5시간

**작업 내용**:
```bash
# Agent 명령어
/implement --agent backend-architect \
  "일일재고 캘린더 API 엔드포인트" \
  --type api --c7 --seq --validate
```

**Deliverables**:
- `src/app/api/stock/daily-calendar/route.ts`
- GET 엔드포인트: 날짜범위, 품목 필터링
- 응답 포맷: JSON + Excel export 지원
- 한글 헤더 Excel 다운로드

**API 스펙**:
```typescript
GET /api/stock/daily-calendar
  ?start_date=2025-01-01
  &end_date=2025-01-31
  &item_id=123
  &format=json|excel

Response: {
  success: true,
  data: [
    {
      calendar_date: "2025-01-15",
      item_code: "ITEM001",
      item_name: "부품A",
      opening_stock: 100,
      receiving_qty: 50,
      production_qty: 0,
      shipping_qty: 30,
      closing_stock: 120,
      stock_value: 1200000
    }
  ],
  pagination: { page: 1, limit: 100, totalCount: 500 }
}
```

**성공 기준**:
- 응답 시간 <200ms
- 한글 Excel 정상 다운로드
- 페이지네이션 정상 작동

---

#### Task 3.2: Production API 검증
**Agent**: `backend-architect` (신뢰도 90%)
**MCP**: Sequential (기존 API 분석), Supabase (트리거 검증)
**시간**: 30분

**작업 내용**:
```bash
# Agent 명령어
/analyze --agent backend-architect \
  @src/app/api/inventory/production \
  --focus integration --seq
```

**Deliverables**:
- BOM 자동차감 트리거 통합 검증
- 에러 핸들링 개선 (재고부족 시 명확한 메시지)
- 트랜잭션 롤백 로직 검증

**성공 기준**:
- POST /api/inventory/production 정상 작동
- 트리거 자동 실행 확인
- 에러 메시지 한글로 정상 표시

---

#### Task 3.3: 보안 검토
**Agent**: `code-reviewer` (신뢰도 90%)
**MCP**: Sequential (보안 분석)
**시간**: 30분

**작업 내용**:
```bash
# Agent 명령어
/analyze --agent code-reviewer \
  @src/app/api/stock \
  --focus security --seq --validate
```

**Deliverables**:
- SQL 인젝션 방지 검증
- 입력 검증 (Zod schema)
- 에러 메시지에서 민감정보 제거

**성공 기준**:
- 보안 취약점 0개
- 입력 검증 100% 커버
- 에러 스택 노출 방지

---

### Wave 4: Integration Tests + UI Skeleton (2.5시간) - **병렬 실행**

#### Task 4.1: BOM 자동차감 통합 테스트
**Agent**: `erp-specialist` (프로젝트 특화)
**MCP**: Sequential (테스트 시나리오), Supabase (데이터 검증)
**시간**: 1.5시간

**작업 내용**:
```bash
# Agent 명령어
/test --agent erp-specialist \
  "BOM 자동차감 E2E 테스트" \
  --type integration --seq --validate
```

**Deliverables**:
- `src/__tests__/api/bom-auto-deduction.test.ts`
- 시나리오 1: 정상 생산 (3단계 BOM)
- 시나리오 2: 재고 부족 에러
- 시나리오 3: 순환 참조 방지
- 시나리오 4: 한글 품목명 처리

**테스트 케이스 예시**:
```typescript
describe('BOM Auto-Deduction Integration', () => {
  it('should deduct materials for 3-level BOM production', async () => {
    // Given: 완제품 PROD001 (부품A 2개, 부품B 3개 필요)
    // When: POST /api/inventory/production { item_id: PROD001, quantity: 10 }
    // Then: 부품A -20, 부품B -30 재고 차감 확인
  });

  it('should throw error when material stock insufficient', async () => {
    // Given: 부품A 재고 5개만 존재
    // When: POST /api/inventory/production { item_id: PROD001, quantity: 10 }
    // Then: 400 error with Korean message "부품A 재고 부족"
  });
});
```

**성공 기준**:
- 테스트 커버리지 >90%
- 모든 시나리오 PASS
- 한글 에러 메시지 검증

---

#### Task 4.2: DailyStockCalendar UI 스켈레톤
**Agent**: `frontend-developer` (신뢰도 92%)
**MCP**: Context7 (React 19 patterns), Magic (UI 컴포넌트)
**시간**: 1시간

**작업 내용**:
```bash
# Agent 명령어
/implement --agent frontend-developer \
  "일일재고 캘린더 컴포넌트 스켈레톤" \
  --type component --magic --c7
```

**Deliverables**:
- `src/components/stock/DailyStockCalendar.tsx`
- 기본 레이아웃 (날짜 필터, 품목 선택, 테이블)
- API 연동 준비 (useFetch hook)
- Excel 다운로드 버튼

**컴포넌트 구조**:
```typescript
export function DailyStockCalendar() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const { data, loading, error } = useFetch('/api/stock/daily-calendar');

  return (
    <div className="space-y-4">
      <DateRangePicker value={dateRange} onChange={setDateRange} />
      <ItemSelector value={selectedItem} onChange={setSelectedItem} />
      <StockCalendarTable data={data} loading={loading} />
      <ExcelDownloadButton onClick={handleExport} />
    </div>
  );
}
```

**성공 기준**:
- 컴파일 에러 없음
- TypeScript 타입 안전성 100%
- 레이아웃 반응형 (모바일 지원)

---

## 🎯 Day 3: UI + Integration (5시간)

### Wave 5: Complete UI Implementation (3시간) - **병렬 실행**

#### Task 5.1: DailyStockCalendar 완성
**Agent**: `frontend-developer` (신뢰도 92%)
**MCP**: Magic (UI 최적화), Context7 (React 19 best practices)
**시간**: 2시간

**작업 내용**:
```bash
# Agent 명령어
/implement --agent frontend-developer \
  "일일재고 캘린더 전체 기능 구현" \
  --magic --c7 --validate
```

**Deliverables**:
- Virtual scrolling (대용량 데이터 처리)
- 날짜별 재고 추이 차트 (Chart.js)
- 품목별 색상 구분
- 한글 숫자 포맷 (toLocaleString('ko-KR'))
- Excel 다운로드 (한글 헤더)

**주요 기능**:
1. **필터링**: 날짜범위, 품목, 재고상태
2. **정렬**: 날짜, 품목코드, 재고량
3. **시각화**: 기초/입고/생산/출고/기말 차트
4. **Export**: Excel 다운로드 (3시트 구조)

**성공 기준**:
- 1,000행 데이터 렌더링 <1초
- 차트 애니메이션 부드러움
- Excel 한글 정상 표시

---

#### Task 5.2: 접근성 검증
**Agent**: `web-accessibility-checker` (신뢰도 88%)
**MCP**: Sequential (WCAG 검증)
**시간**: 1시간

**작업 내용**:
```bash
# Agent 명령어
/analyze --agent web-accessibility-checker \
  @src/components/stock/DailyStockCalendar.tsx \
  --focus accessibility --seq
```

**Deliverables**:
- WCAG 2.1 AA 준수 검증
- 키보드 네비게이션 테스트
- 스크린 리더 호환성 (ARIA labels)
- 색상 대비 검증 (4.5:1 이상)

**성공 기준**:
- WCAG 2.1 AA 100% 준수
- 키보드만으로 전체 조작 가능
- 스크린 리더 정상 동작

---

### Wave 6: Quality Review + Documentation (2시간) - **순차 실행**

#### Task 6.1: 전체 품질 검토
**Agent**: `code-reviewer` (신뢰도 90%)
**MCP**: Sequential (종합 분석)
**시간**: 1시간

**작업 내용**:
```bash
# Agent 명령어
/analyze --agent code-reviewer \
  @src \
  --focus quality --seq --ultrathink
```

**Deliverables**:
- 코드 품질 보고서
- 성능 메트릭 검증
- 보안 최종 검토
- 기술 부채 리스트

**성공 기준**:
- TypeScript 에러 0개
- ESLint 경고 0개
- 모든 테스트 PASS
- 성능 목표 달성 (<100ms trigger, <200ms API)

---

#### Task 6.2: 문서화 및 배포 가이드
**Agent**: `documentation-expert` (신뢰도 91%)
**MCP**: Context7 (문서 패턴)
**시간**: 1시간

**작업 내용**:
```bash
# Agent 명령어
/document --agent documentation-expert \
  "Phase P0 배포 가이드 및 API 문서" \
  --c7
```

**Deliverables**:
- `docs/PHASE_P0_DEPLOYMENT.md`
- `docs/API_DAILY_STOCK_CALENDAR.md`
- 마이그레이션 실행 순서
- 롤백 계획

**문서 구조**:
```markdown
# Phase P0 배포 가이드

## 1. 사전 준비
- PostgreSQL 버전 확인 (>= 14)
- Supabase 백업 생성

## 2. 마이그레이션 실행
npm run migrate:up -- 20250115_bom_auto_deduction.sql
npm run migrate:up -- 20250129_daily_stock_tracking.sql

## 3. 성능 검증
- BOM 트리거 실행 시간 확인
- Materialized view refresh 시간 확인

## 4. 롤백 계획
- 트리거 삭제 스크립트
- View 삭제 스크립트
```

**성공 기준**:
- 배포 가이드 완전성 100%
- API 문서 예제 포함
- 롤백 절차 명확

---

## 📊 Success Metrics (최종 검증)

### 성능 목표
- ✅ BOM 트리거 실행: <100ms
- ✅ API 응답 시간: <200ms
- ✅ Materialized view refresh: <3초
- ✅ UI 렌더링 (1,000행): <1초

### 품질 목표
- ✅ 테스트 커버리지: >90%
- ✅ TypeScript 에러: 0개
- ✅ ESLint 경고: 0개
- ✅ WCAG 2.1 AA: 100% 준수

### 비즈니스 목표
- ✅ BOM 자동차감: 100% 정확도
- ✅ 일일재고 추적: 실시간 갱신
- ✅ Excel 호환성: 한글 정상 표시
- ✅ 사용자 만족도: >95%

---

## 🚀 Parallel Execution Commands

### Day 1 Wave 1 실행
```bash
# 3개 작업 병렬 실행
/design --agent supabase-schema-architect "BOM 자동차감" --c7 --seq --validate &
/analyze --agent database-optimizer @src/lib/db-unified.ts --focus performance --seq &
/implement --agent erp-specialist "테스트 데이터" --c7 --validate &
wait
```

### Day 1 Wave 2 실행
```bash
# 2개 작업 병렬 실행
/design --agent supabase-schema-architect "daily stock view" --seq --c7 &
/improve --agent database-optimizer "view 성능" --focus performance --seq &
wait
```

### Day 2 Wave 3 실행
```bash
# 3개 작업 병렬 실행
/implement --agent backend-architect "daily calendar API" --type api --c7 --seq &
/analyze --agent backend-architect @src/app/api/inventory/production --focus integration &
/analyze --agent code-reviewer @src/app/api/stock --focus security --seq &
wait
```

### Day 2 Wave 4 실행
```bash
# 2개 작업 병렬 실행
/test --agent erp-specialist "BOM E2E test" --type integration --seq &
/implement --agent frontend-developer "UI skeleton" --type component --magic --c7 &
wait
```

### Day 3 Wave 5 실행
```bash
# 2개 작업 병렬 실행
/implement --agent frontend-developer "complete UI" --magic --c7 --validate &
/analyze --agent web-accessibility-checker @src/components/stock --focus accessibility &
wait
```

### Day 3 Wave 6 실행 (순차)
```bash
# 순차 실행 (의존성 있음)
/analyze --agent code-reviewer @src --focus quality --seq --ultrathink
/document --agent documentation-expert "deployment guide" --c7
```

---

## 📝 Notes

### 병렬 실행 시 주의사항
1. **파일 충돌 방지**: 각 에이전트가 독립된 파일 작업
2. **DB 접근 동기화**: migration 순차 실행 필수
3. **MCP 서버 부하**: 동시 3개 이하 권장
4. **메모리 관리**: 각 에이전트 독립 메모리 공간

### 에이전트 신뢰도 기반 선택
- **High (>90%)**: 핵심 기능 담당 (supabase-schema-architect, backend-architect, frontend-developer, code-reviewer, documentation-expert)
- **Medium (85-90%)**: 지원 기능 (database-optimizer, web-accessibility-checker)
- **Project-Specific**: 도메인 특화 (erp-specialist)

### MCP 서버 활용 전략
- **Sequential**: 복잡한 로직 분석, 종합 검토 (모든 Wave)
- **Context7**: 베스트 프랙티스 조회, 프레임워크 패턴 (Wave 1, 3, 5, 6)
- **Supabase**: 쿼리 검증, 성능 분석 (Wave 1, 2)
- **Magic**: UI 컴포넌트 생성 (Wave 4, 5)

---

## 🎯 Immediate Next Actions

1. **문서 검토 완료** ✅
2. **Day 1 Wave 1 실행 시작** ⏭️
   - `supabase-schema-architect`: BOM 트리거 구현
   - `database-optimizer`: 쿼리 최적화
   - `erp-specialist`: 테스트 데이터
3. **진행 상황 추적**: TodoWrite로 각 Wave 완료 시 업데이트

**예상 완료 시각**: 2025-01-17 18:00 (현재로부터 2.5일 후)
