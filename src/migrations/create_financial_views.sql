-- 재무상태표 (Balance Sheet) View
-- 자산, 부채, 자본의 현황을 보여주는 재무제표
CREATE OR REPLACE VIEW v_balance_sheet AS
WITH date_params AS (
  -- Date parameters will be injected via API
  SELECT
    COALESCE(CURRENT_DATE, CURRENT_DATE) AS report_date,
    DATE_TRUNC('year', CURRENT_DATE) AS current_year_start,
    DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year') AS prior_year_start,
    DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year') + INTERVAL '1 year' - INTERVAL '1 day' AS prior_year_end
),
asset_items AS (
  -- 유동자산 (Current Assets)
  SELECT
    '자산' AS main_category,
    '유동자산' AS sub_category,
    '재고자산' AS account_name,
    '11' AS account_code,
    COALESCE(SUM(i.current_stock * i.unit_price), 0) AS current_period,
    COALESCE((
      SELECT SUM(it.quantity * i2.unit_price)
      FROM inventory_transactions it
      JOIN items i2 ON it.item_id = i2.item_id
      WHERE it.transaction_date < (SELECT prior_year_end FROM date_params)
        AND it.is_active = true
    ), 0) AS prior_period,
    1 AS display_order
  FROM items i
  WHERE i.is_active = true

  UNION ALL

  -- 매출채권 (Accounts Receivable)
  SELECT
    '자산' AS main_category,
    '유동자산' AS sub_category,
    '매출채권' AS account_name,
    '12' AS account_code,
    COALESCE(SUM(s.total_amount - s.collected_amount), 0) AS current_period,
    COALESCE((
      SELECT SUM(s2.total_amount - s2.collected_amount)
      FROM sales_transactions s2
      WHERE s2.transaction_date <= (SELECT prior_year_end FROM date_params)
        AND s2.payment_status IN ('PENDING', 'PARTIAL')
        AND s2.is_active = true
    ), 0) AS prior_period,
    2 AS display_order
  FROM sales_transactions s
  WHERE s.payment_status IN ('PENDING', 'PARTIAL')
    AND s.is_active = true

  UNION ALL

  -- 현금및현금성자산 (Cash and Cash Equivalents)
  SELECT
    '자산' AS main_category,
    '유동자산' AS sub_category,
    '현금및현금성자산' AS account_name,
    '10' AS account_code,
    COALESCE(SUM(c.collected_amount), 0) - COALESCE(SUM(p.paid_amount), 0) AS current_period,
    0 AS prior_period, -- Would need historical cash balance tracking
    3 AS display_order
  FROM (SELECT collected_amount FROM collections WHERE is_active = true) c
  FULL OUTER JOIN (SELECT paid_amount FROM payments WHERE is_active = true) p ON false
),
liability_items AS (
  -- 유동부채 (Current Liabilities)
  SELECT
    '부채' AS main_category,
    '유동부채' AS sub_category,
    '매입채무' AS account_name,
    '21' AS account_code,
    COALESCE(SUM(p.total_amount - p.paid_amount), 0) AS current_period,
    COALESCE((
      SELECT SUM(p2.total_amount - p2.paid_amount)
      FROM purchases p2
      WHERE p2.transaction_date <= (SELECT prior_year_end FROM date_params)
        AND p2.payment_status IN ('PENDING', 'PARTIAL')
        AND p2.is_active = true
    ), 0) AS prior_period,
    4 AS display_order
  FROM purchases p
  WHERE p.payment_status IN ('PENDING', 'PARTIAL')
    AND p.is_active = true

  UNION ALL

  -- 미지급금 (Accrued Expenses)
  SELECT
    '부채' AS main_category,
    '유동부채' AS sub_category,
    '미지급금' AS account_name,
    '22' AS account_code,
    0 AS current_period, -- Placeholder for accrued expenses
    0 AS prior_period,
    5 AS display_order
),
equity_items AS (
  -- 자본 (Equity)
  SELECT
    '자본' AS main_category,
    '자본' AS sub_category,
    '자본금' AS account_name,
    '31' AS account_code,
    100000000 AS current_period, -- Default capital (100M KRW)
    100000000 AS prior_period,
    6 AS display_order

  UNION ALL

  -- 이익잉여금 (Retained Earnings)
  SELECT
    '자본' AS main_category,
    '자본' AS sub_category,
    '이익잉여금' AS account_name,
    '32' AS account_code,
    (
      SELECT COALESCE(SUM(s.total_amount), 0) - COALESCE(SUM(p.total_amount), 0)
      FROM (
        SELECT total_amount
        FROM sales_transactions
        WHERE transaction_date < DATE_TRUNC('year', CURRENT_DATE)
          AND is_active = true
      ) s
      FULL OUTER JOIN (
        SELECT total_amount
        FROM purchases
        WHERE transaction_date < DATE_TRUNC('year', CURRENT_DATE)
          AND is_active = true
      ) p ON false
    ) AS current_period,
    0 AS prior_period,
    7 AS display_order

  UNION ALL

  -- 당기순이익 (Net Income)
  SELECT
    '자본' AS main_category,
    '자본' AS sub_category,
    '당기순이익' AS account_name,
    '33' AS account_code,
    (
      SELECT COALESCE(SUM(s.total_amount), 0)
      FROM sales_transactions s
      WHERE s.transaction_date >= (SELECT current_year_start FROM date_params)
        AND s.is_active = true
    ) - (
      SELECT COALESCE(SUM(p.total_amount), 0)
      FROM purchases p
      WHERE p.transaction_date >= (SELECT current_year_start FROM date_params)
        AND p.is_active = true
    ) AS current_period,
    (
      SELECT COALESCE(SUM(s.total_amount), 0)
      FROM sales_transactions s
      WHERE s.transaction_date >= (SELECT prior_year_start FROM date_params)
        AND s.transaction_date <= (SELECT prior_year_end FROM date_params)
        AND s.is_active = true
    ) - (
      SELECT COALESCE(SUM(p.total_amount), 0)
      FROM purchases p
      WHERE p.transaction_date >= (SELECT prior_year_start FROM date_params)
        AND p.transaction_date <= (SELECT prior_year_end FROM date_params)
        AND p.is_active = true
    ) AS prior_period,
    8 AS display_order
)
SELECT
  main_category,
  sub_category,
  account_name,
  account_code,
  current_period AS current_amount,
  prior_period AS prior_amount,
  current_period - prior_period AS change_amount,
  CASE
    WHEN prior_period = 0 AND current_period = 0 THEN 0
    WHEN prior_period = 0 THEN 100
    ELSE ROUND(((current_period - prior_period) / NULLIF(prior_period, 0) * 100)::numeric, 2)
  END AS change_rate,
  display_order
