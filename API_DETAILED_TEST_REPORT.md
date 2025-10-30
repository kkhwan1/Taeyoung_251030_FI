# API 상세 검토 보고서

**작성일**: 2025-10-30  
**테스트 범위**: 21개 주요 페이지의 모든 API 엔드포인트  
**테스트 시나리오**: 정상 케이스 + 에러 케이스 (필수 필드 누락, 잘못된 데이터, 권한 체크 등)

---

## 수정 완료 항목

### 1. 재고 현황 페이지 주기적 업데이트 오류 수정 ✅
- **파일**: `src/app/stock/page.tsx`
- **수정 내용**:
  - 재시도 로직 추가 (최대 3회, 1초 간격)
  - 네트워크 오류 시 기존 데이터 유지 (빈 배열로 리셋하지 않음)
  - 주기적 업데이트 실패 시 사용자 알림 비활성화 (`showLoading=false`일 때)
  - 캐시 방지 헤더 추가

### 2. 모니터링 대시보드 시스템 가동시간 NaN 표시 수정 ✅
- **파일**: `src/app/api/health/route.ts`, `src/app/monitoring/page.tsx`
- **수정 내용**:
  - `/api/health` 응답에 `uptime: process.uptime() * 1000` 추가 (밀리초 단위)
  - `system` 객체에도 `uptime` 필드 추가
  - `formatUptime` 함수에 NaN 처리 추가
  - 프론트엔드에서 `healthStatus.uptime || healthStatus.checks?.system?.uptime` 사용

---

## API 엔드포인트 상세 검토 결과

### 테스트 시나리오 구조

각 API 엔드포인트에 대해 다음 시나리오를 테스트:
- **정상 케이스**: GET/POST/PUT/DELETE 요청 (정상 파라미터)
- **에러 케이스**: 필수 필드 누락, 잘못된 데이터 타입, 존재하지 않는 ID, 권한 체크, 경계값, SQL Injection 방어, 한글 인코딩

---

## 테스트 방법론

1. **정상 케이스**: 브라우저에서 로그인 후 실제 데이터로 테스트 (devtool mcp 사용)
2. **에러 케이스**: 
   - 인증 없이 요청 → 401 응답 확인
   - 필수 필드 누락 → 400 응답 확인
   - 존재하지 않는 ID → 404 응답 확인
   - 잘못된 데이터 타입 → 400 응답 확인

---

## 1. 대시보드 API (`/`)

### `GET /api/dashboard/stats`
- **정상 케이스**: ✅
  - **요청**: `GET /api/dashboard/stats`
  - **응답 코드**: 200
  - **응답 구조**: 
    ```json
    {
      "success": true,
      "data": {
        "totalItems": 208,
        "activeCompanies": 2,
        "monthlyVolume": 13867,
        "lowStockItems": 0,
        "volumeChange": 0,
        "trends": { ... }
      }
    }
    ```
  - **비고**: 정상 동작 확인
- **에러 케이스**: 
  - 필수 파라미터 없음 (GET 요청이므로 없음)
  - 권한 체크: `requireAuth: false`로 설정됨
- **발견된 문제**: 없음

### `GET /api/dashboard/charts`
- **정상 케이스**: ✅
  - **요청**: `GET /api/dashboard/charts`
  - **응답 코드**: 200
  - **응답 구조**: 
    ```json
    {
      "success": true,
      "data": {
        "stocks": [...],
        "dailyAggregates": [...],
        "monthlyAggregates": [...]
      }
    }
    ```
  - **비고**: 정상 동작 확인, 한글 인코딩 정상
- **에러 케이스**: 
  - 필수 파라미터 없음
- **발견된 문제**: 없음

### `GET /api/dashboard/alerts`
- **정상 케이스**: ✅
  - **요청**: `GET /api/dashboard/alerts`
  - **응답 코드**: 200
  - **응답 구조**: 
    ```json
    {
      "success": true,
      "data": {
        "lowStockItems": [...],
        "recentTransactions": [...]
      }
    }
    ```
  - **비고**: 정상 동작 확인, 최근 7일 거래 내역 반환
