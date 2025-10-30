# 태창 ERP - Data Cleanup & Import Migration

## 개요

이 마이그레이션은 Supabase 데이터베이스의 문제 데이터를 정리하고 새로운 정제된 데이터를 임포트합니다.

## 목표

- ✅ BOM 테이블 정리 완료 (130개 invalid 레코드 삭제)
- ✅ 품목 가격 업데이트 (229개 품목)
- ✅ 종합관리 품목 검증 (30개 기존 확인)
- ✅ 데이터 품질 검증

## 실행 방법

### 방법 1: 전체 마이그레이션 실행 (권장)

```bash
cd c:\Users\USER\claude_code\FITaeYoungERP
node scripts/migration/run-all-phases.js
```

### 방법 2: 개별 Phase 실행

```bash
# Phase 1: 데이터 정리
node scripts/migration/phase1-cleanup.js

# Phase 2: 가격 업데이트
node scripts/migration/phase2-update-prices-simple.js

# Phase 3: 종합관리 품목 임포트
node scripts/migration/phase3-import-comprehensive.js

# Phase 4: 검증
node scripts/migration/phase4-validation.js
```

## Phase 상세 설명

### Phase 1: 데이터 정리

**목적**: 문제가 있는 데이터를 삭제하거나 수정

**작업 내용**:
1. BOM 테이블의 모든 레코드 삭제 (130개 invalid)
2. price가 0이거나 NULL인 items 정리 (292개)
3. "NaN" 문자열을 NULL로 변환

**실행 시간**: ~5초

**결과**:
```
BOM records: 0 (cleaned)
Items with NULL price: 292
```

### Phase 2: 가격 업데이트

**목적**: price-master.json에서 최신 가격 정보 임포트

**작업 내용**:
1. `data/clean-data/price-master.json` 로드 (243개 레코드)
2. items 테이블의 price 필드 업데이트
3. 최신 월별 가격 적용

**실행 시간**: ~30초

**결과**:
```
229 updated (품목 가격 업데이트)
14 not found (items 테이블에 없는 품목)
480 items with price > 0 (전체의 66.1%)
```

### Phase 3: 종합관리 품목 임포트

**목적**: comprehensive-items.json에서 새 품목 추가

**작업 내용**:
1. `data/clean-data/comprehensive-items.json` 로드 (34개 레코드)
2. 중복 체크 (item_code 기준)
3. 신규 품목만 INSERT

**실행 시간**: ~10초

**결과**:
```
0 new items (모두 이미 존재)
30 duplicates (기존 품목)
4 skipped (품번 없음)
```

### Phase 4: 검증 및 요약

**목적**: 마이그레이션 결과 검증 및 리포트 생성

**검증 항목**:
1. 레코드 수 확인
   - items: 726개
   - items_with_price: 480개 (66.1%)
   - bom: 0개 (정리 완료)
   - inbound_transactions: 0개 (아직 임포트 안됨)

2. 데이터 품질 확인
   - Spec Coverage: 29.5%
   - Material Coverage: 17.9%
   - Supplier Coverage: 0.0%
   - Active Items: 100.0%

3. 카테고리별 분포
   - 부자재: 615개
   - 원자재: 109개
   - 제품: 2개

**실행 시간**: ~5초

## 데이터 소스

### 1. price-master.json
- **위치**: `scripts/migration/data/clean-data/price-master.json`
- **레코드 수**: 243개
- **구조**:
```json
{
  "item_code": "69174-DO000",
  "price": 1203,
  "supplier": "태영금속",
  "price_month": "2025-04",
  "valid": true
}
```

### 2. comprehensive-items.json
- **위치**: `scripts/migration/data/clean-data/comprehensive-items.json`
- **레코드 수**: 34개 (30개 유효)
- **구조**:
```json
{
  "업체": "풍기서산",
  "구분": "1600T",
  "차종": "TAM",
  "품번": "65522-A3000",
  "품명": "EXTN RR FLOOR (일반,VEN)",
  "일소요량": 200,
  "재고(4/28)": 500,
  "사용일": 2.5
}
```

## 환경 변수

마이그레이션 실행 전에 `.env` 파일에 다음 변수가 설정되어 있어야 합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=pybjnkbmtlyaftuiieyq
```

## 실행 결과

### 성공 시 출력 예시

```
=======================================
태창 ERP - DATA CLEANUP & IMPORT
MASTER MIGRATION SCRIPT
=======================================
Started at: 2025-10-30 15:30:00

Phase 1: Data Cleanup ✅ (5s)
Phase 2: Update Prices ✅ (30s)
Phase 3: Import Comprehensive Items ✅ (10s)
Phase 4: Validation & Summary ✅ (5s)

=======================================
MIGRATION SUMMARY
=======================================
Duration: 50s
Phases: 4 succeeded, 0 failed

🎉 ALL PHASES COMPLETED SUCCESSFULLY!

ACHIEVEMENTS:
  ✅ BOM table cleaned (0 records)
  ✅ Item prices updated (229 items)
  ✅ Comprehensive items verified (30 existing)
  ✅ Data quality validated
```

## 트러블슈팅

### 오류: Missing environment variables
**해결책**: `.env` 파일에 모든 Supabase 환경 변수가 설정되어 있는지 확인

### 오류: File not found
**해결책**: `data/clean-data/` 디렉토리에 필요한 JSON 파일들이 있는지 확인

### 오류: Could not find the function
**해결책**: Supabase 프로젝트가 활성 상태인지 확인하고 SERVICE_ROLE_KEY가 올바른지 확인

### Phase 실패 시
**해결책**:
1. 에러 메시지 확인
2. 해당 Phase만 다시 실행
3. 검증 결과 확인

## 다음 단계

마이그레이션 완료 후:

1. ✅ **UI에서 데이터 확인**
   - http://localhost:5000/items 접속
   - 품목 목록 및 가격 확인

2. ⏳ **입고 거래 임포트** (아직 미완료)
   - `inbound-*.json` 파일 준비 필요
   - 231개 입고 거래 데이터

3. ⏳ **BOM 관계 설정**
   - BOM 데이터 정제 필요
   - 품목 간 관계 설정

4. ✅ **계산 및 리포트 검증**
   - 재고 계산 확인
   - 대시보드 통계 확인

## 파일 구조

```
scripts/migration/
├── README.md                          # 이 파일
├── run-all-phases.js                  # 전체 마이그레이션 실행
├── phase1-cleanup.js                  # Phase 1: 데이터 정리
├── phase2-update-prices-simple.js     # Phase 2: 가격 업데이트
├── phase3-import-comprehensive.js     # Phase 3: 종합관리 품목
├── phase4-validation.js               # Phase 4: 검증
├── cleanup-and-import.ts              # TypeScript 버전 (미사용)
├── cleanup-and-import.sql             # SQL 버전 (참고용)
└── data/
    └── clean-data/
        ├── price-master.json          # 가격 데이터 (243개)
        └── comprehensive-items.json   # 종합관리 품목 (34개)
```

## 기술 스택

- **Node.js**: v22.13.1
- **Supabase Client**: @supabase/supabase-js
- **Database**: PostgreSQL (Supabase Cloud)
- **Project ID**: pybjnkbmtlyaftuiieyq

## 작성자

- 작성일: 2025-10-30
- 프로젝트: 태창 ERP 시스템
- 버전: 1.0.0
