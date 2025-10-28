-- Migration: Add trigger to automatically update items.current_stock
-- Date: 2024

-- Create trigger function that updates current_stock in items table
CREATE OR REPLACE FUNCTION update_stock_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update current_stock in items table based on transaction type
    IF TG_OP = 'INSERT' THEN
        IF NEW.transaction_type = '입고' THEN
            UPDATE items 
            SET current_stock = COALESCE(current_stock, 0) + NEW.quantity,
                updated_at = NOW()
            WHERE item_id = NEW.item_id;
        ELSIF NEW.transaction_type = '출고' THEN
            UPDATE items 
            SET current_stock = COALESCE(current_stock, 0) - NEW.quantity,
                updated_at = NOW()
            WHERE item_id = NEW.item_id;
        ELSIF NEW.transaction_type = '조정' THEN
            -- For adjustments, the API already handles the stock update
            -- Just refresh updated_at to indicate modification
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
        IF OLD.transaction_type = '입고' THEN
            UPDATE items 
            SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - OLD.quantity),
                updated_at = NOW()
            WHERE item_id = OLD.item_id;
        ELSIF OLD.transaction_type = '출고' THEN
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

-- Drop trigger if it exists and create new one
DROP TRIGGER IF EXISTS update_stock_on_transaction ON inventory_transactions;

CREATE TRIGGER update_stock_on_transaction
AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_transaction();

COMMENT ON FUNCTION update_stock_on_transaction() IS 'Automatically updates items.current_stock when inventory_transactions are modified';
