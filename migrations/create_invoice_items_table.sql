-- Migration: Create invoice_items table
-- Date: 2025-11-19
-- Purpose: Invoice items table migration file
-- Note: Table already exists in database, this file documents the current structure

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  invoice_item_id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  line_no INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoice_items_transaction_id ON invoice_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id ON invoice_items(item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_line_no ON invoice_items(transaction_id, line_no);

-- Add foreign key constraints
ALTER TABLE invoice_items
DROP CONSTRAINT IF EXISTS fk_invoice_items_transaction_id;

ALTER TABLE invoice_items
ADD CONSTRAINT fk_invoice_items_transaction_id
FOREIGN KEY (transaction_id) REFERENCES sales_transactions(transaction_id)
ON DELETE CASCADE;

ALTER TABLE invoice_items
DROP CONSTRAINT IF EXISTS fk_invoice_items_item_id;

ALTER TABLE invoice_items
ADD CONSTRAINT fk_invoice_items_item_id
FOREIGN KEY (item_id) REFERENCES items(item_id)
ON DELETE RESTRICT;

-- Add unique constraint for line_no per transaction
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_transaction_line_unique 
ON invoice_items(transaction_id, line_no);

-- Add comments
COMMENT ON TABLE invoice_items IS '계산서 품목 테이블';
COMMENT ON COLUMN invoice_items.invoice_item_id IS '계산서 품목 ID (PK)';
COMMENT ON COLUMN invoice_items.transaction_id IS '거래 ID (FK → sales_transactions)';
COMMENT ON COLUMN invoice_items.item_id IS '품목 ID (FK → items)';
COMMENT ON COLUMN invoice_items.quantity IS '수량';
COMMENT ON COLUMN invoice_items.unit_price IS '단가';
COMMENT ON COLUMN invoice_items.total_amount IS '총액 (quantity * unit_price)';
COMMENT ON COLUMN invoice_items.line_no IS '라인 번호 (거래 내 품목 순서)';
COMMENT ON COLUMN invoice_items.notes IS '메모';
COMMENT ON COLUMN invoice_items.created_at IS '생성 일시';
COMMENT ON COLUMN invoice_items.updated_at IS '수정 일시';

