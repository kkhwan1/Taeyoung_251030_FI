/**
 * Verify Test Items Script
 * Directly queries the test items by item_code to verify creation
 *
 * @date 2025-02-06
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTestItems() {
  console.log('\n🔍 Verifying Test Items\n');

  try {
    // Query by item_code directly
    const { data: items, error } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, category, current_stock, unit, spec, is_active')
      .in('item_code', ['TEST-COIL-001', 'TEST-PLATE-001'])
      .order('item_code');

    if (error) {
      console.error('❌ Error querying items:', error);
      throw error;
    }

    if (!items || items.length === 0) {
      console.log('❌ No test items found!');
      return;
    }

    console.log(`✅ Found ${items.length} test items:\n`);
    console.table(items);

    const coilItem = items.find(item => item.item_code === 'TEST-COIL-001');
    const plateItem = items.find(item => item.item_code === 'TEST-PLATE-001');

    console.log('\n📊 Test Item Verification:');
    console.log(`  코일 (Coil): ${coilItem ? `✅ Found (ID: ${coilItem.item_id}, Stock: ${coilItem.current_stock} ${coilItem.unit})` : '❌ Not found'}`);
    console.log(`  판재 (Plate): ${plateItem ? `✅ Found (ID: ${plateItem.item_id}, Stock: ${plateItem.current_stock} ${plateItem.unit})` : '❌ Not found'}`);

    if (coilItem && plateItem) {
      console.log('\n✅ All test items verified successfully!');
      console.log('\n🎯 Ready to proceed with chain automation testing');
      return { coilItem, plateItem };
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyTestItems();
