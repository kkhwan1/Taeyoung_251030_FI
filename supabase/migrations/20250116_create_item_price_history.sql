-- Migration: Phase P3 - 월별 단가 이력 추적 시스템
-- Created: 2025-01-16
-- Purpose: 품목별 월별 단가 이력 저장 + 재고 금액 자동 계산

-- ============================================================
-- 1. 월별 단가 이력 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS item_price_history (
  price_history_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,

  -- 월별 단가 (기준일: 매월 1일)
  price_month DATE NOT NULL,  -- 예: 2025-10-01, 2025-11-01
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),

  -- 중량 기반 단가 (코일 등 중량 단위 품목용)
  price_per_kg DECIMAL(15,2) DEFAULT NULL CHECK (price_per_kg >= 0 OR price_per_kg IS NULL),

  -- 메타데이터
  note TEXT,  -- 단가 변경 사유 (예: "원자재 가격 인상", "환율 변동")
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100),  -- 변경자 (추후 인증 시스템 연동)

  -- 제약 조건: 월별 단가는 한 품목당 한 달에 하나씩만
  UNIQUE(item_id, price_month)
);

-- ============================================================
-- 2. 인덱스: 월별 조회 최적화
-- ============================================================
CREATE INDEX idx_price_history_month ON item_price_history(price_month DESC);
CREATE INDEX idx_price_history_item_month ON item_price_history(item_id, price_month DESC);

-- ============================================================
-- 3. 트리거: updated_at 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION update_item_price_history_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_price_history_timestamp
  BEFORE UPDATE ON item_price_history
  FOR EACH ROW
  EXECUTE FUNCTION update_item_price_history_timestamp();

-- ============================================================
-- 4. PostgreSQL 뷰: 월별 재고 금액 집계 (품목별)
-- ============================================================
CREATE OR REPLACE VIEW v_stock_valuation_monthly AS
SELECT
  DATE_TRUNC('month', CURRENT_DATE) AS valuation_month,
  i.item_id,
  i.item_code,
  i.item_name,
  i.category,
  i.unit,
  i.current_stock,
  c.company_name AS supplier_name,
  c.company_category,

  -- 최신 단가 조회 (해당 월 또는 가장 최근 과거 단가)
  COALESCE(
    (SELECT unit_price
     FROM item_price_history iph
     WHERE iph.item_id = i.item_id
       AND iph.price_month <= DATE_TRUNC('month', CURRENT_DATE)
     ORDER BY iph.price_month DESC
     LIMIT 1),
    i.unit_price  -- 기본값: items 테이블의 unit_price
  ) AS current_unit_price,

  -- 재고 금액 = 현재고 × 단가
  i.current_stock * COALESCE(
    (SELECT unit_price
     FROM item_price_history iph
     WHERE iph.item_id = i.item_id
       AND iph.price_month <= DATE_TRUNC('month', CURRENT_DATE)
     ORDER BY iph.price_month DESC
     LIMIT 1),
    i.unit_price
  ) AS stock_value,

  -- 중량 기반 재고 금액 (해당되는 경우)
  CASE
    WHEN i.unit = 'kg' THEN
      i.current_stock * COALESCE(
        (SELECT price_per_kg
         FROM item_price_history iph
         WHERE iph.item_id = i.item_id
           AND iph.price_month <= DATE_TRUNC('month', CURRENT_DATE)
           AND iph.price_per_kg IS NOT NULL
         ORDER BY iph.price_month DESC
         LIMIT 1),
        0
      )
    ELSE NULL
  END AS stock_value_by_weight

FROM items i
LEFT JOIN companies c ON i.supplier_id = c.company_id
WHERE i.is_active = true AND i.current_stock > 0;

