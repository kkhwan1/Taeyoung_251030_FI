-- Migration: BOM 자동 차감 트리거
-- Date: 2025-10-27
-- Purpose: 생산입고 시 BOM에 따라 원자재를 자동으로 차감하고 bom_deduction_log에 기록

-- Step 1: BOM 차감 처리 함수 생성
CREATE OR REPLACE FUNCTION process_production_bom_deduction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    bom_record RECORD;
    required_quantity DECIMAL(15,2);
    current_stock_amount DECIMAL(15,2);
    actual_deducted DECIMAL(15,2);
    stock_after DECIMAL(15,2);
    deduction_log_id INTEGER;
BEGIN
    -- 생산입고 거래만 처리 (생산출고는 원자재 반납 처리)
    IF NEW.transaction_type = '생산입고' THEN
        -- 해당 완제품의 BOM 조회
        FOR bom_record IN
            SELECT 
                b.child_item_id,
                b.quantity as bom_quantity,
                i.current_stock
            FROM bom b
            JOIN items i ON b.child_item_id = i.item_id
            WHERE b.parent_item_id = NEW.item_id
                AND b.is_active = true
                AND i.is_active = true
        LOOP
            -- 필요 원자재 수량 계산: BOM 수량 × 생산 수량
            required_quantity := bom_record.bom_quantity * NEW.quantity;
            
            -- 현재 재고 확인
            current_stock_amount := COALESCE(bom_record.current_stock, 0);
            
            -- 실제 차감 수량 계산 (재고가 부족하더라도 가능한 만큼만 차감)
            actual_deducted := LEAST(required_quantity, current_stock_amount);
            stock_after := current_stock_amount - actual_deducted;
            
            -- 원자재 차감 (생산출고 거래 생성)
            INSERT INTO inventory_transactions (
                transaction_date,
                transaction_type,
                item_id,
                quantity,
                unit_price,
                total_amount,
                reference_number,
                notes,
                created_by,
                warehouse_id,
                status
            ) VALUES (
                NEW.transaction_date,
                '생산출고',
                bom_record.child_item_id,
                actual_deducted,
                0,  -- 단가는 0으로 설정 (원가 계산은 별도)
                0,  -- 총액도 0
                NEW.reference_number,
                CONCAT('BOM 차감 - 생산거래#', NEW.transaction_id),
                NEW.created_by,
                NEW.warehouse_id,
                'COMPLETED'
            );
            
            -- 차감 로그 기록
            INSERT INTO bom_deduction_log (
                transaction_id,
                parent_item_id,
                child_item_id,
                required_quantity,
                actual_deducted,
                stock_before,
                stock_after,
                usage_rate,
                notes
            ) VALUES (
                NEW.transaction_id,
                NEW.item_id,
                bom_record.child_item_id,
                required_quantity,
                actual_deducted,
                current_stock_amount,
                stock_after,
                CASE 
                    WHEN required_quantity > 0 THEN (actual_deducted / required_quantity * 100.0)
                    ELSE 0 
                END,  -- 실제 사용률 계산
                CASE 
                    WHEN current_stock_amount < required_quantity THEN 
                        CONCAT('자동 BOM 차감 (재고 부족: 필요 ', required_quantity, ', 실제 ', actual_deducted, ')')
                    ELSE '자동 BOM 차감'
                END
            )
            RETURNING log_id INTO deduction_log_id;
            
        END LOOP;
        
    ELSIF NEW.transaction_type = '생산출고' THEN
        -- 생산출고는 이미 차감된 원자재이므로 추가 처리 없음
        -- 단, items.current_stock은 트리거 update_stock_on_transaction()에서 처리됨
        NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Step 2: BOM 차감 로그 테이블이 존재하는지 확인하고 없으면 생성
CREATE TABLE IF NOT EXISTS bom_deduction_log (
    log_id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES inventory_transactions(transaction_id) ON DELETE CASCADE,
    parent_item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE RESTRICT,
    child_item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE RESTRICT,
    required_quantity DECIMAL(15,2) NOT NULL,
    actual_deducted DECIMAL(15,2) NOT NULL,
    stock_before DECIMAL(15,2) NOT NULL,
    stock_after DECIMAL(15,2) NOT NULL,
    usage_rate DECIMAL(5,2) DEFAULT 100.0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_bom_deduction_log_transaction_id 
    ON bom_deduction_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bom_deduction_log_parent_item_id 
    ON bom_deduction_log(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_bom_deduction_log_child_item_id 
    ON bom_deduction_log(child_item_id);
CREATE INDEX IF NOT EXISTS idx_bom_deduction_log_created_at 
    ON bom_deduction_log(created_at DESC);

-- Step 4: 기존 트리거 제거 후 새로 생성
DROP TRIGGER IF EXISTS process_production_bom_deduction_trigger ON inventory_transactions;

CREATE TRIGGER process_production_bom_deduction_trigger
AFTER INSERT ON inventory_transactions
FOR EACH ROW
WHEN (NEW.transaction_type IN ('생산입고', '생산출고'))
EXECUTE FUNCTION process_production_bom_deduction();

-- Step 5: 기존 update_stock_on_transaction 트리거 수정 (생산입고, 생산출고 추가)
DROP TRIGGER IF EXISTS update_stock_on_transaction ON inventory_transactions;

-- 트리거 함수 수정
CREATE OR REPLACE FUNCTION update_stock_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update current_stock in items table based on transaction type
    IF TG_OP = 'INSERT' THEN
        IF NEW.transaction_type = '입고' OR NEW.transaction_type = '생산입고' THEN
            -- 입고 시 재고 증가
            UPDATE items 
            SET current_stock = COALESCE(current_stock, 0) + NEW.quantity,
                updated_at = NOW()
            WHERE item_id = NEW.item_id;
        ELSIF NEW.transaction_type = '출고' OR NEW.transaction_type = '생산출고' THEN
            -- 출고 시 재고 감소
            UPDATE items 
            SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - NEW.quantity),
                updated_at = NOW()
            WHERE item_id = NEW.item_id;
        ELSIF NEW.transaction_type = '조정' THEN
            -- 조정은 API에서 처리
            UPDATE items 
            SET updated_at = NOW()
            WHERE item_id = NEW.item_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- If transaction is updated, mark item for potential recalculation
        UPDATE items 
        SET updated_at = NOW()
        WHERE item_id = COALESCE(NEW.item_id, OLD.item_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Revert the stock change on deletion
        IF OLD.transaction_type = '입고' OR OLD.transaction_type = '생산입고' THEN
            UPDATE items 
            SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - OLD.quantity),
                updated_at = NOW()
            WHERE item_id = OLD.item_id;
        ELSIF OLD.transaction_type = '출고' OR OLD.transaction_type = '생산출고' THEN
            UPDATE items 
            SET current_stock = COALESCE(current_stock, 0) + OLD.quantity,
                updated_at = NOW()
            WHERE item_id = OLD.item_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- 트리거 다시 생성
CREATE TRIGGER update_stock_on_transaction
AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_transaction();

-- 주석 추가
COMMENT ON FUNCTION process_production_bom_deduction() IS 
    '생산입고 시 BOM을 조회하여 원자재를 자동으로 차감하고 bom_deduction_log에 기록합니다.';
    
COMMENT ON TABLE bom_deduction_log IS 
    'BOM 자동 차감 로그 - 생산 시 원자재 차감 내역을 기록합니다.';

COMMENT ON FUNCTION update_stock_on_transaction() IS 
    '재고 거래 시 items.current_stock을 자동으로 업데이트합니다 (입고/생산입고 증가, 출고/생산출고 감소).';

