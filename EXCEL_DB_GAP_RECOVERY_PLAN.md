# Excel vs DB 데이터 누락 복구 계획

**분석 완료**: 2025. 10. 31. 오전 8:31:30
**분석 대상**: 4개 Excel 파일 → Supabase DB
**누락 규모**: 3,821건 (78.91%)

---

## 🔍 주요 발견사항

### 1. 심각한 데이터 누락
- **Excel 총 레코드**: 4,842건
- **DB 실제 저장**: 1,021건
- **누락**: 3,821건 (78.91%)

### 2. 완전히 비어있는 테이블
| 테이블 | 상태 | Excel 예상 | 영향 |
|--------|------|------------|------|
| `price_master` | ❌ 0건 | 243건 | **단가 정보 전체 누락** |
| `inventory_transactions` | ❌ 0건 | 1,800건+ | **재고 거래 전체 누락** |
| `inbound_transactions` | ❌ 0건 | 532건+ | **입고 거래 전체 누락** |
| `outbound_transactions` | ❌ 0건 | 385건+ | **출고 거래 전체 누락** |
| `production_transactions` | ❌ 0건 | 87건+ | **생산 거래 전체 누락** |

### 3. 부분 누락 테이블
| 테이블 | DB 저장 | Excel 예상 | 누락 | 누락률 |
|--------|---------|------------|------|--------|
| `companies` | 61건 | 75건 | 14건 | 18.67% |
| `bom` | 138건 | 591건+ | 453건+ | 76.64% |
| `sales_transactions` | 51건 | 530건+ | 479건+ | 90.38% |
| `purchase_transactions` | 40건 | 176건+ | 136건+ | 77.27% |

---

## 🎯 누락 원인 분석

### 원인 1: 시트 구조 자동 인식 실패 ⚠️

**문제**: 대부분의 시트가 `unknown` 테이블로 분류됨

**영향을 받은 시트**:
```
태창금속 BOM.xlsx:
  - 대우공업 (140건)       → unknown ❌
  - 풍기산업 (55건)        → unknown ❌
  - 다인 (20건)           → unknown ❌
  - 호원오토 (227건)       → unknown ❌
  - 인알파코리아 (149건)    → unknown ❌
  - 최신단가 (243건)       → unknown ❌  ← price_master 누락!

2025년 9월 매입매출 보고현황.xlsx:
  - 정리 (242건)          → unknown ❌
  - 태창금속 (80건)        → unknown ❌
  - 협력사 (110건)         → unknown ❌
  - 매입부자재(구매) (176건) → unknown ❌
  - 납품수량(영업) (385건)  → unknown ❌  ← 출고 누락!
  - 종합 일일매출 보고용 (530건) → unknown ❌  ← 매출 누락!

2025년 9월 종합관리 SHEET.xlsx:
  - 종합재고 (68건)        → unknown ❌
  - COIL 입고현황 (266건)  → unknown ❌  ← 입고 누락!
  - SHEET 입고현황 (266건) → unknown ❌  ← 입고 누락!
  - 생산실적 (87건)        → unknown ❌  ← 생산 누락!

09월 원자재 수불관리.xlsx:
  - 21개 시트 전부        → unknown ❌  ← 재고 거래 누락!
```

**근본 원인**:
- 기존 임포트 스크립트가 특정 시트명만 인식 (예: "입고", "출고", "BOM")
- 실제 시트명과 불일치 (예: "COIL 입고현황", "납품수량(영업)", "종합 일일매출 보고용")
- 헤더 기반 자동 인식 로직 부재

### 원인 2: 외래키 제약 조건 위반

**문제**: 존재하지 않는 품목/회사 코드 참조

**예상 영향**:
- BOM 매핑 실패 (~400건)
- 재고 거래 매핑 실패 (~1,800건)

**기존 리포트 증거** (MISSING_ITEM_RESOLUTION.md):
```
invalid P/NO: 37개
unknown supplier codes: 14개
```

### 원인 3: 데이터 품질 필터링

**문제**: 유효성 검증 실패로 스킵

**기존 리포트 증거** (INVALID_PNO_ANALYSIS_REPORT.md):
```
zero quantity records skipped: 108개
```

---

## 📋 복구 계획

### Phase 1: 긴급 복구 (최우선) 🔴

#### 1.1. price_master 테이블 채우기
**대상**: 태창금속 BOM.xlsx > 최신단가 시트 (243건)

**작업**:
```bash
# 스크립트 생성
node scripts/migration/import-price-master.js

# 예상 결과
- 243개 단가 레코드 추가
- 품목별 최신 단가 정보 복구
```

#### 1.2. 입고 거래 복구
**대상**:
- 2025년 9월 종합관리 SHEET.xlsx > COIL 입고현황 (266건)
- 2025년 9월 종합관리 SHEET.xlsx > SHEET 입고현황 (266건)
- 09월 원자재 수불관리.xlsx > 대우사급 입고현황 (30건)
- 09월 원자재 수불관리.xlsx > 호원사급 입고현황 (69건)
- 09월 원자재 수불관리.xlsx > 협력업체 입고현황 (110건)

**작업**:
```bash
# 입고 전용 임포트 스크립트 생성
node scripts/migration/import-inbound-transactions.js

# 예상 결과
- 741개 입고 거래 추가
- inbound_transactions 테이블 채워짐
```

#### 1.3. 출고 거래 복구
**대상**:
- 2025년 9월 매입매출 보고현황.xlsx > 납품수량(영업) (385건)

