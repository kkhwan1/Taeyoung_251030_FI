-- ═══════════════════════════════════════
-- Create price_master table for monthly pricing
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS price_master (
  price_master_id SERIAL PRIMARY KEY,
  item_code VARCHAR(50) NOT NULL,
  price NUMERIC(15, 2) NOT NULL CHECK (price >= 0),
  supplier VARCHAR(100),
  price_month DATE NOT NULL, -- First day of the month (e.g., '2025-04-01')
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one price per item per month
  CONSTRAINT uq_price_master_item_month UNIQUE (item_code, price_month)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_master_item_code ON price_master(item_code);
CREATE INDEX IF NOT EXISTS idx_price_master_month ON price_master(price_month DESC);
CREATE INDEX IF NOT EXISTS idx_price_master_supplier ON price_master(supplier);

-- Add comments
COMMENT ON TABLE price_master IS '월별 품목 단가 마스터 테이블';
COMMENT ON COLUMN price_master.item_code IS '품목 코드 (items 테이블과 연결)';
COMMENT ON COLUMN price_master.price IS '월별 단가';
COMMENT ON COLUMN price_master.supplier IS '공급업체명';
COMMENT ON COLUMN price_master.price_month IS '적용 월 (매월 1일)';

-- Enable RLS (Row Level Security)
ALTER TABLE price_master ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable read access for all users" ON price_master
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON price_master
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON price_master
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON price_master
  FOR DELETE USING (true);

-- Grant permissions
GRANT ALL ON price_master TO authenticated;
GRANT ALL ON price_master TO service_role;
GRANT USAGE, SELECT ON SEQUENCE price_master_price_master_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE price_master_price_master_id_seq TO service_role;
