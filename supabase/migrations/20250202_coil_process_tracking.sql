-- File: supabase/migrations/20250202_coil_process_tracking.sql
-- ============================================
-- Migration: Create coil_process_history for 코일 공정 추적
-- ============================================

CREATE TABLE coil_process_history (
  process_id SERIAL PRIMARY KEY,
  source_item_id INTEGER NOT NULL REFERENCES items(item_id),
  process_type TEXT NOT NULL CHECK (process_type IN ('블랭킹', '전단', '절곡', '용접')),
  target_item_id INTEGER NOT NULL REFERENCES items(item_id),
  input_quantity NUMERIC(10,2) NOT NULL,
  output_quantity NUMERIC(10,2) NOT NULL,
  yield_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN input_quantity > 0 THEN ROUND((output_quantity / input_quantity) * 100, 2)
      ELSE 0
    END
  ) STORED,
  process_date DATE NOT NULL DEFAULT CURRENT_DATE,
  operator_id INTEGER REFERENCES users(user_id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE coil_process_history IS '코일 투입부터 판재 산출까지 공정 이력과 수율을 추적하는 테이블';
COMMENT ON COLUMN coil_process_history.process_id IS '코일 공정 이력 고유 ID';
COMMENT ON COLUMN coil_process_history.source_item_id IS '투입된 코일 자재 ID (inventory_type=코일만 허용)';
COMMENT ON COLUMN coil_process_history.process_type IS '작업 공정 유형 (블랭킹/전단/절곡/용접)';
COMMENT ON COLUMN coil_process_history.target_item_id IS '공정 결과물 자재 ID (판재 및 후속 자재)';
COMMENT ON COLUMN coil_process_history.input_quantity IS '공정에 투입된 코일 중량 또는 수량';
COMMENT ON COLUMN coil_process_history.output_quantity IS '공정에서 산출된 자재 중량 또는 수량';
COMMENT ON COLUMN coil_process_history.yield_rate IS '투입 대비 산출 효율(%) 자동 계산 컬럼';
COMMENT ON COLUMN coil_process_history.process_date IS '공정이 수행된 기준 날짜';
COMMENT ON COLUMN coil_process_history.operator_id IS '공정 담당 작업자 ID';
COMMENT ON COLUMN coil_process_history.notes IS '현장 특이사항 및 작업 비고';
COMMENT ON COLUMN coil_process_history.status IS '공정 진행 상태 (PENDING/IN_PROGRESS/COMPLETED/CANCELLED)';
COMMENT ON COLUMN coil_process_history.created_at IS '레코드 생성 일시 (KST 기준)';
COMMENT ON COLUMN coil_process_history.updated_at IS '레코드 최종 수정 일시';

CREATE INDEX idx_coil_process_source ON coil_process_history (source_item_id);
CREATE INDEX idx_coil_process_target ON coil_process_history (target_item_id);
CREATE INDEX idx_coil_process_date ON coil_process_history (process_date DESC);
CREATE INDEX idx_coil_process_status ON coil_process_history (status) WHERE status != 'CANCELLED';

CREATE OR REPLACE FUNCTION enforce_coil_source_inventory_type()
RETURNS TRIGGER AS $$
DECLARE
  v_inventory_type TEXT;
BEGIN
  SELECT i.inventory_type
  INTO v_inventory_type
  FROM items i
  WHERE i.item_id = NEW.source_item_id;

  IF v_inventory_type IS NULL THEN
    RAISE EXCEPTION '소스 자재(ID=%)를 찾을 수 없거나 inventory_type이 비어 있습니다.', NEW.source_item_id;
  END IF;

  IF v_inventory_type <> '코일' THEN
    RAISE EXCEPTION '소스 자재(ID=%)의 재고 유형이 %이므로 코일 공정에 사용할 수 없습니다.', NEW.source_item_id, v_inventory_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_coil_process_source_type ON coil_process_history;

CREATE TRIGGER enforce_coil_process_source_type
  BEFORE INSERT OR UPDATE OF source_item_id
  ON coil_process_history
  FOR EACH ROW
  EXECUTE FUNCTION enforce_coil_source_inventory_type();

CREATE OR REPLACE FUNCTION set_coil_process_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_coil_process_history ON coil_process_history;

CREATE TRIGGER set_timestamp_coil_process_history
  BEFORE UPDATE ON coil_process_history
  FOR EACH ROW
  EXECUTE FUNCTION set_coil_process_history_updated_at();
