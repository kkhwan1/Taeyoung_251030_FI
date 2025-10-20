-- Rollback Migration: Remove coating_status from items table
-- Created: 2025-01-19
-- Phase: 6A-1
-- WARNING: This will drop the coating_status column and all associated data

-- Drop index
DROP INDEX IF EXISTS idx_items_coating_status;

-- Drop constraint
ALTER TABLE items DROP CONSTRAINT IF EXISTS coating_status_values;

-- Drop column
ALTER TABLE items DROP COLUMN IF EXISTS coating_status;

-- Verify rollback
DO $$
BEGIN
  -- Check if column was removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'coating_status'
  ) THEN
    RAISE EXCEPTION 'Rollback failed: coating_status column still exists';
  END IF;

  RAISE NOTICE 'Rollback successful: coating_status column, constraint, and index removed';
END $$;
