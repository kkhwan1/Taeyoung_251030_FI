-- 성능 최적화를 위한 인덱스 추가
-- 작성일: 2025-01-23

-- 1. 월별 단가 관리 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_item_price_history_month_item 
ON item_price_history (price_month, item_id);

CREATE INDEX IF NOT EXISTS idx_item_price_history_month 
ON item_price_history (price_month);

-- 2. BOM 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_bom_parent_child 
ON bom (parent_item_id, child_item_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bom_parent_active 
ON bom (parent_item_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bom_child_active 
ON bom (child_item_id) 
WHERE is_active = true;

-- 3. 거래 관련 인덱스 (수금/지급)
CREATE INDEX IF NOT EXISTS idx_sales_transactions_payment_status 
ON sales_transactions (payment_status) 
WHERE payment_status IN ('PENDING', 'PARTIAL');

CREATE INDEX IF NOT EXISTS idx_purchase_transactions_payment_status 
ON purchase_transactions (payment_status) 
WHERE payment_status IN ('PENDING', 'PARTIAL');

CREATE INDEX IF NOT EXISTS idx_sales_transactions_date_status 
ON sales_transactions (transaction_date, payment_status);

CREATE INDEX IF NOT EXISTS idx_purchase_transactions_date_status 
ON purchase_transactions (transaction_date, payment_status);

-- 4. 재고 이력 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_date 
ON inventory_transactions (item_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date 
ON inventory_transactions (transaction_date DESC);

-- 5. 품목 검색 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_items_code_name 
ON items (item_code, item_name);

CREATE INDEX IF NOT EXISTS idx_items_category_active 
ON items (category) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_items_vehicle_model 
ON items (vehicle_model) 
WHERE vehicle_model IS NOT NULL;

-- 6. 회사 검색 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_companies_name_code 
ON companies (company_name, company_code);

CREATE INDEX IF NOT EXISTS idx_companies_type_active 
ON companies (company_type) 
WHERE is_active = true;

-- 7. 컬렉션/페이먼트 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_collections_date_method 
ON collections (collection_date DESC, payment_method);

CREATE INDEX IF NOT EXISTS idx_payments_date_method 
ON payments (payment_date DESC, payment_method);

CREATE INDEX IF NOT EXISTS idx_collections_transaction 
ON collections (sales_transaction_id);

CREATE INDEX IF NOT EXISTS idx_payments_transaction 
ON payments (purchase_transaction_id);

-- 8. 이미지 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_item_images_item_primary 
ON item_images (item_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_item_images_item_order 
ON item_images (item_id, display_order);

-- 9. 복합 인덱스 (자주 함께 사용되는 컬럼들)
CREATE INDEX IF NOT EXISTS idx_items_category_type_active 
ON items (category, item_type, is_active);

CREATE INDEX IF NOT EXISTS idx_bom_parent_level_active 
ON bom (parent_item_id, level_no, is_active);

-- 10. 부분 인덱스 (특정 조건의 데이터만 인덱싱)
CREATE INDEX IF NOT EXISTS idx_items_active_items 
ON items (item_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bom_active_entries 
ON bom (bom_id) 
WHERE is_active = true;

-- 인덱스 생성 완료 메시지
SELECT 'Performance optimization indexes created successfully' as message;
