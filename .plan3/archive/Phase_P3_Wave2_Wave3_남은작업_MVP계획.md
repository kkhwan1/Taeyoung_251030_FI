# Phase P3: Wave 2 & Wave 3 남은 작업 - MVP 빠른 실행 계획

## 📋 개요

- **Wave 1 상태**: ✅ 100% 완료 (핵심 CRUD 기능)
- **Wave 2 범위**: 가격 계산 엔진, 이력 관리 고도화
- **Wave 3 범위**: 대시보드 통합, 실시간 알림, 고급 분석
- **총 예상 소요 시간**: 3.5일 (Wave 2: 2일 + Wave 3: 1.5일)
- **병렬 실행 전략**: 3-Agent 협업 (Backend, Frontend, Test)

## 🎯 Wave 2: 가격 계산 엔진 (2일)

### 작업 분류

#### 1️⃣ 가격 계산 로직 (4시간)

**Backend Agent** (4h):
- [ ] 가격 자동 계산 API 엔드포인트
  - `POST /api/price-master/calculate`
  - 전월 대비 인상률 계산 (%, 고정금액)
  - 특정 카테고리 일괄 적용
  - 반올림 정책 설정 (원 단위, 십원 단위, 백원 단위)

```typescript
// 예상 구현
interface PriceCalculation {
  calculation_type: 'PERCENTAGE' | 'FIXED';  // 인상률 or 고정금액
  value: number;                              // 5% or 1000원
  rounding_policy: 'NONE' | 'TEN' | 'HUNDRED' | 'THOUSAND';
  target_items?: number[];                    // 특정 품목만
  target_category?: string;                   // 특정 카테고리만
  effective_month: string;                    // 적용 월 (YYYY-MM)
}

POST /api/price-master/calculate
{
  "calculation_type": "PERCENTAGE",
  "value": 5.0,
  "rounding_policy": "HUNDRED",
  "target_category": "원자재",
  "effective_month": "2025-02"
}
```

- [ ] 계산 결과 미리보기 기능
  - 변경 전/후 비교
  - 영향받는 품목 수
  - 총 금액 변화

- [ ] 계산 이력 저장
  - `price_calculation_history` 테이블 생성
  - 계산 로직, 실행 시각, 실행자 기록

#### 2️⃣ 이력 관리 시스템 고도화 (4시간)

**Backend Agent** (2h):
- [ ] 월별 이력 조회 API 개선
  - `GET /api/price-master/history?item_id={id}&from={YYYY-MM}&to={YYYY-MM}`
  - 기간별 필터링
  - 변경 사유 조회

- [ ] 이력 비교 API
  - `GET /api/price-master/compare?item_id={id}&month1={YYYY-MM}&month2={YYYY-MM}`
  - 두 시점 단가 비교
  - 차이 금액/비율 계산

**Frontend Agent** (2h):
- [ ] 이력 비교 UI 컴포넌트
  - 월별 단가 변화 차트 (Line Chart)
  - 전월 대비 증감 표시
  - 필터링 옵션 (기간, 품목, 카테고리)

```typescript
// 예상 컴포넌트 구조
<PriceHistoryChart
  itemId={123}
  dateRange={{ from: '2024-01', to: '2025-01' }}
  showPercentageChange={true}
/>
```

#### 3️⃣ 대량 업데이트 최적화 (3시간)

**Backend Agent** (2h):
- [ ] Bulk Update API 생성
  - `POST /api/price-master/bulk-update`
  - 배치 처리 (100개씩 chunk)
  - PostgreSQL `COPY` 명령 활용 (고속 삽입)
  - 트랜잭션 처리 (전체 성공 or 전체 롤백)

```typescript
POST /api/price-master/bulk-update
{
  "updates": [
    { "item_id": 1, "unit_price": 15000, "price_month": "2025-02" },
    { "item_id": 2, "unit_price": 22000, "price_month": "2025-02" },
    // ... 최대 1000개
  ]
}
```

