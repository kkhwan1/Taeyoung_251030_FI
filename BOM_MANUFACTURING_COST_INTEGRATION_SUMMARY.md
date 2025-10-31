# BOM Manufacturing Cost Integration - Complete Summary

생성일시: 2025-01-30 18:30
상태: 분석 및 스크립트 작성 완료 ✅

## 📋 Overview

**목적**: Excel BOM 파일의 상세한 제조 원가 데이터를 웹 애플리케이션에 통합

**배경**:
- Excel 파일에 품목별 재질, 치수, 중량, 스크랩 원가 등 상세 데이터 존재
- 현재 데이터베이스에는 일부 필드만 존재
- 웹에서 완전한 제조 원가 계산 및 분석 불가능

**결과**:
- ✅ 6개 시트 구조 분석 완료 (900+ 레코드)
- ✅ 데이터베이스 스키마 비교 완료
- ✅ 5개 필드 추가 마이그레이션 스크립트 작성
- ✅ Excel 임포트 스크립트 작성
- ✅ 상세 문서 작성 완료

## 🔍 분석 결과

### Excel BOM 파일 구조

**파일**: `.example/태창금속 BOM.xlsx`

**시트별 레코드 수**:
| 시트명 | 데이터 행 수 | 상태 |
|--------|------------|------|
| 대우공업 | 137 | ✅ 분석 완료 |
| 풍기산업 | 163 | ✅ 분석 완료 |
| 다인 | 108 | ✅ 분석 완료 |
| 호원오토 | 225 | ✅ 분석 완료 |
| 인알파코리아 | 146 | ✅ 분석 완료 |
| 최신단가 | 243 | ⚠️ 다른 구조 (품번-단가 매핑) |
| **합계** | **779** | |

**총 31개 컬럼** (주요 필드):
- 기본 정보: 납품처, 차종, 품번, 품명
- 재질/치수: 재질, 두께, 폭, 길이, SEP
- 중량: 비중, EA중량, 실적수량
- 스크랩: 스크랩중량, 스크랩단가, 스크랩금액
- 원가: KG단가, 단품단가, 단가

### 현재 Database Schema

**items 테이블** (33개 컬럼):

**✅ 이미 존재하는 필드**:
- `material` - 재질
- `thickness` - 두께
- `width` - 폭
- `height` - **길이** (필드명 주의!)
- `specific_gravity` (default 7.85) - 비중
- `mm_weight` - **EA중량** (필드명 주의!)
- `scrap_unit_price` (default 0) - 스크랩 단가

**❌ 누락된 필드** (5개):
1. `sep` - Separator 개수
2. `actual_quantity` - 실적수량 (월별 생산 실적)
3. `scrap_weight` - 단위당 스크랩중량
4. `scrap_amount` - 스크랩금액 (총액)
5. `kg_unit_price` - KG단가 (재료비)

### 필드 매핑

| Excel 필드 | DB 컬럼 | 상태 | 데이터 타입 |
|-----------|---------|------|-----------|
| 품번 | item_code | ✅ 존재 | VARCHAR(50) |
| 품명 | item_name | ✅ 존재 | VARCHAR(200) |
| 재질 | material | ✅ 존재 | VARCHAR(100) |
| 두께 | thickness | ✅ 존재 | NUMERIC |
| 폭 | width | ✅ 존재 | NUMERIC |
| 길이 | height | ✅ 존재 | NUMERIC |
| SEP | **sep** | ❌ 추가 필요 | INTEGER |
| 비중 | specific_gravity | ✅ 존재 | NUMERIC (7.85) |
| EA중량 | mm_weight | ✅ 존재 | NUMERIC |
| 실적수량 | **actual_quantity** | ❌ 추가 필요 | INTEGER |
| 스크랩중량 | **scrap_weight** | ❌ 추가 필요 | NUMERIC(10,4) |
| 스크랩단가 | scrap_unit_price | ✅ 존재 | NUMERIC |
| 스크랩금액 | **scrap_amount** | ❌ 추가 필요 | NUMERIC(15,2) |
| KG단가 | **kg_unit_price** | ❌ 추가 필요 | NUMERIC(10,2) |
| 단품단가 | price | ✅ 존재 | NUMERIC |

