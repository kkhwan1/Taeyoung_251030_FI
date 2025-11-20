-- Migration: Create payment_splits table
-- Date: 2025-11-19
-- Purpose: Payment splits table migration file
-- Note: Table already exists in database, this file documents the current structure

-- Create payment_splits table
CREATE TABLE IF NOT EXISTS payment_splits (
  payment_split_id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  payment_method VARCHAR(50) NOT NULL,  -- 'CASH', 'CARD', 'BILL', 'CHECK', 'CREDIT'
  amount NUMERIC NOT NULL DEFAULT 0,
  bill_number VARCHAR(255),
  bill_date DATE,
  bill_drawer VARCHAR(255),
  check_number VARCHAR(255),
  check_bank VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_splits_transaction_id ON payment_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_payment_method ON payment_splits(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_splits_created_at ON payment_splits(created_at);

-- Add foreign key constraint
ALTER TABLE payment_splits
DROP CONSTRAINT IF EXISTS fk_payment_splits_transaction_id;

ALTER TABLE payment_splits
ADD CONSTRAINT fk_payment_splits_transaction_id
FOREIGN KEY (transaction_id) REFERENCES sales_transactions(transaction_id)
ON DELETE CASCADE;

-- Add check constraint for payment method
ALTER TABLE payment_splits
DROP CONSTRAINT IF EXISTS chk_payment_splits_payment_method;

ALTER TABLE payment_splits
ADD CONSTRAINT chk_payment_splits_payment_method
CHECK (payment_method IN ('CASH', 'CARD', 'BILL', 'CHECK', 'CREDIT', 'TRANSFER'));

-- Add check constraint for amount
ALTER TABLE payment_splits
DROP CONSTRAINT IF EXISTS chk_payment_splits_amount;

ALTER TABLE payment_splits
ADD CONSTRAINT chk_payment_splits_amount
CHECK (amount >= 0);

-- Add comments
COMMENT ON TABLE payment_splits IS '결제 분할 테이블 (복합 결제 수단 관리)';
COMMENT ON COLUMN payment_splits.payment_split_id IS '결제 분할 ID (PK)';
COMMENT ON COLUMN payment_splits.transaction_id IS '거래 ID (FK → sales_transactions)';
COMMENT ON COLUMN payment_splits.payment_method IS '결제 수단 (CASH, CARD, BILL, CHECK, CREDIT, TRANSFER)';
COMMENT ON COLUMN payment_splits.amount IS '결제 금액';
COMMENT ON COLUMN payment_splits.bill_number IS '어음 번호';
COMMENT ON COLUMN payment_splits.bill_date IS '어음 일자';
COMMENT ON COLUMN payment_splits.bill_drawer IS '어음 발행인';
COMMENT ON COLUMN payment_splits.check_number IS '수표 번호';
COMMENT ON COLUMN payment_splits.check_bank IS '수표 발행 은행';
COMMENT ON COLUMN payment_splits.notes IS '메모';
COMMENT ON COLUMN payment_splits.created_at IS '생성 일시';
COMMENT ON COLUMN payment_splits.updated_at IS '수정 일시';

