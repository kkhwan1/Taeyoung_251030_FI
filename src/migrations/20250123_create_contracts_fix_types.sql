-- Migration: Create Contract Management Tables (Fixed TypeScript Types)
-- Created: 2025-01-23
-- Description: 계약 관리 시스템 테이블 생성 - Fixes 28 TypeScript errors
-- This migration creates the contracts and contract_documents tables
-- that are referenced in existing TypeScript files

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS contract_documents CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;

-- Create contracts table with INTEGER primary key (matching existing TypeScript types)
CREATE TABLE contracts (
  contract_id SERIAL PRIMARY KEY,
  contract_no TEXT UNIQUE NOT NULL,
  company_id INTEGER REFERENCES companies(company_id),
  contract_date DATE NOT NULL,
  start_date DATE,
  end_date DATE,
  total_amount DECIMAL(15,2),
  status TEXT DEFAULT 'DRAFT',
  notes TEXT,
  searchable_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create contract_documents table
CREATE TABLE contract_documents (
  document_id SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(contract_id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_type TEXT,
  file_size INTEGER,
  original_filename TEXT,
  page_count INTEGER,
  extracted_text TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_contracts_company ON contracts(company_id);
CREATE INDEX idx_contracts_searchable ON contracts USING GIN(to_tsvector('simple', searchable_text));
CREATE INDEX idx_contract_documents_contract ON contract_documents(contract_id);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE contracts IS '계약 관리 테이블 - Contract management table';
COMMENT ON TABLE contract_documents IS '계약 문서 관리 테이블 - Contract documents table';
COMMENT ON COLUMN contracts.contract_no IS '계약 번호 - Contract number';
COMMENT ON COLUMN contracts.company_id IS '거래처 ID - Company ID reference';
COMMENT ON COLUMN contracts.contract_date IS '계약일 - Contract date';
COMMENT ON COLUMN contracts.start_date IS '시작일 - Start date';
COMMENT ON COLUMN contracts.end_date IS '종료일 - End date';
COMMENT ON COLUMN contracts.total_amount IS '계약 금액 - Total contract amount';
COMMENT ON COLUMN contracts.status IS '상태: DRAFT, ACTIVE, EXPIRED, TERMINATED';
COMMENT ON COLUMN contracts.searchable_text IS 'PDF 추출 텍스트 (전문 검색용) - Extracted text for full-text search';
COMMENT ON COLUMN contract_documents.document_url IS 'Supabase Storage URL';
COMMENT ON COLUMN contract_documents.document_type IS 'MIME type (application/pdf, etc)';
COMMENT ON COLUMN contract_documents.file_size IS '파일 크기 (bytes)';
COMMENT ON COLUMN contract_documents.original_filename IS '원본 파일명 - Original filename';
COMMENT ON COLUMN contract_documents.page_count IS 'PDF 페이지 수 - Number of pages in PDF';
COMMENT ON COLUMN contract_documents.extracted_text IS 'PDF에서 추출한 텍스트 - Text extracted from PDF';

-- Insert sample data for testing (optional, commented out)
-- INSERT INTO contracts (contract_no, company_id, contract_date, start_date, end_date, total_amount, status)
-- VALUES
-- ('CNT-2025-001', 1, '2025-01-01', '2025-01-01', '2025-12-31', 10000000, 'ACTIVE'),
-- ('CNT-2025-002', 2, '2025-01-15', '2025-02-01', '2025-07-31', 5000000, 'DRAFT');