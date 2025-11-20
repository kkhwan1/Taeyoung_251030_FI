/**
 * Phase 3 Test Data Creation Script
 * Creates coil items and plate items for testing coil process tracking
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestData() {
  console.log('🚀 Starting Phase 3 test data creation...\n');

  try {
    // 1. Create test coil items (코일 타입)
    console.log('1️⃣ Creating test coil items...');
    const coilItems = [
      {
        item_code: 'COIL-001',
        item_name: '테스트 코일 A (1.0t x 1000mm)',
        spec: '1.0t x 1000mm x C',
        unit: 'kg',
        inventory_type: '코일',
        category: '원재료',
        current_stock: 1000,
        is_active: true
      },
      {
        item_code: 'COIL-002',
        item_name: '테스트 코일 B (1.2t x 1200mm)',
        spec: '1.2t x 1200mm x C',
        unit: 'kg',
        inventory_type: '코일',
        category: '원재료',
        current_stock: 1500,
        is_active: true
      }
    ];

    const { data: coilData, error: coilError } = await supabase
      .from('items')
      .upsert(coilItems, {
        onConflict: 'item_code',
        ignoreDuplicates: false
      })
      .select();

    if (coilError) {
      console.error('❌ Error creating coil items:', coilError);
      throw coilError;
    }
    console.log(`✅ Created ${coilData.length} coil items`);

    // 2. Create test plate items (판재 타입)
    console.log('\n2️⃣ Creating test plate items...');
    const plateItems = [
      {
        item_code: 'PLATE-001',
        item_name: '테스트 판재 A (블랭킹 완료)',
        spec: '500mm x 300mm x 1.0t',
        unit: 'ea',
        inventory_type: '반제품',
        category: '반제품',
        current_stock: 0,
        is_active: true
      },
      {
        item_code: 'PLATE-002',
        item_name: '테스트 판재 B (전단 완료)',
        spec: '600mm x 400mm x 1.2t',
        unit: 'ea',
        inventory_type: '반제품',
        category: '반제품',
        current_stock: 0,
        is_active: true
      }
    ];

    const { data: plateData, error: plateError } = await supabase
      .from('items')
      .upsert(plateItems, {
        onConflict: 'item_code',
        ignoreDuplicates: false
      })
      .select();

    if (plateError) {
      console.error('❌ Error creating plate items:', plateError);
      throw plateError;
    }
    console.log(`✅ Created ${plateData.length} plate items`);

    // 3. Verify user exists for operator_id (optional)
    console.log('\n3️⃣ Checking for test user...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_id, name')
      .limit(1);

    if (userError) {
      console.warn('⚠️  No users table or error:', userError.message);
    } else if (userData && userData.length > 0) {
      console.log(`✅ Found test user: ${userData[0].name} (ID: ${userData[0].user_id})`);
    } else {
      console.log('ℹ️  No users found - operator_id will be null in tests');
    }

    // 4. Summary
    console.log('\n📊 Test Data Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Coil Items:');
    coilData.forEach(item => {
      console.log(`   - ${item.item_code}: ${item.item_name} (Stock: ${item.current_stock}kg)`);
    });
    console.log('✅ Plate Items:');
    plateData.forEach(item => {
      console.log(`   - ${item.item_code}: ${item.item_name} (Stock: ${item.current_stock}ea)`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Test data created successfully!');
    console.log('🚀 Ready to start Phase 3 Milestone testing\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

createTestData();
