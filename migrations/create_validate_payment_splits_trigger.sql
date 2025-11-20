-- Migration: Create validate_payment_splits_total trigger function and trigger
-- Date: 2025-11-19
-- Purpose: Validate that payment_splits total matches sales_transactions total_amount

-- Create or replace function to validate payment splits total
CREATE OR REPLACE FUNCTION validate_payment_splits_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id INTEGER;
  v_total_amount NUMERIC;
  v_splits_total NUMERIC;
  v_sales_total NUMERIC;
BEGIN
  -- Determine transaction_id from NEW or OLD record
  IF TG_OP = 'DELETE' THEN
    v_transaction_id := OLD.transaction_id;
  ELSE
    v_transaction_id := NEW.transaction_id;
  END IF;
  
  -- Get total amount from sales_transactions
  SELECT total_amount INTO v_sales_total
  FROM sales_transactions
  WHERE transaction_id = v_transaction_id
    AND is_active = true;
  
  -- If transaction doesn't exist, skip validation (might be a different transaction type)
  IF v_sales_total IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate total of all payment splits for this transaction
  SELECT COALESCE(SUM(amount), 0) INTO v_splits_total
  FROM payment_splits
  WHERE transaction_id = v_transaction_id;
  
  -- Validate that splits total matches sales total (allow 0.01 difference for rounding)
  IF ABS(v_splits_total - v_sales_total) > 0.01 THEN
    RAISE EXCEPTION '결제 분할 금액 합계(%, 원)가 거래 총액(%, 원)과 일치하지 않습니다. 차이: % 원',
      v_splits_total,
      v_sales_total,
      ABS(v_splits_total - v_sales_total);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_validate_payment_splits_total ON payment_splits;

-- Create trigger to call the function before INSERT or UPDATE or DELETE on payment_splits
-- Note: We use AFTER trigger so we can calculate the total including the new/updated record
CREATE TRIGGER trg_validate_payment_splits_total
AFTER INSERT OR UPDATE OR DELETE ON payment_splits
FOR EACH ROW
EXECUTE FUNCTION validate_payment_splits_total();

-- Add comment
COMMENT ON FUNCTION validate_payment_splits_total() IS '결제 분할 금액 합계가 거래 총액과 일치하는지 검증하는 트리거 함수';
COMMENT ON TRIGGER trg_validate_payment_splits_total ON payment_splits IS 'payment_splits 변경 시 결제 금액 합계를 검증하는 트리거';

