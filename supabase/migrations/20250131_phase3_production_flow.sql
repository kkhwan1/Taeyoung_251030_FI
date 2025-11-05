-- Phase 3: Production Flow Database Schema
-- Created: 2025-01-31
-- Purpose: Enable production batch tracking, process flow, and auto-inventory movement

-- =============================================================================
-- 1. Add product_type column to items table
-- =============================================================================
-- Classifies items as RAW_MATERIAL, SEMI_FINISHED, or FINISHED
-- Enables automatic stock movement logic based on product classification
ALTER TABLE items
ADD COLUMN IF NOT EXISTS product_type VARCHAR(20)
CHECK (product_type IN ('RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED', 'CONSUMABLE'));

-- Add index for filtering by product type
CREATE INDEX IF NOT EXISTS idx_items_product_type ON items(product_type);

-- Add comment for documentation
COMMENT ON COLUMN items.product_type IS '제품 분류: RAW_MATERIAL(원자재), SEMI_FINISHED(반제품), FINISHED(완제품), CONSUMABLE(소모품)';

-- =============================================================================
-- 2. Create production_batch table
-- =============================================================================
-- Tracks production batches with batch number, date, and notes
-- Similar pattern to inventory_transactions but for production grouping
CREATE TABLE IF NOT EXISTS production_batch (
  batch_id SERIAL PRIMARY KEY,
  batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_production_batch_date ON production_batch(batch_date DESC);
CREATE INDEX IF NOT EXISTS idx_production_batch_number ON production_batch(batch_number);
CREATE INDEX IF NOT EXISTS idx_production_batch_status ON production_batch(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_production_batch_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_production_batch_timestamp_trigger
BEFORE UPDATE ON production_batch
FOR EACH ROW
EXECUTE FUNCTION update_production_batch_timestamp();

-- Comments
COMMENT ON TABLE production_batch IS '생산 배치 마스터 테이블';
COMMENT ON COLUMN production_batch.batch_number IS '생산 배치 번호 (PROD-YYYYMMDD-001 형식)';
COMMENT ON COLUMN production_batch.status IS '배치 상태: IN_PROGRESS(진행중), COMPLETED(완료), CANCELLED(취소)';

-- =============================================================================
-- 3. Create production_batch_items table (Multi-item support)
-- =============================================================================
-- Reuses invoice_items pattern for multi-item production batches
-- Each batch can have multiple input/output items
CREATE TABLE IF NOT EXISTS production_batch_items (
  batch_item_id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES production_batch(batch_id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('INPUT', 'OUTPUT')),
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  defect_quantity DECIMAL(10,2) DEFAULT 0 CHECK (defect_quantity >= 0),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_production_batch_items_batch_id ON production_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_production_batch_items_item_id ON production_batch_items(item_id);
CREATE INDEX IF NOT EXISTS idx_production_batch_items_type ON production_batch_items(item_type);

-- Comments
COMMENT ON TABLE production_batch_items IS '생산 배치 품목 상세 (입력/출력 품목)';
COMMENT ON COLUMN production_batch_items.item_type IS '품목 유형: INPUT(투입), OUTPUT(산출)';
COMMENT ON COLUMN production_batch_items.defect_quantity IS '불량 수량';

-- =============================================================================
-- 4. Create process_flow table
-- =============================================================================
-- Tracks production process flow between batches
-- Enables traceability from raw materials to finished goods
CREATE TABLE IF NOT EXISTS process_flow (
  flow_id SERIAL PRIMARY KEY,
  source_batch_id INTEGER REFERENCES production_batch(batch_id) ON DELETE SET NULL,
  target_batch_id INTEGER REFERENCES production_batch(batch_id) ON DELETE SET NULL,
  flow_type VARCHAR(20) NOT NULL CHECK (flow_type IN ('DIRECT', 'INTERMEDIATE', 'REWORK')),
  flow_date TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_process_flow_source ON process_flow(source_batch_id);
CREATE INDEX IF NOT EXISTS idx_process_flow_target ON process_flow(target_batch_id);
CREATE INDEX IF NOT EXISTS idx_process_flow_date ON process_flow(flow_date DESC);

-- Comments
COMMENT ON TABLE process_flow IS '생산 공정 흐름 추적';
COMMENT ON COLUMN process_flow.flow_type IS '흐름 유형: DIRECT(직접), INTERMEDIATE(중간), REWORK(재작업)';

-- =============================================================================
-- 5. Create auto_production_stock_movement trigger function
-- =============================================================================
-- Automatically updates inventory when production batch is completed
-- - Deducts INPUT items from stock (raw materials/semi-finished)
-- - Adds OUTPUT items to stock (finished goods/semi-finished)
-- Reuses inventory_transactions table for audit trail
CREATE OR REPLACE FUNCTION auto_production_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_transaction_no VARCHAR(50);
BEGIN
  -- Only trigger when batch status changes to COMPLETED
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN

    -- Generate transaction number for this batch
    v_transaction_no := 'PROD-' || TO_CHAR(NEW.batch_date, 'YYYYMMDD') || '-' || LPAD(NEW.batch_id::TEXT, 4, '0');

    -- Process all batch items
    FOR v_item IN
      SELECT * FROM production_batch_items
      WHERE batch_id = NEW.batch_id
    LOOP
      IF v_item.item_type = 'INPUT' THEN
        -- Deduct input materials (negative quantity)
        INSERT INTO inventory_transactions (
          transaction_date,
          transaction_no,
          transaction_type,
          item_id,
          quantity,
          unit_price,
          total_amount,
          notes,
          is_active
        ) VALUES (
          NEW.batch_date,
          v_transaction_no || '-IN',
          'PRODUCTION_INPUT',
          v_item.item_id,
          -v_item.quantity,  -- Negative for deduction
          v_item.unit_price,
          -v_item.total_amount,
          '생산 배치 ' || NEW.batch_number || ' 투입',
          TRUE
        );

      ELSIF v_item.item_type = 'OUTPUT' THEN
        -- Add output products (positive quantity)
        INSERT INTO inventory_transactions (
          transaction_date,
          transaction_no,
          transaction_type,
          item_id,
          quantity,
          unit_price,
          total_amount,
          notes,
          is_active
        ) VALUES (
          NEW.batch_date,
          v_transaction_no || '-OUT',
          'PRODUCTION_OUTPUT',
          v_item.item_id,
          v_item.quantity - v_item.defect_quantity,  -- Subtract defects
          v_item.unit_price,
          (v_item.quantity - v_item.defect_quantity) * v_item.unit_price,
          '생산 배치 ' || NEW.batch_number || ' 산출',
          TRUE
        );

        -- If there are defects, record them separately
        IF v_item.defect_quantity > 0 THEN
          INSERT INTO inventory_transactions (
            transaction_date,
            transaction_no,
            transaction_type,
            item_id,
            quantity,
            unit_price,
            total_amount,
            notes,
            is_active
          ) VALUES (
            NEW.batch_date,
            v_transaction_no || '-DEFECT',
            'PRODUCTION_DEFECT',
            v_item.item_id,
            -v_item.defect_quantity,  -- Negative for defects
            v_item.unit_price,
            -v_item.defect_quantity * v_item.unit_price,
            '생산 배치 ' || NEW.batch_number || ' 불량',
            TRUE
          );
        END IF;
      END IF;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to production_batch table
DROP TRIGGER IF EXISTS auto_production_stock_movement_trigger ON production_batch;
CREATE TRIGGER auto_production_stock_movement_trigger
AFTER INSERT OR UPDATE ON production_batch
FOR EACH ROW
EXECUTE FUNCTION auto_production_stock_movement();

COMMENT ON FUNCTION auto_production_stock_movement() IS '생산 배치 완료 시 자동 재고 이동 처리';

-- =============================================================================
-- 6. Add new transaction types to inventory_transactions (if not exists)
-- =============================================================================
-- Extend transaction_type check constraint to include production types
-- Note: This assumes transaction_type column exists with CHECK constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

  -- Add updated constraint with production types
  ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'IN',                    -- 입고
    'OUT',                   -- 출고
    'PRODUCTION',            -- 생산
    'ADJUSTMENT',            -- 조정
    'TRANSFER',              -- 이동
    'RETURN',                -- 반품
    'PRODUCTION_INPUT',      -- 생산 투입 (Phase 3)
    'PRODUCTION_OUTPUT',     -- 생산 산출 (Phase 3)
    'PRODUCTION_DEFECT'      -- 생산 불량 (Phase 3)
  ));
END $$;

-- =============================================================================
-- 7. Sample data for testing (Optional - Comment out for production)
-- =============================================================================
-- Uncomment to insert sample production batch for testing

/*
-- Insert sample batch
INSERT INTO production_batch (batch_date, batch_number, status, notes)
VALUES (CURRENT_DATE, 'PROD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001', 'IN_PROGRESS', '샘플 생산 배치');

-- Get the inserted batch_id
DO $$
DECLARE
  v_batch_id INTEGER;
  v_raw_material_id INTEGER;
  v_finished_good_id INTEGER;
BEGIN
  SELECT batch_id INTO v_batch_id FROM production_batch WHERE batch_number LIKE 'PROD-%001' ORDER BY batch_id DESC LIMIT 1;

  -- Assuming items exist with product_type set
  SELECT item_id INTO v_raw_material_id FROM items WHERE product_type = 'RAW_MATERIAL' AND is_active = TRUE LIMIT 1;
  SELECT item_id INTO v_finished_good_id FROM items WHERE product_type = 'FINISHED' AND is_active = TRUE LIMIT 1;

  IF v_raw_material_id IS NOT NULL AND v_finished_good_id IS NOT NULL THEN
    -- Add input item (raw material)
    INSERT INTO production_batch_items (batch_id, item_id, item_type, quantity, unit_price)
    VALUES (v_batch_id, v_raw_material_id, 'INPUT', 100, 500);

    -- Add output item (finished good)
    INSERT INTO production_batch_items (batch_id, item_id, item_type, quantity, unit_price, defect_quantity)
    VALUES (v_batch_id, v_finished_good_id, 'OUTPUT', 95, 1000, 5);
  END IF;
END $$;
*/

-- =============================================================================
-- Migration Complete
-- =============================================================================
-- This migration adds:
-- 1. product_type column to items (RAW_MATERIAL, SEMI_FINISHED, FINISHED, CONSUMABLE)
-- 2. production_batch table with status tracking
-- 3. production_batch_items table (multi-item support, reuses invoice pattern)
-- 4. process_flow table for production traceability
-- 5. auto_production_stock_movement trigger for automatic inventory updates
-- 6. Extended transaction types for production (INPUT, OUTPUT, DEFECT)
--
-- Next steps:
-- 1. Update items table with product_type values
-- 2. Create batch registration API (/api/batch-registration)
-- 3. Create batch registration UI component
-- 4. Test end-to-end production flow
-- =============================================================================
