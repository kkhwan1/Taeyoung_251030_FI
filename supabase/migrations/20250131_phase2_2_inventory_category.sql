-- Phase 2-2: 재고 카테고리 확장
-- 생성일: 2025-01-31
-- 목적: 품목 카테고리 확장 및 카테고리별 집계 뷰 생성

-- =====================================================================
-- 1. 카테고리 제약조건 확장
-- =====================================================================

-- 기존 제약조건 제거 후 새로운 제약조건 추가
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_category_check;
ALTER TABLE items ADD CONSTRAINT items_category_check
  CHECK (category IN ('완제품', '반제품', '원자재', '부품', '소모품', '기타'));

COMMENT ON CONSTRAINT items_category_check ON items IS
  '품목 카테고리: 완제품(최종 제품), 반제품(중간 제품), 원자재(Raw Material), 부품(Parts), 소모품(Supplies), 기타(Others)';

-- =====================================================================
-- 2. 기존 NULL 또는 유효하지 않은 값 처리
-- =====================================================================

-- NULL 또는 새 제약조건에 맞지 않는 값을 '기타'로 설정
UPDATE items
SET category = '기타'
WHERE category IS NULL
   OR category NOT IN ('완제품', '반제품', '원자재', '부품', '소모품');

-- 카테고리별 데이터 분포 확인을 위한 임시 쿼리 (주석 처리)
-- SELECT category, COUNT(*) as count FROM items GROUP BY category ORDER BY count DESC;

-- =====================================================================
-- 3. 카테고리별 집계 뷰 생성
-- =====================================================================

CREATE OR REPLACE VIEW v_inventory_by_category AS
SELECT
  category,
  COUNT(*) as item_count,
  SUM(current_stock) as total_stock,
  SUM(current_stock * COALESCE(cost_price, 0)) as total_value
FROM items
WHERE is_active = true
GROUP BY category
ORDER BY category;

COMMENT ON VIEW v_inventory_by_category IS
  '카테고리별 재고 집계 뷰 - 품목 수, 총 재고량, 총 재고 금액';

-- =====================================================================
-- 4. 인덱스 최적화 (카테고리 필터링 성능 향상)
-- =====================================================================

-- 카테고리별 필터링이 빠르도록 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_category_active ON items(category, is_active);

-- =====================================================================
-- 5. 롤백 스크립트 (주석 처리)
-- =====================================================================

/*
-- 롤백 시 아래 명령어를 실행하세요:

DROP VIEW IF EXISTS v_inventory_by_category;

DROP INDEX IF EXISTS idx_items_category_active;
DROP INDEX IF EXISTS idx_items_category;

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_category_check;
ALTER TABLE items ADD CONSTRAINT items_category_check
  CHECK (category IN ('완제품', '반제품', '원자재', '부품'));

-- 카테고리 '소모품'과 '기타'를 '부품'으로 롤백 (필요 시)
-- UPDATE items SET category = '부품' WHERE category IN ('소모품', '기타');
*/