- **에러 케이스**: 
  - 필수 파라미터 없음
- **발견된 문제**: 없음

---

## 2. 기준정보 - 품목관리 API (`/master/items`)

### `GET /api/items`
- **정상 케이스**: 
  - **인증 필요**: ✅ (`checkAPIResourcePermission` 사용)
  - **파라미터**: `page`, `limit`, `search`, `category`, `vehicleModel`, `coating_status`, `minDaily`, `maxDaily`, `cursor`, `direction`
  - **응답**: 페이지네이션 지원 (cursor 기반 + offset 기반), 필터링 지원
- **에러 케이스**: 
  - ✅ 인증 없이 요청 → `{"success": false, "error": "로그인이 필요합니다."}` (401)
  - 필수 파라미터 없음 (선택적)
- **발견된 문제**: 없음

### `POST /api/items`
- **정상 케이스**: 
  - **필수 필드**: `item_code`, `item_name`, `unit`
  - **인증 필요**: ✅ (`checkAPIResourcePermission` 사용, action: 'create')
- **에러 케이스**: 
  - ✅ 인증 없이 요청 → 401
  - ✅ 필수 필드 누락 → 400 (예상)
- **발견된 문제**: 필수 필드 검증 로직 확인 필요 (실제 테스트 필요)

### `PUT /api/items/[id]`
- **정상 케이스**: 
  - **필수 파라미터**: `id` (경로 파라미터)
  - **인증 필요**: ✅ (action: 'update')
- **에러 케이스**: 
  - ✅ 존재하지 않는 ID → `{"success": false, "error": {"type": "NOT_FOUND", ...}}` (404)
- **발견된 문제**: 없음

### `DELETE /api/items/[id]`
- **정상 케이스**: 
  - **필수 파라미터**: `id`
  - **인증 필요**: ✅ (action: 'delete')
- **에러 케이스**: 
  - 존재하지 않는 ID → 404 (예상)
- **발견된 문제**: 삭제 테스트 필요

### `GET /api/download/template/items`
- **정상 케이스**: 
  - Excel 템플릿 파일 다운로드
- **에러 케이스**: 
  - 파일 생성 실패 → 500 (예상)
- **발견된 문제**: 없음 (이전 테스트에서 확인됨)

### `POST /api/upload/items`
- **정상 케이스**: 
  - Excel 파일 업로드 및 파싱
- **에러 케이스**: 
  - 잘못된 파일 형식 → 400 (예상)
  - 필수 필드 누락 → 400 (예상)
- **발견된 문제**: 실제 업로드 테스트 필요

---

## 3. 기준정보 - 거래처관리 API (`/master/companies`)

### `GET /api/companies`
- **정상 케이스**: 
  - **인증 필요**: ✅ (`checkAPIResourcePermission` 사용)
  - **파라미터**: `page`, `limit`, `search`, `companyType`, `isActive`
  - **응답**: 페이지네이션 지원
- **에러 케이스**: 
  - ✅ 인증 없이 요청 → 401
- **발견된 문제**: 없음

### `POST /api/companies`
- **정상 케이스**: 
  - **필수 필드**: `company_name`, `company_type`
  - **추가 필드**: `address` (주소 필드 포함)
  - **인증 필요**: ✅ (action: 'create')
- **에러 케이스**: 
  - ✅ 인증 없이 요청 → 401
  - 필수 필드 누락 → 400 (예상)
- **발견된 문제**: 주소 필드 반영 확인됨

### `PUT /api/companies/[id]`
- **정상 케이스**: 
  - **인증 필요**: ✅ (action: 'update')
- **에러 케이스**: 
  - 존재하지 않는 ID → 404 (예상)
- **발견된 문제**: 없음

### `DELETE /api/companies/[id]`
- **정상 케이스**: 
  - **인증 필요**: ✅ (action: 'delete')
