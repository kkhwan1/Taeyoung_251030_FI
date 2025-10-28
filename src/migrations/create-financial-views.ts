/**
 * Create Financial Statement Views
 *
 * This script creates database views for:
 * 1. Balance Sheet (재무상태표)
 * 2. Cash Flow Statement (현금흐름표)
 *
 * Run with: npm run migrate:financial-views
 */

import { mcp__supabase__execute_sql } from '../lib/supabase-mcp';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID;

if (!PROJECT_ID) {
  console.error('[ERROR] SUPABASE_PROJECT_ID is not set in environment variables');
  process.exit(1);
}

// Type assertion: PROJECT_ID is guaranteed to be string after the check above
const projectId: string = PROJECT_ID;

async function createBalanceSheetView() {
  console.log('[INFO] Creating Balance Sheet view (v_balance_sheet)...');

  const query = `
    -- Drop existing view if exists
    DROP VIEW IF EXISTS v_balance_sheet CASCADE;

    -- Create Balance Sheet View
    CREATE OR REPLACE VIEW v_balance_sheet AS
    WITH
    -- 자산 (Assets)
    asset_items AS (
      -- 유동자산 - 재고자산
      SELECT
        '자산' AS category,
        '유동자산' AS subcategory,
        '재고자산' AS account_name,
        '1110' AS account_code,
        1 AS display_order,
        COALESCE(SUM(i.current_stock * i.unit_price), 0) AS amount
      FROM items i
      WHERE i.is_active = true

      UNION ALL

      -- 유동자산 - 매출채권
      SELECT
        '자산' AS category,
        '유동자산' AS subcategory,
        '매출채권' AS account_name,
        '1120' AS account_code,
        2 AS display_order,
        COALESCE(SUM(s.total_amount - s.collected_amount), 0) AS amount
      FROM sales_transactions s
      WHERE s.payment_status IN ('PENDING', 'PARTIAL')
    ),

    -- 부채 (Liabilities)
    liability_items AS (
      -- 유동부채 - 매입채무
      SELECT
        '부채' AS category,
        '유동부채' AS subcategory,
        '매입채무' AS account_name,
        '2110' AS account_code,
        10 AS display_order,
        COALESCE(SUM(p.total_amount - p.paid_amount), 0) AS amount
      FROM purchases p
      WHERE p.payment_status IN ('PENDING', 'PARTIAL')
    ),

    -- 자본 (Equity)
    equity_items AS (
      -- 자본 - 당기순이익
      SELECT
        '자본' AS category,
        '이익잉여금' AS subcategory,
        '당기순이익' AS account_name,
        '3310' AS account_code,
        20 AS display_order,
        (
          -- 매출 총액
          SELECT COALESCE(SUM(s.total_amount), 0)
          FROM sales_transactions s
          WHERE DATE_PART('year', s.transaction_date) = DATE_PART('year', CURRENT_DATE)
        ) - (
          -- 매입 총액
          SELECT COALESCE(SUM(p.total_amount), 0)
          FROM purchases p
          WHERE DATE_PART('year', p.transaction_date) = DATE_PART('year', CURRENT_DATE)
        ) AS amount
    ),

    -- Combine all categories
    all_items AS (
      SELECT * FROM asset_items
      UNION ALL
      SELECT * FROM liability_items
      UNION ALL
      SELECT * FROM equity_items
    )

    SELECT
      category,
      subcategory,
      account_name,
      account_code,
      display_order,
      amount,
      CURRENT_TIMESTAMP AS created_at
    FROM all_items
    ORDER BY display_order, account_code;

    -- Create index for better performance
    COMMENT ON VIEW v_balance_sheet IS '재무상태표 (Balance Sheet) - 자산, 부채, 자본의 현재 상태를 보여주는 뷰';
  `;

  try {
    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    console.log('[SUCCESS] Balance Sheet view created successfully');
    return true;
  } catch (error) {
    console.error('[ERROR] Error creating Balance Sheet view:', error);
    return false;
  }
}

