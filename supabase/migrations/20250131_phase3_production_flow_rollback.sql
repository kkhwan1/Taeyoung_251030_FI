-- Phase 3: Production Flow Database Schema ROLLBACK
-- Created: 2025-01-31
-- Purpose: Safely rollback production flow schema changes

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- This file rolls back changes from 20250131_phase3_production_flow.sql
-- Execute this file ONLY if you need to undo the production flow migration
-- WARNING: This will delete all production batch data permanently!
-- =============================================================================

-- 1. Drop trigger first (before dropping function)
DROP TRIGGER IF EXISTS auto_production_stock_movement_trigger ON production_batch;

-- 2. Drop trigger function
DROP FUNCTION IF EXISTS auto_production_stock_movement();

-- 3. Revert transaction_type constraint to original values
DO $$
BEGIN
  ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

  ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'IN',
    'OUT',
    'PRODUCTION',
    'ADJUSTMENT',
    'TRANSFER',
    'RETURN'
  ));
END $$;

-- 4. Drop process_flow table
DROP TABLE IF EXISTS process_flow CASCADE;

-- 5. Drop production_batch_items table
DROP TABLE IF EXISTS production_batch_items CASCADE;

-- 6. Drop production_batch table and related objects
DROP TRIGGER IF EXISTS update_production_batch_timestamp_trigger ON production_batch;
DROP FUNCTION IF EXISTS update_production_batch_timestamp();
DROP TABLE IF EXISTS production_batch CASCADE;

-- 7. Remove product_type column from items table
ALTER TABLE items DROP COLUMN IF EXISTS product_type;

-- =============================================================================
-- Rollback Complete
-- =============================================================================
-- All production flow schema changes have been reverted
-- The database is back to pre-Phase 3 state
-- =============================================================================
