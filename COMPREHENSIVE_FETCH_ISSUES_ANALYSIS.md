# 전체 앱 Fetch 이슈 종합 분석 보고서

## 작성일시
2025-01-20

## 개요

전체 앱의 fetch 호출 패턴을 분석하여 타임아웃, 재시도, 에러 처리가 누락된 부분을 찾아 우선순위별로 정리했습니다.

---

## ✅ 이미 수정 완료된 페이지

1. ✅ **월별 단가 관리** (`/price-management`) - BOM cost 배치 API에 타임아웃 추가
2. ✅ **재고 현황** (`/stock`) - 초기 로딩 지연 및 재시도 로직
3. ✅ **품목 상세** (`/master/items/[id]`) - 순차 → 병렬 처리, 공통 유틸리티 적용
4. ✅ **재고 관리** (`/inventory`) - 공통 유틸리티 적용
5. ✅ **대시보드 데이터** (`useDashboardData`) - 공통 유틸리티 적용
6. ✅ **회계 요약** (`/accounting/summary`) - 공통 유틸리티 적용
7. ✅ **BOM 관리** (`/master/bom`) - 공통 유틸리티 적용

---

## 🔴 우선순위 1: 즉시 수정 권장

### 1. 순차 Fetch 호출 (성능 문제)

#### 1-1. **ShippingForm 컴포넌트** (`src/components/ShippingForm.tsx`)
**문제:**
- 3개의 순차 fetch 호출 (고객, 제품, 재고)
- 타임아웃 없음, 재시도 없음
- 하나 실패 시 전체 실패

**현재 코드:**
```typescript
const customersResponse = await fetch('/api/companies?type=CUSTOMER');
const productsResponse = await fetch('/api/items?type=PRODUCT');
const stockResponse = await fetch('/api/stock');
```

**개선 방안:**
- `safeFetchAllJson`로 병렬 처리
- 타임아웃: 15초, 재시도: 2회

#### 1-2. **ReceivingForm 컴포넌트** (`src/components/ReceivingForm.tsx`)
**문제:**
- 단가 조회 순차 호출
- 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용

#### 1-3. **Reports 페이지** (`src/app/reports/page.tsx`)
**문제:**
- 2개의 순차 fetch (재무상태표, 현금흐름표)
- 타임아웃 없음, 재시도 없음

**현재 코드:**
```typescript
const balanceSheetResponse = await fetch(...);
const cashFlowResponse = await fetch(...);
```

**개선 방안:**
- `safeFetchAllJson`로 병렬 처리
- 타임아웃: 30초 (대량 데이터)

#### 1-4. **Financial Statements 페이지** (`src/app/reports/financial-statements/page.tsx`)
**문제:**
- 동일한 패턴 (순차 fetch)
- 타임아웃 없음

**개선 방안:**
- `safeFetchAllJson`로 병렬 처리

---

### 2. Promise.all 사용하지만 타임아웃 없음

#### 2-1. **PaymentForm 컴포넌트** (`src/components/forms/PaymentForm.tsx`)
**문제:**
- `Promise.all`로 2개 API 병렬 호출하지만 타임아웃 없음
- 추가로 단일 fetch도 타임아웃 없음

**현재 코드:**
```typescript
const [pendingResponse, partialResponse] = await Promise.all([
  fetch('/api/purchase-transactions?payment_status=PENDING&limit=100'),
  fetch('/api/purchase-transactions?payment_status=PARTIAL&limit=100')
]);
```

**개선 방안:**
- `safeFetchAllJson` 적용
- 타임아웃: 15초, 재시도: 2회

#### 2-2. **CollectionForm 컴포넌트** (`src/components/forms/CollectionForm.tsx`)
**문제:**
- PaymentForm과 동일한 패턴

**개선 방안:**
- `safeFetchAllJson` 적용

---

## 🟡 우선순위 2: 단기 개선 권장

### 3. 단일 Fetch 호출 (타임아웃/재시도 없음)

#### 3-1. **매출 관리 페이지** (`src/app/sales/page.tsx`)
- 메인 fetch: 타임아웃/재시도 없음
- 상세 조회 fetch: 타임아웃/재시도 없음
- Excel 내보내기 fetch: 타임아웃 없음 (대량 데이터 가능)

**개선 방안:**
- `safeFetchJson` 적용
- Excel 내보내기: 타임아웃 60초

#### 3-2. **매입 관리 페이지** (`src/app/purchases/page.tsx`)
- 동일한 패턴

**개선 방안:**
- `safeFetchJson` 적용

#### 3-3. **지급 관리 페이지** (`src/app/payments/page.tsx`)
- 메인 fetch, 요약 fetch, 상세 조회 fetch 모두 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용
- 요약 fetch는 `safeFetchAllJson`로 병렬 처리 가능

#### 3-4. **수금 관리 페이지** (`src/app/collections/page.tsx`)
- 동일한 패턴

**개선 방안:**
- `safeFetchJson` 적용

#### 3-5. **품목 관리 페이지** (`src/app/master/items/page.tsx`)
- 메인 fetch, 생성/수정 fetch, 삭제 fetch 모두 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용
- 초기 로딩 지연 추가 고려

#### 3-6. **거래처 관리 페이지** (`src/app/master/companies/page.tsx`)
- 동일한 패턴

**개선 방안:**
- `safeFetchJson` 적용

#### 3-7. **재고 이력 페이지** (`src/app/stock/history/page.tsx`)
- 품목 조회 fetch, 이력 조회 fetch 모두 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용
- 초기 로딩 지연 추가

