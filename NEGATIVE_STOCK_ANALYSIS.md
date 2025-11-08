# 음수 재고 품목 분석 리포트

**분석 일시**: 2025-02-05
**총 음수 재고 품목**: 41개
**총 부족 수량**: 약 -400,000개

---

## 🚨 Critical Issue: 대규모 음수 재고

### Top 10 최악의 음수 재고

| 순위 | 품목코드 | 품목명 | 카테고리 | 음수 재고 | 단가 |
|------|----------|--------|----------|-----------|------|
| 1 | 12900-06140 | BOLT-WELD | 원자재 | **-41,124** | ₩16 |
| 2 | 50007315 | M5 INSERT BOLT | 원자재 | **-31,600** | ₩32 |
| 3 | 65264-F6000 | BRKT-CTR DR SCUFF MTG,LH (ALL) | 원자재 | **-28,246** | ₩70 |
| 4 | 81836-R0600 | BRKT-T/GATE LIFTER,LH (파워사양) | 원자재 | **-26,858** | ₩575 |
| 5 | 65176-L1000 | MEMBER-FR SEAT CROSS RR,LH | 원자재 | **-21,904** | ₩2,323 |
| 6 | 69156-DO000 | BULKHEAD-RR TRANSVERSE,LH | 원자재 | **-20,831** | ₩1,403 |
| 7 | 65186-L1000 | MEMBER-FR SEAT CROSS RR,RH | 원자재 | **-20,590** | ₩2,323 |
| 8 | 81846-R0600 | BRKT-T/GATE LIFTER,RH (파워사양) | 원자재 | **-19,350** | ₩575 |
| 9 | 65174-L1000 | REINF-SIDE SILL INR, LH | 원자재 | **-18,894** | ₩797 |
| 10 | 65184-L1000 | REINF-SIDE SILL INR, RH | 원자재 | **-18,770** | ₩797 |

---

## 📊 음수 재고 패턴 분석

### 1. 카테고리별 분포
```
원자재: 38개 (92.7%)
부자재: 3개 (7.3%)
```

**분석**: 음수 재고는 거의 대부분 **원자재**에서 발생

### 2. 품목 유형 분석
음수 재고 품목들은 크게 4가지 유형:

**A. 볼트/패스너류 (3개)**
- BOLT-WELD (12900-06140): -41,124개
- M5 INSERT BOLT (50007315): -31,600개
- M5*16.7 BOLT (50007752): -10,752개

**B. 브라켓류 (13개)**
- BRKT-CTR DR SCUFF MTG 시리즈
- BRKT-T/GATE LIFTER 시리즈
- BRKT-FR SEAT RR INR MTG 시리즈
- BRKT BATTERY MTG RR 등

**C. 멤버/보강재 (21개)**
- MEMBER-FR SEAT CROSS 시리즈
- REINF-SIDE SILL INR 시리즈
- REINF-FR SEAT CROSS MBR SD 시리즈
- REINF-CTR FLOOR 시리즈

**D. 패널/기타 (4개)**
- PNL BACK (69112-EV000): -6,642개
- MEMBER RR TRANSVERSE (69122-EV000): -6,642개
- PATCH-S/SILL INR 시리즈

### 3. 금액 영향 분석

**Top 5 금액 손실 추정**:
| 품목코드 | 품목명 | 음수 재고 | 단가 | 추정 손실 |
|----------|--------|-----------|------|-----------|
| 65176-L1000 | MEMBER-FR SEAT CROSS RR,LH | -21,904 | ₩2,323 | **-₩50,881,792** |
| 65186-L1000 | MEMBER-FR SEAT CROSS RR,RH | -20,590 | ₩2,323 | **-₩47,830,870** |
| 69156-DO000 | BULKHEAD-RR TRANSVERSE,LH | -20,831 | ₩1,403 | **-₩29,226,293** |
| 81836-R0600 | BRKT-T/GATE LIFTER,LH | -26,858 | ₩575 | **-₩15,443,350** |
| 81846-R0600 | BRKT-T/GATE LIFTER,RH | -19,350 | ₩575 | **-₩11,126,250** |

**총 추정 손실 (Top 5만)**: 약 **-₩154,508,555** (1억 5천만원)

---

## 🔍 원인 분석

### 가설 1: 재고 거래 데이터 불일치
- Excel `종합재고` 시트와 DB `inventory_transactions` (2,043건) 간 동기화 문제
- 생산/출고 거래가 입고보다 많이 기록됨

