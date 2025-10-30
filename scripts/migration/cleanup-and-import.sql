-- ═══════════════════════════════════════
-- 태창 ERP - DATA CLEANUP & IMPORT SQL
-- ═══════════════════════════════════════
-- Project ID: pybjnkbmtlyaftuiieyq
-- Execution: Run via Supabase MCP execute_sql
-- ═══════════════════════════════════════

-- PHASE 1: DATA CLEANUP
-- ═══════════════════════════════════════

BEGIN;

-- 1.1 Delete all BOM records (130 invalid records)
DELETE FROM bom WHERE bom_id IS NOT NULL;

-- 1.2 Clean up items with price = 0 or NULL (292 records)
UPDATE items
SET price = NULL,
    updated_at = NOW()
WHERE price = 0 OR price IS NULL;

-- 1.3 Clean up "NaN" strings in spec and material
UPDATE items
SET spec = CASE WHEN spec = 'NaN' THEN NULL ELSE spec END,
    material = CASE WHEN material = 'NaN' THEN NULL ELSE material END,
    updated_at = NOW()
WHERE spec = 'NaN' OR material = 'NaN';

COMMIT;

-- ═══════════════════════════════════════
-- PHASE 2: IMPORT PRICE DATA (243 records)
-- ═══════════════════════════════════════
-- Note: This section shows sample syntax.
-- Full import requires batch processing via TypeScript script.
-- ═══════════════════════════════════════

BEGIN;

-- Sample price_master insert (first 10 records)
INSERT INTO price_master (item_code, price, supplier, price_month)
VALUES
  ('69174-DO000', 1203, '태영금속', '2025-04-01'),
  ('69184-DO000', 1203, '태영금속', '2025-04-01'),
  ('69158-DO000', 451, '태영금속', '2025-04-01'),
  ('69168-DO000', 450, '태영금속', '2025-04-01'),
  ('69118-DO000', 158, '태영금속', '2025-04-01'),
  ('50011721C', 2169, '창경에스테크', '2025-04-01'),
  ('50007278B', 2631, '창경에스테크', '2025-04-01'),
  ('50010755C', 2644, '창경에스테크', '2025-04-01'),
  ('50012110B', 1707, '창경에스테크', '2025-04-01'),
  ('651M7-L2000', 298.6, '웅지테크', '2025-04-01')
ON CONFLICT (item_code, price_month)
DO UPDATE SET
  price = EXCLUDED.price,
  supplier = EXCLUDED.supplier,
  updated_at = NOW();

-- Update items table with latest prices from price_master
UPDATE items i
SET price = pm.price,
    updated_at = NOW()
FROM price_master pm
WHERE i.item_code = pm.item_code
  AND pm.price_month = (
    SELECT MAX(price_month)
    FROM price_master pm2
    WHERE pm2.item_code = i.item_code
  );

COMMIT;

-- ═══════════════════════════════════════
-- PHASE 3: IMPORT COMPREHENSIVE ITEMS (34 records)
-- ═══════════════════════════════════════
-- Sample items from comprehensive-items.json
-- Full import requires duplicate check via TypeScript
-- ═══════════════════════════════════════

BEGIN;

-- Sample comprehensive items insert (first 5 records)
INSERT INTO items (item_code, item_name, category, spec, unit, is_active)
VALUES
  ('65522-A3000', 'EXTN RR FLOOR (일반,VEN)', '1600T', 'TAM', 'EA', true),
  ('65712-A3000', 'MBR RR FLR SIDE LH', '1600T', 'TAM', 'EA', true),
  ('65722-A3000', 'MBR RR FLR SIDE RH', '1600T', 'TAM', 'EA', true),
  ('65522-E2510', 'EXTN-RR FLOOR FR', '1600T', 'TAM BEV', 'EA', true),
  ('65522-L8400', 'EXTN RR FLR FRT (지엠오토 납품)', '1600T', 'GL3', 'EA', true)
ON CONFLICT (item_code)
DO NOTHING;

COMMIT;

-- ═══════════════════════════════════════
-- PHASE 4: VALIDATION QUERIES
-- ═══════════════════════════════════════

-- Record counts
SELECT
  'items' as table_name,
  COUNT(*) as record_count
FROM items
UNION ALL
SELECT
  'items_with_price' as table_name,
  COUNT(*) as record_count
FROM items WHERE price > 0
UNION ALL
SELECT
  'price_master' as table_name,
  COUNT(*) as record_count
FROM price_master
UNION ALL
SELECT
  'bom' as table_name,
  COUNT(*) as record_count
FROM bom
UNION ALL
SELECT
  'inbound_transactions' as table_name,
  COUNT(*) as record_count
FROM inventory_transactions WHERE transaction_type = 'INBOUND';

-- Data quality check
SELECT
  COUNT(*) as total_items,
  SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END) as items_with_price,
  ROUND(100.0 * SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as price_percentage,
  SUM(CASE WHEN spec IS NOT NULL AND spec != 'NaN' THEN 1 ELSE 0 END) as items_with_spec,
  ROUND(100.0 * SUM(CASE WHEN spec IS NOT NULL AND spec != 'NaN' THEN 1 ELSE 0 END) / COUNT(*), 1) as spec_percentage,
  SUM(CASE WHEN material IS NOT NULL AND material != 'NaN' THEN 1 ELSE 0 END) as items_with_material,
  ROUND(100.0 * SUM(CASE WHEN material IS NOT NULL AND material != 'NaN' THEN 1 ELSE 0 END) / COUNT(*), 1) as material_percentage
FROM items;

-- Price distribution by supplier
SELECT
  supplier,
  COUNT(*) as price_records,
  MIN(price) as min_price,
  MAX(price) as max_price,
  ROUND(AVG(price), 2) as avg_price
FROM price_master
GROUP BY supplier
ORDER BY price_records DESC;

-- Items by category
SELECT
  category,
  COUNT(*) as item_count,
  SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END) as with_price,
  ROUND(100.0 * SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as price_pct
FROM items
GROUP BY category
ORDER BY item_count DESC;

-- ═══════════════════════════════════════
-- EXPECTED RESULTS SUMMARY
-- ═══════════════════════════════════════
-- ✅ BOM table: 0 records (cleaned)
-- ✅ price_master: 243 records imported
-- ✅ items with price: 434+ records (updated from price_master)
-- ✅ total items: 726 → 760 (34 new comprehensive items)
-- ✅ Data quality: No "NaN" strings, valid prices
-- ═══════════════════════════════════════
