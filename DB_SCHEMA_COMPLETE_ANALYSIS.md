# 태창 ERP 데이터베이스 완전 스키마 분석

**분석 완료 일시**: 2025. 10. 31. 오전 8:45:00
**데이터베이스**: Supabase PostgreSQL (Cloud)
**분석 테이블 수**: 7개 (마스터 4개 + 트랜잭션 3개)

---

## 📊 전체 테이블 요약

| 테이블명 | 컬럼 수 | 주요 용도 | 상태 |
|---------|--------|----------|------|
| items | 38 | 품목 마스터 | ✅ Active |
| companies | 19 | 거래처 마스터 | ✅ Active |
| bom | 12 | BOM 관계 | ✅ Active |
| price_master | 9 | 단가 마스터 | ⚠️ Empty |
| inventory_transactions | 26 | 재고 거래 (입고/출고/생산) | ✅ Active |
| sales_transactions | 29 | 매출 거래 | ✅ Active |
| purchase_transactions | 29 | 매입 거래 | ✅ Active |
| inbound_transactions | - | 입고 전용 | ❌ Not Exists |
| outbound_transactions | - | 출고 전용 | ❌ Not Exists |
| production_transactions | - | 생산 전용 | ❌ Not Exists |

**중요 발견**: `inbound_transactions`, `outbound_transactions`, `production_transactions` 테이블이 존재하지 않습니다. 모든 재고 거래는 `inventory_transactions` 테이블의 `transaction_type` 컬럼으로 구분됩니다.

---

## 🔑 1. ITEMS (품목 마스터) - 38 컬럼

### 핵심 식별 필드
```sql
item_id             bigint PRIMARY KEY (자동 증가)
item_code           varchar(50) NOT NULL UNIQUE  -- 품목 코드 (예: "50008175", "구조용 접착체")
item_name           varchar(200) NOT NULL        -- 품목명
```

### 분류 필드
```sql
category            USER-DEFINED enum NOT NULL   -- 품목 카테고리 (원자재/반제품/완제품/외주품)
item_type           varchar(20) DEFAULT 'RAW'    -- 품목 유형
material_type       varchar(20) DEFAULT 'OTHER'  -- 재질 유형
```

### 물리적 사양
```sql
spec                text                         -- 규격 (nullable)
material            varchar(100)                 -- 재질
thickness           numeric                      -- 두께
width               numeric                      -- 폭
height              numeric                      -- 높이
unit                varchar(10) DEFAULT 'EA'     -- 단위
```

### 가격 정보
```sql
price               numeric DEFAULT 0            -- 기본 단가
kg_unit_price       numeric DEFAULT 0            -- kg당 단가
scrap_unit_price    numeric DEFAULT 0            -- 스크랩 단가
```

### 재고 관리
```sql
current_stock       integer DEFAULT 0            -- 현재고
safety_stock        integer DEFAULT 0            -- 안전재고
location            varchar(100)                 -- 위치
```

### 제조 정보
```sql
vehicle_model       varchar(50)                  -- 차종 (예: "G80", "GV70")
specific_gravity    numeric DEFAULT 7.85         -- 비중 (철강 기본값)
mm_weight           numeric                      -- mm 중량
daily_requirement   integer                      -- 일일 소요량
blank_size          integer                      -- 블랭크 크기
```

### 원가 회계
```sql
scrap_rate          numeric DEFAULT 0            -- 스크랩율 (%)
yield_rate          numeric DEFAULT 100          -- 수율 (%)
overhead_rate       numeric DEFAULT 0            -- 간접비율 (%)
labor_cost          numeric                      -- 인건비
```

### 관계 필드
```sql
supplier_id         integer                      -- FK → companies.company_id
```

### 메타데이터
```sql
is_active           boolean DEFAULT true NOT NULL
created_at          timestamptz
updated_at          timestamptz
created_by          bigint
updated_by          bigint
```

### ⚠️ 중요 발견: 데이터 품질 이슈

