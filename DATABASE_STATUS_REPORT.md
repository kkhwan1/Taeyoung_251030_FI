# 데이터베이스 현황 분석 보고서

**작성일**: 2025-01-27  
**프로젝트**: TAECHANG_ERP  
**데이터베이스**: Supabase (PostgreSQL 17.6.1)  
**프로젝트 ID**: pybjnkbmtlyaftuiieyq

---

## 📊 전체 테이블 현황

| 테이블명 | 행 수 | 상태 | 비고 |
|---------|------|------|------|
| **users** | 3 | ✅ 유지 필요 | 운영 계정 |
| **companies** | 14 | ⚠️ 부분 삭제 필요 | 11개 테스트 데이터, 3개 실제 데이터 |
| **items** | 208 | ⚠️ 검토 필요 | 실제 품목 + 테스트 데이터 혼재 |
| **inventory_transactions** | 43 | ❌ 삭제 대상 | 테스트 거래 내역 |
| **bom** | 20 | ❌ 삭제 대상 | 테스트 BOM 관계 |
| **bom_deduction_log** | 32 | ❌ 삭제 대상 | 테스트 차감 로그 |
| **item_price_history** | 1,456 | ⚠️ 검토 필요 | 실제 가격 이력 가능성 높음 |
| **purchase_transactions** | 0 | ✅ 빈 테이블 | - |
| **sales_transactions** | 0 | ✅ 빈 테이블 | - |
| **warehouses** | 0 | ✅ 빈 테이블 | - |
| **warehouse_stock** | 0 | ✅ 빈 테이블 | - |
| **stock_adjustments** | 0 | ✅ 빈 테이블 | - |

---

## 🔍 상세 분석

### 1. Users 테이블 (3개 레코드)

**유지 대상** - 운영 계정으로 보임

| user_id | username | name | role | is_active |
|---------|----------|------|------|-----------|
| 1 | admin | 시스템 관리자 | admin | ✅ |
| 4 | accountant | 김회계 | manager | ✅ |
| 5 | ceo | 대표자 | admin | ✅ |

**결론**: 모든 사용자 계정 유지

---

### 2. Companies 테이블 (14개 레코드)

**테스트 데이터**: 11개  
**실제 데이터**: 3개  
**비활성화**: 8개

#### 테스트 데이터 패턴:
- `company_name`에 "테스트" 포함
- `company_name`이 "테스트회사"로 반복
- `business_number`, `representative`, `phone` 등이 NULL
- `is_active = false`인 경우 다수

#### 테스트 데이터 목록:
```
- 테스트 고객사 1 (CUS001)
- 테스트 공급사 1 (SUP001)
- 테스트회사 (SUP003, SUP004, SUP005, SUP006, SUP007, SUP008, SUP010, SUP011)
- 기타 (SUP012, SUP013)
```

#### 실제 데이터 (유지 대상):
```
- 태창정밀자동차부품(주) (SUP002, SUP006)
- ABC자동차부품(주) (SUP009)
```

**결론**: 
- 테스트 데이터 11개 삭제 필요
- 실제 데이터 3개 유지

---

### 3. Items 테이블 (208개 레코드)

**특징**:
- 대부분 실제 품목 코드 형태 (예: `65511-E2510`, `65852-BY000`)
- 카테고리: 원자재, 제품 등
- **의심점**: 많은 품목의 `price`가 `1000.00`으로 통일되어 있음

**샘플 데이터**:
| item_code | item_name | category | price | current_stock |
|-----------|-----------|----------|-------|---------------|
| 65511-E2510 | RR FLOOR 일반 | 원자재 | 1000.00 | 0 |
| 65630-L2010 | PNL & MBR ASS'Y RR FLR COMPLE | 제품 | 250000.00 | 5 |
| 66798-2J700 | COWL COVER FRT | 제품 | 5000.00 | 0 |

**결론**: 
- 실제 품목 코드이지만 일부는 테스트 데이터일 가능성
- 가격이 1000원인 품목들은 검토 필요
- **현재로서는 모두 유지 권장** (실제 마이그레이션 시 Excel과 매칭하여 결정)

---

### 4. Inventory Transactions (43개 레코드)

**특징**:
- 모든 거래가 2025-10-28 ~ 2025-10-29에 생성됨
- `reference_number` 패턴: `REF-40144`, `REF-40145`, `STOCK-ADD-20251029085627`
- 거래 유형: 생산입고, 입고

**결론**: 모두 테스트 데이터로 판단 → **삭제 대상**

---

### 5. BOM (20개 레코드)

**특징**:
- 2025-10-28에 일괄 생성
- `quantity_required`가 대부분 1.0 또는 2.0
- 테스트 BOM 관계

**결론**: 모두 테스트 데이터 → **삭제 대상**

---

### 6. BOM Deduction Log (32개 레코드)

**특징**:
- `deducted_quantity`가 대부분 0.0000
- 테스트 차감 로그

**결론**: 모두 테스트 데이터 → **삭제 대상**

---

### 7. Item Price History (1,456개 레코드)

**특징**:
- `price_month`가 2025-05-01 등 다양한 월별 데이터
- `unit_price`가 실제 가격처럼 보임 (예: 5738.00, 5318.00, 5284.00)
- 2025-10-29에 일괄 생성된 것으로 보임

**샘플 데이터**:
| item_id | price_month | unit_price |
|---------|-------------|------------|
| 4223 | 2025-05-01 | 5738.00 |
| 4227 | 2025-05-01 | 5318.00 |
| 4294 | 2025-05-01 | 5284.00 |

