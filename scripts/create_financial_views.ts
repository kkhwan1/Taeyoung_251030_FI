/**
 * Script to create financial statement views in Supabase
 *
 * This script creates two views:
 * 1. v_balance_sheet - Balance sheet (재무상태표)
 * 2. v_cash_flow - Cash flow statement (현금흐름표)
 */

import dotenv from 'dotenv';
import { mcp__supabase__execute_sql } from '../src/lib/supabase-mcp';

dotenv.config();

async function createFinancialViews() {
  console.log('Creating financial statement views...');

  // Balance Sheet View
  const balanceSheetView = `
    CREATE OR REPLACE VIEW v_balance_sheet AS
    WITH asset_items AS (
      -- 유동자산: 재고자산
      SELECT
        '자산' AS main_category,
        '유동자산' AS category,
        '재고자산' AS account_name,
        COALESCE(SUM(i.current_stock * COALESCE(i.unit_price, 0)), 0) AS current_period,
        0::numeric AS prior_period
      FROM items i
      WHERE i.is_active = true

      UNION ALL

      -- 유동자산: 매출채권
      SELECT
        '자산' AS main_category,
        '유동자산' AS category,
        '매출채권' AS account_name,
        COALESCE(SUM(s.total_amount - s.collected_amount), 0) AS current_period,
        0::numeric AS prior_period
      FROM sales_transactions s
      WHERE s.payment_status IN ('PENDING', 'PARTIAL')
        AND s.is_active = true
    ),
    liability_items AS (
      -- 유동부채: 매입채무
      SELECT
        '부채' AS main_category,
        '유동부채' AS category,
        '매입채무' AS account_name,
        COALESCE(SUM(p.total_amount - p.paid_amount), 0) AS current_period,
        0::numeric AS prior_period
      FROM purchases p
      WHERE p.payment_status IN ('PENDING', 'PARTIAL')
        AND p.is_active = true
    ),
    equity_items AS (
      -- 자본: 당기순이익
      SELECT
        '자본' AS main_category,
        '자본' AS category,
        '당기순이익' AS account_name,
        (
          SELECT COALESCE(SUM(s.total_amount), 0)
          FROM sales_transactions s
          WHERE s.transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
            AND s.is_active = true
        ) - (
          SELECT COALESCE(SUM(p.total_amount), 0)
          FROM purchases p
          WHERE p.transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
            AND p.is_active = true
        ) AS current_period,
        0::numeric AS prior_period
    )
    SELECT
      main_category,
      category,
      account_name,
      current_period,
      prior_period,
      current_period - prior_period AS change_amount,
      CASE
        WHEN prior_period = 0 THEN 0
        ELSE ROUND(((current_period - prior_period) / prior_period * 100)::numeric, 2)
      END AS change_rate
    FROM (
      SELECT * FROM asset_items
      UNION ALL
      SELECT * FROM liability_items
      UNION ALL
      SELECT * FROM equity_items
    ) combined
    ORDER BY
      CASE main_category
        WHEN '자산' THEN 1
        WHEN '부채' THEN 2
        WHEN '자본' THEN 3
      END,
      category,
      account_name;
  `;

  // Cash Flow View
  const cashFlowView = `
    CREATE OR REPLACE VIEW v_cash_flow AS
    WITH date_params AS (
      SELECT
        DATE_TRUNC('month', CURRENT_DATE) AS month_start,
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' AS month_end
    ),
    operating_activities AS (
      -- 영업활동: 매출로 인한 현금유입
      SELECT
        '영업활동' AS category,
        '매출로 인한 현금유입' AS activity_name,
        COALESCE(SUM(c.collected_amount), 0) AS amount,
        1 AS display_order
      FROM collections c, date_params d
      WHERE c.collected_date >= d.month_start
        AND c.collected_date < d.month_end
        AND c.is_active = true

      UNION ALL

      -- 영업활동: 매입으로 인한 현금유출
      SELECT
        '영업활동' AS category,
        '매입으로 인한 현금유출' AS activity_name,
        -COALESCE(SUM(p.paid_amount), 0) AS amount,
        2 AS display_order
      FROM payments p, date_params d
      WHERE p.payment_date >= d.month_start
        AND p.payment_date < d.month_end
        AND p.is_active = true
    ),
    investing_activities AS (
      -- 투자활동: 고정자산 취득 (placeholder for future implementation)
      SELECT
        '투자활동' AS category,
        '고정자산 취득' AS activity_name,
        0::numeric AS amount,
        3 AS display_order
    ),
    financing_activities AS (
      -- 재무활동: 차입금 변동 (placeholder for future implementation)
      SELECT
        '재무활동' AS category,
        '차입금 변동' AS activity_name,
        0::numeric AS amount,
        4 AS display_order
    ),
    all_activities AS (
      SELECT * FROM operating_activities
      UNION ALL
      SELECT * FROM investing_activities
      UNION ALL
      SELECT * FROM financing_activities
    )
    SELECT
      category,
      activity_name,
      amount,
      SUM(amount) OVER (PARTITION BY category) AS category_total,
      SUM(amount) OVER () AS net_cash_flow
    FROM all_activities
    ORDER BY display_order;
  `;

  try {
    // Create Balance Sheet View
    console.log('Creating v_balance_sheet view...');
    const balanceSheetResult = await mcp__supabase__execute_sql({
      project_id: process.env.SUPABASE_PROJECT_ID!,
      query: balanceSheetView
    });

    if (balanceSheetResult.error) {
      console.error('Error creating v_balance_sheet:', balanceSheetResult.error);
      throw new Error(balanceSheetResult.error);
    }

    console.log('✅ v_balance_sheet view created successfully');

    // Create Cash Flow View
    console.log('Creating v_cash_flow view...');
    const cashFlowResult = await mcp__supabase__execute_sql({
      project_id: process.env.SUPABASE_PROJECT_ID!,
      query: cashFlowView
    });

    if (cashFlowResult.error) {
      console.error('Error creating v_cash_flow:', cashFlowResult.error);
      throw new Error(cashFlowResult.error);
    }

    console.log('✅ v_cash_flow view created successfully');

    // Test the views
    console.log('\nTesting views...');

    // Test Balance Sheet View
    const balanceSheetTest = await mcp__supabase__execute_sql({
      project_id: process.env.SUPABASE_PROJECT_ID!,
      query: 'SELECT * FROM v_balance_sheet LIMIT 5'
    });

    if (balanceSheetTest.rows && balanceSheetTest.rows.length > 0) {
      console.log('✅ v_balance_sheet test passed. Sample data:');
      console.table(balanceSheetTest.rows);
    } else {
      console.log('⚠️ v_balance_sheet created but no data returned');
    }

    // Test Cash Flow View
    const cashFlowTest = await mcp__supabase__execute_sql({
      project_id: process.env.SUPABASE_PROJECT_ID!,
      query: 'SELECT * FROM v_cash_flow LIMIT 5'
    });

    if (cashFlowTest.rows && cashFlowTest.rows.length > 0) {
      console.log('✅ v_cash_flow test passed. Sample data:');
      console.table(cashFlowTest.rows);
    } else {
      console.log('⚠️ v_cash_flow created but no data returned');
    }

    console.log('\n✅ All financial views created successfully!');

  } catch (error) {
    console.error('Error creating financial views:', error);
    process.exit(1);
  }
}

// Run the script
createFinancialViews().then(() => {
  console.log('Script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});