-- Fix Production Trigger Function
-- Created: 2025-02-01
-- Purpose: Fix column name from transaction_no to transaction_number
-- Also fix: transaction_type values to Korean ENUM
-- Updated: Idempotent version - safe to run multiple times

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
          transaction_number,
          transaction_type,
          item_id,
          quantity,
          unit_price,
          total_amount,
          notes
        ) VALUES (
          NEW.batch_date,
          v_transaction_no || '-IN',
          '생산투입'::transaction_type,
          v_item.item_id,
          -v_item.quantity,  -- Negative for deduction
          v_item.unit_price,
          -v_item.total_amount,
          '생산 배치 ' || NEW.batch_number || ' 투입'
        );

      ELSIF v_item.item_type = 'OUTPUT' THEN
        -- Add output products (positive quantity)
        INSERT INTO inventory_transactions (
          transaction_date,
          transaction_number,
          transaction_type,
          item_id,
          quantity,
          unit_price,
          total_amount,
          notes
        ) VALUES (
          NEW.batch_date,
          v_transaction_no || '-OUT',
          '생산산출'::transaction_type,
          v_item.item_id,
          v_item.quantity - v_item.defect_quantity,  -- Subtract defects
          v_item.unit_price,
          (v_item.quantity - v_item.defect_quantity) * v_item.unit_price,
          '생산 배치 ' || NEW.batch_number || ' 산출'
        );

        -- If there are defects, record them separately
        IF v_item.defect_quantity > 0 THEN
          INSERT INTO inventory_transactions (
            transaction_date,
            transaction_number,
            transaction_type,
            item_id,
            quantity,
            unit_price,
            total_amount,
            notes
          ) VALUES (
            NEW.batch_date,
            v_transaction_no || '-DEFECT',
            '생산불량'::transaction_type,
            v_item.item_id,
            -v_item.defect_quantity,  -- Negative for defects
            v_item.unit_price,
            -v_item.defect_quantity * v_item.unit_price,
            '생산 배치 ' || NEW.batch_number || ' 불량'
          );
        END IF;
      END IF;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS auto_production_stock_movement_trigger ON production_batch;
CREATE TRIGGER auto_production_stock_movement_trigger
AFTER UPDATE ON production_batch
FOR EACH ROW
EXECUTE FUNCTION auto_production_stock_movement();
