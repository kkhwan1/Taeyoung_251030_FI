-- ============================================
-- Migration: Add Inventory Classification
-- Purpose: Support 4 inventory types (완제품/반제품/고객재고/원재료)
-- Author: ERP Team
-- Date: 2025-02-02
-- Estimated Impact: ~1000 existing items will be classified
-- ============================================

-- Step 1: Add new columns to items table
ALTER TABLE items
ADD COLUMN inventory_type TEXT
CHECK (inventory_type IN ('완제품', '반제품', '고객재고', '원재료'));

ALTER TABLE items
ADD COLUMN warehouse_zone TEXT;

ALTER TABLE items
ADD COLUMN quality_status TEXT DEFAULT '검수중'
CHECK (quality_status IN ('검수중', '합격', '불합격', '보류'));

COMMENT ON COLUMN items.inventory_type IS '재고 분류: 완제품/반제품/고객재고/원재료';
COMMENT ON COLUMN items.warehouse_zone IS '보관 구역 (예: A-01, B-03)';
COMMENT ON COLUMN items.quality_status IS '품질 검수 상태';

-- Step 2: Create indexes for performance optimization
CREATE INDEX idx_items_inventory_type ON items(inventory_type)
WHERE is_active = true;

CREATE INDEX idx_items_warehouse_zone ON items(warehouse_zone)
WHERE is_active = true;

CREATE INDEX idx_items_quality_status ON items(quality_status)
WHERE is_active = true;

-- Step 3: Migrate existing data based on product_type mapping
UPDATE items
SET inventory_type = CASE
  WHEN product_type = 'FINISHED' THEN '완제품'
  WHEN product_type = 'SEMI_FINISHED' THEN '반제품'
  WHEN category = 'RAW_MATERIAL' THEN '원재료'
  WHEN category = 'MATERIAL' THEN '원재료'
  ELSE '반제품'  -- Default for uncertain cases
END
WHERE inventory_type IS NULL;

-- Step 4: Make inventory_type NOT NULL after data migration
ALTER TABLE items ALTER COLUMN inventory_type SET NOT NULL;

-- Step 5: Add validation trigger for business rule enforcement
CREATE OR REPLACE FUNCTION validate_inventory_classification()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: Finished goods must have quality status
  IF NEW.inventory_type = '완제품' AND NEW.quality_status IS NULL THEN
    NEW.quality_status := '검수중';
  END IF;

  -- Rule 2: Customer stock must have warehouse zone
  IF NEW.inventory_type = '고객재고' AND NEW.warehouse_zone IS NULL THEN
    RAISE EXCEPTION '고객재고는 보관 구역이 필수입니다';
  END IF;

  -- Rule 3: Quality failed items cannot be in warehouse
  IF NEW.quality_status = '불합격' AND NEW.warehouse_zone IS NOT NULL THEN
    NEW.warehouse_zone := NULL;  -- Auto-clear warehouse zone for failed items
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_inventory_classification
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION validate_inventory_classification();

-- Step 6: Verification query (for manual check after migration)
-- SELECT inventory_type, COUNT(*) as count, SUM(current_stock) as total_stock
-- FROM items
-- WHERE is_active = true
-- GROUP BY inventory_type
-- ORDER BY inventory_type;