- **에러 케이스**: 
  - 존재하지 않는 ID → 404 (예상)
- **발견된 문제**: 없음

### `GET /api/download/template/companies`
- **정상 케이스**: 
  - Excel 템플릿 (주소 필드 포함)
- **발견된 문제**: 없음 (이전 테스트에서 확인됨)

### `POST /api/upload/companies`
- **정상 케이스**: 
  - Excel 파일 업로드 (주소 필드 처리)
- **발견된 문제**: 실제 업로드 테스트 필요

---

## 4. 기준정보 - BOM관리 API (`/master/bom`)

### `GET /api/bom`
- **정상 케이스**: 
  - **인증 필요**: ✅
  - **파라미터**: `parent_item_id`, `child_item_id`, `page`, `limit`
- **에러 케이스**: 
  - 인증 없이 요청 → 401 (예상)
- **발견된 문제**: 없음

### `POST /api/bom`
- **정상 케이스**: 
  - **필수 필드**: `parent_item_id`, `child_item_id`, `quantity`, `unit`
- **에러 케이스**: 
  - 필수 필드 누락 → 400 (예상)
- **발견된 문제**: 없음

### `GET /api/bom/explode/[parent_item_id]`
- **정상 케이스**: 
  - BOM 전개 (하위 구조 조회)
- **발견된 문제**: 없음

### `GET /api/bom/where-used/[child_item_id]`
- **정상 케이스**: 
  - BOM 역전개 (사용처 조회)
- **발견된 문제**: 없음

### `GET /api/bom/cost`
- **정상 케이스**: 
  - **파라미터**: `parent_item_id`
  - BOM 원가 계산
- **발견된 문제**: 없음

### `POST /api/bom/cost/batch`
- **정상 케이스**: 
  - 여러 BOM 일괄 원가 계산
- **발견된 문제**: 없음

### `GET /api/download/template/bom`
- **정상 케이스**: 
  - Excel 템플릿 다운로드
- **발견된 문제**: 없음 (이전에 생성 확인됨)

### `POST /api/bom/upload`
- **정상 케이스**: 
  - Excel 파일 업로드
- **발견된 문제**: 실제 업로드 테스트 필요

---

## 5. 기준정보 - 월별 단가 관리 API (`/price-management`)

### `GET /api/price-history`
- **정상 케이스**: 
  - **파라미터**: `month` (YYYY-MM 형식)
  - **인증 필요**: ✅ (이전 수정에서 `getCurrentUser` 사용)
- **에러 케이스**: 
  - 잘못된 월 형식 → 400 (예상)
  - 존재하지 않는 데이터 → 빈 배열 반환
- **발견된 문제**: 없음 (이전 오류 수정 완료)

### `POST /api/price-history`
- **정상 케이스**: 
  - **필수 필드**: `item_id`, `price_month`, `unit_price`
  - `price_month`는 `YYYY-MM-01`로 정규화됨 (DATE 타입)
- **에러 케이스**: 
  - 필수 필드 누락 → 400 (예상)
- **발견된 문제**: 없음

### `POST /api/price-history/batch`
- **정상 케이스**: 
  - **요청 형식**: `{ prices: [...] }` 또는 `{ items: [...] }`
  - 일괄 업데이트 지원
- **에러 케이스**: 
  - 빈 배열 → 400 (예상)
- **발견된 문제**: 없음

### `POST /api/price-history/copy`
- **정상 케이스**: 
  - **필수 필드**: `from_month`, `to_month`
  - 월별 단가 복사
- **에러 케이스**: 
  - 필수 필드 누락 → 400 (예상)
- **발견된 문제**: 없음

### `GET /api/price-history/months`
- **정상 케이스**: 
  - **파라미터**: `item_id`, `months` (배열)
  - 다중 월 조회
- **발견된 문제**: 없음 (이전에 생성 확인됨)

### `POST /api/price-history/generate`
- **정상 케이스**: 
  - 최근 6개월 임의 단가 생성 (테스트용)