-- ============================================================
-- 5. PostgreSQL 뷰: 카테고리별 재고 금액 집계
-- ============================================================
CREATE OR REPLACE VIEW v_stock_value_by_category AS
SELECT
  DATE_TRUNC('month', CURRENT_DATE) AS valuation_month,

  -- 카테고리 분류 (Excel "정리 보드" 로직 구현)
  CASE
    WHEN c.company_category = '협력업체-원자재' THEN '원자재'
    WHEN c.company_category = '협력업체-외주' THEN '부자재'
    WHEN i.category LIKE '%완제품%' THEN '완제품'
    WHEN i.category LIKE '%반제품%' THEN '공정재고'
    ELSE '기타'
  END AS inventory_category,

  -- 집계 데이터
  COUNT(DISTINCT i.item_id) AS item_count,
  SUM(i.current_stock) AS total_quantity,

  -- 총 재고 금액 (단가 × 수량)
  SUM(
    i.current_stock * COALESCE(
      (SELECT unit_price
       FROM item_price_history iph
       WHERE iph.item_id = i.item_id
         AND iph.price_month <= DATE_TRUNC('month', CURRENT_DATE)
       ORDER BY iph.price_month DESC
       LIMIT 1),
      i.unit_price
    )
  ) AS total_value

FROM items i
LEFT JOIN companies c ON i.supplier_id = c.company_id
WHERE i.is_active = true AND i.current_stock > 0
GROUP BY inventory_category;

-- ============================================================
-- 6. PostgreSQL 뷰: 업체별 재고 금액 집계
-- ============================================================
CREATE OR REPLACE VIEW v_stock_value_by_supplier AS
SELECT
  DATE_TRUNC('month', CURRENT_DATE) AS valuation_month,
  c.company_id,
  c.company_name,
  c.company_category,

  -- 집계 데이터
  COUNT(DISTINCT i.item_id) AS item_count,
  SUM(i.current_stock) AS total_quantity,

  -- 총 재고 금액
  SUM(
    i.current_stock * COALESCE(
      (SELECT unit_price
       FROM item_price_history iph
       WHERE iph.item_id = i.item_id
         AND iph.price_month <= DATE_TRUNC('month', CURRENT_DATE)
       ORDER BY iph.price_month DESC
       LIMIT 1),
      i.unit_price
    )
  ) AS total_value

FROM items i
LEFT JOIN companies c ON i.supplier_id = c.company_id
WHERE i.is_active = true AND i.current_stock > 0
GROUP BY c.company_id, c.company_name, c.company_category;

-- ============================================================
-- 7. Comments (문서화)
-- ============================================================
COMMENT ON TABLE item_price_history IS '품목별 월별 단가 이력 추적 - Phase P3';
COMMENT ON COLUMN item_price_history.price_month IS '단가 적용 기준월 (매월 1일)';
COMMENT ON COLUMN item_price_history.unit_price IS '단위당 단가 (원/개, 원/EA)';
COMMENT ON COLUMN item_price_history.price_per_kg IS '중량 단위 단가 (원/kg) - 코일 등';
COMMENT ON COLUMN item_price_history.note IS '단가 변경 사유';

COMMENT ON VIEW v_stock_valuation_monthly IS '월별 재고 금액 평가 (품목별) - Phase P3';
COMMENT ON VIEW v_stock_value_by_category IS '카테고리별 재고 금액 집계 (원자재/부자재/완제품/공정재고) - Phase P3';
COMMENT ON VIEW v_stock_value_by_supplier IS '업체별 재고 금액 집계 - Phase P3';

-- ============================================================
-- 8. 샘플 데이터 (테스트용)
-- ============================================================
-- 품목이 이미 존재한다고 가정
-- INSERT INTO item_price_history (item_id, price_month, unit_price, note)
-- VALUES
--   (1, '2025-10-01', 1000.00, '초기 단가'),
--   (1, '2025-11-01', 1100.00, '원자재 가격 인상'),
--   (2, '2025-10-01', 500.00, '초기 단가'),
--   (2, '2025-11-01', 550.00, '환율 변동');