**작업**:
```bash
# 출고 전용 임포트 스크립트 생성
node scripts/migration/import-outbound-transactions.js

# 예상 결과
- 385개 출고 거래 추가
- outbound_transactions 테이블 채워짐
```

### Phase 2: 중요 복구 (우선순위 중) 🟡

#### 2.1. 매출 거래 복구
**대상**:
- 2025년 9월 매입매출 보고현황.xlsx > 종합 일일매출 보고용 (530건)

**작업**:
```bash
node scripts/migration/import-sales-transactions.js

# 예상 결과
- 479개 매출 거래 추가 (현재 51건 → 530건)
- 매출 데이터 완성도 90% 향상
```

#### 2.2. 매입 거래 복구
**대상**:
- 2025년 9월 매입매출 보고현황.xlsx > 매입부자재(구매) (176건)

**작업**:
```bash
node scripts/migration/import-purchase-transactions.js

# 예상 결과
- 136개 매입 거래 추가 (현재 40건 → 176건)
- 매입 데이터 완성도 77% 향상
```

#### 2.3. BOM 관계 복구
**대상**:
- 태창금속 BOM.xlsx > 대우공업 (140건)
- 태창금속 BOM.xlsx > 호원오토 (227건)
- 태창금속 BOM.xlsx > 인알파코리아 (149건)

**작업**:
```bash
# 누락된 품목 코드 먼저 추가
node scripts/migration/add-missing-items-for-bom.js

# BOM 재임포트
node scripts/migration/reimport-bom-relationships.js

# 예상 결과
- 453개 BOM 관계 추가 (현재 138건 → 591건)
- BOM 완성도 76% 향상
```

### Phase 3: 기타 복구 (우선순위 낮음) 🟢

#### 3.1. 생산 거래 복구
**대상**:
- 2025년 9월 종합관리 SHEET.xlsx > 생산실적 (87건)

#### 3.2. 회사 정보 보완
**대상**:
- 2025년 9월 매입매출 보고현황.xlsx > 협력사 (110건)

---

## 🛠️ 실행 가이드

### 스텝 1: 누락 품목/회사 선행 추가

```bash
# 1. Excel에서 누락된 품목 코드 추출
node scripts/analysis/extract-missing-item-codes.js

# 2. 누락된 품목 일괄 추가
node scripts/migration/add-missing-items.ts

# 3. 누락된 회사 일괄 추가
node scripts/migration/add-missing-companies.ts
```

### 스텝 2: Phase 1 긴급 복구 실행

```bash
# 단가 복구
node scripts/migration/import-price-master.js

# 입고 복구
node scripts/migration/import-inbound-transactions.js

# 출고 복구
node scripts/migration/import-outbound-transactions.js
```

### 스텝 3: 검증

```bash
# 복구 후 재분석
node scripts/analyze-excel-vs-db-gap.js

# 예상 결과
Before:
  - Excel: 4,842건
  - DB: 1,021건
  - 누락: 3,821건 (78.91%)

After (Phase 1 완료):
  - Excel: 4,842건
  - DB: 2,390건 (1,021 + 1,369)
  - 누락: 2,452건 (50.64%)
```

---

## 📊 예상 효과

### Phase 1 완료 시
| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| price_master | 0건 | 243건 | ✅ 100% |
| inbound_transactions | 0건 | 741건 | ✅ 100% |
| outbound_transactions | 0건 | 385건 | ✅ 100% |
| **전체 누락률** | **78.91%** | **50.64%** | **✅ 28.27%p 개선** |

### Phase 1+2 완료 시
| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| sales_transactions | 51건 | 530건 | ✅ 90.38% |
| purchase_transactions | 40건 | 176건 | ✅ 77.27% |
| bom | 138건 | 591건 | ✅ 76.64% |
| **전체 누락률** | **78.91%** | **25.12%** | **✅ 53.79%p 개선** |

### Phase 1+2+3 완료 시
- **전체 누락률**: 78.91% → **15% 이하** (✅ **63.91%p 개선**)
- **데이터 완성도**: 21.09% → **85% 이상**

---

## ⚠️ 주의사항

### 1. 외래키 제약 조건
- 품목/회사 코드가 먼저 존재해야 함
- 순서: items → companies → transactions

### 2. 중복 데이터 처리
- 기존 임포트 스크립트는 중복 제거 로직 포함
- 재실행 시 중복 체크 필요

### 3. 한글 인코딩
- 모든 임포트 스크립트는 UTF-8 인코딩 사용
- `request.text() + JSON.parse()` 패턴 적용 필수

### 4. 데이터 품질
- 0 수량 거래는 스킵 (비즈니스 로직)
- Invalid P/NO는 별도 처리 필요

---

## 📝 다음 단계

1. **Phase 1 스크립트 생성** (긴급)
   - [ ] import-price-master.js
   - [ ] import-inbound-transactions.js
   - [ ] import-outbound-transactions.js

2. **Phase 2 스크립트 생성** (중요)
   - [ ] import-sales-transactions.js
   - [ ] import-purchase-transactions.js
   - [ ] reimport-bom-relationships.js

3. **검증 및 모니터링**
   - [ ] 복구 후 재분석
   - [ ] 웹 화면에서 데이터 확인
   - [ ] 누락 데이터 최종 검증

---

**분석 완료 시간**: 2025. 10. 31. 오전 8:31:30
**예상 복구 시간**: Phase 1 (2시간) + Phase 2 (3시간) = **총 5시간**
