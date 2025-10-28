-- Migration: Create Contract Management Tables
-- Created: 2025-01-22
-- Description: 계약 관리 시스템 테이블 생성

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
  contract_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  contract_no TEXT UNIQUE NOT NULL,
  contract_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'TERMINATED')),
  searchable_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create contract_documents table
CREATE TABLE IF NOT EXISTS contract_documents (
  document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  original_filename TEXT NOT NULL,
  page_count INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_searchable_text ON contracts USING GIN (to_tsvector('korean', searchable_text));
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id ON contract_documents(contract_id);

-- Create Storage bucket for contract documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-documents',
  'contract-documents',
  false, -- Private bucket
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE contracts IS '계약 관리 테이블';
COMMENT ON TABLE contract_documents IS '계약 문서 관리 테이블';
COMMENT ON COLUMN contracts.searchable_text IS 'PDF 추출 텍스트 (전문 검색용)';
COMMENT ON COLUMN contracts.status IS 'ACTIVE: 활성, EXPIRED: 만료, TERMINATED: 해지';
