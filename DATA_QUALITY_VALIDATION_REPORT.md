# 데이터 품질 검증 리포트

**검증 일시**: 2025-02-05
**검증 대상**: 4개 마스터 데이터 테이블 (items, companies, bom, price_master)

---

## 📊 Executive Summary

### 전체 현황
- ✅ **BOM**: 100% 완벽 (347개)
- ✅ **Price_Master**: 100% 완벽 (228개)
- ⚠️ **Items**: 70% 양호, 30% 개선 필요 (749개)
- ⚠️ **Companies**: 95% 연락처 정보 누락 (95개)

### 핵심 발견사항
1. **BOM 및 가격 마스터**: 데이터 품질 우수, FK 무결성 100%, 추가 작업 불필요
2. **품목(Items)**: 가격 정보 60% 누락, 재고 음수 41건 발견
3. **거래처(Companies)**: 연락처 정보 95% 누락, Phase 2 필드 미사용

---

## 1️⃣ Items 테이블 (749개 품목)

### ✅ 양호한 부분
- **중복 없음**: 749개 코드 모두 고유 (0 duplicates)
- **필수 필드**: item_name 100% 입력 완료
- **활성 상태**: 100% 활성 (is_active = true)

### ⚠️ 개선 필요 부분

#### 1. 가격 정보 누락
```
- price 누락: 302개 (40.3%) ⚠️
- kg_unit_price 누락: 636개 (84.9%) ⚠️
- price 있음: 447개 (59.7%)
- kg_unit_price 있음: 113개 (15.1%)
```

**권고사항**: Excel 파일(`태창금속 BOM.xlsx`, `최신단가` 시트)에서 단가 정보 추출하여 업데이트

#### 2. 스펙(Spec) 정보 부족
```
- spec 누락: 529개 (70.6%) ⚠️
```

**권고사항**: Excel BOM 파일에서 제품 스펙 정보 추출하여 보완

#### 3. 재고 상태 이상
```
- 재고 0: 573개 (76.5%)
- 재고 양수: 135개 (18.0%)
- 재고 음수: 41개 (5.5%) 🚨 CRITICAL
```

**권고사항**:
- 음수 재고 41건 즉시 조사 및 수정 필요
- Excel `종합재고` 시트와 대조하여 정확한 재고 수량 반영

#### 4. 거래처 연결 거의 없음
```
- supplier_id 있음: 1개 (0.1%)
- supplier_id 없음: 748개 (99.9%) ⚠️
```

**권고사항**: Excel BOM 파일에서 공급사 정보 매핑

---

## 2️⃣ Companies 테이블 (95개 거래처)

### ✅ 양호한 부분
- **중복 없음**: 95개 코드 모두 고유
- **필수 필드**: company_name, company_type 100% 입력
- **활성 상태**: 94개 활성 (98.9%)
- **Phase 2 필드**: business_info JSONB 100% 채워짐

### ⚠️ 개선 필요 부분

#### 1. 거래처 타입 분포
```
- 공급사: 75개 (78.9%)
- 협력사: 13개 (13.7%)
- 고객사: 7개 (7.4%)
- 기타: 0개
```

**분석**: 주로 공급사 중심 데이터, 고객사 데이터 부족

#### 2. 연락처 정보 대부분 누락 🚨
```
- representative 누락: 90개 (94.7%)
- phone 누락: 90개 (94.7%)
- email 누락: 94개 (98.9%)
- address 누락: 90개 (94.7%)
- business_number 누락: 90개 (94.7%)
```

**권고사항**: Excel `매입매출 보고현황.xlsx`에서 거래처 연락처 정보 추출

#### 3. Phase 2 필드 미사용
```
- company_category: 0개 (0%)
- payment_terms: 1개 (1.1%)
```

**권고사항**:
- company_category (원자재/외주/소모품/기타) 분류 작업 필요
- payment_terms (결제 조건) Excel에서 추출하여 입력

---

## 3️⃣ BOM 테이블 (347개 BOM) ✅

### ✅ 완벽한 상태
- **총 BOM**: 347개
- **고유 부모 품목**: 78개
- **고유 자식 품목**: 163개
- **중복/누락**: 0건
- **음수 수량**: 0건
- **FK 무결성**: 100% (invalid_parent_fk=0, invalid_child_fk=0)
- **활성 상태**: 100% (347개 모두 활성)

