# BOM Schema Enhancement Proposal

생성일시: 2025-01-30
목적: Excel BOM 파일의 제조 원가 데이터를 데이터베이스 및 웹 UI에 통합

## 📋 Executive Summary

**현황**: Excel BOM 파일에는 품목별 상세한 제조 원가 계산 필드가 포함되어 있으나, 현재 데이터베이스에는 일부만 존재
**목표**: 제조 원가 분석을 위한 필수 필드를 데이터베이스에 추가하고 웹 UI에서 표시
**영향**: 6개 시트, 총 900+ 레코드, 상세한 재질/치수/스크랩 원가 데이터

## 🔍 Excel BOM 파일 분석 결과

### 파일 구조
- **파일명**: `.example/태창금속 BOM.xlsx`
- **총 시트**: 6개 (대우공업 137행, 풍기산업 163행, 다인 108행, 호원오토 225행, 인알파코리아 146행, 최신단가 243행)
- **헤더 위치**: 5행 (0-based: row 5)
- **총 컬럼**: 31개 (시트별 동일 구조)

### 주요 필드 구조

#### 1. 기본 품목 정보 (이미 DB에 존재)
- ✅ `품번` (item_code) → items.item_code
- ✅ `품명` (item_name) → items.item_name
- ✅ `단가` (unit_price) → items.price

#### 2. 재질 및 치수 정보 (부분적으로 존재)
| Excel 필드 | 데이터 타입 | DB 컬럼 | 상태 | 비고 |
|-----------|-----------|---------|------|------|
| 재질 | TEXT | items.material | ✅ 존재 | 예: SGARC340, SGAFC590, SPCC |
| 두께 (mm) | DECIMAL | items.thickness | ✅ 존재 | 예: 1.2, 0.75, 0.8 |
| 폭 (mm) | DECIMAL | items.width | ✅ 존재 | 예: 1300, 675, 1040 |
| 길이 (mm) | DECIMAL | items.height | ✅ 존재 | **주의**: Excel은 "길이", DB는 "height" |

#### 3. 중량 계산 관련 (부분적으로 존재)
| Excel 필드 | 데이터 타입 | DB 컬럼 | 상태 | 비고 |
|-----------|-----------|---------|------|------|
| SEP | INTEGER | - | ❌ 없음 | Separator 개수 |
| 비중 | DECIMAL | items.specific_gravity | ✅ 존재 | 기본값: 7.85 |
| EA중량 (kg) | DECIMAL | items.mm_weight | ✅ 존재 | **주의**: 필드명 불일치 |

#### 4. 생산 및 실적 정보 (없음)
| Excel 필드 | 데이터 타입 | DB 컬럼 | 상태 | 필요성 |
|-----------|-----------|---------|------|--------|
| 실적수량 (개) | INTEGER | - | ❌ 없음 | 🔴 매우 중요 |
| 스크랩중량 (kg) | DECIMAL | - | ❌ 없음 | 🔴 매우 중요 |
| 스크랩 단가 (₩/kg) | DECIMAL | items.scrap_unit_price | ✅ 존재 | |
| 스크랩금액 (₩) | DECIMAL | - | ❌ 없음 | 🟡 계산 가능 |

#### 5. 원가 계산 정보 (부분적으로 존재)
| Excel 필드 | 데이터 타입 | DB 컬럼 | 상태 | 비고 |
|-----------|-----------|---------|------|------|
| KG단가 (₩/kg) | DECIMAL | - | ❌ 없음 | 🔴 매우 중요 |
| 단품단가 (₩/개) | DECIMAL | items.price | ✅ 존재 | |

## 📊 현재 Database Schema

### items 테이블 (33개 컬럼)

**✅ 이미 존재하는 관련 필드:**
- `material` (character varying 100) - 재질
- `thickness` (numeric) - 두께
- `width` (numeric) - 폭
- `height` (numeric) - **길이** (필드명 주의!)
- `specific_gravity` (numeric, default 7.85) - 비중
- `mm_weight` (numeric) - **EA중량** (필드명 주의!)
- `scrap_unit_price` (numeric, default 0) - 스크랩 단가
- `scrap_rate` (numeric, default 0) - 스크랩율 (추가 필드)
- `yield_rate` (numeric, default 100) - 수율 (추가 필드)

**❌ 누락된 중요 필드:**
1. `sep` - Separator 개수
2. `actual_quantity` - 실적수량
3. `scrap_weight` - 스크랩중량
4. `scrap_amount` - 스크랩금액 (계산 가능하지만 저장 권장)
5. `kg_unit_price` - KG단가

### bom 테이블 (12개 컬럼)

**현재 구조:**
- `bom_id` (PK)
- `parent_item_id` (FK → items)
- `child_item_id` (FK → items)
- `quantity_required` (numeric) - 소요량
- `level_no` (integer) - BOM 레벨
- `labor_cost` (numeric) - 인건비
- `machine_time` (numeric) - 기계 시간
- `setup_time` (numeric) - 준비 시간
- `notes` (text) - 비고

**BOM 테이블의 역할:**
- 제품(parent) - 부품(child) 관계 정의
- 제조 원가는 items 테이블에 저장하는 것이 적절

## 🎯 권장 Schema 변경

### Option A: items 테이블에 필드 추가 (추천)

**장점:**
- 품목 마스터 데이터와 함께 관리
- 조회 성능 우수 (JOIN 불필요)
- 기존 구조와 일관성 유지

