-- Phase 2: 계약서 관리 시스템
-- contracts 테이블 확장

-- contracts 테이블에 컬럼 추가
ALTER TABLE contracts 
  ADD COLUMN IF NOT EXISTS contract_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20) 
    CHECK (contract_type IN ('매출계약', '매입계약', '협력계약')),
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 기존 컬럼 수정 (nullable 허용)
ALTER TABLE contracts ALTER COLUMN contract_date DROP NOT NULL;
ALTER TABLE contracts ALTER COLUMN contract_date SET DEFAULT CURRENT_DATE;

-- contract_amount 컬럼명 통일 (total_amount 그대로 사용, 나중에 alias)
-- total_amount 컬럼이 이미 있으므로 그대로 사용

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON contracts(created_by);
CREATE INDEX IF NOT EXISTS idx_contracts_active ON contracts(is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(start_date, end_date);

-- 자동 계약번호 생성 함수
CREATE OR REPLACE FUNCTION generate_contract_no(p_contract_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR(3);
  v_next_num INTEGER;
  v_contract_no VARCHAR(50);
BEGIN
  v_prefix := CASE p_contract_type
    WHEN '매출계약' THEN 'SC'
    WHEN '매입계약' THEN 'PC'
    WHEN '협력계약' THEN 'CC'
    ELSE 'CT'
  END;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(contract_no FROM LENGTH(v_prefix) + 1) AS INTEGER)
  ), 0) + 1
  INTO v_next_num
  FROM contracts
  WHERE contract_no LIKE v_prefix || '%'
  AND contract_no ~ ('^' || v_prefix || '[0-9]+$');

  v_contract_no := v_prefix || LPAD(v_next_num::TEXT, 3, '0');
  RETURN v_contract_no;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 계약 생성 시 자동 번호 할당
CREATE OR REPLACE FUNCTION set_contract_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_no IS NULL OR NEW.contract_no = '' THEN
    NEW.contract_no := generate_contract_no(NEW.contract_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contracts_set_contract_no ON contracts;
CREATE TRIGGER contracts_set_contract_no
  BEFORE INSERT ON contracts
  FOR EACH ROW
  WHEN (NEW.contract_type IS NOT NULL)
  EXECUTE FUNCTION set_contract_no();

-- updated_at 트리거
DROP TRIGGER IF EXISTS contracts_updated_at ON contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 코멘트 추가
COMMENT ON COLUMN contracts.contract_name IS '계약명 (예: 2025년 부품 공급 계약)';
COMMENT ON COLUMN contracts.contract_type IS '계약 타입: 매출계약(SC), 매입계약(PC), 협력계약(CC)';
COMMENT ON COLUMN contracts.terms IS '계약 조건 및 특이사항';
COMMENT ON COLUMN contracts.created_by IS '계약 생성자 (users.user_id 참조)';

