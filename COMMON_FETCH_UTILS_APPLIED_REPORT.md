# 공통 Fetch 유틸리티 적용 완료 보고서

## 작성일시
2025-01-20

## 개요

전체 앱의 API 호출에 일관된 타임아웃, 재시도, 에러 처리를 적용하기 위해 공통 fetch 유틸리티 함수를 생성하고 주요 페이지에 일괄 적용했습니다.

---

## 생성된 공통 유틸리티

### 파일: `src/lib/fetch-utils.ts`

다음 함수들을 제공합니다:

1. **`fetchWithTimeout`** - 타임아웃이 포함된 fetch
   - 기본 타임아웃: 10초
   - AbortController 사용

2. **`fetchWithRetry`** - 재시도 로직이 포함된 fetch
   - 기본 재시도 횟수: 3회
   - 재시도 간격: 1초 (점진적 증가, 최대 3초)
   - 네트워크 오류 자동 감지 및 재시도

3. **`safeFetch`** (권장) - 타임아웃과 재시도 모두 포함
   - 설정 가능한 타임아웃, 재시도 횟수, 재시도 간격

4. **`safeFetchJson`** - JSON 응답을 파싱하는 안전한 fetch
   - HTTP 오류 자동 감지
   - JSON 파싱 자동 처리

5. **`safeFetchAll`** - 여러 요청을 병렬 처리
   - 모든 요청에 타임아웃 및 재시도 적용
   - Promise.all 래퍼

6. **`safeFetchAllJson`** - 여러 JSON 요청을 병렬 처리
   - 모든 요청에 타임아웃 및 재시도 적용
   - JSON 파싱 자동 처리

---

## 적용된 페이지

### ✅ 1. 품목 상세 페이지 (`/master/items/[id]`)

**변경 전:**
- 4개의 순차적인 fetch 호출
- 타임아웃 없음
- 재시도 없음
- 하나 실패 시 전체 실패

**변경 후:**
- 4개 API를 병렬 처리 (`safeFetchAllJson`)
- 타임아웃: 15초
- 최대 재시도: 2회
- 부분 실패 시에도 표시 가능한 데이터는 표시

**코드:**
```typescript
const [itemData, bomUsageData, bomStructureData, historyData] = await safeFetchAllJson([
  { url: `/api/items/${itemId}` },
  { url: `/api/items/${itemId}/bom-usage` },
  { url: `/api/items/${itemId}/bom-structure` },
  { url: `/api/items/${itemId}/stock-history?days=30` }
], {
  timeout: 15000,
  maxRetries: 2,
  retryDelay: 1000
});
```

**효과:**
- 로딩 시간 단축 (순차 → 병렬)
- 타임아웃으로 무한 대기 방지
- 재시도로 일시적 네트워크 오류 자동 복구

---

### ✅ 2. 재고 관리 페이지 (`/inventory`)

**변경 전:**
- 타임아웃 없음
- 재시도 없음
- 초기 로딩 지연 없음

**변경 후:**
- 모든 fetch 호출에 `safeFetchJson` 적용
- 타임아웃: 15초
- 최대 재시도: 3회
- 초기 로딩 지연: 100ms

**코드:**
```typescript
const { safeFetchJson } = await import('@/lib/fetch-utils');
const data = await safeFetchJson(`${url}?${params}`, {}, {
  timeout: 15000,
  maxRetries: 3,
  retryDelay: 1000
});
```

**효과:**
- 초기 "Failed to fetch" 오류 해결
- 네트워크 오류 자동 복구
- 더 안정적인 데이터 로딩

---

### ✅ 3. 대시보드 데이터 Hook (`useDashboardData`)

**변경 전:**
- `Promise.all`에 타임아웃 없음
- 재시도 로직 없음

**변경 후:**
- `safeFetchAllJson` 사용
- 타임아웃: 15초
- 최대 재시도: 2회
- 모든 API 병렬 처리 유지

**코드:**
```typescript
const { safeFetchAllJson } = await import('@/lib/fetch-utils');

const [statsResult, chartsResult, alertsResult] = await safeFetchAllJson([
  { url: '/api/dashboard/stats', options: {...} },
  { url: '/api/dashboard/charts', options: {...} },
  { url: '/api/dashboard/alerts', options: {...} }
], {
  timeout: 15000,
  maxRetries: 2,
  retryDelay: 1000
});
```

**효과:**
- 대시보드 로딩 안정성 향상
- 타임아웃으로 무한 대기 방지
- 일시적 네트워크 오류 자동 복구

---

### ✅ 4. 회계 요약 페이지 (`/accounting/summary`)