**Test Agent** (1h):
- [ ] 대량 업데이트 성능 테스트
  - 100개 업데이트: <1초
  - 1000개 업데이트: <5초
  - 에러 처리 검증 (중간 실패 시 롤백)

#### 4️⃣ 엑셀 배치 업로드 (2시간)

**Backend Agent** (1h):
- [ ] 엑셀 업로드 API
  - `POST /api/price-master/upload`
  - XLSX 파일 파싱 (SheetJS)
  - 품목명 or 품번으로 매칭
  - 검증 로직 (중복, 존재하지 않는 품목)

**Frontend Agent** (1h):
- [ ] 엑셀 업로드 UI
  - 드래그 앤 드롭
  - 업로드 진행률 표시
  - 에러 품목 리스트 표시
  - 템플릿 다운로드 버튼

```typescript
// 예상 엑셀 템플릿 형식
| 품번 | 품목명 | 단가 (원) | 적용월 |
|------|--------|-----------|--------|
| ITM001 | 부품A | 15000 | 2025-02 |
| ITM002 | 부품B | 22000 | 2025-02 |
```

#### 5️⃣ 고급 검증 및 에러 처리 (2시간)

**Backend Agent** (1.5h):
- [ ] 비즈니스 룰 검증
  - 전월 대비 100% 이상 인상 시 경고
  - 0원 단가 저장 시 확인 메시지
  - 과거 6개월 이내 중복 단가 체크

- [ ] 에러 메시지 한글화
  - 모든 API 에러 메시지 한글로 변경
  - 에러 코드 체계 정립

**Test Agent** (0.5h):
- [ ] 비즈니스 룰 테스트
  - 경고 조건 테스트 (>100% 인상)
  - 에러 조건 테스트 (음수 단가, NULL)

### Wave 2 체크리스트

**Day 1 오전 (4h)**: 가격 계산 로직
- [ ] 계산 API 엔드포인트 구현
- [ ] 계산 결과 미리보기
- [ ] 계산 이력 저장

**Day 1 오후 (4h)**: 이력 관리 시스템
- [ ] 이력 조회 API 개선
- [ ] 이력 비교 API 구현
- [ ] 이력 차트 UI 컴포넌트

**Day 2 오전 (3h)**: 대량 업데이트 최적화
- [ ] Bulk Update API
- [ ] 성능 테스트 (<1초/100개)
- [ ] 트랜잭션 처리 검증

**Day 2 오후 (2h)**: 엑셀 배치 & 고급 검증
- [ ] 엑셀 업로드 API + UI
- [ ] 비즈니스 룰 검증
- [ ] 에러 메시지 한글화

## 🎯 Wave 3: 대시보드 통합 (1.5일)

### 작업 분류

#### 1️⃣ 대시보드 위젯 생성 (2시간)

**Frontend Agent** (2h):
- [ ] 단가 현황 위젯
  - 평균 단가 추이 (월별)
  - 단가 변동률 (전월 대비)
  - 카테고리별 평균 단가

```typescript
// 예상 컴포넌트
<PriceDashboardWidget>
  <PriceStatCard title="평균 단가" value="15,000원" change="+5%" />
  <PriceTrendChart data={monthlyPrices} />
  <CategoryPriceTable categories={categoryPrices} />
</PriceDashboardWidget>
```

- [ ] Top N 위젯
  - 가격 상승률 TOP 10
  - 가격 하락률 TOP 10
  - 고가 품목 TOP 10

#### 2️⃣ 실시간 알림 시스템 (2시간)

**Backend Agent** (1h):
- [ ] 알림 조건 설정 API
  - `POST /api/notifications/rules`
  - 조건: 전월 대비 X% 이상 변동
  - 조건: 특정 금액 이상/이하
  - 조건: 특정 카테고리 변경

