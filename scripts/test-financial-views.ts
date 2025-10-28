/**
 * Test Financial Views
 * This script tests the financial statement views
 */

import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testFinancialViews() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Testing Financial Views...\n');

  // Test Balance Sheet View
  console.log('📊 Balance Sheet (v_balance_sheet):');
  console.log('─'.repeat(50));

  const { data: balanceSheetData, error: balanceSheetError } = await supabase
    .from('v_balance_sheet')
    .select('*')
    .order('display_order')
    .limit(10);

  if (balanceSheetError) {
    console.error('❌ Balance Sheet view error:', balanceSheetError.message);
  } else {
    console.log('✅ Balance Sheet view is working!');
    console.log('Sample data:');
    console.table(balanceSheetData);
  }

  console.log('\n');

  // Test Cash Flow View
  console.log('💰 Cash Flow (v_cash_flow):');
  console.log('─'.repeat(50));

  const { data: cashFlowData, error: cashFlowError } = await supabase
    .from('v_cash_flow')
    .select('*')
    .order('display_order')
    .limit(10);

  if (cashFlowError) {
    console.error('❌ Cash Flow view error:', cashFlowError.message);
  } else {
    console.log('✅ Cash Flow view is working!');
    console.log('Sample data:');
    console.table(cashFlowData);
  }

  console.log('\n📝 Summary:');
  console.log('─'.repeat(50));

  if (!balanceSheetError && !cashFlowError) {
    console.log('✅ All financial views are working correctly!');
    console.log('\n🎯 You can now:');
    console.log('1. Access the financial statements page: http://localhost:5000/reports/financial-statements');
    console.log('2. Test the API endpoints:');
    console.log('   - http://localhost:5000/api/reports/balance-sheet');
    console.log('   - http://localhost:5000/api/reports/cash-flow');
    console.log('3. Test the Excel export endpoints:');
    console.log('   - http://localhost:5000/api/export/balance-sheet');
    console.log('   - http://localhost:5000/api/export/cash-flow');
  } else {
    console.log('❌ Some views are not working. Please check the errors above.');
  }
}

// Run the test
testFinancialViews().catch(console.error);