## 📁 생성된 파일

### 1. BOM_SCHEMA_ENHANCEMENT_PROPOSAL.md (5,200자)
**내용**:
- Excel BOM 구조 상세 분석
- 현재 데이터베이스 스키마 비교
- Option A: items 테이블 확장 (추천)
- Option B: 별도 manufacturing_cost 테이블
- 예상 효과 및 Next Steps

**핵심 권장사항**:
- Phase 1: items 테이블에 5개 필드 추가 (즉시 실행)
- Phase 2: 향후 이력 관리용 별도 테이블 고려

### 2. add-manufacturing-cost-fields.ts (마이그레이션 스크립트)
**기능**:
- items 테이블에 5개 컬럼 추가
- 각 컬럼에 COMMENT 설정
- 자동 검증 기능 포함

**실행 명령**:
```bash
npx tsx scripts/migration/add-manufacturing-cost-fields.ts
```

**예상 결과**:
- ✅ sep (INTEGER DEFAULT 1)
- ✅ actual_quantity (INTEGER DEFAULT 0)
- ✅ scrap_weight (NUMERIC(10,4) DEFAULT 0)
- ✅ scrap_amount (NUMERIC(15,2) DEFAULT 0)
- ✅ kg_unit_price (NUMERIC(10,2) DEFAULT 0)

### 3. import-bom-manufacturing-data.ts (임포트 스크립트)
**기능**:
- Excel 파일 자동 파싱 (HEADER_ROW = 5)
- 5개 시트 순차 처리
- item_code 기반 매칭 및 업데이트
- 상세 통계 및 에러 리포트

**실행 명령**:
```bash
npx tsx scripts/migration/import-bom-manufacturing-data.ts
```

**예상 결과**:
- 779개 레코드 처리
- 품목 코드 기반 자동 매칭
- 존재하는 품목만 업데이트
- 상세 성공률 리포트

### 4. 분석 스크립트 (2개)
- `scripts/analysis/analyze-bom-excel.js` - 기본 구조 분석
- `scripts/analysis/analyze-bom-detail.js` - 상세 필드 매핑

## 🚀 실행 계획

### Step 1: 데이터베이스 마이그레이션 (우선순위: 🔴 높음)

```bash
# 1. Migration 실행
npx tsx scripts/migration/add-manufacturing-cost-fields.ts

# 2. TypeScript 타입 재생성
npm run db:types

# 3. 변경사항 확인
psql $NEXT_PUBLIC_SUPABASE_URL -c "\d items"
```

**예상 소요 시간**: 5분
**영향 범위**: items 테이블만 (기존 데이터 보존)

### Step 2: Excel 데이터 임포트 (우선순위: 🔴 높음)

```bash
# 1. Import 실행
npx tsx scripts/migration/import-bom-manufacturing-data.ts

# 2. 결과 검증
npm run db:check-data
```

**예상 소요 시간**: 10분
**예상 결과**: 779개 레코드 중 매칭되는 품목 업데이트

### Step 3: Web UI 개선 (우선순위: 🟡 중간)

**수정할 파일**:
1. `src/app/master/items/[id]/page.tsx`
   - "제조 원가" 섹션 추가
   - 재질, 치수, 중량 정보 표시
   - 스크랩 원가 계산 표시

2. `src/app/api/items/route.ts`
   - 새 필드 포함하여 응답
   - Validation 스키마 업데이트

3. `src/lib/validation.ts`
   - ItemCreateSchema 확장
   - ItemUpdateSchema 확장

**예상 소요 시간**: 2시간