**샘플 데이터 분석 결과**:
```json
{
  "item_code": "50008175",
  "item_name": "IMPORTED FROM EXCEL - 최신단가 (에이오에스)",
  "category": "원자재",
  "price": "965.00",
  "created_at": "2025-10-30 23:04:28.659958+00"
}

{
  "item_code": "구조용 접착체",
  "item_name": "IMPORTED FROM EXCEL - 최신단가 (호원사급)",
  "category": "원자재",
  "price": "9700.00"
}
```

**문제**:
- `item_name` 필드가 실제 품명이 아닌 **플레이스홀더 텍스트**로 채워짐
- 패턴: `"IMPORTED FROM EXCEL - 최신단가 (거래처명)"`
- 영향: Excel → DB 역추적 불가능 (품명으로 매칭 불가)
- 원인: 초기 import 스크립트가 품명을 보존하지 않음

**보존된 데이터**:
- ✅ `item_code`: 정상 보존
- ✅ `price`: 정상 보존
- ❌ `item_name`: 플레이스홀더로 대체됨
- ❌ `spec`, `material`: null

---

## 🏢 2. COMPANIES (거래처 마스터) - 19 컬럼

### 핵심 식별 필드
```sql
company_id          bigint PRIMARY KEY (자동 증가)
company_code        varchar(50) NOT NULL UNIQUE  -- 거래처 코드 (예: "CUS001", "SUP001")
company_name        varchar(200) NOT NULL        -- 거래처명
company_type        USER-DEFINED enum NOT NULL   -- 고객사/공급사/협력사/기타
```

### 사업자 정보
```sql
business_number     varchar(20)                  -- 사업자등록번호
representative      varchar(100)                 -- 대표자명
```

### 연락 정보
```sql
phone               varchar(20)
fax                 varchar(20)
email               varchar(100)
address             text
```

### 비즈니스 정보
```sql
description         text                         -- 설명
company_category    varchar(50)                  -- 카테고리 (Phase 2: 원자재/외주/소모품/기타)
business_info       jsonb DEFAULT '{}'           -- JSON 확장 필드 (Phase 2)
                    -- 예: { "business_type": "제조업", "business_item": "철강" }
```

### 결제 조건
```sql
payment_terms       integer                      -- 결제 조건 (일수)
```

### 메타데이터
```sql
is_active           boolean DEFAULT true
created_at          timestamptz
updated_at          timestamptz
created_by          bigint
updated_by          bigint
```

---

## 🔗 3. BOM (자재 명세서) - 12 컬럼

### ⚠️ 중요: 컬럼명 주의사항
- ❌ `quantity` (존재하지 않음!)
- ✅ `quantity_required` (실제 컬럼명)

### 관계 필드
```sql
bom_id              integer PRIMARY KEY (자동 증가)
parent_item_id      integer NOT NULL             -- FK → items.item_id (모품목)
child_item_id       integer NOT NULL             -- FK → items.item_id (자품목)
```

### 수량 정보
```sql
quantity_required   numeric DEFAULT 1.0 NOT NULL -- ⚠️ 실제 컬럼명! (quantity 아님)
level_no            integer DEFAULT 1 NOT NULL   -- BOM 레벨 (1, 2, 3...)
```

### 원가 정보
```sql
labor_cost          numeric DEFAULT 0            -- 인건비
machine_time        numeric DEFAULT 0            -- 기계 시간 (분)
setup_time          numeric DEFAULT 0            -- 준비 시간 (분)
```

### 메타데이터
```sql
notes               text
is_active           boolean DEFAULT true NOT NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

**스키마 에러 경험**:
```javascript
// ❌ 잘못된 쿼리 (에러 발생)
await supabase.from('bom').select('quantity')
// Error: column bom.quantity does not exist

// ✅ 올바른 쿼리
await supabase.from('bom').select('quantity_required')
```

---

## 💰 4. PRICE_MASTER (단가 마스터) - 9 컬럼

### 핵심 필드
```sql
price_id            integer PRIMARY KEY (자동 증가)
item_id             integer NOT NULL             -- FK → items.item_id
unit_price          numeric NOT NULL             -- 단가
effective_date      date DEFAULT CURRENT_DATE NOT NULL  -- 적용일
is_current          boolean DEFAULT true NOT NULL       -- 현재가 여부
```

### 분류 및 메모
```sql
price_type          varchar(50)                  -- 단가 유형 (매입가/매출가)
notes               text
```

### 메타데이터
```sql
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

