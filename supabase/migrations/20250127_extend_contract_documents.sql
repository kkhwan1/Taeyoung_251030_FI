-- Phase 3: 문서 첨부 시스템
-- contract_documents 테이블 확장

-- contract_documents 테이블에 컬럼 추가
ALTER TABLE contract_documents 
  ADD COLUMN IF NOT EXISTS file_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS uploaded_by BIGINT,
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 외래 키 제약 조건 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'contract_documents_uploaded_by_fkey'
  ) THEN
    ALTER TABLE contract_documents ADD CONSTRAINT contract_documents_uploaded_by_fkey 
      FOREIGN KEY (uploaded_by) REFERENCES users(user_id);
  END IF;
END $$;

-- document_url을 document_type으로 file_name 업데이트
UPDATE contract_documents 
SET file_name = original_filename
WHERE file_name IS NULL AND original_filename IS NOT NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_contract_documents_uploaded_by 
  ON contract_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_contract_documents_active 
  ON contract_documents(is_active);

-- 버전 자동 증가 함수
CREATE OR REPLACE FUNCTION increment_document_version()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1
  INTO NEW.version
  FROM contract_documents
  WHERE contract_id = NEW.contract_id
  AND file_name = NEW.file_name
  AND is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contract_documents_version ON contract_documents;
CREATE TRIGGER contract_documents_version
  BEFORE INSERT ON contract_documents
  FOR EACH ROW
  EXECUTE FUNCTION increment_document_version();

-- updated_at 트리거
DROP TRIGGER IF EXISTS contract_documents_updated_at ON contract_documents;
CREATE TRIGGER contract_documents_updated_at
  BEFORE UPDATE ON contract_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

