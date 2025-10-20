-- ============================================
-- Phase P3 MVP: 월별 단가 관리
-- 목적: 품목별 월별 단가 이력 추적
-- 작성일: 2025-01-16
-- 예상 소요 시간: 1시간
-- ============================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS item_price_history (
  price_history_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  price_month DATE NOT NULL,  -- 'YYYY-MM-01' 형식 (매월 1일로 통일)
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 제약 조건: 품목당 월별로 하나의 단가만 존재
  CONSTRAINT unique_item_month UNIQUE (item_id, price_month)
);

-- 2. 인덱스 생성
CREATE INDEX idx_price_month ON item_price_history(price_month DESC);
CREATE INDEX idx_item_price ON item_price_history(item_id, price_month DESC);

-- 3. 코멘트 추가
COMMENT ON TABLE item_price_history IS '품목별 월별 단가 이력 (MVP)';
COMMENT ON COLUMN item_price_history.price_month IS '단가 적용 월 (매월 1일)';
COMMENT ON COLUMN item_price_history.unit_price IS '해당 월의 품목 단가';

-- 4. RLS 정책 (나중에 인증 구현 시)
-- ALTER TABLE item_price_history ENABLE ROW LEVEL SECURITY;
