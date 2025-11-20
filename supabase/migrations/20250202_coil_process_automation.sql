-- File: supabase/migrations/20250202_coil_process_automation.sql
-- ============================================
-- Migration: 자동 재고 반영 트리거 (코일 공정)
-- ============================================

CREATE OR REPLACE FUNCTION auto_coil_process_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_date DATE;
  v_transaction_number TEXT;
BEGIN
  IF NEW.status <> 'COMPLETED' OR COALESCE(OLD.status, '') = 'COMPLETED' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM inventory_transactions it
    WHERE it.reference_number LIKE 'COIL-%' || NEW.process_id
  ) THEN
    RETURN NEW;
  END IF;

  v_transaction_date := COALESCE(NEW.process_date, CURRENT_DATE);
  v_transaction_number := 'COIL-' || to_char(v_transaction_date, 'YYYYMMDD') || '-' || NEW.process_id;

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
    '자동 생성: 코일 공정 투입 출고 처리 (공정ID: ' || NEW.process_id || ')',
    NOW(),
    NOW()
  );

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
    '자동 생성: 코일 공정 산출 입고 처리 (공정ID: ' || NEW.process_id || ')',
    NOW(),
    NOW()
  );

  UPDATE items
  SET current_stock = COALESCE(current_stock, 0) - NEW.input_quantity,
      updated_at = NOW()
  WHERE item_id = NEW.source_item_id;

  UPDATE items
  SET current_stock = COALESCE(current_stock, 0) + NEW.output_quantity,
      updated_at = NOW()
  WHERE item_id = NEW.target_item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_coil_process_stock_movement() IS '코일 공정 완료 시 자동으로 입출고 거래를 생성하고 재고를 업데이트하는 트리거 함수';

DROP TRIGGER IF EXISTS trigger_coil_process_stock_automation ON coil_process_history;

CREATE TRIGGER trigger_coil_process_stock_automation
  AFTER UPDATE ON coil_process_history
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'COMPLETED')
  EXECUTE FUNCTION auto_coil_process_stock_movement();