### ⚠️ 현재 상태: 완전히 비어있음

**Excel 분석 결과**:
- Excel `태창금속 BOM.xlsx` > `최신단가` 시트: **243건**
- DB `price_master` 테이블: **0건**
- **누락**: 243건 (100%)

**원인**:
- `최신단가` 시트가 `unknown` 테이블로 분류됨
- Import 스크립트가 이 시트를 인식하지 못함

---

## 📦 5. INVENTORY_TRANSACTIONS (재고 거래) - 26 컬럼

### ⚠️ 중요: 통합 트랜잭션 테이블

이 테이블은 **입고, 출고, 생산** 모든 재고 거래를 `transaction_type` 컬럼으로 구분합니다:
- `입고` (INBOUND)
- `출고` (OUTBOUND)
- `생산` (PRODUCTION)

### 핵심 필드
```sql
transaction_id      bigint PRIMARY KEY (자동 증가)
transaction_date    date NOT NULL                -- 거래 일자
transaction_type    USER-DEFINED enum NOT NULL   -- 입고/출고/생산
```

### 품목 및 거래처
```sql
item_id             bigint NOT NULL              -- FK → items.item_id
company_id          bigint                       -- FK → companies.company_id (nullable)
```

### 수량 및 금액
```sql
quantity            integer NOT NULL             -- 수량
unit_price          numeric DEFAULT 0            -- 단가
total_amount        numeric DEFAULT 0            -- 공급가액
tax_amount          numeric DEFAULT 0            -- 세액
grand_total         numeric DEFAULT 0            -- 합계
```

### 문서 관리
```sql
document_number     varchar(50)                  -- 문서 번호
reference_number    varchar(100)                 -- 참조 번호
transaction_number  varchar(20)                  -- 거래 번호
```

### 창고 관리
```sql
warehouse_id        integer                      -- 창고 ID
location            varchar(100)                 -- 위치
lot_number          varchar(50)                  -- LOT 번호
expiry_date         date                         -- 유효기간
```

### 상태 및 설명
```sql
status              USER-DEFINED enum DEFAULT '완료'  -- 거래 상태
description         text                         -- 설명
notes               text                         -- 비고
```

### 일자 정보
```sql
delivery_date       date                         -- 납품일
arrival_date        date                         -- 도착일
```

### 메타데이터
```sql
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
created_by          bigint
updated_by          bigint
```

---

## 💵 6. SALES_TRANSACTIONS (매출 거래) - 29 컬럼

### 핵심 식별
```sql
transaction_id      integer PRIMARY KEY (자동 증가)
transaction_date    date NOT NULL                -- 거래 일자
transaction_no      varchar(50) NOT NULL         -- 거래 번호 (UNIQUE)
```

### 고객 정보
```sql
customer_id         integer NOT NULL             -- FK → companies.company_id
customer_name       varchar(100)                 -- 고객사명 (비정규화)
```

### 품목 정보
```sql
item_id             integer NOT NULL             -- FK → items.item_id
item_name           varchar(100)                 -- 품목명 (비정규화)
spec                varchar(100)                 -- 규격
vehicle_model       varchar(50)                  -- 차종
material_type       varchar(20)                  -- 재질
```

### 수량 및 금액
```sql
quantity            numeric NOT NULL             -- 수량
unit                varchar(10) DEFAULT 'EA'     -- 단위
unit_price          numeric NOT NULL             -- 단가
supply_amount       numeric NOT NULL             -- 공급가액
tax_amount          numeric DEFAULT 0            -- 세액
total_amount        numeric NOT NULL             -- 합계
```

### 배송 정보
```sql
delivery_date       date                         -- 배송일
delivery_address    text                         -- 배송 주소
```

### 세금계산서
```sql
tax_invoice_id      integer                      -- 세금계산서 ID
tax_invoice_issued  boolean DEFAULT false        -- 세금계산서 발행 여부
```

