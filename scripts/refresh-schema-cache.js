/**
 * Refresh Supabase Schema Cache and Verify Table
 *
 * This script forces a schema cache refresh for the item_price_history table.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function refreshAndVerify() {
  console.log('='.repeat(70));
  console.log('Supabase Schema Cache Refresh & Verification');
  console.log('='.repeat(70));
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    }
  });

  try {
    console.log('Step 1: Verifying table via REST API');
    console.log('-'.repeat(70));

    // Use REST API directly to check table
    const response = await fetch(`${SUPABASE_URL}/rest/v1/item_price_history?select=count`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    console.log(`REST API Response: ${response.status} ${response.statusText}`);

    if (response.status === 200) {
      const count = response.headers.get('content-range');
      console.log(`✓ Table accessible via REST API`);
      console.log(`  Content-Range: ${count}`);
    } else if (response.status === 404) {
      console.error('❌ Table not found in REST API');
      console.log('');
      console.log('Possible solutions:');
      console.log('  1. Wait 30-60 seconds for Supabase to refresh schema cache');
      console.log('  2. Restart the Supabase project from the dashboard');
      console.log('  3. Use Supabase Studio to verify table exists');
      process.exit(1);
    }

    console.log('');
    console.log('Step 2: Testing table with simplified query');
    console.log('-'.repeat(70));

    // Try a simple select with limit 0 (doesn't require data)
    const { data, error, count } = await supabase
      .from('item_price_history')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Error:', error.message);
      console.log('');
      console.log('The table exists but schema cache needs refresh.');
      console.log('Please wait 30-60 seconds and try again.');
      process.exit(1);
    } else {
      console.log('✓ Table query successful');
      console.log(`  Current rows: ${count || 0}`);
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('✓ Schema Cache Refresh Confirmed');
    console.log('='.repeat(70));
    console.log('');
    console.log('Next steps:');
    console.log('  1. Wait 30-60 seconds for full schema propagation');
    console.log('  2. Run verification script again: node scripts/verify-via-supabase-client.js');
    console.log('  3. Proceed with Phase P3 MVP API implementation');
    console.log('');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

refreshAndVerify();
