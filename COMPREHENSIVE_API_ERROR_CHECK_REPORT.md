# 전체 앱 API 에러 및 타임아웃 체크 보고서

## 작성일시
2025-01-20

## 체크 범위
- 모든 페이지의 fetch 호출
- 타임아웃 처리 여부
- 재시도 로직 여부
- 에러 처리 개선 필요 여부

---

## ✅ 이미 수정 완료된 페이지

### 1. 월별 단가 관리 페이지 (`/price-management`)
- ✅ BOM cost API 호출에 30초 타임아웃 추가
- ✅ 에러 처리 개선
- ✅ 상태: 정상 작동

### 2. 재고 현황 페이지 (`/stock`)
- ✅ 초기 로딩 지연 100ms 추가
- ✅ 재시도 로직 개선 (모든 네트워크 오류)
- ✅ 상태: 정상 작동

---

## ⚠️ 개선이 필요한 페이지

### 1. 품목 상세 페이지 (`/master/items/[id]`)

**문제점:**
- 4개의 순차적인 fetch 호출 (타임아웃 없음, 재시도 없음)
  - `/api/items/${itemId}` (품목 기본 정보)
  - `/api/items/${itemId}/bom-usage` (BOM 사용 현황)
  - `/api/items/${itemId}/bom-structure` (BOM 구조)
  - `/api/items/${itemId}/stock-history?days=30` (재고 이력)
- 하나라도 실패하면 전체가 실패
- 네트워크 오류 시 무한 대기 가능

**권장 개선:**
1. 타임아웃 추가 (각 요청당 10초)
2. 병렬 처리로 변경 (Promise.all)
3. 재시도 로직 추가
4. 부분 실패 시에도 표시 가능한 데이터는 표시

**현재 코드:**
```117:153:src/app/master/items/[id]/page.tsx
      const itemRes = await fetch(`/api/items/${itemId}`);
      // ... 3개 더 순차 호출
```

---

### 2. 재고 관리 페이지 (`/inventory`)

**문제점:**
- `fetchTransactions()`와 `fetchStockInfo()` 병렬 호출은 좋지만
- 각각 타임아웃/재시도 없음
- 초기 로딩 지연 없음

**권장 개선:**
1. 초기 로딩 지연 추가 (100ms)
2. 타임아웃 추가 (10초)
3. 재시도 로직 추가

**현재 코드:**
```146:174:src/app/inventory/page.tsx
  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${url}?${params}`);
      // 타임아웃/재시도 없음
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };
```

---

### 3. 대시보드 데이터 Hook (`useDashboardData`)

**문제점:**
- `Promise.all`로 3개 API 병렬 호출
- 타임아웃 없음
- 재시도 로직이 있지만 자동 재시도는 없음 (`retryCount`만 증가)

**권장 개선:**
1. `Promise.all`에 타임아웃 래퍼 추가
2. 자동 재시도 로직 추가
3. 부분 실패 처리 (일부 API 실패 시에도 표시)

**현재 코드:**
```158:180:src/hooks/useDashboardData.tsx
      const [statsRes, chartsRes, alertsRes] = await Promise.all([
        fetch('/api/dashboard/stats', { ... }),
        fetch('/api/dashboard/charts', { ... }),
        fetch('/api/dashboard/alerts', { ... })
      ]);
      // 타임아웃 없음
```

---

### 4. 회계 요약 페이지 (`/accounting/summary`)

**문제점:**
- fetch 호출에 타임아웃 없음
- 재시도 로직 없음
- 초기 로딩 지연 없음

**권장 개선:**
1. 타임아웃 추가 (30초)
2. 재시도 로직 추가
3. 초기 로딩 지연 추가 (100ms)

**현재 코드:**
```82:84:src/app/accounting/summary/page.tsx
        const response = await fetch(
          `/api/accounting/monthly-summary?${queryParams}`
        );
        // 타임아웃/재시도 없음
```

---

### 5. BOM 관리 페이지 (`/master/bom`)

**문제점:**
- 여러 fetch 호출에 타임아웃 없음
- 재시도 로직 없음
- 대량 데이터 조회 가능 (limit=1000)

**권장 개선:**
1. 대량 조회 API에 타임아웃 추가
2. 재시도 로직 추가
3. 에러 처리 개선

---

### 6. 기타 페이지들

다음 페이지들도 타임아웃/재시도 로직이 없습니다:

- **매출 관리** (`/sales`) - fetch 호출 3개
- **매입 관리** (`/purchases`) - fetch 호출 3개
- **수금 관리** (`/collections`) - fetch 호출 3개
- **지급 관리** (`/payments`) - fetch 호출 3개
- **재고 이력** (`/stock/history`) - fetch 호출 2개
- **재고 보고서** (`/stock/reports`) - fetch 호출 1개
- **거래처 관리** (`/master/companies`) - fetch 호출 4개
- **품목 관리** (`/master/items`) - fetch 호출 4개
- **계약 관리** (`/contracts`) - fetch 호출 5개
- **포털 페이지들** - fetch 호출 다수

---

## 📊 전체 통계

### Fetch 호출 현황
- **총 페이지 수**: 31개
- **이미 수정 완료**: 2개 (월별 단가 관리, 재고 현황)
- **개선 필요**: 약 20개 이상
- **React Query 사용**: 일부 hook만 사용 (useItems, useCompanies 등)

### 주요 문제 패턴

1. **타임아웃 없음** (95% 이상)
   - 대부분의 fetch 호출에 타임아웃 없음
   - 네트워크 문제 시 무한 대기 가능

2. **재시도 로직 부재** (90% 이상)
   - 재고 현황 페이지만 개선됨
   - 나머지는 재시도 없음

3. **초기 로딩 지연 없음** (100%)
   - 재고 현황 페이지만 개선됨
   - 페이지 로드 직후 즉시 API 호출

4. **에러 처리 미흡** (80% 이상)
   - 대부분 console.error만 사용
   - 사용자 친화적 에러 메시지 부족

---

## 🔧 권장 개선 사항

### 우선순위 1 (즉시 개선)
1. **품목 상세 페이지** - 4개 순차 호출 → 병렬 처리 + 타임아웃
2. **재고 관리 페이지** - 타임아웃 + 재시도 추가
3. **대시보드 데이터 hook** - Promise.all에 타임아웃 래퍼

### 우선순위 2 (단기 개선)
4. 회계 요약 페이지
5. BOM 관리 페이지
6. 매출/매입/수금/지급 관리 페이지

### 우선순위 3 (장기 개선)
7. 공통 fetch 유틸리티 함수 생성
8. 모든 페이지에 타임아웃/재시도 적용
9. 에러 처리 통일화

---

## 💡 공통 해결 방안

### 1. 공통 fetch 유틸리티 함수 생성
```typescript
// src/lib/fetch-utils.ts
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Response> {
  // 재시도 로직 구현
}
```

### 2. React Query 활용 확대
- 현재 일부 hook만 사용 (useItems, useCompanies)
- 모든 데이터 페칭을 React Query로 전환 고려
- 자동 재시도, 캐싱, 에러 처리 제공

### 3. 에러 바운더리 추가
- 페이지 레벨 에러 바운더리
- 섹션별 에러 바운더리
- 사용자 친화적 에러 메시지

---

## 🎯 다음 단계

1. **공통 fetch 유틸리티 함수 생성**
2. **우선순위 1 페이지들 개선**
3. **전체 페이지 통합 테스트**
4. **에러 로깅 시스템 구축**

