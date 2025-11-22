# 공정 관리 페이지 통합

## 📋 통합 개요

공정 작업 페이지(`/process`)와 코일 공정 추적 페이지(`/process/coil-tracking`)를 하나의 통합 페이지로 통합했습니다.

## ✅ 통합 내용

### 1. 단일 페이지로 통합
- **메인 페이지**: `/process` (공정 관리)
- **데이터 소스 선택**: 공정 작업 / 코일 추적
- **코일 추적 페이지**: `/process/coil-tracking` → `/process?source=coil_tracking`로 리다이렉트

### 2. 통합된 기능

#### 공정 작업 모드 (기본)
- `process_operations` 테이블 데이터 표시
- BLANKING, PRESS, ASSEMBLY 공정 유형
- 상태별 탭 필터링 (대기, 진행중, 완료, 전체)
- 공정 시작/완료 버튼
- 상태별 통계 표시

#### 코일 추적 모드
- `coil_process_history` 테이블 데이터 표시
- 블랭킹, 전단, 절곡, 용접 공정 유형
- 동일한 상태별 탭 필터링
- 코일 추적 전용 정보 표시
- 상태별 통계 표시

### 3. 공통 기능
- ✅ 상태별 탭 구분 (대기, 진행중, 완료, 전체)
- ✅ 상태별 통계 표시 (각 탭에 개수 배지)
- ✅ 상태 배지 UI (아이콘 및 색상 구분)
- ✅ 검색 및 필터링
- ✅ 날짜 범위 필터
- ✅ 정렬 기능

## 🔄 데이터 소스 전환

### UI
- 헤더 영역에 "공정 작업" / "코일 추적" 버튼 추가
- 클릭 시 데이터 소스 전환
- 각 모드별 설명 텍스트 표시

### 데이터 변환
- 코일 추적 데이터를 공정 작업 형식으로 변환하여 표시
- 동일한 테이블 구조로 통일된 UI 제공

## 📊 데이터베이스 연결

### 공정 작업 모드
- 테이블: `process_operations`
- API: `/api/process-operations`
- 재고 이동: `auto_process_stock_movement()` 트리거

### 코일 추적 모드
- 테이블: `coil_process_history`
- API: `/api/coil/process`
- 재고 이동: `auto_coil_process_stock_movement()` 트리거

### 연결 관계
- `process_operations.coil_process_id` → `coil_process_history.process_id`
- BLANKING 공정 작업 생성 시 자동으로 `coil_process_history` 생성 및 연결

## 🎯 사용자 경험 개선

### 이전
- 두 개의 별도 페이지
- 기능 중복
- 일관성 부족

### 현재
- 하나의 통합 페이지
- 데이터 소스 전환으로 모든 기능 접근
- 일관된 UI/UX
- 페이지 수 감소

## 📝 변경 사항

### 파일 변경
1. `src/app/process/page.tsx`
   - 데이터 소스 선택 기능 추가
   - 코일 추적 데이터 조회 및 변환 로직 추가
   - 헤더에 데이터 소스 선택 버튼 추가

2. `src/app/process/coil-tracking/page.tsx`
   - 공정 작업 페이지로 리다이렉트
   - URL 파라미터로 코일 추적 모드 활성화

### API 변경
- 기존 API 유지 (별도 수정 없음)
- 프론트엔드에서 데이터 변환 처리

## 🚀 향후 개선 사항

1. **완전 통합**: 두 테이블을 하나로 통합 (장기 계획)
2. **통합 뷰**: 데이터베이스 뷰 생성으로 성능 개선
3. **고급 필터**: 두 데이터 소스를 동시에 필터링

