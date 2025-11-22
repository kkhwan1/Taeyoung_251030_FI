# 공정 작업 상태별 데이터베이스 연결 분석

## 📊 상태별 현황

### 데이터베이스 상태 분포
- **PENDING (대기)**: 63개
- **COMPLETED (완료)**: 52개
- **IN_PROGRESS (진행중)**: 0개

## 🔗 데이터베이스 연결 현황

### 1. 재고 이동 (inventory_transactions)
- **현재 상태**: 연결되지 않음 (transaction_count = 0)
- **예상 연결 방식**: `lot_number` 또는 `reference_id`를 통한 연결
- **문제점**: COMPLETED 상태의 공정 작업도 재고 이동 데이터가 생성되지 않음

### 2. 코일 추적 (coil_process_history)
- **현재 상태**: 연결되지 않음 (coil_history_count = 0)
- **예상 연결 방식**: `coil_process_id` 외래키를 통한 연결
- **문제점**: BLANKING 공정 작업도 코일 추적 데이터가 생성되지 않음

### 3. 상태 전이 흐름
```
PENDING → IN_PROGRESS → COMPLETED
  ↓          ↓            ↓
등록만    작업 시작    재고 이동
완료      (started_at)  (completed_at)
```

## 🔍 확인 필요 사항

### 1. 재고 이동 트리거 함수
- `auto_process_stock_movement()` 함수 존재 여부 확인 필요
- COMPLETED 상태로 변경 시 자동으로 재고 이동이 발생해야 함

### 2. 코일 추적 자동 생성
- BLANKING 공정 작업 생성 시 `coil_process_history` 자동 생성 여부 확인
- `coil_process_id` 연결 확인

### 3. 상태별 UI 구분
- ✅ 탭별 명확한 구분 (대기, 진행중, 완료, 전체)
- ✅ 상태 배지 색상 및 아이콘 구분
- ✅ 각 탭별 설명 추가

## 📝 권장 사항

1. **재고 이동 트리거 확인**: 데이터베이스에 `auto_process_stock_movement()` 함수가 존재하는지 확인
2. **재고 이동 데이터 생성**: COMPLETED 상태로 변경 시 `inventory_transactions` 테이블에 데이터가 생성되는지 확인
3. **코일 추적 자동 생성**: BLANKING 공정 작업 생성 시 `coil_process_history` 자동 생성 로직 확인
4. **상태별 통계 표시**: 각 탭에 해당 상태의 공정 작업 개수 표시

