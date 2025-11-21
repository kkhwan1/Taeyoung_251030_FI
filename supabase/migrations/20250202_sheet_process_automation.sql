-- File: supabase/migrations/20250202_sheet_process_automation.sql
-- ============================================
-- Migration: Sheet Process Automation
-- Purpose: Auto-create inventory transactions when sheet is processed into subsidiary materials
-- Related: Phone conversation requirement - Sheet pressing → subsidiary inventory update
-- Author: ERP Team
-- Date: 2025-02-02
-- ============================================

-- Step 1: Create sheet_process_history table for tracking sheet → subsidiary conversions
CREATE TABLE IF NOT EXISTS sheet_process_history (
  process_id SERIAL PRIMARY KEY,
  source_item_id INTEGER NOT NULL REFERENCES items(item_id),
  process_type TEXT NOT NULL CHECK (process_type IN ('절단', '프레스', '성형', '조립')),
  target_item_id INTEGER NOT NULL REFERENCES items(item_id),
  input_quantity NUMERIC(10,2) NOT NULL CHECK (input_quantity > 0),
  output_quantity NUMERIC(10,2) NOT NULL CHECK (output_quantity > 0),
  yield_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN input_quantity > 0 THEN ROUND((output_quantity / input_quantity) * 100, 2)
      ELSE 0
    END
  ) STORED,
  process_date DATE NOT NULL DEFAULT CURRENT_DATE,
  operator_id INTEGER REFERENCES users(user_id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add table and column comments
COMMENT ON TABLE sheet_process_history IS '판재(Sheet) 가공 공정 이력 - 판재를 부자재로 변환하는 과정 추적';
COMMENT ON COLUMN sheet_process_history.process_id IS '판재 공정 이력 고유 ID';
COMMENT ON COLUMN sheet_process_history.source_item_id IS '투입된 판재 자재 ID (반제품 판재)';
COMMENT ON COLUMN sheet_process_history.process_type IS '가공 공정 유형 (절단/프레스/성형/조립)';
COMMENT ON COLUMN sheet_process_history.target_item_id IS '공정 결과물 부자재 ID';
COMMENT ON COLUMN sheet_process_history.input_quantity IS '투입된 판재 수량';
COMMENT ON COLUMN sheet_process_history.output_quantity IS '산출된 부자재 수량';
COMMENT ON COLUMN sheet_process_history.yield_rate IS '투입 대비 산출 효율(%) 자동 계산';
COMMENT ON COLUMN sheet_process_history.process_date IS '공정 수행 날짜';
COMMENT ON COLUMN sheet_process_history.operator_id IS '공정 담당 작업자';
COMMENT ON COLUMN sheet_process_history.notes IS '작업 특이사항 및 비고';
COMMENT ON COLUMN sheet_process_history.status IS '공정 진행 상태';

-- Step 2: Create indexes for performance
CREATE INDEX idx_sheet_process_source ON sheet_process_history (source_item_id);
CREATE INDEX idx_sheet_process_target ON sheet_process_history (target_item_id);
CREATE INDEX idx_sheet_process_date ON sheet_process_history (process_date DESC);
CREATE INDEX idx_sheet_process_status ON sheet_process_history (status) WHERE status != 'CANCELLED';

-- Step 3: Create validation trigger to ensure source is sheet material
CREATE OR REPLACE FUNCTION enforce_sheet_source_inventory_type()
RETURNS TRIGGER AS $$
DECLARE
  v_inventory_type TEXT;
  v_item_name TEXT;
BEGIN
  -- Get inventory type and item name of source material
  SELECT i.inventory_type, i.item_name
  INTO v_inventory_type, v_item_name
  FROM items i
  WHERE i.item_id = NEW.source_item_id;

  IF v_inventory_type IS NULL THEN
    RAISE EXCEPTION '소스 자재(ID=%)를 찾을 수 없습니다.', NEW.source_item_id;
  END IF;

  -- Allow both '반제품' (semi-finished) and items with '판재' in name
  IF v_inventory_type != '반제품' AND v_item_name NOT ILIKE '%판재%' THEN
    RAISE EXCEPTION '소스 자재(ID=%)는 판재가 아닙니다. (현재 유형: %, 이름: %)',
      NEW.source_item_id, v_inventory_type, v_item_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the validation trigger
DROP TRIGGER IF EXISTS enforce_sheet_process_source_type ON sheet_process_history;

CREATE TRIGGER enforce_sheet_process_source_type
  BEFORE INSERT OR UPDATE OF source_item_id
  ON sheet_process_history
  FOR EACH ROW
  EXECUTE FUNCTION enforce_sheet_source_inventory_type();

-- Step 4: Create the main automation function for stock movement
CREATE OR REPLACE FUNCTION auto_sheet_process_stock_movement()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path TO public
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_date DATE;
  v_transaction_number TEXT;
  v_source_stock NUMERIC(10,2);
BEGIN
  -- Only process when status changes to COMPLETED
  IF NEW.status <> 'COMPLETED' OR COALESCE(OLD.status, '') = 'COMPLETED' THEN
    RETURN NEW;
  END IF;

  -- Prevent duplicate transactions by checking exact reference number
  v_transaction_number := 'SHEET-' || to_char(COALESCE(NEW.process_date, CURRENT_DATE), 'YYYYMMDD') || '-' || NEW.process_id;

  IF EXISTS (
    SELECT 1
    FROM inventory_transactions it
    WHERE it.reference_number = v_transaction_number
  ) THEN
    RETURN NEW;
  END IF;

  -- Set transaction date and generate unique transaction number
  v_transaction_date := COALESCE(NEW.process_date, CURRENT_DATE);
  v_transaction_number := 'SHEET-' || to_char(v_transaction_date, 'YYYYMMDD') || '-' || NEW.process_id;

  -- Validate: Prevent circular reference (source = target)
  IF NEW.source_item_id = NEW.target_item_id THEN
    RAISE EXCEPTION '순환 참조: 소스 자재와 목표 자재가 동일합니다 (ID=%)', NEW.source_item_id;
  END IF;

  -- Validate: Prevent negative stock for source item
  SELECT COALESCE(current_stock, 0) INTO v_source_stock
  FROM items
  WHERE item_id = NEW.source_item_id;

  IF v_source_stock < NEW.input_quantity THEN
    RAISE EXCEPTION '재고 부족: 소스 자재(ID=%)의 현재 재고(%)가 투입 수량(%)보다 적습니다',
      NEW.source_item_id, v_source_stock, NEW.input_quantity;
  END IF;

  -- Create 생산출고 transaction for sheet consumption
  INSERT INTO inventory_transactions (
    item_id,
    transaction_date,
    transaction_type,
    quantity,
    transaction_number,
    reference_number,
    notes,
    created_at,
    updated_at
  ) VALUES (
    NEW.source_item_id,
    v_transaction_date,
    '생산출고',
    -NEW.input_quantity,
    v_transaction_number,
    v_transaction_number,
    '자동 생성: 판재 가공 투입 출고 (' || NEW.process_type || ', 공정ID: ' || NEW.process_id || ')',
    NOW(),
    NOW()
  );

  -- Create 생산입고 transaction for subsidiary material production
  INSERT INTO inventory_transactions (
    item_id,
    transaction_date,
    transaction_type,
    quantity,
    transaction_number,
    reference_number,
    notes,
    created_at,
    updated_at
  ) VALUES (
    NEW.target_item_id,
    v_transaction_date,
    '생산입고',
    NEW.output_quantity,
    v_transaction_number,
    v_transaction_number,
    '자동 생성: 부자재 생산 입고 (' || NEW.process_type || ', 공정ID: ' || NEW.process_id || ')',
    NOW(),
    NOW()
  );

  -- Update current stock for source item (sheet)
  UPDATE items
  SET current_stock = COALESCE(current_stock, 0) - NEW.input_quantity,
      updated_at = NOW()
  WHERE item_id = NEW.source_item_id;

  -- Update current stock for target item (subsidiary material)
  UPDATE items
  SET current_stock = COALESCE(current_stock, 0) + NEW.output_quantity,
      updated_at = NOW()
  WHERE item_id = NEW.target_item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_sheet_process_stock_movement() IS '판재 공정 완료 시 자동으로 입출고 거래를 생성하고 재고를 업데이트하는 트리거 함수';

-- Step 5: Create the trigger for automatic stock movement
DROP TRIGGER IF EXISTS trigger_sheet_process_stock_automation ON sheet_process_history;

CREATE TRIGGER trigger_sheet_process_stock_automation
  AFTER UPDATE ON sheet_process_history
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'COMPLETED')
  EXECUTE FUNCTION auto_sheet_process_stock_movement();

-- Step 6: Create updated_at timestamp trigger
CREATE OR REPLACE FUNCTION set_sheet_process_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_sheet_process_history ON sheet_process_history;

CREATE TRIGGER set_timestamp_sheet_process_history
  BEFORE UPDATE ON sheet_process_history
  FOR EACH ROW
  EXECUTE FUNCTION set_sheet_process_history_updated_at();

-- Step 7: Grant appropriate permissions
GRANT ALL ON sheet_process_history TO authenticated;
GRANT ALL ON sheet_process_history_process_id_seq TO authenticated;

-- Verification queries (commented out - for manual testing)
-- SELECT * FROM pg_trigger WHERE tgname LIKE '%sheet_process%';
-- SELECT proname FROM pg_proc WHERE proname LIKE '%sheet_process%';
-- SELECT * FROM sheet_process_history ORDER BY created_at DESC;