// Test script to verify stock_history data exists in database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStockHistoryData() {
  console.log('Checking stock_history data for item_id 4388...\n');

  // Query stock_history table
  const { data, error } = await supabase
    .from('stock_history')
    .select('history_id, item_id, change_type, quantity_change, stock_after, created_at')
    .eq('item_id', 4388)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Database query error:', error);
    return;
  }

  console.log(`Found ${data.length} records for item_id 4388:\n`);

  if (data.length === 0) {
    console.log('❌ NO DATA FOUND - Test data may have been deleted');
  } else {
    console.log('✅ Data exists in database:');
    data.forEach((record, index) => {
      console.log(`\n${index + 1}. history_id: ${record.history_id}`);
      console.log(`   change_type: ${record.change_type}`);
      console.log(`   quantity_change: ${record.quantity_change}`);
      console.log(`   stock_after: ${record.stock_after}`);
      console.log(`   created_at: ${record.created_at}`);
    });
  }
}

checkStockHistoryData().catch(console.error);