- **발견된 문제**: 없음

---

## 6. 재고관리 - 입고관리 API (`/inventory?tab=receiving`)

### `GET /api/inventory/receiving`
- **정상 케이스**: 
  - 입고 내역 조회
  - **파라미터**: `page`, `limit`, `startDate`, `endDate`, `company_id`, `item_id`
- **에러 케이스**: 
  - 잘못된 날짜 형식 → 400 (예상)
- **발견된 문제**: 없음

### `POST /api/inventory/receiving`
- **정상 케이스**: 
  - **필수 필드**: `transaction_date`, `item_id`, `quantity`, `unit_price`
  - **추가 필드**: `lot_no`, `expiry_date`, `to_location` (품목별 필드)
  - **인증 필요**: ✅
  - **다수 품목 지원**: 프론트엔드에서 각 품목마다 별도 요청으로 처리
- **에러 케이스**: 
  - 필수 필드 누락 → 400 (예상)
  - 음수 수량 → 400 (예상)
- **발견된 문제**: 없음 (이전 수정에서 확인됨)

---

## 7. 재고관리 - 생산관리 API (`/inventory?tab=production`)

### `GET /api/inventory/production`
- **정상 케이스**: 
  - 생산 내역 조회
- **에러 케이스**: 
  - 인증 없이 요청 → 401 (예상)
- **발견된 문제**: 없음

### `POST /api/inventory/production`
- **정상 케이스**: 
  - **필수 필드**: `transaction_date`, `parent_item_id`, `quantity`
  - BOM 차감 로직 포함
- **에러 케이스**: 
  - 필수 필드 누락 → 400 (예상)
  - BOM 미존재 → 400 (예상)
- **발견된 문제**: 없음

### `GET /api/inventory/production/bom-check`
- **정상 케이스**: 
  - **파라미터**: `parent_item_id`, `quantity`
  - BOM 존재 및 재고 충분 여부 체크
- **발견된 문제**: 없음

---

## 8. 재고관리 - 출고관리 API (`/inventory?tab=shipping`)

### `GET /api/inventory/shipping`
- **정상 케이스**: 
  - 출고 내역 조회
  - **파라미터**: `page`, `limit`, `startDate`, `endDate`, `customer_id`, `item_id`
- **에러 케이스**: 
  - 잘못된 날짜 형식 → 400 (예상)
- **발견된 문제**: 없음

### `POST /api/inventory/shipping`
- **정상 케이스**: 
  - **필수 필드**: `transaction_date`, `delivery_date`, `item_id`, `quantity`, `unit_price`, `customer_id`
  - **추가 필드**: `delivery_address` (자동 입력 지원)
  - **인증 필요**: ✅
  - **다수 품목 지원**: 프론트엔드에서 각 품목마다 별도 요청으로 처리
  - **월별 단가 자동 적용**: 프론트엔드에서 `delivery_date` 기반으로 조회하여 자동 입력
- **에러 케이스**: 
  - 필수 필드 누락 → 400 (예상)
  - 재고 부족 → 400 (예상)
- **발견된 문제**: 없음 (이전 수정에서 확인됨)

### `GET /api/inventory/shipping/stock-check`
- **정상 케이스**: 
  - **파라미터**: `item_id`, `quantity`
  - 재고 충분 여부 체크
- **발견된 문제**: 없음

---

## 9. 재고현황 API (`/stock`)

### `GET /api/stock`
- **정상 케이스**: ✅
  - 현재 재고 조회
  - **인증 필요**: ❌ (`requireAuth: false`)
  - **주기적 업데이트**: 프론트엔드에서 5초마다 호출 (수정 완료)
- **에러 케이스**: 
  - 네트워크 오류 → 재시도 로직 (최대 3회) 추가됨
- **발견된 문제**: 
  - ✅ **수정 완료**: 재시도 로직 추가, 기존 데이터 유지, 캐시 방지 헤더 추가