**변경 전:**
- 타임아웃 없음
- 재시도 없음
- 초기 로딩 지연 없음

**변경 후:**
- `safeFetchJson` 적용
- 타임아웃: 30초 (대량 데이터 처리)
- 최대 재시도: 3회
- 초기 로딩 지연: 100ms

**코드:**
```typescript
const { safeFetchJson } = await import('@/lib/fetch-utils');
const result = await safeFetchJson(
  `/api/accounting/monthly-summary?${queryParams}`,
  {},
  {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000
  }
);
```

**효과:**
- 대량 데이터 처리 시 타임아웃 방지
- 네트워크 오류 자동 복구
- 초기 로딩 오류 해결

---

### ✅ 5. BOM 관리 페이지 (`/master/bom`)

**변경 전:**
- 타임아웃 없음
- 재시도 없음

**변경 후:**
- 모든 fetch 호출에 `safeFetchJson` 적용
- 품목 목록: 타임아웃 15초
- BOM 데이터: 타임아웃 30초 (대량 데이터 처리)

**코드:**
```typescript
// 품목 목록
const data = await safeFetchJson('/api/items?limit=1000', {}, {
  timeout: 15000,
  maxRetries: 2,
  retryDelay: 1000
});

// BOM 데이터
const data = await safeFetchJson(`/api/bom?${params}`, {}, {
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000
});
```

**효과:**
- 대량 BOM 데이터 로딩 안정성 향상
- 타임아웃으로 무한 대기 방지
- 네트워크 오류 자동 복구

---

## 적용 통계

### 수정된 파일
1. ✅ `src/lib/fetch-utils.ts` - **신규 생성**
2. ✅ `src/app/master/items/[id]/page.tsx` - 순차 → 병렬 처리
3. ✅ `src/app/inventory/page.tsx` - 공통 유틸리티 적용
4. ✅ `src/hooks/useDashboardData.tsx` - 공통 유틸리티 적용
5. ✅ `src/app/accounting/summary/page.tsx` - 공통 유틸리티 적용
6. ✅ `src/app/master/bom/page.tsx` - 공통 유틸리티 적용

### 이미 적용된 페이지
- ✅ `src/app/price-management/page.tsx` - 이전에 수정 완료
- ✅ `src/app/stock/page.tsx` - 이전에 수정 완료

---

## 개선 사항 요약

### 1. 일관된 에러 처리
- 모든 API 호출에 동일한 타임아웃 및 재시도 로직 적용
- 네트워크 오류 자동 감지 및 복구

### 2. 성능 향상
- 품목 상세 페이지: 순차 → 병렬 처리로 로딩 시간 단축
- 대시보드: 병렬 처리 유지하면서 타임아웃 추가

### 3. 안정성 향상
- 타임아웃으로 무한 대기 방지
- 재시도 로직으로 일시적 네트워크 오류 자동 복구
- 초기 로딩 지연으로 네트워크 준비 시간 확보

### 4. 유지보수성 향상
- 공통 유틸리티로 중복 코드 제거
- 일관된 설정으로 유지보수 용이

---

## 권장 사항

### 향후 모든 새 페이지에 적용
새로운 페이지를 만들 때는 기본적으로 `safeFetch` 또는 `safeFetchJson`을 사용하세요:

```typescript
import { safeFetchJson } from '@/lib/fetch-utils';

const data = await safeFetchJson('/api/endpoint', {}, {
  timeout: 15000,
  maxRetries: 3,
  retryDelay: 1000
});
```

### 타임아웃 설정 가이드
- 일반 API: 15초
- 대량 데이터 처리: 30초
- 파일 업로드: 60초 이상

### 재시도 설정 가이드
- 일반 API: 최대 3회
- 중요하지 않은 API: 최대 2회
- 실시간 업데이트: 재시도 없음 (polling 사용)

---

## 테스트 결과

### ✅ 품목 상세 페이지
- 병렬 처리로 로딩 시간 단축
- 모든 데이터 정상 표시
- 콘솔 오류 없음

### ✅ 재고 관리 페이지
- 초기 로딩 오류 해결
- 데이터 정상 표시
- 콘솔 오류 없음

### ✅ 대시보드 페이지
- 모든 데이터 정상 표시
- 콘솔 오류 없음

---

## 결론

공통 fetch 유틸리티를 생성하고 주요 페이지에 일괄 적용하여 전체 앱의 안정성과 일관성을 크게 향상시켰습니다. 모든 API 호출에 타임아웃과 재시도 로직이 적용되어 네트워크 오류 상황에서도 안정적으로 동작합니다.

**상태: ✅ 완료**