FROM (
  SELECT * FROM asset_items
  UNION ALL
  SELECT * FROM liability_items
  UNION ALL
  SELECT * FROM equity_items
) combined
ORDER BY display_order;

-- 현금흐름표 (Cash Flow Statement) View
-- 영업활동, 투자활동, 재무활동으로 인한 현금의 변동을 보여주는 재무제표
CREATE OR REPLACE VIEW v_cash_flow AS
WITH date_params AS (
  SELECT
    DATE_TRUNC('month', CURRENT_DATE) AS current_month_start,
    DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' AS current_month_end,
    DATE_TRUNC('year', CURRENT_DATE) AS current_year_start,
    DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' AS current_year_end
),
operating_activities AS (
  -- 영업활동 현금흐름 (Operating Activities)

  -- 매출로 인한 현금유입
  SELECT
    '영업활동' AS main_category,
    '영업수입' AS sub_category,
    '매출로 인한 현금유입' AS activity_name,
    COALESCE(SUM(
      CASE
        WHEN c.collected_date >= (SELECT current_month_start FROM date_params)
         AND c.collected_date < (SELECT current_month_end FROM date_params)
        THEN c.collected_amount
        ELSE 0
      END
    ), 0) AS current_month,
    COALESCE(SUM(
      CASE
        WHEN c.collected_date >= (SELECT current_year_start FROM date_params)
         AND c.collected_date < (SELECT current_year_end FROM date_params)
        THEN c.collected_amount
        ELSE 0
      END
    ), 0) AS year_to_date,
    1 AS display_order
  FROM collections c
  WHERE c.is_active = true

  UNION ALL

  -- 매입으로 인한 현금유출
  SELECT
    '영업활동' AS main_category,
    '영업지출' AS sub_category,
    '매입으로 인한 현금유출' AS activity_name,
    -COALESCE(SUM(
      CASE
        WHEN p.payment_date >= (SELECT current_month_start FROM date_params)
         AND p.payment_date < (SELECT current_month_end FROM date_params)
        THEN p.paid_amount
        ELSE 0
      END
    ), 0) AS current_month,
    -COALESCE(SUM(
      CASE
        WHEN p.payment_date >= (SELECT current_year_start FROM date_params)
         AND p.payment_date < (SELECT current_year_end FROM date_params)
        THEN p.paid_amount
        ELSE 0
      END
    ), 0) AS year_to_date,
    2 AS display_order
  FROM payments p
  WHERE p.is_active = true

  UNION ALL

  -- 재고 변동으로 인한 현금유출
  SELECT
    '영업활동' AS main_category,
    '영업지출' AS sub_category,
    '재고자산의 증가' AS activity_name,
    -COALESCE(SUM(
      CASE
        WHEN it.transaction_date >= (SELECT current_month_start FROM date_params)
         AND it.transaction_date < (SELECT current_month_end FROM date_params)
         AND it.transaction_type = 'IN'
        THEN it.quantity * i.unit_price
        WHEN it.transaction_date >= (SELECT current_month_start FROM date_params)
         AND it.transaction_date < (SELECT current_month_end FROM date_params)
         AND it.transaction_type = 'OUT'
        THEN -it.quantity * i.unit_price
        ELSE 0
      END
    ), 0) AS current_month,
    -COALESCE(SUM(
      CASE
        WHEN it.transaction_date >= (SELECT current_year_start FROM date_params)
         AND it.transaction_date < (SELECT current_year_end FROM date_params)
         AND it.transaction_type = 'IN'
        THEN it.quantity * i.unit_price
        WHEN it.transaction_date >= (SELECT current_year_start FROM date_params)
         AND it.transaction_date < (SELECT current_year_end FROM date_params)
         AND it.transaction_type = 'OUT'
        THEN -it.quantity * i.unit_price
        ELSE 0
      END
    ), 0) AS year_to_date,
    3 AS display_order
  FROM inventory_transactions it
  JOIN items i ON it.item_id = i.item_id
  WHERE it.is_active = true
),
investing_activities AS (
  -- 투자활동 현금흐름 (Investing Activities)

  -- 설비 투자 (placeholder)
  SELECT
    '투자활동' AS main_category,
    '투자지출' AS sub_category,
    '유형자산의 취득' AS activity_name,
    0::numeric AS current_month,
    0::numeric AS year_to_date,
    4 AS display_order

  UNION ALL

  -- 설비 매각 (placeholder)
  SELECT
    '투자활동' AS main_category,
    '투자수입' AS sub_category,
    '유형자산의 처분' AS activity_name,
    0::numeric AS current_month,
    0::numeric AS year_to_date,
    5 AS display_order
),
financing_activities AS (
  -- 재무활동 현금흐름 (Financing Activities)

  -- 차입금 증가 (placeholder)
  SELECT
    '재무활동' AS main_category,
    '재무수입' AS sub_category,
    '차입금의 증가' AS activity_name,
    0::numeric AS current_month,
    0::numeric AS year_to_date,
    6 AS display_order

  UNION ALL

  -- 차입금 상환 (placeholder)
  SELECT
    '재무활동' AS main_category,
    '재무지출' AS sub_category,
    '차입금의 상환' AS activity_name,
    0::numeric AS current_month,
    0::numeric AS year_to_date,
    7 AS display_order
),
all_activities AS (
  SELECT * FROM operating_activities
  UNION ALL
  SELECT * FROM investing_activities
  UNION ALL
  SELECT * FROM financing_activities
)
SELECT
  main_category,
  sub_category,
  activity_name,
  current_month,
  year_to_date,
  SUM(current_month) OVER (PARTITION BY main_category) AS category_month_total,
  SUM(year_to_date) OVER (PARTITION BY main_category) AS category_year_total,
  SUM(current_month) OVER () AS net_cash_flow_month,
  SUM(year_to_date) OVER () AS net_cash_flow_year,
  display_order
FROM all_activities
ORDER BY display_order;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_transactions_payment_date ON sales_transactions(transaction_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_purchases_payment_date ON purchases(transaction_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_collections_collected_date ON collections(collected_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(transaction_date) WHERE is_active = true;