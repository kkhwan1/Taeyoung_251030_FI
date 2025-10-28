-- 성능 최적화를 위한 추가 인덱스 생성
-- 작성일: 2025-10-24
-- 목적: 대시보드 쿼리 및 자주 사용되는 조회 최적화

-- 1. 대시보드 재고 집계 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_items_category_stock 
ON items (category, current_stock, is_active) 
WHERE is_active = true;

-- 2. 거래 내역 조회 최적화 (대시보드 차트용)
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type_date 
ON inventory_transactions (transaction_type, transaction_date DESC, status);

-- 3. 회사별 거래 조회 최적화
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_company_date 
ON inventory_transactions (company_id, transaction_date DESC) 
WHERE company_id IS NOT NULL;

-- 4. 품목별 거래 조회 최적화
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_date 
ON inventory_transactions (item_id, transaction_date DESC);

-- 5. 재고 부족 알림 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_items_stock_levels 
ON items (current_stock, safety_stock, minimum_stock) 
WHERE is_active = true;

-- 6. 월별 거래 통계 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_monthly 
ON inventory_transactions (DATE_TRUNC('month', transaction_date), transaction_type);

-- 7. 품목 검색 성능 향상 (텍스트 검색)
CREATE INDEX IF NOT EXISTS idx_items_search_text 
ON items USING gin(to_tsvector('korean', item_name || ' ' || COALESCE(spec, '') || ' ' || COALESCE(material, ''))) 
WHERE is_active = true;

-- 8. 거래처 검색 최적화
CREATE INDEX IF NOT EXISTS idx_companies_search 
ON companies USING gin(to_tsvector('korean', company_name || ' ' || COALESCE(company_code, ''))) 
WHERE is_active = true;

-- 9. 최근 거래 조회 최적화
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_recent 
ON inventory_transactions (transaction_date DESC, created_at DESC) 
WHERE status = '완료';

-- 10. 품목별 재고 이력 조회 최적화
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_history 
ON inventory_transactions (item_id, transaction_date DESC, transaction_type);

-- 인덱스 생성 완료 메시지
SELECT 'Critical performance indexes created successfully' as message;
