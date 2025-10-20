-- Migration: Add coating_status to items table for 도장 전/후 재고 구분
-- Created: 2025-01-19
-- Phase: 6A-1

-- Add coating_status column with default value
ALTER TABLE items ADD COLUMN IF NOT EXISTS coating_status VARCHAR(20) DEFAULT 'no_coating';

-- Add check constraint to ensure only valid values
ALTER TABLE items ADD CONSTRAINT coating_status_values
  CHECK (coating_status IN ('no_coating', 'before_coating', 'after_coating'));

-- Add index for efficient filtering by coating status
CREATE INDEX IF NOT EXISTS idx_items_coating_status ON items(coating_status);

-- Add comment for documentation
COMMENT ON COLUMN items.coating_status IS 'Coating process status: no_coating (도장 불필요), before_coating (도장 전), after_coating (도장 후)';

-- Update existing items to 'no_coating' (already set by DEFAULT, but explicit for clarity)
UPDATE items SET coating_status = 'no_coating' WHERE coating_status IS NULL;

-- Verify migration
DO $$
BEGIN
  -- Check if column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'coating_status'
  ) THEN
    RAISE EXCEPTION 'Migration failed: coating_status column not created';
  END IF;

  -- Check if constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'coating_status_values' AND table_name = 'items'
  ) THEN
    RAISE EXCEPTION 'Migration failed: coating_status_values constraint not created';
  END IF;

  -- Check if index exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'items' AND indexname = 'idx_items_coating_status'
  ) THEN
    RAISE EXCEPTION 'Migration failed: idx_items_coating_status index not created';
  END IF;

  RAISE NOTICE 'Migration successful: coating_status column, constraint, and index created';
END $$;