### 가설 2: 초기 재고 설정 누락
- 품목 등록 시 `current_stock`을 0으로 초기화
- 실제 보유 재고를 반영하지 않음

### 가설 3: BOM 계산 오류
- 생산 시 BOM 기반 자동 차감이 과다하게 이루어짐
- Phase 3 production_batch (2건) vs 실제 생산량 불일치

### 가설 4: Excel 데이터가 정확한 재고
- Excel `종합재고` 시트에 정확한 실제 재고가 있음
- DB는 단순히 거래만 기록하여 음수 발생

---

## ✅ 해결 방안

### Step 1: Excel 종합재고 데이터 확인 (우선순위 1)
```javascript
// analyze-excel-detailed.js에서 이미 추출한 데이터 확인
// EXCEL_DETAILED_ANALYSIS.json → "2025년 9월 종합관리 SHEET.xlsx" → "종합재고" 시트
```

**확인 사항**:
- Excel에 이 41개 품목의 실제 재고가 양수로 기록되어 있는가?
- Excel 재고와 DB 재고 차이가 얼마나 나는가?

### Step 2: 재고 동기화 스크립트 작성
```sql
-- Option A: Excel 재고를 신뢰 (권장)
UPDATE items
SET current_stock = [Excel에서 읽은 값]
WHERE item_code = '[품목코드]';

-- Option B: 재고 0으로 초기화
UPDATE items
SET current_stock = 0
WHERE current_stock < 0;
```

### Step 3: inventory_transactions 검증
```sql
-- 각 품목별 거래 내역 합계 확인
SELECT
  item_id,
  SUM(CASE WHEN transaction_type = '입고' THEN quantity ELSE 0 END) as total_in,
  SUM(CASE WHEN transaction_type = '생산' THEN quantity ELSE 0 END) as total_production,
  SUM(CASE WHEN transaction_type = '출고' THEN -quantity ELSE 0 END) as total_out,
  SUM(CASE
    WHEN transaction_type = '입고' THEN quantity
    WHEN transaction_type = '생산' THEN quantity
    WHEN transaction_type = '출고' THEN -quantity
    ELSE 0
  END) as calculated_stock
FROM inventory_transactions
WHERE item_id IN (4442, 4498, 4336, ...)  -- 음수 재고 품목들
GROUP BY item_id;
```

### Step 4: 근본 원인 수정
- 입고/생산 거래 누락 건 추가
- 출고 거래 과다 기록 건 수정
- BOM 자동 차감 로직 검증

---

## 📋 다음 액션 아이템

### 즉시 실행 (Critical)
1. ✅ 음수 재고 41개 품목 리스트업 완료
2. ⏳ Excel `종합재고` 시트에서 이 41개 품목의 실제 재고 확인
3. ⏳ Excel 재고 vs DB 재고 차이 분석
4. ⏳ 재고 동기화 방법 결정 (Excel 신뢰 vs 거래 재계산)

### 단기 실행 (1주)
5. ⏳ inventory_transactions 검증 및 누락 거래 식별
6. ⏳ 재고 수정 스크립트 작성 및 실행
7. ⏳ 수정 후 재검증

### 중기 실행 (2주)
8. ⏳ BOM 자동 차감 로직 검증
9. ⏳ 재고 관리 정책 수립 (최소 재고, 안전 재고)
10. ⏳ 재고 모니터링 대시보드 구축

---

## 🎯 권고사항

### 1. Excel 데이터 우선 신뢰
Excel `종합재고` 시트가 실제 물리적 재고를 반영한다고 가정하고, DB를 Excel에 맞춰 동기화하는 것을 권장합니다.

**근거**:
- Excel은 실무에서 사용 중인 실제 재고 대장
- DB는 시스템 구축 후 거래 기록만 입력
- 초기 재고 설정이 누락되었을 가능성 높음

### 2. 단계적 접근
1. **우선**: 음수 → 0 또는 양수로 수정 (업무 연속성)
2. **다음**: 거래 내역 검증 및 누락 건 보완
3. **최종**: 재고 관리 프로세스 정립

### 3. 재발 방지
- 품목 등록 시 초기 재고 필수 입력
- 재고 음수 발생 시 알림 기능
- 월말 재고 실사 및 Excel-DB 동기화 프로세스

---

**분석 완료**: 2025-02-05
**다음 단계**: Excel 종합재고 데이터 추출 및 비교 분석
