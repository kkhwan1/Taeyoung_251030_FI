-- Migration: Add arrival_date column to inventory_transactions
-- Purpose: Track expected arrival date for receiving transactions
-- Author: ERP System
-- Date: 2025-01-30

-- Add arrival_date column
ALTER TABLE inventory_transactions
ADD COLUMN IF NOT EXISTS arrival_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN inventory_transactions.arrival_date IS '도착 예정일 (입고 거래 시 사용, 출고는 delivery_date 사용)';

-- Create index for performance (partial index only for non-null values)
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_arrival_date
ON inventory_transactions(arrival_date)
WHERE arrival_date IS NOT NULL;

-- Verify column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inventory_transactions'
    AND column_name = 'arrival_date'
  ) THEN
    RAISE NOTICE 'Migration successful: arrival_date column added to inventory_transactions';
  ELSE
    RAISE EXCEPTION 'Migration failed: arrival_date column not found';
  END IF;
END $$;