### 결제 관리
```sql
payment_status      varchar(20) DEFAULT 'PENDING'  -- PENDING/PARTIAL/COMPLETED
paid_amount         numeric DEFAULT 0            -- 수금액 (Phase 1: 자동 계산)
payment_due_date    date                         -- 결제 예정일
```

**Phase 1 자동 결제 상태 계산**:
```sql
-- 트리거로 자동 계산됨
IF paid_amount = 0 THEN payment_status = 'PENDING'
ELSE IF paid_amount < total_amount THEN payment_status = 'PARTIAL'
ELSE payment_status = 'COMPLETED'
```

### 메타데이터
```sql
notes               text
created_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
created_by          integer
updated_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_by          integer
is_active           boolean NOT NULL DEFAULT true
```

---

## 🛒 7. PURCHASE_TRANSACTIONS (매입 거래) - 29 컬럼

### 핵심 식별
```sql
transaction_id      integer PRIMARY KEY (자동 증가)
transaction_date    date NOT NULL                -- 거래 일자
transaction_no      varchar(50) NOT NULL         -- 거래 번호 (UNIQUE)
```

### 공급사 정보
```sql
supplier_id         integer NOT NULL             -- FK → companies.company_id
supplier_name       varchar(100)                 -- 공급사명 (비정규화)
```

### 품목 정보
```sql
item_id             integer NOT NULL             -- FK → items.item_id
item_name           varchar(100)                 -- 품목명 (비정규화)
spec                varchar(100)                 -- 규격
vehicle_model       varchar(50)                  -- 차종
material_type       varchar(20)                  -- 재질
```

### 수량 및 금액
```sql
quantity            numeric NOT NULL             -- 수량
unit                varchar(10) DEFAULT 'EA'     -- 단위
unit_price          numeric NOT NULL             -- 단가
supply_amount       numeric NOT NULL             -- 공급가액
tax_amount          numeric DEFAULT 0            -- 세액
total_amount        numeric NOT NULL             -- 합계
```

### 입고 정보
```sql
receiving_date      date                         -- 입고일
warehouse_location  varchar(50)                  -- 창고 위치
```

### 세금계산서
```sql
tax_invoice_id      integer                      -- 세금계산서 ID
tax_invoice_received boolean DEFAULT false       -- 세금계산서 수령 여부
```

### 결제 관리
```sql
payment_status      varchar(20) DEFAULT 'PENDING'  -- PENDING/PARTIAL/COMPLETED
paid_amount         numeric DEFAULT 0            -- 지급액 (Phase 1: 자동 계산)
payment_due_date    date                         -- 결제 예정일
```

**Phase 1 자동 결제 상태 계산**:
```sql
-- 트리거로 자동 계산됨
IF paid_amount = 0 THEN payment_status = 'PENDING'
ELSE IF paid_amount < total_amount THEN payment_status = 'PARTIAL'
ELSE payment_status = 'COMPLETED'
```

### 메타데이터
```sql
notes               text
created_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
created_by          integer
updated_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_by          integer
is_active           boolean NOT NULL DEFAULT true
```

---

## 🔍 핵심 발견사항

### 1. 테이블 구조 특징

**통합 vs 분리**:
- ✅ 재고 거래: **통합 테이블** (`inventory_transactions.transaction_type`으로 구분)
- ✅ 매출/매입: **분리 테이블** (`sales_transactions`, `purchase_transactions`)

**이유**:
- 재고 거래는 물리적 재고 이동이므로 통합 관리가 효율적
- 매출/매입은 회계 처리가 달라서 분리 관리

### 2. 비정규화 패턴

다음 필드들이 **의도적으로 비정규화**되어 있습니다:
```sql
sales_transactions.customer_name    -- companies.company_name 복사
sales_transactions.item_name        -- items.item_name 복사
purchase_transactions.supplier_name -- companies.company_name 복사
purchase_transactions.item_name     -- items.item_name 복사
```

