-- Migration: Audit Log Table for Transaction History
-- Created: 2025-01-30
-- Purpose: 거래 수정/삭제 이력 추적

-- ============================================================
-- Audit Log Table
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  operation VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  table_name VARCHAR(100) NOT NULL, -- 'inventory_transactions', 'purchase_transactions', etc.
  record_id BIGINT, -- 삭제된 경우에도 기록을 위해 남김
  old_values JSONB, -- 수정 전 데이터 (JSON 형식)
  new_values JSONB, -- 수정 후 데이터 (JSON 형식)
  status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'ROLLBACK'
  error_message TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  execution_time INTEGER, -- 밀리초 단위
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- 코멘트
COMMENT ON TABLE audit_log IS '거래 수정/삭제 이력 추적 테이블';
COMMENT ON COLUMN audit_log.operation IS '작업 유형: CREATE, UPDATE, DELETE';
COMMENT ON COLUMN audit_log.table_name IS '대상 테이블명';
COMMENT ON COLUMN audit_log.record_id IS '대상 레코드 ID (삭제된 경우에도 기록 보존)';
COMMENT ON COLUMN audit_log.old_values IS '수정 전 데이터 (JSON 형식)';
COMMENT ON COLUMN audit_log.new_values IS '수정 후 데이터 (JSON 형식)';