async function createCashFlowView() {
  console.log('[INFO] Creating Cash Flow view (v_cash_flow)...');

  const query = `
    -- Drop existing view if exists
    DROP VIEW IF EXISTS v_cash_flow CASCADE;

    -- Create Cash Flow View
    CREATE OR REPLACE VIEW v_cash_flow AS
    WITH
    -- 영업활동 (Operating Activities)
    operating_activities AS (
      -- 매출로 인한 현금유입
      SELECT
        '영업활동' AS category,
        '매출 수금' AS activity_name,
        '4110' AS activity_code,
        1 AS display_order,
        COALESCE(SUM(c.collected_amount), 0) AS inflow,
        0 AS outflow,
        COALESCE(SUM(c.collected_amount), 0) AS net_amount,
        MIN(c.collected_date) AS start_date,
        MAX(c.collected_date) AS end_date
      FROM collections c
      WHERE c.collected_date >= DATE_TRUNC('year', CURRENT_DATE)

      UNION ALL

      -- 매입으로 인한 현금유출
      SELECT
        '영업활동' AS category,
        '매입 지급' AS activity_name,
        '5110' AS activity_code,
        2 AS display_order,
        0 AS inflow,
        COALESCE(SUM(p.paid_amount), 0) AS outflow,
        -COALESCE(SUM(p.paid_amount), 0) AS net_amount,
        MIN(p.payment_date) AS start_date,
        MAX(p.payment_date) AS end_date
      FROM payments p
      WHERE p.payment_date >= DATE_TRUNC('year', CURRENT_DATE)
    ),

    -- 투자활동 (Investing Activities) - placeholder for future
    investing_activities AS (
      SELECT
        '투자활동' AS category,
        '설비투자' AS activity_name,
        '6110' AS activity_code,
        10 AS display_order,
        0::DECIMAL AS inflow,
        0::DECIMAL AS outflow,
        0::DECIMAL AS net_amount,
        CURRENT_DATE AS start_date,
        CURRENT_DATE AS end_date
    ),

    -- 재무활동 (Financing Activities) - placeholder for future
    financing_activities AS (
      SELECT
        '재무활동' AS category,
        '차입금' AS activity_name,
        '7110' AS activity_code,
        20 AS display_order,
        0::DECIMAL AS inflow,
        0::DECIMAL AS outflow,
        0::DECIMAL AS net_amount,
        CURRENT_DATE AS start_date,
        CURRENT_DATE AS end_date
    ),

    -- Summary calculations
    summary AS (
      SELECT
        '현금흐름 요약' AS category,
        '영업활동 현금흐름' AS activity_name,
        '8110' AS activity_code,
        30 AS display_order,
        (SELECT COALESCE(SUM(inflow), 0) FROM operating_activities) AS inflow,
        (SELECT COALESCE(SUM(outflow), 0) FROM operating_activities) AS outflow,
        (SELECT COALESCE(SUM(net_amount), 0) FROM operating_activities) AS net_amount,
        (SELECT MIN(start_date) FROM operating_activities) AS start_date,
        (SELECT MAX(end_date) FROM operating_activities) AS end_date

      UNION ALL

      SELECT
        '현금흐름 요약' AS category,
        '기말 현금' AS activity_name,
        '9999' AS activity_code,
        40 AS display_order,
        (
          SELECT COALESCE(SUM(inflow), 0)
          FROM (
            SELECT inflow FROM operating_activities
            UNION ALL SELECT inflow FROM investing_activities
            UNION ALL SELECT inflow FROM financing_activities
          ) t
        ) AS inflow,
        (
          SELECT COALESCE(SUM(outflow), 0)
          FROM (
            SELECT outflow FROM operating_activities
            UNION ALL SELECT outflow FROM investing_activities
            UNION ALL SELECT outflow FROM financing_activities
          ) t
        ) AS outflow,
        (
          SELECT COALESCE(SUM(net_amount), 0)
          FROM (
            SELECT net_amount FROM operating_activities
            UNION ALL SELECT net_amount FROM investing_activities
            UNION ALL SELECT net_amount FROM financing_activities
          ) t
        ) AS net_amount,
        DATE_TRUNC('year', CURRENT_DATE) AS start_date,
        CURRENT_DATE AS end_date
    )

    -- Combine all activities
    SELECT
      category,
      activity_name,
      activity_code,
      display_order,
      inflow,
      outflow,
      net_amount,
      start_date,
      end_date,
      CURRENT_TIMESTAMP AS created_at
    FROM (
      SELECT * FROM operating_activities
      UNION ALL
      SELECT * FROM investing_activities
      UNION ALL
      SELECT * FROM financing_activities
      UNION ALL
      SELECT * FROM summary
    ) all_activities
    ORDER BY display_order, activity_code;

    -- Add comment
    COMMENT ON VIEW v_cash_flow IS '현금흐름표 (Cash Flow Statement) - 영업, 투자, 재무 활동별 현금 흐름을 보여주는 뷰';
  `;

  try {
    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    console.log('[SUCCESS] Cash Flow view created successfully');
    return true;
  } catch (error) {
    console.error('[ERROR] Error creating Cash Flow view:', error);
    return false;
  }
}

async function verifyViews() {
  console.log('[INFO] Verifying created views...');

  const queries = [
    {
      name: 'Balance Sheet',
      query: `
        SELECT
          category,
          COUNT(*) as account_count,
          SUM(amount) as total_amount
        FROM v_balance_sheet
        GROUP BY category
        ORDER BY category;
      `
    },
    {
      name: 'Cash Flow',
      query: `
        SELECT
          category,
          COUNT(*) as activity_count,
          SUM(inflow) as total_inflow,
          SUM(outflow) as total_outflow,
          SUM(net_amount) as net_cash_flow
        FROM v_cash_flow
        GROUP BY category
        ORDER BY category;
      `
    }
  ];

  for (const { name, query } of queries) {
    try {
      const result = await mcp__supabase__execute_sql({
        project_id: projectId,
        query
      });

      if (result?.error) {
        console.error(`[ERROR] Error verifying ${name}:`, result.error);
      } else {
        console.log(`[SUCCESS] ${name} verification:`);
        console.table(result.rows);
      }
    } catch (error) {
      console.error(`[ERROR] Error verifying ${name}:`, error);
    }
  }
}

async function main() {
  console.log('[START] Starting Financial Views Migration');
  console.log('═'.repeat(50));

  // Create views
  const balanceSheetSuccess = await createBalanceSheetView();
  const cashFlowSuccess = await createCashFlowView();

  console.log('═'.repeat(50));

  if (balanceSheetSuccess && cashFlowSuccess) {
    console.log('[SUCCESS] All views created successfully!');

    // Verify the views
    await verifyViews();

    console.log('\n[SUMMARY] Views Created:');
    console.log('- v_balance_sheet: 재무상태표 (자산, 부채, 자본)');
    console.log('- v_cash_flow: 현금흐름표 (영업활동, 투자활동, 재무활동)');
    console.log('\n[NEXT STEPS]:');
    console.log('1. Test the API endpoints: /api/reports/balance-sheet and /api/reports/cash-flow');
    console.log('2. Check the Excel export endpoints');
    console.log('3. Verify the frontend components');
  } else {
    console.error('[ERROR] Some views failed to create. Please check the errors above.');
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);