**추가할 필드:**
```sql
-- 1. SEP (Separator 개수)
ALTER TABLE items ADD COLUMN sep INTEGER DEFAULT 1;
COMMENT ON COLUMN items.sep IS 'Separator 개수 (제조 시 필요한 구분자 수)';

-- 2. 실적수량 (생산 실적)
ALTER TABLE items ADD COLUMN actual_quantity INTEGER DEFAULT 0;
COMMENT ON COLUMN items.actual_quantity IS '실적수량 (월별 생산 실적, 개)';

-- 3. 스크랩중량 (단위당)
ALTER TABLE items ADD COLUMN scrap_weight NUMERIC(10,4) DEFAULT 0;
COMMENT ON COLUMN items.scrap_weight IS '단위당 스크랩중량 (kg/개)';

-- 4. 스크랩금액 (총액)
ALTER TABLE items ADD COLUMN scrap_amount NUMERIC(15,2) DEFAULT 0;
COMMENT ON COLUMN items.scrap_amount IS '스크랩금액 (실적수량 * 스크랩중량 * 스크랩단가, ₩)';

-- 5. KG단가 (재료비)
ALTER TABLE items ADD COLUMN kg_unit_price NUMERIC(10,2) DEFAULT 0;
COMMENT ON COLUMN items.kg_unit_price IS 'KG단가 (재료비, ₩/kg)';
```

**필드명 표준화 (선택사항):**
```sql
-- height → length 로 변경 (더 직관적)
ALTER TABLE items RENAME COLUMN height TO length;
COMMENT ON COLUMN items.length IS '길이 (mm)';

-- mm_weight → ea_weight 로 변경 (더 명확)
ALTER TABLE items RENAME COLUMN mm_weight TO ea_weight;
COMMENT ON COLUMN items.ea_weight IS 'EA중량 (개당 중량, kg/개)';
```

### Option B: 별도 manufacturing_cost 테이블 생성

**장점:**
- 이력 관리 용이 (월별 원가 변동 추적)
- items 테이블 복잡도 낮춤

**단점:**
- 조회 시 항상 JOIN 필요
- 복잡도 증가

**구조 예시:**
```sql
CREATE TABLE manufacturing_cost (
  cost_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id),

  -- 재질/치수 (items 테이블과 중복이지만 이력 관리용)
  material VARCHAR(100),
  thickness NUMERIC(10,3),
  width NUMERIC(10,2),
  length NUMERIC(10,2),

  -- 중량 계산
  sep INTEGER DEFAULT 1,
  specific_gravity NUMERIC(5,2) DEFAULT 7.85,
  ea_weight NUMERIC(10,4),

  -- 생산 실적
  actual_quantity INTEGER DEFAULT 0,

  -- 스크랩 원가
  scrap_weight NUMERIC(10,4) DEFAULT 0,
  scrap_unit_price NUMERIC(10,2) DEFAULT 0,
  scrap_amount NUMERIC(15,2) DEFAULT 0,

  -- 재료 원가
  kg_unit_price NUMERIC(10,2) DEFAULT 0,
  unit_price NUMERIC(10,2) DEFAULT 0,

  -- 기준 시점
  cost_date DATE NOT NULL DEFAULT CURRENT_DATE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_manufacturing_cost_item ON manufacturing_cost(item_id);
CREATE INDEX idx_manufacturing_cost_date ON manufacturing_cost(cost_date);
```

## 💡 최종 권장사항

### Phase 1: items 테이블 확장 (즉시 실행 가능)

**이유:**
- 기존 코드 영향 최소화
- 간단한 마이그레이션
- 즉시 웹 UI에 표시 가능

**실행 순서:**
1. ✅ **Migration Script 작성**: 5개 컬럼 추가
2. ✅ **Excel Import Script 작성**: BOM 파일 → items 테이블
3. ✅ **Web UI 수정**: 품목 상세 페이지에 제조 원가 섹션 추가
4. ✅ **Validation**: 데이터 정합성 검증

### Phase 2: 이력 관리 (향후 고려)

필요 시 manufacturing_cost 테이블 추가하여 월별 원가 변동 추적

## 📈 예상 효과

### 데이터 분석 개선
- ✅ 품목별 상세 제조 원가 계산 가능
- ✅ 재료비 분석 (재질 × 치수 × 비중 × KG단가)
- ✅ 스크랩 손실 분석 (스크랩중량 × 스크랩단가)
- ✅ 실적 기반 원가 추적

### 업무 효율성
- ✅ Excel 파일 참조 불필요
- ✅ 웹에서 실시간 원가 조회
- ✅ 자동 원가 계산 (EA중량 = 재질 × 치수 × 비중)

### 확장성
- ✅ 향후 ERP 고도화 기반 마련
- ✅ MES (Manufacturing Execution System) 연동 준비

## 🚀 Next Steps

1. **Migration Script 작성** (우선순위: 🔴 높음)
   - `scripts/migration/add-manufacturing-cost-fields.ts`
   - ALTER TABLE 문 5개 실행

2. **Excel Import Script 작성** (우선순위: 🔴 높음)
   - `scripts/migration/import-bom-manufacturing-data.ts`
   - 6개 시트 × 900+ 레코드 임포트

3. **Web UI 개선** (우선순위: 🟡 중간)
   - `src/app/master/items/[id]/page.tsx` 수정
   - "제조 원가" 섹션 추가

4. **API Enhancement** (우선순위: 🟡 중간)
   - `src/app/api/items/route.ts` 수정
   - 새 필드 포함하여 응답

5. **Documentation** (우선순위: 🟢 낮음)
   - API 문서 업데이트
   - 사용자 가이드 작성

---

**작성자**: Claude (SuperClaude Framework)
**승인 대기**: 프로젝트 담당자