### 📊 통계
```
- 평균 소요 수량: 1.44개
- 최소 수량: 1개
- 최대 수량: 15개
```

### ✅ Phase 3 필드 100% 완성
```
- labor_cost: 347개 (100%)
- machine_time: 347개 (100%)
- setup_time: 347개 (100%)
```

**결론**: 추가 작업 불필요, 데이터 품질 우수 ⭐

---

## 4️⃣ Price_Master 테이블 (228개 가격) ✅

### ✅ 완벽한 상태
- **총 가격 레코드**: 228개
- **고유 품목**: 228개 (1:1 매핑)
- **중복/누락**: 0건
- **음수 가격**: 0건
- **FK 무결성**: 100% (invalid_item_fk=0)
- **현재 유효 가격**: 228개 (100%)

### 📊 가격 통계
```
- 평균 단가: ₩5,744
- 최소 단가: ₩10
- 최대 단가: ₩38,175
- 유효 기간: 2025-01-01 ~ 2025-04-01
```

### ✅ 데이터 완성도
```
- effective_date: 228개 (100%)
- is_current: 228개 (100%, 모두 현재가)
- notes: 228개 (100%)
- price_type: 0개 (미사용)
```

**결론**: 추가 작업 불필요, 데이터 품질 우수 ⭐

---

## 🎯 우선순위별 액션 아이템

### 🚨 Critical (즉시 조치)
1. **Items 음수 재고 41건 조사 및 수정**
   - 재고 음수 품목 리스트 추출
   - Excel `종합재고` 시트와 대조
   - 데이터 정정 스크립트 작성

2. **Companies 연락처 정보 보완**
   - Excel `매입매출 보고현황.xlsx`에서 거래처 정보 추출
   - representative, phone, email, address, business_number 일괄 업데이트

### ⚠️ High Priority (1주 내)
3. **Items 가격 정보 보완**
   - Excel `태창금속 BOM.xlsx` → `최신단가` 시트 분석
   - price 필드 302개 채우기
   - kg_unit_price 필드 636개 채우기

4. **Items 스펙 정보 보완**
   - Excel BOM 파일에서 제품 스펙 추출
   - spec 필드 529개 채우기

5. **Items-Companies 연결**
   - Excel BOM에서 공급사 정보 매핑
   - supplier_id 748개 채우기

### 📋 Medium Priority (2주 내)
6. **Companies Phase 2 필드 활용**
   - company_category 95개 분류 (원자재/외주/소모품/기타)
   - payment_terms 설정

---

## 📈 다음 단계

### Step 1: 음수 재고 조사 (Critical)
```sql
SELECT item_id, item_code, item_name, current_stock
FROM items
WHERE current_stock < 0
ORDER BY current_stock;
```

### Step 2: Excel 데이터 추출 스크립트 작성
- `태창금속 BOM.xlsx` → 단가 정보
- `종합재고.xlsx` → 재고 수량
- `매입매출 보고현황.xlsx` → 거래처 연락처

### Step 3: 데이터 업데이트 스크립트 실행
- Items 가격/스펙/재고 일괄 업데이트
- Companies 연락처 정보 일괄 업데이트

### Step 4: 재검증
- 업데이트 후 동일한 품질 검증 쿼리 재실행
- 개선율 측정 및 리포트

---

## 📝 기술 노트

### 실제 스키마 vs 예상 스키마 차이점
1. **Items 테이블**:
   - ✅ `price` + `kg_unit_price` 두 컬럼 모두 존재
   - ✅ `supplier_id` 존재 (거의 사용 안 됨)

2. **Companies 테이블**:
   - ✅ `representative` (예상: contact_person)
   - ✅ `business_info` JSONB 100% 채워짐
   - ⚠️ `company_category` 0% 사용
   - ⚠️ `payment_terms` 1% 사용

3. **BOM 테이블**:
   - ✅ `quantity_required` (예상: quantity)
   - ✅ Phase 3 필드 완벽 (labor_cost, machine_time, setup_time)

4. **Price_Master 테이블**:
   - ✅ `effective_date` + `is_current` (예상: valid_from/valid_to)
   - ⚠️ `price_type` 미사용
   - ✅ `notes` 100% 채워짐

---

**검증 완료 시간**: 2025-02-05
**검증자**: Claude Code (Supabase MCP)
**다음 단계**: Excel 데이터 추출 및 품질 이슈 수정
