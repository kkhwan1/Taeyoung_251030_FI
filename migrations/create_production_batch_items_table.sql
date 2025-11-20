-- Migration: Create production_batch_items table
-- Date: 2025-11-19
-- Purpose: Production batch items table migration file
-- Note: Table already exists in database, this file documents the current structure

-- Create production_batch_items table
CREATE TABLE IF NOT EXISTS production_batch_items (
  batch_item_id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  item_type VARCHAR(50) NOT NULL,  -- 'INPUT' or 'OUTPUT'
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC DEFAULT 0,
  total_amount NUMERIC,
  defect_quantity NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_production_batch_items_batch_id ON production_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_production_batch_items_item_id ON production_batch_items(item_id);
CREATE INDEX IF NOT EXISTS idx_production_batch_items_item_type ON production_batch_items(item_type);

-- Add foreign key constraints
ALTER TABLE production_batch_items
DROP CONSTRAINT IF EXISTS fk_production_batch_items_batch_id;

ALTER TABLE production_batch_items
ADD CONSTRAINT fk_production_batch_items_batch_id
FOREIGN KEY (batch_id) REFERENCES production_batch(batch_id)
ON DELETE CASCADE;

ALTER TABLE production_batch_items
DROP CONSTRAINT IF EXISTS fk_production_batch_items_item_id;

ALTER TABLE production_batch_items
ADD CONSTRAINT fk_production_batch_items_item_id
FOREIGN KEY (item_id) REFERENCES items(item_id)
ON DELETE RESTRICT;

-- Add comments
COMMENT ON TABLE production_batch_items IS '생산 배치 품목 테이블';
COMMENT ON COLUMN production_batch_items.batch_item_id IS '배치 품목 ID (PK)';
COMMENT ON COLUMN production_batch_items.batch_id IS '배치 ID (FK → production_batch)';
COMMENT ON COLUMN production_batch_items.item_id IS '품목 ID (FK → items)';
COMMENT ON COLUMN production_batch_items.item_type IS '품목 유형 (INPUT: 투입 자재, OUTPUT: 산출 제품)';
COMMENT ON COLUMN production_batch_items.quantity IS '수량';
COMMENT ON COLUMN production_batch_items.unit_price IS '단가';
COMMENT ON COLUMN production_batch_items.total_amount IS '총액';
COMMENT ON COLUMN production_batch_items.defect_quantity IS '불량 수량';
COMMENT ON COLUMN production_batch_items.notes IS '메모';
COMMENT ON COLUMN production_batch_items.created_at IS '생성 일시';