**목적**:
- 거래 시점의 데이터 스냅샷 보존
- 마스터 데이터 변경 시에도 과거 거래 내역 유지
- 조회 성능 향상 (JOIN 횟수 감소)

### 3. 데이터 품질 이슈

**중대한 문제**:
```
items.item_name: "IMPORTED FROM EXCEL - 최신단가 (거래처명)"
```

- 실제 품명이 보존되지 않음
- Excel 역추적 불가능
- 웹 화면에서 의미 없는 텍스트 표시됨

**영향 범위**:
- 품목 마스터 전체 (정확한 수 미확인, 샘플 20개 중 20개 모두 해당)
- 비정규화된 거래 테이블 (`sales_transactions.item_name`, `purchase_transactions.item_name`)

### 4. 누락된 데이터

| 테이블 | Excel 예상 | DB 실제 | 누락률 |
|--------|-----------|---------|--------|
| price_master | 243건 | 0건 | 100% |
| inventory_transactions (입고) | 532건+ | 미확인 | 미확인 |
| inventory_transactions (출고) | 385건+ | 미확인 | 미확인 |
| inventory_transactions (생산) | 87건+ | 미확인 | 미확인 |

### 5. 중요 컬럼명 변경 이력

**BOM 테이블**:
- ❌ `quantity` → 존재하지 않음 (과거 스크립트에서 사용됨)
- ✅ `quantity_required` → 실제 컬럼명

**영향**: 모든 BOM 관련 쿼리 수정 필요

---

## 📋 다음 단계 권장사항

### 1. 데이터 품질 복구 (긴급)

**우선순위 1: 품목명 복구**
```
문제: items.item_name = "IMPORTED FROM EXCEL - 최신단가 (...)"
해결: Excel에서 실제 품명 추출하여 UPDATE
대상: items 테이블 전체 (샘플 20/20개 모두 해당)
```

**우선순위 2: price_master 채우기**
```
문제: price_master 테이블 완전히 비어있음 (0건)
해결: Excel "최신단가" 시트 재import
대상: 243건
```

**우선순위 3: 재고 거래 검증**
```
문제: inventory_transactions 누락 여부 미확인
해결: Excel과 DB 데이터 건수 비교
대상: 입고 532건+, 출고 385건+, 생산 87건+
```

### 2. Excel → DB 매핑 문서 작성

**필요한 이유**:
- 현재 Excel 컬럼명과 DB 컬럼명 매핑이 불명확
- `__EMPTY`, `__EMPTY_1` 같은 파싱 에러 존재
- 각 Excel 시트가 어느 DB 테이블로 가는지 명확한 문서 필요

**포함 내용**:
```
Excel 파일명 > 시트명 > 컬럼명 → DB 테이블.컬럼명
예: 태창금속 BOM.xlsx > 최신단가 > P/NO → items.item_code
예: 태창금속 BOM.xlsx > 최신단가 > 품명 → items.item_name (현재 누락!)
```

### 3. Import 스크립트 수정

**현재 문제점**:
- 품목명을 플레이스홀더로 대체함
- 일부 시트를 `unknown` 테이블로 분류
- 복잡한 Excel 레이아웃 파싱 실패

**수정 방향**:
- 실제 품명 보존 로직 추가
- 시트별 맞춤형 파싱 로직 구현
- 컬럼 매핑 명확화

---

## 📊 스키마 완성도 평가

| 항목 | 평가 | 점수 |
|------|------|------|
| 테이블 구조 설계 | 우수 (정규화 + 비정규화 적절) | 90/100 |
| 컬럼 타입 및 제약조건 | 우수 (enum, FK, default 잘 정의됨) | 95/100 |
| 데이터 품질 | **불량** (품명 누락, price_master 비어있음) | 30/100 |
| Excel 매핑 정확도 | 불량 (품명 미보존, 일부 시트 미인식) | 40/100 |
| **전체 평가** | **데이터 복구 필요** | **63/100** |

---

**분석 완료 일시**: 2025. 10. 31. 오전 8:45:00
**분석자**: Claude Code (SuperClaude Framework)
**다음 작업**: Excel → DB 역추적 스크립트 실행하여 실제 데이터 비교