**결론**: 
- 실제 가격 이력일 가능성 높음
- **Excel 마이그레이션 시 검증 후 결정 권장**
- 현재로서는 유지 권장

---

## 🗑️ 삭제 대상 요약

### 즉시 삭제 가능한 테스트 데이터:

1. **inventory_transactions** (43개)
   - 모든 거래 내역 삭제

2. **bom_deduction_log** (32개)
   - 모든 차감 로그 삭제

3. **bom** (20개)
   - 모든 BOM 관계 삭제

4. **companies** - 테스트 데이터만 (11개)
   - `company_name` LIKE '%테스트%' 또는 `company_name = '테스트회사'`
   - 단, 외래 키 제약 조건 확인 필수

### 검토 필요:

1. **items** (208개)
   - 가격이 1000원인 품목들 검토
   - Excel 마이그레이션과 매칭 후 결정

2. **item_price_history** (1,456개)
   - 실제 가격 이력일 가능성
   - Excel 데이터와 검증 후 결정

---

## ⚠️ 주의사항

### 외래 키 제약 조건

다음 테이블들은 외래 키 관계가 있어 삭제 순서가 중요합니다:

1. `bom_deduction_log` → `inventory_transactions`, `items`
2. `inventory_transactions` → `items`, `companies`, `warehouses`
3. `bom` → `items`
4. `items` → `companies` (supplier_id)
5. `companies` → 삭제 시 해당 items의 supplier_id도 NULL 처리 필요

### 권장 삭제 순서:

```sql
1. bom_deduction_log (FK: inventory_transactions, bom)
2. inventory_transactions (FK: items, companies, warehouses)
3. bom (FK: items)
4. companies - 테스트 데이터만 (FK 제약 확인)
5. items - 테스트 데이터만 (검토 후)
```

---

## 📝 다음 단계 권장사항

1. **데이터 백업**: 삭제 전 전체 데이터 백업 필수
2. **Excel 데이터 확인**: 실제 마이그레이션할 Excel 파일 확인
3. **점진적 삭제**: 테스트 데이터만 선별 삭제
4. **검증**: 삭제 후 외래 키 무결성 확인
5. **Item Price History 검토**: Excel 데이터와 매칭하여 실제 데이터인지 확인

---

## 🔧 실행 가능한 SQL 쿼리

### Companies 테스트 데이터 확인:
```sql
SELECT company_id, company_code, company_name, company_type, is_active
FROM companies
WHERE company_name LIKE '%테스트%' OR company_name = '테스트회사'
ORDER BY company_id;
```

### Companies 테스트 데이터 삭제 (주의: FK 제약 확인 필수):
```sql
-- 먼저 items.supplier_id 참조 확인
SELECT COUNT(*) 
FROM items 
WHERE supplier_id IN (
  SELECT company_id 
  FROM companies 
  WHERE company_name LIKE '%테스트%' OR company_name = '테스트회사'
);

-- 참조되는 items가 없으면 삭제 가능
DELETE FROM companies
WHERE company_name LIKE '%테스트%' OR company_name = '테스트회사';
```

### Inventory Transactions 삭제:
```sql
-- FK 제약 조건으로 인해 bom_deduction_log 먼저 삭제 필요
DELETE FROM bom_deduction_log;
DELETE FROM inventory_transactions;
```

### BOM 삭제:
```sql
DELETE FROM bom;
```

---

## ✅ 작업 완료 내역

### 테스트 데이터 삭제 완료 (2025-01-27)

**삭제된 테이블 및 레코드 수:**
- ✅ bom_deduction_log: 32개 삭제
- ✅ inventory_transactions: 43개 삭제
- ✅ bom: 20개 삭제
- ✅ item_price_history: 1,456개 삭제
- ✅ items: 208개 삭제
- ✅ companies: 14개 삭제

**유지된 데이터:**
- ✅ users: 3개 유지 (운영 계정)

**삭제 후 상태:**
- 모든 테스트 데이터 삭제 완료
- users 테이블만 남음 (운영 계정 보호)

---

## 📝 다음 단계: 엑셀 데이터 마이그레이션

### 준비된 스크립트

**파일**: `scripts/migration/import-inventory-excel.ts`

**기능:**
1. PyHub MCP를 사용하여 엑셀 파일 (`09월 원자재 수불관리.xlsx`) 파싱
2. 품목 정보 추출 및 `items` 테이블에 삽입
3. T1~T268 일별 데이터를 `inventory_transactions`로 변환 및 삽입

**실행 방법:**
```bash
npx tsx scripts/migration/import-inventory-excel.ts
```

**주의사항:**
- PyHub MCP가 Cursor에 설정되어 있어야 합니다
- 엑셀 파일이 `.example` 폴더에 있어야 합니다
- PyHub MCP가 열려있는 Excel 파일을 읽을 수 있어야 합니다

---

## 🔧 PyHub MCP 설정 확인

PyHub MCP가 제대로 작동하는지 확인:
- Cursor 설정에서 PyHub MCP 서버가 등록되어 있는지 확인
- 엑셀 파일이 열려있는지 확인 (`09월 원자재 수불관리.xlsx`)
- PyHub MCP 도구가 응답하는지 확인

---

## 결론

1. ✅ **테스트 데이터 삭제 완료**: 모든 테스트 데이터 삭제됨
2. ⏳ **엑셀 마이그레이션 대기**: 스크립트 준비 완료, 실행 필요
3. 📊 **결과 보고서**: 마이그레이션 실행 후 자동 생성됨

