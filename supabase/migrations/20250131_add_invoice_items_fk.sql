-- Migration: Add foreign key relationship between invoice_items and sales_transactions
-- Created: 2025-01-31
-- Purpose: Fix "Could not find a relationship" error in invoice API

-- Add foreign key constraint
ALTER TABLE invoice_items
ADD CONSTRAINT fk_invoice_items_sales_transactions
FOREIGN KEY (invoice_id)
REFERENCES sales_transactions(transaction_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Verify the relationship was created
COMMENT ON CONSTRAINT fk_invoice_items_sales_transactions ON invoice_items IS
'Foreign key linking invoice items to sales transactions. Required for Supabase nested select queries.';
