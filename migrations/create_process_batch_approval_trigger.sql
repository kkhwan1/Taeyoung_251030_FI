-- Migration: Create process_batch_approval trigger function and trigger
-- Date: 2025-11-19
-- Purpose: Convert production_batch to individual inventory_transactions when batch is approved

-- Create or replace function to process batch approval
CREATE OR REPLACE FUNCTION process_batch_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_transaction_no VARCHAR(50);
  v_batch_date DATE;
BEGIN
  -- Only trigger when batch status changes to 'APPROVED'
  IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status != 'APPROVED') THEN
    
    -- Get batch date
    v_batch_date := COALESCE(NEW.batch_date, CURRENT_DATE);
    
    -- Generate transaction number for this batch
    v_transaction_no := 'BATCH-' || TO_CHAR(v_batch_date, 'YYYYMMDD') || '-' || LPAD(NEW.batch_id::TEXT, 4, '0');
    
    -- Process all batch items
    FOR v_item IN
      SELECT 
        pbi.*,
        i.item_code,
        i.item_name
      FROM production_batch_items pbi
      INNER JOIN items i ON pbi.item_id = i.item_id
      WHERE pbi.batch_id = NEW.batch_id
        AND i.is_active = true
    LOOP
      -- Determine transaction type based on item_type
      IF v_item.item_type = 'INPUT' THEN
        -- Deduct input materials (생산투입)
        INSERT INTO inventory_transactions (
          transaction_date,
          transaction_type,
          item_id,
          quantity,
          unit_price,
          total_amount,
          reference_number,
          notes,
          status,
          created_by
        ) VALUES (
          v_batch_date,
          '생산투입',
          v_item.item_id,
          -v_item.quantity,  -- Negative for deduction
          COALESCE(v_item.unit_price, 0),
          -COALESCE(v_item.total_amount, v_item.quantity * COALESCE(v_item.unit_price, 0)),
          v_transaction_no || '-IN',
          COALESCE(v_item.notes, '') || ' | 배치: ' || COALESCE(NEW.batch_number, NEW.batch_id::TEXT),
          '완료',
          COALESCE(NEW.created_by, 1)
        );
        
      ELSIF v_item.item_type = 'OUTPUT' THEN
        -- Add output products (생산입고)
        INSERT INTO inventory_transactions (
          transaction_date,
          transaction_type,
          item_id,
          quantity,
          unit_price,
          total_amount,
          reference_number,
          notes,
          status,
          created_by
        ) VALUES (
          v_batch_date,
          '생산입고',
          v_item.item_id,
          v_item.quantity - COALESCE(v_item.defect_quantity, 0),  -- Subtract defects
          COALESCE(v_item.unit_price, 0),
          (v_item.quantity - COALESCE(v_item.defect_quantity, 0)) * COALESCE(v_item.unit_price, 0),
          v_transaction_no || '-OUT',
          COALESCE(v_item.notes, '') || ' | 배치: ' || COALESCE(NEW.batch_number, NEW.batch_id::TEXT),
          '완료',
          COALESCE(NEW.created_by, 1)
        );
        
        -- If there are defects, record them separately (불량 처리)
        IF COALESCE(v_item.defect_quantity, 0) > 0 THEN
          INSERT INTO inventory_transactions (
            transaction_date,
            transaction_type,
            item_id,
            quantity,
            unit_price,
            total_amount,
            reference_number,
            notes,
            status,
            created_by
          ) VALUES (
            v_batch_date,
            '조정',  -- Adjustment for defects
            v_item.item_id,
            -v_item.defect_quantity,  -- Negative for defects
            COALESCE(v_item.unit_price, 0),
            -v_item.defect_quantity * COALESCE(v_item.unit_price, 0),
            v_transaction_no || '-DEFECT',
            '생산 불량 | 배치: ' || COALESCE(NEW.batch_number, NEW.batch_id::TEXT),
            '완료',
            COALESCE(NEW.created_by, 1)
          );
        END IF;
      END IF;
    END LOOP;
    
    -- Log the approval
    RAISE NOTICE 'Batch % approved and converted to inventory transactions', NEW.batch_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_process_batch_approval ON production_batch;

-- Create trigger to call the function after UPDATE on production_batch
CREATE TRIGGER trg_process_batch_approval
AFTER UPDATE ON production_batch
FOR EACH ROW
WHEN (NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status != 'APPROVED'))
EXECUTE FUNCTION process_batch_approval();

-- Add comment
COMMENT ON FUNCTION process_batch_approval() IS '배치 승인 시 개별 재고 거래로 변환하는 트리거 함수';
COMMENT ON TRIGGER trg_process_batch_approval ON production_batch IS 'production_batch 상태가 APPROVED로 변경될 때 실행되는 트리거';