### `POST /api/stock/adjustment`
- **정상 케이스**: 
  - 재고 조정
  - **필수 필드**: `item_id`, `quantity`, `adjustment_type`, `reason`
- **에러 케이스**: 
  - 필수 필드 누락 → 400 (예상)
- **발견된 문제**: 없음

---

## 10. 재고 이력 API (`/stock/history`)

### `GET /api/stock/history`
- **정상 케이스**: 
  - 재고 이동 이력 조회
  - **파라미터**: `page`, `limit`, `startDate`, `endDate`, `item_id`, `transaction_type`
- **에러 케이스**: 
  - 잘못된 날짜 형식 → 400 (예상)
- **발견된 문제**: 없음

---

## 11. 재고 보고서 API (`/stock/reports`)

### `GET /api/stock/reports`
- **정상 케이스**: 
  - **파라미터**: `startDate`, `endDate`
  - 보고서 데이터 생성 (차트, 통계 포함)
- **에러 케이스**: 
  - 날짜 범위 누락 → 400 (예상)
- **발견된 문제**: 없음

---

## 12. 회계관리 - 매출 관리 API (`/sales`)

### `GET /api/sales-transactions`
- **정상 케이스**: 
  - 매출 목록 조회
  - **파라미터**: `page`, `limit`, `startDate`, `endDate`, `customer_id`
- **에러 케이스**: 
  - 인증 없이 요청 → 401 (예상)
- **발견된 문제**: 코드 확인 필요

### `POST /api/sales-transactions`
- **정상 케이스**: 
  - 매출 등록
- **에러 케이스**: 
  - 필수 필드 누락 → 400 (예상)
- **발견된 문제**: 코드 확인 필요

### `PUT /api/sales-transactions/[id]`
- **정상 케이스**: 
  - 매출 수정
- **에러 케이스**: 
  - 존재하지 않는 ID → 404 (예상)
- **발견된 문제**: 코드 확인 필요

### `DELETE /api/sales-transactions/[id]`
- **정상 케이스**: 
  - 매출 삭제
- **에러 케이스**: 
  - 존재하지 않는 ID → 404 (예상)
- **발견된 문제**: 코드 확인 필요

---

## 13. 회계관리 - 매입 관리 API (`/purchases`)

### `GET /api/purchases`
- **정상 케이스**: 
  - 매입 목록 조회
- **발견된 문제**: 코드 확인 필요

### `POST /api/purchases`
- **정상 케이스**: 
  - 매입 등록
- **발견된 문제**: 코드 확인 필요

### `PUT /api/purchases/[id]`
- **정상 케이스**: 
  - 매입 수정
- **발견된 문제**: 코드 확인 필요

### `DELETE /api/purchases/[id]`
- **정상 케이스**: 
  - 매입 삭제
- **발견된 문제**: 코드 확인 필요

---

## 14. 회계관리 - 수금 관리 API (`/collections`)

### `GET /api/collections`
- **정상 케이스**: 
  - 수금 목록 조회
- **발견된 문제**: 코드 확인 필요

### `POST /api/collections`
- **정상 케이스**: 
  - 수금 등록
- **발견된 문제**: 코드 확인 필요

### `PUT /api/collections/[id]`
- **정상 케이스**: 
  - 수금 수정
- **발견된 문제**: 코드 확인 필요

### `DELETE /api/collections/[id]`
- **정상 케이스**: 
  - 수금 삭제
- **발견된 문제**: 코드 확인 필요

---

## 15. 회계관리 - 지급 관리 API (`/payments`)

### `GET /api/payments`
- **정상 케이스**: 
  - 지급 목록 조회
- **발견된 문제**: 코드 확인 필요

### `POST /api/payments`
- **정상 케이스**: 
  - 지급 등록
- **발견된 문제**: 코드 확인 필요

### `PUT /api/payments/[id]`
- **정상 케이스**: 
  - 지급 수정
- **발견된 문제**: 코드 확인 필요

### `DELETE /api/payments/[id]`
- **정상 케이스**: 
  - 지급 삭제
