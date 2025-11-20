// Create test items directly using Supabase service role (bypasses auth)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestItems() {
  console.log('Creating test items directly in database...\n');

  try {
    // Create input item (raw material)
    console.log('Creating input item (raw material)...');
    const { data: inputItem, error: inputError } = await supabase
      .from('items')
      .insert({
        item_code: 'TEST-RAW-001',
        item_name: '테스트 원자재',
        category: '원자재',
        spec: 'Test raw material for blanking',
        unit: 'EA',
        current_stock: 1000,
        safety_stock: 100,
        is_active: true
      })
      .select()
      .single();

    if (inputError) {
      console.error(`❌ Failed to create input item:`, inputError.message);
      return;
    }

    console.log(`✅ Created input item: ${inputItem.item_name} (ID: ${inputItem.item_id})`);
    console.log(`   Stock: ${inputItem.current_stock}\n`);

    // Create output item (finished product)
    console.log('Creating output item (finished product)...');
    const { data: outputItem, error: outputError } = await supabase
      .from('items')
      .insert({
        item_code: 'TEST-FIN-001',
        item_name: '테스트 완제품',
        category: '제품',
        spec: 'Test finished product from blanking',
        unit: 'EA',
        current_stock: 0,
        safety_stock: 50,
        is_active: true
      })
      .select()
      .single();

    if (outputError) {
      console.error(`❌ Failed to create output item:`, outputError.message);
      return;
    }

    console.log(`✅ Created output item: ${outputItem.item_name} (ID: ${outputItem.item_id})`);
    console.log(`   Stock: ${outputItem.current_stock}\n`);

    console.log('=== Test items created successfully ✅ ===');
    console.log('You can now run: node test-process-buttons.js');

  } catch (error) {
    console.error('❌ Failed to create test items:', error.message);
    console.error(error.stack);
  }
}

createTestItems().catch(console.error);