```typescript
// 예상 알림 룰
interface NotificationRule {
  rule_type: 'PRICE_INCREASE' | 'PRICE_DECREASE' | 'THRESHOLD';
  threshold: number;                 // 5% or 10000원
  target_category?: string;          // 특정 카테고리만
  notification_method: 'EMAIL' | 'TOAST' | 'PUSH';
}
```

**Frontend Agent** (1h):
- [ ] 알림 표시 UI
  - Toast 알림 (단가 변경 시)
  - 알림 센터 (이력 보기)
  - 알림 설정 페이지

#### 3️⃣ 고급 분석 기능 (4시간)

**Backend Agent** (2h):
- [ ] 분석 API 엔드포인트
  - `GET /api/price-master/analytics/trend`
    - 전체 품목 평균 단가 추이
    - 카테고리별 평균 단가 추이
  - `GET /api/price-master/analytics/volatility`
    - 단가 변동성 분석 (표준편차)
    - 안정 품목 vs 불안정 품목 분류
  - `GET /api/price-master/analytics/correlation`
    - 카테고리 간 단가 상관관계
    - 계절성 분석 (월별 패턴)

**Frontend Agent** (2h):
- [ ] 분석 대시보드 페이지
  - 트렌드 차트 (Line/Area Chart)
  - 변동성 히트맵
  - 상관관계 매트릭스

```typescript
// 예상 분석 페이지 구조
<AnalyticsDashboard>
  <TrendSection>
    <LineChart data={overallTrend} />
    <CategoryTrendChart data={categoryTrends} />
  </TrendSection>

  <VolatilitySection>
    <HeatMap data={volatilityMatrix} />
    <VolatileItemsTable items={topVolatileItems} />
  </VolatilitySection>

  <CorrelationSection>
    <CorrelationMatrix data={correlationData} />
  </CorrelationSection>
</AnalyticsDashboard>
```

#### 4️⃣ 데이터 내보내기 개선 (1시간)

**Backend Agent** (0.5h):
- [ ] 엑셀 내보내기 개선
  - 3-Sheet 구조
    - Sheet 1: 현재 단가 목록
    - Sheet 2: 월별 이력
    - Sheet 3: 통계 (평균, 최소, 최대)
  - 한글 헤더
  - 셀 포맷팅 (천 단위 콤마)

**Frontend Agent** (0.5h):
- [ ] 내보내기 옵션 UI
  - 내보내기 범위 선택 (전체/선택/필터)
  - 포함할 컬럼 선택
  - 날짜 범위 선택

#### 5️⃣ 성능 최적화 (3시간)

**Backend Agent** (2h):
- [ ] 캐싱 전략 도입
  - Redis 또는 In-memory 캐싱
  - 캐시 키: `price_master:item:{id}:month:{YYYY-MM}`
  - TTL: 1시간 (단가는 자주 변경되지 않음)
  - Invalidation: 단가 수정 시 해당 품목 캐시 삭제

- [ ] 쿼리 최적화
  - 인덱스 추가 (필요 시)
  - N+1 쿼리 제거
  - 불필요한 JOIN 제거

**Test Agent** (1h):
- [ ] 성능 테스트 재실행
  - 목표: 평균 응답 시간 <200ms (현재 229ms)
  - 목표 달성률: >90% (현재 70%)
  - 100회 반복 테스트

### Wave 3 체크리스트

**Day 1 오전 (2h)**: 대시보드 위젯
- [ ] 단가 현황 위젯 구현
- [ ] Top N 위젯 구현

**Day 1 오후 (2h)**: 실시간 알림
- [ ] 알림 조건 설정 API
- [ ] 알림 표시 UI

**Day 2 오전 (4h)**: 고급 분석
- [ ] 분석 API 구현 (트렌드, 변동성, 상관관계)
- [ ] 분석 대시보드 페이지

**Day 2 오후 (4h)**: 내보내기 & 성능 최적화
- [ ] 엑셀 내보내기 개선
- [ ] 캐싱 전략 도입
- [ ] 쿼리 최적화
- [ ] 성능 테스트 재실행 (목표 달성 확인)

