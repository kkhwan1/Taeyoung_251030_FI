-- ============================================
-- Phase P3: Add Missing Columns to MVP Schema
-- Purpose: Add price_per_kg and created_by columns
-- Created: 2025-01-17
-- ============================================

-- 1. Add missing columns to existing table
ALTER TABLE item_price_history
  ADD COLUMN IF NOT EXISTS price_per_kg DECIMAL(15,2) DEFAULT NULL
    CHECK (price_per_kg >= 0 OR price_per_kg IS NULL),
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

-- 2. Add comments for new columns
COMMENT ON COLUMN item_price_history.price_per_kg IS '중량 단위 단가 (원/kg) - 코일 등';
COMMENT ON COLUMN item_price_history.created_by IS '변경자 (추후 인증 시스템 연동)';

-- 3. Verify columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'item_price_history'
    AND column_name = 'price_per_kg'
  ) THEN
    RAISE NOTICE '✓ price_per_kg column added successfully';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'item_price_history'
    AND column_name = 'created_by'
  ) THEN
    RAISE NOTICE '✓ created_by column added successfully';
  END IF;
END $$;