### Step 4: 테스트 및 검증 (우선순위: 🟡 중간)

```bash
# 1. API 테스트
npm run test:api

# 2. 타입 체크
npm run type-check

# 3. 빌드 테스트
npm run build
```

**예상 소요 시간**: 30분

## 📊 예상 효과

### 데이터 품질 개선
- ✅ 품목별 완전한 제조 원가 데이터 확보
- ✅ Excel 파일 의존도 감소
- ✅ 데이터 일관성 향상

### 업무 효율성
- ✅ 웹에서 실시간 원가 조회 가능
- ✅ 자동 원가 계산 (재질 × 치수 × 비중)
- ✅ 스크랩 손실 분석 가능

### 시스템 확장성
- ✅ MES 연동 준비
- ✅ 고급 원가 분석 기반 마련
- ✅ 월별 원가 변동 추적 (향후)

## ⚠️ 주의사항

### Migration 실행 전 확인사항
1. ✅ **백업**: Supabase 자동 백업 활성화 확인
2. ✅ **권한**: SUPABASE_SERVICE_ROLE_KEY 설정 확인
3. ✅ **테스트**: 로컬 환경에서 먼저 테스트 (권장)

### Excel Import 실행 전 확인사항
1. ✅ **파일 위치**: `.example/태창금속 BOM.xlsx` 존재 확인
2. ✅ **인코딩**: Excel 파일이 UTF-8로 저장되었는지 확인
3. ✅ **품목 매칭**: items 테이블에 품목 코드가 존재하는지 확인

### 필드명 불일치 주의
- ⚠️ Excel "길이" → DB "height"
- ⚠️ Excel "EA중량" → DB "mm_weight"
- 임포트 스크립트에서 자동 매핑 처리됨

## 📈 성공 지표

| 지표 | 목표 | 측정 방법 |
|-----|------|---------|
| Migration 성공률 | 100% (5/5 필드) | 스크립트 실행 로그 |
| Import 성공률 | ≥80% | 매칭된 품목 수 / 총 레코드 |
| 데이터 완성도 | ≥90% | 필수 필드 입력 비율 |
| API 응답 시간 | <200ms | 품목 조회 API 성능 |
| UI 렌더링 | <100ms | 품목 상세 페이지 로딩 |

## 🔗 관련 문서

- [BOM_SCHEMA_ENHANCEMENT_PROPOSAL.md](./BOM_SCHEMA_ENHANCEMENT_PROPOSAL.md) - 상세 스키마 분석
- [INBOUND_IMPORT_FINAL_SUMMARY.md](./INBOUND_IMPORT_FINAL_SUMMARY.md) - 입고 거래 임포트 현황
- [PRICE_POPULATION_COMPLETE.md](./PRICE_POPULATION_COMPLETE.md) - 가격 정보 채우기 완료 보고서
- [API_REFERENCE.md](./API_REFERENCE.md) - API 문서

## 📞 Next Steps (즉시 실행 가능)

### 1️⃣ Migration 실행 (5분)
```bash
cd C:\Users\USER\claude_code\FITaeYoungERP
npx tsx scripts/migration/add-manufacturing-cost-fields.ts
npm run db:types
```

### 2️⃣ Import 실행 (10분)
```bash
npx tsx scripts/migration/import-bom-manufacturing-data.ts
```

### 3️⃣ Web UI 개선 (2시간)
- 품목 상세 페이지에 "제조 원가" 섹션 추가
- 재질, 치수, 중량, 스크랩 원가 표시

### 4️⃣ 테스트 및 배포 (30분)
```bash
npm run test:api
npm run type-check
npm run build
```

---

**작성자**: Claude (SuperClaude Framework)
**프로젝트**: 태창 ERP 시스템
**버전**: Phase 2 Complete → Phase 2.5 BOM Enhancement
**완료율**: 100% (분석 및 스크립트 작성 완료)
