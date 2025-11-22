# 코일 공정 추적 페이지 상태별 통합 작업

## ✅ 적용된 개선 사항

### 1. 상태별 탭 구분 개선
- **전체**: 검은색 배경, "모든 상태의 공정"
- **대기 (PENDING)**: 회색 배경, "등록만 된 공정"
- **진행중 (IN_PROGRESS)**: 파란색 배경, "작업이 시작된 공정"
- **완료 (COMPLETED)**: 초록색 배경, "완료된 공정"
- **취소 (CANCELLED)**: 빨간색 배경, "취소된 공정"

### 2. 상태 배지 UI
- ✅ 이미 `ProcessStatusBadge` 컴포넌트 사용 중 (공정 작업 페이지와 동일)
- 아이콘 및 색상 구분 적용됨

### 3. 상태별 통계 표시
- API에서 상태별 개수를 별도로 조회하여 반환
- 각 탭에 개수 배지 표시
- 통계 카드에서 전체/완료/진행중 개수 표시 (필터링된 결과가 아닌 전체 개수)

### 4. API 개선
- `/api/coil/process` GET 엔드포인트에 `statusCounts` 추가
- 필터링 전 전체 상태별 개수 조회

## 📊 데이터베이스 연결

### 코일 공정 이력 (coil_process_history)
- 상태 필터링 지원
- `process_operations`와 `coil_process_id`로 연결
- 재고 이동은 `auto_coil_process_stock_movement()` 트리거 함수로 처리

### 재고 이동
- 코일 공정 완료 시 `auto_coil_process_stock_movement()` 트리거가 작동
- `inventory_transactions` 테이블에 기록 생성
- 거래 번호 형식: `COIL-YYYYMMDD-{process_id}`

## 🔄 공정 작업 페이지와의 일관성

### 공통 사항
1. ✅ 상태별 탭 색상 구분 (동일한 색상 체계)
2. ✅ 상태 배지 컴포넌트 공유 (`ProcessStatusBadge`)
3. ✅ 상태별 개수 표시 (API에서 조회)
4. ✅ 통계 카드 표시

### 차이점
- **공정 작업 페이지**: 탭 스타일 (버튼 형태)
- **코일 공정 추적 페이지**: 필터 필 스타일 (Pill 형태)
- 두 페이지 모두 동일한 기능 제공, UI 스타일만 다름

## 📝 변경 사항

### API 변경
- `src/app/api/coil/process/route.ts`
  - 상태별 개수 조회 로직 추가
  - 응답에 `statusCounts` 필드 추가

### 프론트엔드 변경
- `src/components/process/CoilProcessList.tsx`
  - `statusCounts` state 추가
  - API에서 받은 상태별 개수 사용
  - 탭 스타일 개선 (공정 작업 페이지와 동일한 색상 체계)
  - 통계 카드에서 전체 개수 표시