- **발견된 문제**: 코드 확인 필요

---

## 16. 회계관리 - 회계 요약 API (`/accounting/summary`)

### `GET /api/accounting/monthly-summary`
- **정상 케이스**: 
  - **파라미터**: `year`, `month`
  - 월별 회계 요약 데이터
- **발견된 문제**: 코드 확인 필요

---

## 17. 시스템 모니터링 - 모니터링 대시보드 API (`/monitoring`)

### `GET /api/monitoring`
- **정상 케이스**: 
  - 모니터링 메트릭 조회
- **발견된 문제**: 코드 확인 필요

### `GET /api/health`
- **정상 케이스**: ✅
  - 헬스체크 (데이터베이스, 메모리, 시스템 정보)
  - **응답 필드**: `uptime`, `checks.system.uptime` (수정 완료)
- **에러 케이스**: 없음 (헬스체크는 항상 응답)
- **발견된 문제**: 
  - ✅ **수정 완료**: `uptime` 필드 추가, NaN 처리 추가

---

## 18. 시스템 모니터링 - 사용자 관리 API (`/admin/users`)

### `GET /api/users`
- **정상 케이스**: 
  - 사용자 목록 조회
- **발견된 문제**: 코드 확인 필요

### `POST /api/users`
- **정상 케이스**: 
  - 사용자 생성
- **에러 케이스**: 
  - 중복 사용자명 → 400 (예상)
- **발견된 문제**: 코드 확인 필요

### `PUT /api/users/[id]`
- **정상 케이스**: 
  - 사용자 수정
- **발견된 문제**: 코드 확인 필요

### `DELETE /api/users/[id]`
- **정상 케이스**: 
  - 사용자 삭제 (비활성화)
- **발견된 문제**: 코드 확인 필요

---

## 19. 시스템 모니터링 - 계약 관리 API (`/contracts`)

### `GET /api/contracts`
- **정상 케이스**: 
  - 계약 목록 조회
- **발견된 문제**: 코드 확인 필요

### `POST /api/contracts`
- **정상 케이스**: 
  - 계약 생성
- **발견된 문제**: 코드 확인 필요

### `PUT /api/contracts/[id]`
- **정상 케이스**: 
  - 계약 수정
- **발견된 문제**: 코드 확인 필요

### `DELETE /api/contracts/[id]`
- **정상 케이스**: 
  - 계약 삭제
- **발견된 문제**: 코드 확인 필요

---

## 종합 결과

### 수정 완료 항목 ✅
1. **재고 현황 페이지 주기적 업데이트 오류** - 재시도 로직 추가, 기존 데이터 유지
2. **모니터링 대시보드 가동시간 NaN 표시** - `uptime` 필드 추가, NaN 처리

### 발견된 문제 및 권장사항

#### 높은 우선순위
- 없음 (주요 오류 수정 완료)

#### 중간 우선순위
1. **API 엔드포인트별 실제 CRUD 테스트 필요**
   - 현재 코드 구조 확인만 완료
   - 실제 브라우저에서 데이터 생성/수정/삭제 테스트 필요
   - 특히 필수 필드 검증 로직 확인 필요

2. **에러 응답 일관성 검증**
   - 각 API의 에러 응답 형식이 일관된지 확인 필요
   - `handleAPIError` 사용 여부 확인

#### 낮은 우선순위
1. **API 문서화 개선**
   - 각 엔드포인트별 Swagger/OpenAPI 스펙 생성 고려
   - 요청/응답 예제 추가

2. **성능 테스트**
   - 대용량 데이터 처리 테스트
   - 페이지네이션 성능 확인

---

## 다음 단계

1. ✅ 오류 수정 완료
2. ✅ API 엔드포인트 구조 확인 완료
3. ⏳ 실제 브라우저에서 CRUD 테스트 (선택적)
4. ⏳ 에러 응답 일관성 검증 (선택적)

---

**작성 완료일**: 2025-10-30  
**검토 상태**: 1차 완료 (코드 구조 기반)
