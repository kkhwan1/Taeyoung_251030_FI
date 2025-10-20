-- Phase 2 Task 5: Index Optimization for Notifications
-- Created: 2025-01-17
-- Target: 15-25% query time reduction

-- ============================================================================
-- 1. DROP REDUNDANT INDEXES
-- ============================================================================
-- The new covering indexes will replace these specific-column indexes
DROP INDEX IF EXISTS idx_notifications_type;
DROP INDEX IF EXISTS idx_notifications_is_read;

-- ============================================================================
-- 2. COVERING INDEX FOR MOST COMMON QUERY PATTERN
-- ============================================================================
-- Query: SELECT * WHERE user_id = ? AND type = ? AND is_read = ? ORDER BY created_at DESC
-- This covering index includes all filter columns + sort column + frequently selected columns
CREATE INDEX IF NOT EXISTS idx_notifications_covering_full ON notifications(
  user_id,
  type,
  is_read,
  created_at DESC
) INCLUDE (
  notification_id,
  title,
  message,
  item_id,
  updated_at
);

-- ============================================================================
-- 3. OPTIMIZED INDEX FOR UNREAD NOTIFICATIONS (MOST COMMON USE CASE)
-- ============================================================================
-- Query: SELECT * WHERE user_id = ? AND is_read = false ORDER BY created_at DESC
-- Partial index for unread notifications only (smaller, faster)
CREATE INDEX IF NOT EXISTS idx_notifications_unread_covering ON notifications(
  user_id,
  created_at DESC
)
INCLUDE (
  notification_id,
  type,
  title,
  message,
  item_id
)
WHERE is_read = FALSE;

-- ============================================================================
-- 4. OPTIMIZED INDEX FOR TYPE-FILTERED QUERIES
-- ============================================================================
-- Query: SELECT * WHERE user_id = ? AND type = 'price_alert' ORDER BY created_at DESC
-- Partial indexes for specific notification types
CREATE INDEX IF NOT EXISTS idx_notifications_price_alert ON notifications(
  user_id,
  created_at DESC
)
INCLUDE (
  notification_id,
  title,
  message,
  item_id,
  is_read
)
WHERE type = 'price_alert';

CREATE INDEX IF NOT EXISTS idx_notifications_price_change ON notifications(
  user_id,
  created_at DESC
)
INCLUDE (
  notification_id,
  title,
  message,
  item_id,
  is_read
)
WHERE type = 'price_change';

-- ============================================================================
-- 5. ANALYZE TABLE FOR QUERY PLANNER
-- ============================================================================
-- Update statistics for better query planning
ANALYZE notifications;
ANALYZE notification_preferences;

-- ============================================================================
-- 6. VERIFICATION QUERIES (FOR TESTING)
-- ============================================================================
-- Test query 1: Most common pattern (user + type + read status)
-- EXPLAIN ANALYZE
-- SELECT * FROM notifications
-- WHERE user_id = 1 AND type = 'price_alert' AND is_read = false
-- ORDER BY created_at DESC LIMIT 20;

-- Test query 2: Unread notifications only
-- EXPLAIN ANALYZE
-- SELECT * FROM notifications
-- WHERE user_id = 1 AND is_read = false
-- ORDER BY created_at DESC LIMIT 20;

-- Test query 3: Type-specific query
-- EXPLAIN ANALYZE
-- SELECT * FROM notifications
-- WHERE user_id = 1 AND type = 'price_alert'
-- ORDER BY created_at DESC LIMIT 20;

-- ============================================================================
-- 7. INDEX SIZE MONITORING
-- ============================================================================
-- Query to check index sizes (run periodically)
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'notifications'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- EXPECTED IMPROVEMENTS
-- ============================================================================
-- 1. Covering indexes eliminate table lookups → 30-40% faster SELECT queries
-- 2. Partial indexes for unread notifications → 50-60% faster (most common query)
-- 3. Type-specific partial indexes → 20-30% faster for price alerts
-- 4. Removed redundant indexes → Lower write overhead
-- 5. Overall expected improvement: 15-25% average query time reduction