## 🚀 3-Agent 병렬 실행 전략

### Agent 역할 분담

**Agent 1: Backend Specialist**
- API 엔드포인트 개발
- 데이터베이스 쿼리 최적화
- 비즈니스 로직 구현
- 캐싱 전략 구현

**Agent 2: Frontend Specialist**
- UI 컴포넌트 개발
- 차트/그래프 구현
- 사용자 경험 개선
- 반응형 디자인

**Agent 3: Test & Optimize Specialist**
- Edge Case 테스트
- 성능 벤치마크
- 부하 테스트
- 에러 시나리오 검증

### 병렬 작업 타임라인

#### Wave 2 Timeline (2일)

**Day 1 (8h)**:
```
시간       | Agent 1 (Backend)    | Agent 2 (Frontend)   | Agent 3 (Test)
-----------|---------------------|---------------------|-------------------
09:00-11:00| 계산 API 구현        | 이력 차트 UI 준비    | 계산 로직 테스트 준비
11:00-13:00| 계산 이력 저장 구현   | 이력 차트 구현       | 계산 결과 검증
14:00-16:00| 이력 조회/비교 API   | 이력 비교 UI        | 이력 API 테스트
16:00-18:00| Bulk Update API     | 엑셀 업로드 UI       | 대량 업데이트 성능 테스트
```

**Day 2 (5h)**:
```
시간       | Agent 1 (Backend)    | Agent 2 (Frontend)   | Agent 3 (Test)
-----------|---------------------|---------------------|-------------------
09:00-11:00| 엑셀 파싱 구현       | 업로드 진행률 UI     | 엑셀 업로드 테스트
11:00-13:00| 비즈니스 룰 검증     | 에러 메시지 표시     | 비즈니스 룰 테스트
14:00-16:00| 에러 처리 한글화     | UI 통합 테스트       | 전체 Wave 2 검증
```

#### Wave 3 Timeline (1.5일)

**Day 1 (8h)**:
```
시간       | Agent 1 (Backend)    | Agent 2 (Frontend)   | Agent 3 (Test)
-----------|---------------------|---------------------|-------------------
09:00-11:00| 알림 조건 API        | 단가 현황 위젯       | 위젯 렌더링 테스트
11:00-13:00| 알림 트리거 로직     | Top N 위젯          | 알림 동작 테스트
14:00-16:00| 트렌드 분석 API      | 트렌드 차트 구현     | 분석 API 테스트
16:00-18:00| 변동성 분석 API      | 변동성 히트맵        | 변동성 계산 검증
```

**Day 2 (4h)**:
```
시간       | Agent 1 (Backend)    | Agent 2 (Frontend)   | Agent 3 (Test)
-----------|---------------------|---------------------|-------------------
09:00-11:00| 상관관계 분석 API    | 상관관계 매트릭스    | 분석 정확도 검증
11:00-13:00| 캐싱 전략 구현       | 내보내기 옵션 UI     | 성능 테스트 재실행
14:00-16:00| 쿼리 최적화          | UI 폴리싱           | 전체 시스템 검증
```

### 병렬 실행 장점

1. **시간 단축**: 3명이 순차 작업 시 10.5일 → 병렬 작업 시 3.5일 (70% 단축)
2. **품질 향상**: Test Agent가 실시간으로 검증하여 버그 조기 발견
3. **기술 부채 최소화**: Backend/Frontend 동시 개발로 API 스펙 불일치 방지
4. **코드 리뷰**: 다른 Agent가 작성한 코드를 상호 검토

## 📊 예상 결과물

### Wave 2 산출물
- 새 API 엔드포인트: 6개
  - `/api/price-master/calculate` (POST)
  - `/api/price-master/history` (GET)
  - `/api/price-master/compare` (GET)
  - `/api/price-master/bulk-update` (POST)
  - `/api/price-master/upload` (POST)
  - `/api/notifications/rules` (POST)

