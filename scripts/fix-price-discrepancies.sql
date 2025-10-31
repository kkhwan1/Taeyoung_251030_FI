-- Fix Price Discrepancies: Immediate Actions
-- Generated: 2025-01-30
-- Source: Excel "최신단가" sheet

BEGIN;

-- ============================================
-- STEP 1: Add Missing Items (3 items)
-- ============================================
-- These items exist in Excel but not in database

INSERT INTO items (
  item_code,
  item_name,
  category,
  price,
  is_active,
  created_at,
  updated_at
) VALUES
-- Item 1: 65100-BY000
(
  '65100-BY000',
  'IMPORTED FROM EXCEL - 최신단가',
  '원자재',
  5830,
  true,
  NOW(),
  NOW()
),
-- Item 2: 65852-BY000
(
  '65852-BY000',
  'IMPORTED FROM EXCEL - 최신단가',
  '원자재',
  5844,
  true,
  NOW(),
  NOW()
),
-- Item 3: 651M7-L2000 (웅지테크)
(
  '651M7-L2000',
  'IMPORTED FROM EXCEL - 최신단가 (웅지테크)',
  '원자재',
  298.6,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (item_code) DO NOTHING;

-- ============================================
-- STEP 2: Update NULL Prices (3 items)
-- ============================================
-- These items have NULL price in database

-- Item 1: 50010562C (태영금속)
UPDATE items
SET
  price = 785,
  updated_at = NOW()
WHERE item_code = '50010562C'
  AND is_active = true
  AND price IS NULL;

-- Item 2: 50010755C (창경에스테크)
UPDATE items
SET
  price = 2644,
  updated_at = NOW()
WHERE item_code = '50010755C'
  AND is_active = true
  AND price IS NULL;

-- Item 3: 50010988 (에이오에스)
UPDATE items
SET
  price = 587,
  updated_at = NOW()
WHERE item_code = '50010988'
  AND is_active = true
  AND price IS NULL;

-- ============================================
-- STEP 3: Review Mismatches (DO NOT RUN YET!)
-- ============================================
-- These items have different prices in Excel vs Database
-- MANUAL REVIEW REQUIRED before running these updates!

/*
-- Mismatch 1: 50007278B
-- Current DB: ₩1,488  →  Excel: ₩2,631 (Difference: -₩1,143, -76.8%)
-- Supplier: 창경에스테크
-- UPDATE items SET price = 2631, updated_at = NOW()
-- WHERE item_code = '50007278B' AND is_active = true;

-- Mismatch 2: 50012110B
-- Current DB: ₩2,631  →  Excel: ₩1,707 (Difference: +₩924, +54.1%)
-- Supplier: 창경에스테크
-- UPDATE items SET price = 1707, updated_at = NOW()
-- WHERE item_code = '50012110B' AND is_active = true;

-- Mismatch 3: 65158-L8000
-- Current DB: ₩610  →  Excel: ₩561 (Difference: +₩49, +8.7%)
-- Supplier: 웅지테크
-- UPDATE items SET price = 561, updated_at = NOW()
-- WHERE item_code = '65158-L8000' AND is_active = true;

-- Mismatch 4: 50008904
-- Current DB: ₩1,584  →  Excel: ₩1,491 (Difference: +₩93, +6.2%)
-- Supplier: 에이오에스
-- UPDATE items SET price = 1491, updated_at = NOW()
-- WHERE item_code = '50008904' AND is_active = true;
*/

-- ============================================
-- Verification Queries
-- ============================================

-- Check newly inserted items
SELECT
  item_code,
  item_name,
  price,
  created_at
FROM items
WHERE item_code IN ('65100-BY000', '65852-BY000', '651M7-L2000')
  AND is_active = true
ORDER BY item_code;

-- Check updated NULL prices
SELECT
  item_code,
  item_name,
  price,
  updated_at
FROM items
WHERE item_code IN ('50010562C', '50010755C', '50010988')
  AND is_active = true
ORDER BY item_code;

-- Count remaining NULL prices
SELECT
  COUNT(*) as null_price_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM items WHERE is_active = true), 2) as percentage
FROM items
WHERE is_active = true
  AND price IS NULL;

COMMIT;

-- ============================================
-- ROLLBACK if needed
-- ============================================
-- ROLLBACK;
