-- Phase 2-1: 계산서 품목 및 복합 결제 스키마
-- 생성일: 2025-01-31
-- 목적: 계산서 품목 상세 관리 및 복합 결제 수단 지원

-- =====================================================================
-- 1. invoice_items 테이블 생성
-- =====================================================================
CREATE TABLE invoice_items (
  invoice_item_id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount >= 0),
  line_no INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT invoice_items_invoice_line_unique UNIQUE(invoice_id, line_no),
  CONSTRAINT invoice_items_amount_check CHECK (total_amount = quantity * unit_price)
);

-- 인덱스 생성
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_item_id ON invoice_items(item_id);

COMMENT ON TABLE invoice_items IS '계산서 품목 상세 테이블 - 각 거래의 품목별 수량/단가 관리';
COMMENT ON COLUMN invoice_items.line_no IS '품목 순번 (1, 2, 3...)';
COMMENT ON COLUMN invoice_items.unit_price IS '품목별 단가';
COMMENT ON COLUMN invoice_items.total_amount IS '품목별 금액 (수량 × 단가)';

-- =====================================================================
-- 2. payment_splits 테이블 생성
-- =====================================================================
CREATE TABLE payment_splits (
  split_id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES sales_transactions(transaction_id) ON DELETE CASCADE,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'BILL', 'CHECK', 'CREDIT')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  bill_number VARCHAR(50),
  bill_date DATE,
  bill_drawer VARCHAR(100),
  check_number VARCHAR(50),
  check_bank VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT payment_splits_bill_required
    CHECK (payment_method != 'BILL' OR (bill_number IS NOT NULL AND bill_date IS NOT NULL)),
  CONSTRAINT payment_splits_check_required
    CHECK (payment_method != 'CHECK' OR check_number IS NOT NULL)
);

-- 인덱스 생성
CREATE INDEX idx_payment_splits_transaction_id ON payment_splits(transaction_id);
CREATE INDEX idx_payment_splits_method ON payment_splits(payment_method);

COMMENT ON TABLE payment_splits IS '복합 결제 상세 테이블 - 하나의 거래에 대한 여러 결제 수단 조합';
COMMENT ON COLUMN payment_splits.payment_method IS '결제 수단 (현금/카드/어음/수표/외상)';
COMMENT ON COLUMN payment_splits.amount IS '해당 결제 수단의 결제 금액';
COMMENT ON COLUMN payment_splits.bill_number IS '어음 번호 (payment_method = BILL인 경우 필수)';
COMMENT ON COLUMN payment_splits.bill_date IS '어음 만기일 (payment_method = BILL인 경우 필수)';
COMMENT ON COLUMN payment_splits.check_number IS '수표 번호 (payment_method = CHECK인 경우 필수)';

-- =====================================================================
-- 3. 기존 거래 테이블 ENUM 확장 (COMPOUND 추가)
-- =====================================================================

-- 매출 거래 결제 수단 확장
ALTER TABLE sales_transactions DROP CONSTRAINT IF EXISTS sales_transactions_payment_method_check;
ALTER TABLE sales_transactions ADD CONSTRAINT sales_transactions_payment_method_check
  CHECK (payment_method IN ('CASH', 'CARD', 'BILL', 'CHECK', 'CREDIT', 'COMPOUND'));

-- 매입 거래 결제 수단 확장
ALTER TABLE purchases_transactions DROP CONSTRAINT IF EXISTS purchases_transactions_payment_method_check;
ALTER TABLE purchases_transactions ADD CONSTRAINT purchases_transactions_payment_method_check
  CHECK (payment_method IN ('CASH', 'CARD', 'BILL', 'CHECK', 'CREDIT', 'COMPOUND'));

COMMENT ON CONSTRAINT sales_transactions_payment_method_check ON sales_transactions IS
  'COMPOUND는 복합 결제를 의미하며, 실제 결제 수단은 payment_splits 테이블에서 관리';

-- =====================================================================
-- 4. 결제 분할 금액 검증 트리거
-- =====================================================================

-- 트리거 함수: 결제 분할 금액 합계가 거래 총액과 일치하는지 검증
CREATE OR REPLACE FUNCTION validate_payment_splits_total()
RETURNS TRIGGER AS $$
DECLARE
  total_splits DECIMAL(15,2);
  transaction_total DECIMAL(15,2);
BEGIN
  -- payment_splits 테이블에서 해당 거래의 모든 분할 금액 합계 계산
  SELECT COALESCE(SUM(amount), 0) INTO total_splits
  FROM payment_splits
  WHERE transaction_id = NEW.transaction_id;

  -- sales_transactions 테이블에서 거래 총액 조회
  SELECT total_amount INTO transaction_total
  FROM sales_transactions
  WHERE transaction_id = NEW.transaction_id;

  -- 금액 불일치 시 예외 발생
  IF total_splits != transaction_total THEN
    RAISE EXCEPTION '결제 분할 금액 합계(%)가 거래 총액(%)과 일치하지 않습니다',
      total_splits, transaction_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trg_validate_payment_splits_total
  AFTER INSERT OR UPDATE ON payment_splits
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_splits_total();

COMMENT ON FUNCTION validate_payment_splits_total() IS
  '복합 결제 시 분할 금액 합계가 거래 총액과 일치하는지 검증';

-- =====================================================================
-- 5. 롤백 스크립트 (주석 처리)
-- =====================================================================

/*
-- 롤백 시 아래 명령어를 실행하세요:

DROP TRIGGER IF EXISTS trg_validate_payment_splits_total ON payment_splits;
DROP FUNCTION IF EXISTS validate_payment_splits_total();

ALTER TABLE purchases_transactions DROP CONSTRAINT IF EXISTS purchases_transactions_payment_method_check;
ALTER TABLE purchases_transactions ADD CONSTRAINT purchases_transactions_payment_method_check
  CHECK (payment_method IN ('CASH', 'CARD', 'BILL', 'CHECK', 'CREDIT'));

ALTER TABLE sales_transactions DROP CONSTRAINT IF EXISTS sales_transactions_payment_method_check;
ALTER TABLE sales_transactions ADD CONSTRAINT sales_transactions_payment_method_check
  CHECK (payment_method IN ('CASH', 'CARD', 'BILL', 'CHECK', 'CREDIT'));

DROP TABLE IF EXISTS payment_splits CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
*/
