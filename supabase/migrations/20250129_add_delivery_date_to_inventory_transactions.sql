-- Add delivery_date column to inventory_transactions table
-- 출고 거래의 배송 예정일을 저장하기 위한 컬럼 추가

ALTER TABLE inventory_transactions
ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN inventory_transactions.delivery_date IS '배송 예정일 (출고 거래 시 사용)';

-- Create index for performance (optional but recommended for date queries)
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_delivery_date
ON inventory_transactions(delivery_date)
WHERE delivery_date IS NOT NULL;
