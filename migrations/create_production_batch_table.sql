-- Migration: Create production_batch table
-- Date: 2025-11-19
-- Purpose: Production batch management table migration file
-- Note: Table already exists in database, this file documents the current structure

-- Create production_batch table
CREATE TABLE IF NOT EXISTS production_batch (
  batch_id SERIAL PRIMARY KEY,
  batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_number VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'IN_PROGRESS',
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_production_batch_date ON production_batch(batch_date);
CREATE INDEX IF NOT EXISTS idx_production_batch_status ON production_batch(status);
CREATE INDEX IF NOT EXISTS idx_production_batch_number ON production_batch(batch_number);
CREATE INDEX IF NOT EXISTS idx_production_batch_created_by ON production_batch(created_by);
CREATE INDEX IF NOT EXISTS idx_production_batch_is_active ON production_batch(is_active);

-- Add foreign key constraint for created_by (if users table exists)
-- ALTER TABLE production_batch
-- ADD CONSTRAINT fk_production_batch_created_by
-- FOREIGN KEY (created_by) REFERENCES users(user_id)
-- ON DELETE SET NULL;

-- Add unique constraint for batch_number (optional, if needed)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_production_batch_number_unique ON production_batch(batch_number) WHERE is_active = true;

-- Add comments
COMMENT ON TABLE production_batch IS '생산 배치 관리 테이블';
COMMENT ON COLUMN production_batch.batch_id IS '배치 ID (PK)';
COMMENT ON COLUMN production_batch.batch_date IS '배치 날짜';
COMMENT ON COLUMN production_batch.batch_number IS '배치 번호 (고유 식별자)';
COMMENT ON COLUMN production_batch.status IS '배치 상태 (IN_PROGRESS, APPROVED, COMPLETED, CANCELLED)';
COMMENT ON COLUMN production_batch.notes IS '배치 메모';
COMMENT ON COLUMN production_batch.created_by IS '생성자 ID';
COMMENT ON COLUMN production_batch.created_at IS '생성 일시';
COMMENT ON COLUMN production_batch.updated_at IS '수정 일시';
COMMENT ON COLUMN production_batch.is_active IS '활성화 여부';