#### 3-8. **계약 관리 페이지** (`src/app/contracts/page.tsx`)
- 메인 fetch, 문서 조회 fetch, 생성/수정 fetch 모두 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용

#### 3-9. **사용자 관리 페이지** (`src/app/admin/users/page.tsx`)
- 메인 fetch, 상세 조회 fetch, 삭제 fetch 모두 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용

---

## 🟢 우선순위 3: 개선 권장 (영향 낮음)

### 4. 컴포넌트 내 Fetch 호출

#### 4-1. **대시보드 컴포넌트들**
- `TopNWidget.tsx` - 타임아웃 없음
- `StockSummaryCard.tsx` - 타임아웃 없음
- `StockStatusWidget.tsx` - 타임아웃 없음
- `RecentActivityWidget.tsx` - 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용

#### 4-2. **Excel 내보내기 컴포넌트** (`src/components/ExcelExportButton.tsx`)
- 여러 export API 호출, 타임아웃 없음
- 대량 데이터 처리 가능

**개선 방안:**
- `safeFetchJson` 적용
- 타임아웃: 60초 (대량 데이터)

#### 4-3. **BOM Viewer 컴포넌트** (`src/components/bom/BOMViewer.tsx`)
- BOM 조회 fetch, Excel 내보내기 fetch 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용
- Excel 내보내기: 타임아웃 60초

#### 4-4. **이미지 갤러리 컴포넌트** (`src/components/ItemImageGallery.tsx`)
- 이미지 조회, 삭제, 기본 이미지 설정 fetch 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용

#### 4-5. **알림 컴포넌트** (`src/components/notifications/NotificationPanel.tsx`)
- 알림 조회, 읽음 처리 fetch 타임아웃 없음

**개선 방안:**
- `safeFetchJson` 적용

#### 4-6. **업로드 컴포넌트들**
- `ExcelUploadModal.tsx` - 파일 업로드 fetch 타임아웃 없음
- `ImageUploadZone.tsx` - 이미지 업로드 fetch 타임아웃 없음
- `FileUploadZone.tsx` - 파일 업로드 fetch 타임아웃 없음

**개선 방안:**
- `safeFetch` 적용
- 타임아웃: 60초 이상 (파일 업로드)

---

## 📊 통계 요약

### Fetch 호출 현황
- **총 fetch 호출**: 약 119개
- **이미 수정 완료**: 7개 페이지
- **우선순위 1 (즉시 수정)**: 8개 위치
- **우선순위 2 (단기 개선)**: 9개 페이지
- **우선순위 3 (개선 권장)**: 약 15개 컴포넌트

### 문제 유형 분류
1. **순차 fetch 호출**: 5개 위치
2. **Promise.all 사용하지만 타임아웃 없음**: 2개 위치
3. **단일 fetch 타임아웃 없음**: 약 90개 위치
4. **초기 로딩 지연 없음**: 약 10개 위치

---

## 🎯 권장 개선 계획

### Phase 1 (우선순위 1) - 즉시 수정
1. ShippingForm - 병렬 처리
2. ReceivingForm - safeFetchJson 적용
3. Reports 페이지들 - 병렬 처리
4. PaymentForm - safeFetchAllJson 적용
5. CollectionForm - safeFetchAllJson 적용

**예상 시간**: 2-3시간
**영향**: 성능 및 안정성 크게 향상

### Phase 2 (우선순위 2) - 단기 개선
1. 매출/매입/지급/수금 관리 페이지들
2. 품목/거래처 관리 페이지들
3. 재고 이력 페이지
4. 계약/사용자 관리 페이지

**예상 시간**: 4-6시간
**영향**: 전체 앱 안정성 향상

### Phase 3 (우선순위 3) - 점진적 개선
1. 대시보드 컴포넌트들
2. Excel 내보내기 컴포넌트
3. 업로드 컴포넌트들
4. 기타 컴포넌트들

**예상 시간**: 6-8시간
**영향**: 전체적인 일관성 향상

---

## 💡 개선 효과 예상

### 성능 향상
- **순차 → 병렬 처리**: 로딩 시간 50-70% 단축
- **타임아웃 적용**: 무한 대기 방지
- **재시도 로직**: 일시적 네트워크 오류 자동 복구

### 안정성 향상
- **일관된 에러 처리**: 모든 API 호출에 동일한 패턴 적용
- **네트워크 오류 복구**: 재시도 로직으로 사용자 경험 향상
- **타임아웃으로 무한 대기 방지**: 사용자 불만 감소

### 유지보수성 향상
- **공통 유틸리티 사용**: 중복 코드 제거
- **일관된 설정**: 유지보수 용이

---

## 📝 참고 사항

### 이미 적용된 패턴
- React Query 사용하는 hook들 (`useItems`, `useCompanies` 등)은 React Query의 기본 retry 로직이 적용되어 있음
- 하지만 직접 fetch를 사용하는 곳은 모두 개선 필요

### 파일 업로드
- 파일 업로드는 타임아웃을 60초 이상으로 설정 권장
- 파일 크기에 따라 조정 필요

### 대량 데이터 처리
- Excel 내보내기: 60초 타임아웃
- 대량 조회: 30초 타임아웃
- 일반 조회: 15초 타임아웃

---

## 결론

전체 앱을 검토한 결과, 약 119개의 fetch 호출 중 7개만 수정 완료된 상태입니다. 우선순위 1 항목부터 순차적으로 개선하면 전체 앱의 안정성과 성능이 크게 향상될 것입니다.

**다음 단계**: 우선순위 1 항목부터 수정을 진행하는 것을 권장합니다.