- 새 UI 컴포넌트: 4개
  - `PriceHistoryChart`
  - `PriceCalculationModal`
  - `ExcelUploadModal`
  - `BulkUpdateProgress`

- 새 데이터베이스 테이블: 2개
  - `price_calculation_history` (계산 이력)
  - `notification_rules` (알림 규칙)

### Wave 3 산출물
- 새 API 엔드포인트: 4개
  - `/api/price-master/analytics/trend` (GET)
  - `/api/price-master/analytics/volatility` (GET)
  - `/api/price-master/analytics/correlation` (GET)
  - `/api/price-master/export-advanced` (GET)

- 새 UI 페이지: 1개
  - `src/app/price-analytics/page.tsx` (분석 대시보드)

- 새 UI 컴포넌트: 7개
  - `PriceDashboardWidget`
  - `PriceStatCard`
  - `PriceTrendChart`
  - `TopNWidget`
  - `NotificationCenter`
  - `VolatilityHeatMap`
  - `CorrelationMatrix`

- 성능 개선
  - API 평균 응답 시간: 229ms → <200ms (12.6% 개선)
  - 목표 달성률: 70% → >90% (20%p 개선)

### 예상 코드 증가량
- **Wave 2**: +1,200 lines
  - Backend: +600 lines
  - Frontend: +500 lines
  - Test: +100 lines

- **Wave 3**: +1,000 lines
  - Backend: +400 lines
  - Frontend: +500 lines
  - Test: +100 lines

- **총 증가**: +2,200 lines (Wave 1: 1,536 lines → Wave 1+2+3: 3,736 lines)

## 🎯 완성 후 기능 완성도

### Phase P3 전체 완성도: 100%

**Wave 1 (완료)**: 27%
- ✅ 기본 CRUD
- ✅ Edge Case 처리
- ✅ Bug 수정

**Wave 2 (예정)**: 40%
- ⏳ 가격 계산 엔진
- ⏳ 이력 관리 고도화
- ⏳ 대량 업데이트
- ⏳ 엑셀 배치 업로드

**Wave 3 (예정)**: 33%
- ⏳ 대시보드 통합
- ⏳ 실시간 알림
- ⏳ 고급 분석
- ⏳ 성능 최적화

### 최종 점수 예상: 100/100

**현재 점수**: 97/100
- 완료 항목: 97점
- 감점 항목: -3점 (API 성능)

**Wave 2+3 완료 후**:
- 성능 최적화 완료: +3점 (API <200ms 달성)
- 추가 기능 완료: +0점 (기본 요구사항 초과)
- **최종 점수**: 100/100 ✅

## ⚡ 전체 남은 작업 병렬 실행 일정

### 📅 총 소요 시간: **3.5~4일** (Phase P3 + Phase 1 병렬)

#### 전체 작업 범위

**Phase P3 Wave 2 & 3**: 3.5일
```
├─ Wave 2 (2일): 가격 계산 엔진, 이력 관리, 대량 업데이트, 엑셀 업로드
└─ Wave 3 (1.5일): 대시보드 통합, 알림, 분석, 성능 최적화
```

**Phase 1 Frontend 완성**: 1일 (병렬 실행 가능)
```
├─ 수금 관리 페이지 UI (4h)
└─ 지급 관리 페이지 UI (4h)
```

#### 최적화된 병렬 실행 전략

**Day 1-2 (Wave 2 + Phase 1)**: 동시 진행 가능
```
┌─────────────┬──────────────────────────┬──────────────────────────┐
│ 시간대      │ Phase P3 Wave 2          │ Phase 1 Frontend         │
├─────────────┼──────────────────────────┼──────────────────────────┤
│ Day 1 오전  │ 가격 계산 API (4h)       │ 수금 페이지 UI (4h)      │
│ Day 1 오후  │ 이력 관리 고도화 (4h)    │ 지급 페이지 UI (4h)      │
│ Day 2 오전  │ 대량 업데이트 (3h)       │ UI 통합 테스트 (3h)      │
│ Day 2 오후  │ 엑셀 업로드 + 검증 (2h)  │ 버그 수정 (2h)           │
└─────────────┴──────────────────────────┴──────────────────────────┘
```

