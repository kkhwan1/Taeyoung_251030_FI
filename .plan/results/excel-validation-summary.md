# Excel 검증 완료 요약 (File 4: 09월 원자재 수불관리.xlsx)

## ✅ 검증 완료 상태

### 분석 완료된 시트
- ✅ **Sheet 1-11**: 공급사별 시트 (모두 Sheet 13 참조)
- ✅ **Sheet 12**: MV1, SV (재고관리) - 마스터 시트
- ✅ **Sheet 13**: TAM, KA4, 인알파 - **핵심 마스터 시트**
- ✅ **Sheet 14**: DL3 GL3 (재고관리) - 마스터 시트
- ✅ **Sheet 16**: 인알파 (주간계획) - SharePoint 참조 ⚠️
- ✅ **Sheet 19**: 대우사급 입고현황
- ✅ **Sheet 20**: 호원사급 입고현황
- ✅ **Sheet 21**: 협력업체 입고현황 (122,150셀 - 최대)

---

## 🔑 핵심 발견사항

### 1. 재고 계산 핵심 로직 (Sheet 13)
```excel
현재고 = 입고수량 + 기초재고 - 생산실적 - C/O 납품수량
현재고 = I3 + L3 - J3 - K3
```

**Phase P3 연결**: 이 로직을 `v_stock_valuation_monthly` 뷰에서 SQL로 구현 필요

---

### 2. 외부 파일 의존성 (2개)

#### ⚠️ SharePoint 의존성 (Sheet 16)
```excel
='https://inalfa0-my.sharepoint.com/personal/jaehyuk_ryoo_inalfa_com/
Documents/Desktop/MRP/태창금속/[0.태창신성 현황관리.xlsx]TAECHANG'!M9
```
- **영향도**: 주간 계획 30+ 품목 × 10일 데이터
- **해결책**: Phase P3 전에 수동 export 또는 Microsoft Graph API 연동

#### ⚠️ D: 드라이브 파일 (Sheet 13)
```excel
기초재고 = IFERROR(VLOOKUP(F3,'D:\구매 인수인계\재고실사\
[2025년 9월 01일 재고실사 NEW.xlsx]구매 부자재'!$F$4:$I$192,4,0),0)
```
- **영향도**: 기초재고 값 (Phase P3 재고 금액 계산 기초)
- **해결책**: Phase P3 전에 임포트 필요

---

### 3. 시간 시리즈 데이터 (Sheet 21)

**현재 구조** (350 가로 컬럼):
```
NO,양산처,P/NO,Part Name,입고수량,1일,2일,3일,...,350일
1,JS테크,69156-DO000,BULKHEAD-RR,=SUM(G3:AL3),0,6000,0,...
```

**Phase P3 마이그레이션 필요**:
```sql
-- 가로 350컬럼 → 세로 350행 변환
CREATE TABLE incoming_parts_daily (
  part_number VARCHAR(50),
  date DATE,
  quantity INTEGER,
  PRIMARY KEY (part_number, date)
);
```

---

## 📊 Phase P3 연결 포인트

### 1. 단가 이력 시스템 (Task 1.1, 1.2)
**Excel 데이터**: Sheet 13의 품목별 단가 → 현재는 고정값
**Phase P3 구현**: `item_price_history` 테이블로 월별 단가 변동 추적

```sql
-- Excel: 품목A 단가 = 1,000원 (고정)
-- Phase P3: 품목A 단가 이력
--   2025-10-01: 1,000원
--   2025-11-01: 1,100원
--   2025-12-01: 1,050원
```

### 2. 재고 금액 계산 (Task 2.1, 2.2)
**Excel 수식**: `현재고 = 입고 + 기초 - 생산 - 납품`
**Phase P3 구현**: SQL 뷰로 자동 계산

```sql
CREATE VIEW v_stock_valuation_monthly AS
SELECT
  item_id,
  current_stock,
  -- 최신 단가 (해당 월 or 최근 과거)
  COALESCE(최근단가, 기본단가) AS unit_price,
  -- 재고 금액
  current_stock * unit_price AS stock_value
FROM items i
LEFT JOIN item_price_history iph ON ...
```

### 3. 카테고리별 집계 (Task 2.3)
**Excel**: Sheet 13의 수동 집계 → 10개 시트 참조
**Phase P3 구현**: `v_stock_value_by_category` 뷰로 자동 집계

```sql
-- 원자재/부자재/완제품/공정재고 자동 분류
CASE
  WHEN company_category = '협력업체-원자재' THEN '원자재'
  WHEN company_category = '협력업체-외주' THEN '부자재'
  WHEN category LIKE '%완제품%' THEN '완제품'
  ...
END AS inventory_category
```

---

## 🚀 Phase P3 시작 전 준비 사항

### 1. 외부 파일 임포트 (필수)
- [ ] SharePoint 파일 export: `0.태창신성 현황관리.xlsx`
- [ ] D: 드라이브 파일 복사: `2025년 9월 01일 재고실사 NEW.xlsx`

### 2. 기존 품목 데이터 확인
- [ ] `items` 테이블에 `unit_price` 컬럼 존재 확인
- [ ] 현재 재고 데이터 (`current_stock`) 확인

### 3. 카테고리 매핑 확인
- [ ] `companies.company_category` 값 확인 (협력업체-원자재, 협력업체-외주)
- [ ] `items.category` 값 확인 (완제품, 반제품 포함 여부)

---

## 📋 다음 단계

**Phase P3 시작 준비 완료** ✅

1. ✅ Excel 수식 분석 완료
2. ✅ 재고 로직 이해 완료
3. ✅ 외부 의존성 파악 완료
4. ⏳ Phase P3 Task 1.1 시작 대기: `item_price_history` 테이블 생성

---

**마지막 업데이트**: 2025-01-16
**검증 완료 시트**: 21개 / 21개
**Phase P3 연결**: 준비 완료
