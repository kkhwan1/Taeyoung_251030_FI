-- 결제 수단 어음 추가: collections 및 payments 테이블
-- 생성일: 2025-11-03
-- 목적: 수금 관리 및 지급 관리에 어음(BILL) 결제 수단 추가

-- =====================================================================
-- 1. collections 테이블에 어음 필드 추가
-- =====================================================================
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS bill_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bill_date DATE,
ADD COLUMN IF NOT EXISTS bill_drawer VARCHAR(100);

COMMENT ON COLUMN collections.bill_number IS '어음 번호 (payment_method = BILL인 경우)';
COMMENT ON COLUMN collections.bill_date IS '어음 만기일 (payment_method = BILL인 경우)';
COMMENT ON COLUMN collections.bill_drawer IS '어음 발행자 (payment_method = BILL인 경우)';

-- =====================================================================
-- 2. payments 테이블에 어음 필드 추가
-- =====================================================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS bill_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bill_date DATE,
ADD COLUMN IF NOT EXISTS bill_drawer VARCHAR(100);

COMMENT ON COLUMN payments.bill_number IS '어음 번호 (payment_method = BILL인 경우)';
COMMENT ON COLUMN payments.bill_date IS '어음 만기일 (payment_method = BILL인 경우)';
COMMENT ON COLUMN payments.bill_drawer IS '어음 발행자 (payment_method = BILL인 경우)';

-- =====================================================================
-- 3. collections 테이블 payment_method 제약조건 업데이트
-- =====================================================================
ALTER TABLE collections
DROP CONSTRAINT IF EXISTS collections_payment_method_check;

ALTER TABLE collections
ADD CONSTRAINT collections_payment_method_check
CHECK (payment_method IN ('CASH', 'TRANSFER', 'CHECK', 'CARD', 'BILL'));

-- =====================================================================
-- 4. payments 테이블 payment_method 제약조건 업데이트
-- =====================================================================
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE payments
ADD CONSTRAINT payments_payment_method_check
CHECK (payment_method IN ('CASH', 'TRANSFER', 'CHECK', 'CARD', 'BILL'));

-- =====================================================================
-- 롤백 스크립트 (주석 처리)
-- =====================================================================

/*
-- 롤백 시 아래 명령어를 실행하세요:

ALTER TABLE collections
DROP CONSTRAINT IF EXISTS collections_payment_method_check;
ALTER TABLE collections
ADD CONSTRAINT collections_payment_method_check
CHECK (payment_method IN ('CASH', 'TRANSFER', 'CHECK', 'CARD'));

ALTER TABLE collections
DROP COLUMN IF EXISTS bill_number;
ALTER TABLE collections
DROP COLUMN IF EXISTS bill_date;
ALTER TABLE collections
DROP COLUMN IF EXISTS bill_drawer;

ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments
ADD CONSTRAINT payments_payment_method_check
CHECK (payment_method IN ('CASH', 'TRANSFER', 'CHECK', 'CARD'));

ALTER TABLE payments
DROP COLUMN IF EXISTS bill_number;
ALTER TABLE payments
DROP COLUMN IF EXISTS bill_date;
ALTER TABLE payments
DROP COLUMN IF EXISTS bill_drawer;
*/