**Day 3-4 (Wave 3)**: 최종 통합 및 최적화
```
┌─────────────┬──────────────────────────────────────────────────────┐
│ 시간대      │ Phase P3 Wave 3                                      │
├─────────────┼──────────────────────────────────────────────────────┤
│ Day 3 오전  │ 대시보드 위젯 + 알림 (4h)                            │
│ Day 3 오후  │ 고급 분석 API + UI (4h)                              │
│ Day 4 오전  │ 데이터 내보내기 개선 (1h) + 캐싱 전략 (2h)           │
│ Day 4 오후  │ 쿼리 최적화 + 성능 테스트 (3h)                       │
└─────────────┴──────────────────────────────────────────────────────┘
```

#### 3-Agent 병렬 실행 시 예상 결과

**순차 실행 대비 시간 단축**:
- Phase P3 Wave 2 & 3: 3.5일 (단독 실행)
- Phase 1 Frontend: 1일 (단독 실행)
- **순차 실행 시**: 4.5일
- **병렬 실행 시**: **3.5~4일** (약 15% 단축)

**병렬 실행 가능 구간**:
- ✅ Wave 2 가격 계산 API ⟷ Phase 1 수금/지급 UI (독립적)
- ✅ Wave 2 이력 관리 API ⟷ Phase 1 UI 통합 테스트 (독립적)
- ⚠️ Wave 3는 Wave 2 완료 후 시작 (의존성 존재)

**코드 증가량**:
- Phase P3: +2,200 lines
- Phase 1: +800 lines
- **총 증가**: +3,000 lines

**최종 완성도**:
- Phase P3: 100% (현재 27% → 100%)
- Phase 1: 100% (현재 95% → 100%)
- **전체 시스템**: 100/100 ✅

#### 일정 정확성 분석

**✅ 낙관적 요소** (일정 단축 가능):
1. Backend/Frontend 완전 분리 작업 → 병렬 진행 가능
2. Test Agent 실시간 검증 → 버그 조기 발견
3. 기존 코드 재사용 → 개발 속도 향상
4. 명확한 요구사항 → 재작업 최소화

**⚠️ 리스크 요소** (일정 지연 가능):
1. API 스펙 불일치 → +2-4h (Backend/Frontend 조율)
2. 예상 못한 버그 → +2-4h (Edge Case 처리)
3. 성능 목표 미달 → +2-4h (추가 최적화)
4. 테스트 실패 → +1-2h (재테스트 및 수정)

**현실적 일정 범위**:
- 최선의 경우 (모든 작업 순조): **3.5일**
- 현실적 예상 (소규모 이슈): **3.5~4일** ✅ 권장
- 보수적 예상 (중규모 이슈): **4~4.5일**

#### 일정 달성 전략

**리스크 완화 방안**:
1. **API 스펙 사전 합의**: Backend/Frontend Agent 간 API 스펙 문서화 (1h)
2. **일일 동기화**: 매일 오전 9시 Agent 간 진행상황 공유 (0.5h)
3. **테스트 우선**: Test Agent가 각 기능 완료 즉시 검증 (실시간)
4. **버퍼 시간**: 각 Wave 마지막 날 2-4h 버퍼 (예비)

**일정 준수 확률**:
- 3.5일 이내 완료: **70%**
- 4일 이내 완료: **90%** ✅
- 4.5일 이내 완료: **98%**

---

**작성일**: 2025-01-17
**갱신일**: 2025-01-17 (병렬 실행 일정 추가)
**작성자**: Claude Code SuperClaude Framework
**버전**: Phase P3 Wave 2 & 3 Remaining Work Plan v1.1
