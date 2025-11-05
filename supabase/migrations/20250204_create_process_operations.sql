-- Create process_operations table for manufacturing process management
-- Supports Blanking, Press, and Assembly operations
-- Author: Claude (Backend System Architect)
-- Date: 2025-02-04

-- ============================================================================
-- MAIN TABLE: process_operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS process_operations (
  operation_id SERIAL PRIMARY KEY,
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('BLANKING', 'PRESS', 'ASSEMBLY')),
  input_item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE RESTRICT,
  output_item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE RESTRICT,
  input_quantity DECIMAL(15, 2) NOT NULL CHECK (input_quantity > 0),
  output_quantity DECIMAL(15, 2) NOT NULL CHECK (output_quantity > 0),
  efficiency DECIMAL(5, 2) CHECK (efficiency > 0 AND efficiency <= 200), -- 수율 (%)
  operator_id INTEGER,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for Query Performance
-- ============================================================================

CREATE INDEX idx_process_operation_type ON process_operations(operation_type);
CREATE INDEX idx_process_operation_status ON process_operations(status);
CREATE INDEX idx_process_operation_dates ON process_operations(started_at, completed_at);
CREATE INDEX idx_process_operation_items ON process_operations(input_item_id, output_item_id);
CREATE INDEX idx_process_operation_created ON process_operations(created_at DESC);

-- Composite index for common filtering queries
CREATE INDEX idx_process_operation_type_status_date
ON process_operations(operation_type, status, created_at DESC);

-- ============================================================================
-- TRIGGER FUNCTION: Auto Stock Movement on Operation Completion
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_blanking_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only execute when status changes to COMPLETED
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN

    -- Validate input stock availability
    DECLARE
      available_stock DECIMAL(15, 2);
    BEGIN
      SELECT current_stock INTO available_stock
      FROM items
      WHERE item_id = NEW.input_item_id;

      IF available_stock < NEW.input_quantity THEN
        RAISE EXCEPTION '원자재 재고가 부족합니다. 필요: %, 현재: %', NEW.input_quantity, available_stock;
      END IF;
    END;

    -- Deduct input material stock (원자재 차감)
    UPDATE items
    SET current_stock = current_stock - NEW.input_quantity,
        updated_at = NOW()
    WHERE item_id = NEW.input_item_id;

    -- Add output product stock (반제품/완제품 추가)
    UPDATE items
    SET current_stock = current_stock + NEW.output_quantity,
        updated_at = NOW()
    WHERE item_id = NEW.output_item_id;

    -- Record in stock_history for audit trail
    INSERT INTO stock_history (
      item_id,
      change_type,
      quantity_change,
      reference_type,
      reference_id,
      notes,
      created_at
    ) VALUES
    -- Input material consumption record
    (
      NEW.input_item_id,
      'PROCESS_INPUT',
      -NEW.input_quantity,
      'process_operation',
      NEW.operation_id,
      CONCAT(NEW.operation_type, ' 공정 투입 (작업ID: ', NEW.operation_id, ')'),
      NOW()
    ),
    -- Output product creation record
    (
      NEW.output_item_id,
      'PROCESS_OUTPUT',
      NEW.output_quantity,
      'process_operation',
      NEW.operation_id,
      CONCAT(NEW.operation_type, ' 공정 산출 (작업ID: ', NEW.operation_id, ', 수율: ', COALESCE(NEW.efficiency, 0), '%)'),
      NOW()
    );

    -- Set completion timestamp if not already set
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  END IF;

  -- Auto-update updated_at timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Auto Stock Movement
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_blanking_stock_movement ON process_operations;

CREATE TRIGGER trigger_blanking_stock_movement
BEFORE UPDATE ON process_operations
FOR EACH ROW
EXECUTE FUNCTION auto_blanking_stock_movement();

-- ============================================================================
-- TRIGGER FUNCTION: Auto-update timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_process_operation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_process_operation_timestamp ON process_operations;

CREATE TRIGGER trigger_update_process_operation_timestamp
BEFORE UPDATE ON process_operations
FOR EACH ROW
EXECUTE FUNCTION update_process_operation_timestamp();

-- ============================================================================
-- COMMENTS for Documentation
-- ============================================================================

COMMENT ON TABLE process_operations IS '제조 공정 작업 관리 테이블 (Blanking, Press, Assembly)';
COMMENT ON COLUMN process_operations.operation_id IS '작업 ID (Primary Key)';
COMMENT ON COLUMN process_operations.operation_type IS '공정 유형 (BLANKING: 원자재→반제품, PRESS: 반제품→완제품, ASSEMBLY: 조립)';
COMMENT ON COLUMN process_operations.input_item_id IS '투입 품목 ID (원자재 또는 반제품)';
COMMENT ON COLUMN process_operations.output_item_id IS '산출 품목 ID (반제품 또는 완제품)';
COMMENT ON COLUMN process_operations.input_quantity IS '투입 수량';
COMMENT ON COLUMN process_operations.output_quantity IS '산출 수량';
COMMENT ON COLUMN process_operations.efficiency IS '수율 (%) - 자동 계산: (산출/투입)*100';
COMMENT ON COLUMN process_operations.operator_id IS '작업자 ID (향후 사용자 관리 연동)';
COMMENT ON COLUMN process_operations.started_at IS '작업 시작 시각';
COMMENT ON COLUMN process_operations.completed_at IS '작업 완료 시각 (COMPLETED 상태 전환 시 자동 설정)';
COMMENT ON COLUMN process_operations.status IS '작업 상태 (PENDING: 대기, IN_PROGRESS: 진행중, COMPLETED: 완료, CANCELLED: 취소)';
COMMENT ON COLUMN process_operations.notes IS '비고 (작업 메모, 특이사항)';

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Note: You'll need actual item_id values from your items table
-- Example:
-- INSERT INTO process_operations (
--   operation_type, input_item_id, output_item_id,
--   input_quantity, output_quantity, efficiency,
--   status, notes
-- ) VALUES
-- ('BLANKING', 1, 2, 100.00, 95.00, 95.00, 'PENDING', 'Blanking 공정 테스트');
