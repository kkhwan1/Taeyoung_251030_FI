/**
 * Test Chain Automation Script
 * Tests the 코일→판재→납품 full manufacturing chain automation
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
  console.error('Please ensure .env file contains:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExistingItems() {
  console.log('\n📦 Checking existing test items...\n');

  // Query test items directly by item_code
  const { data, error } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, category, current_stock, unit')
    .in('item_code', ['TEST-COIL-001', 'TEST-PLATE-001'])
    .order('item_code');

  if (error) {
    console.error('❌ Error querying items:', error);
    throw error;
  }

  console.log(`Found ${data?.length || 0} test items:`);
  console.table(data || []);

  return data || [];
}

async function main() {
  try {
    console.log('\n🚀 Starting Full Chain Automation Test');
    console.log('📍 Testing: 코일 → 판재 → 납품\n');

    // Step 1: Check existing items
    const items = await checkExistingItems();

    // Find test items by item_code
    const coilItem = items.find(item => item.item_code === 'TEST-COIL-001');
    const plateItem = items.find(item => item.item_code === 'TEST-PLATE-001');

    console.log('\n📊 Test Item Status:');
    console.log(`  코일 (Coil): ${coilItem ? `✅ Found (ID: ${coilItem.item_id}, Stock: ${coilItem.current_stock})` : '❌ Not found'}`);
    console.log(`  판재 (Plate): ${plateItem ? `✅ Found (ID: ${plateItem.item_id}, Stock: ${plateItem.current_stock})` : '❌ Not found'}`);

    if (!coilItem || !plateItem) {
      console.log('\n⚠️  Missing test items. Please create them first via /api/items');
      console.log('\nRequired items:');
      if (!coilItem) {
        console.log('  - 코일 item (category: 원자재)');
      }
      if (!plateItem) {
        console.log('  - 판재 item (category: 반제품)');
      }
      return;
    }

    console.log('\n✅ All required test items found');
    console.log('\n📋 Ready to test process chain automation:');
    console.log(`  1. Create BLANKING operation (${coilItem.item_name} → ${plateItem.item_name})`);
    console.log(`  2. Start operation (PENDING → IN_PROGRESS)`);
    console.log(`  3. Complete operation (IN_PROGRESS → COMPLETED)`);
    console.log(`  4. Verify automatic stock movement`);
    console.log(`  5. Verify LOT number generation`);
    console.log(`  6. Check stock_history audit trail`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
