-- Migration: Fix invoice_items foreign key to reference sales_transactions
-- Created: 2025-01-31
-- Purpose: Correct the foreign key from non-existent invoices table to sales_transactions
-- Updated: Idempotent version - safe to run multiple times

-- Step 1: Drop the incorrect foreign key constraint if exists
ALTER TABLE invoice_items
DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;

-- Step 2: Rename column for clarity if invoice_id still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoice_items' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE invoice_items RENAME COLUMN invoice_id TO transaction_id;
  END IF;
END $$;

-- Step 3: Add correct foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_invoice_items_sales_transactions'
  ) THEN
    ALTER TABLE invoice_items
    ADD CONSTRAINT fk_invoice_items_sales_transactions
    FOREIGN KEY (transaction_id)
    REFERENCES sales_transactions(transaction_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 4: Update the unique constraint to use new column name
ALTER TABLE invoice_items
DROP CONSTRAINT IF EXISTS invoice_items_invoice_line_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invoice_items_transaction_line_unique'
  ) THEN
    ALTER TABLE invoice_items
    ADD CONSTRAINT invoice_items_transaction_line_unique
    UNIQUE(transaction_id, line_no);
  END IF;
END $$;

-- Step 5: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_invoice_items_transaction_id
ON invoice_items(transaction_id);

-- Step 6: Add comment for documentation
COMMENT ON CONSTRAINT fk_invoice_items_sales_transactions ON invoice_items IS
'Foreign key linking invoice items to sales transactions. Required for Supabase nested select queries.';
