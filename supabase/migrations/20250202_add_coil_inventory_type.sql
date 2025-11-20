-- Migration: Add '코일' (Coil) to inventory_type enum
-- Date: 2025-02-02
-- Purpose: Extend inventory classification system to support coil material type
-- Related: Phone conversation with 태창금속 조성원 팀장 (2025.10.31)

-- Add '코일' to inventory_type enum
-- This is a foundational change for tracking coil → blanking → plate flow
ALTER TYPE inventory_type ADD VALUE IF NOT EXISTS '코일';

-- Update enum comment with new type
COMMENT ON TYPE inventory_type IS '재고 분류 타입: 완제품 (finished products), 반제품 (semi-finished), 고객재고 (customer inventory), 원재료 (raw materials), 코일 (coil)';

-- Verification query (commented out - for manual testing)
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'inventory_type'::regtype ORDER BY enumsortorder;
