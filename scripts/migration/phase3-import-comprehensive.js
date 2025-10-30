/**
 * Phase 3: Import Comprehensive Items
 * - Load comprehensive-items.json (34 records)
 * - Check for duplicates
 * - Insert new items only
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function phase3ImportComprehensive() {
  console.log('=======================================');
  console.log('PHASE 3: IMPORT COMPREHENSIVE ITEMS');
  console.log('=======================================\n');

  try {
    // 1. Load comprehensive items data
    const itemsFilePath = path.join(__dirname, 'data', 'clean-data', 'comprehensive-items.json');
    console.log(`1. Loading comprehensive items from: ${itemsFilePath}`);

    if (!fs.existsSync(itemsFilePath)) {
      throw new Error(`File not found: ${itemsFilePath}`);
    }

    const itemsData = JSON.parse(fs.readFileSync(itemsFilePath, 'utf-8'));
    console.log(`   Loaded ${itemsData.length} comprehensive items\n`);

    // 2. Filter and prepare items for import
    console.log('2. Processing items for import...');
    const validItems = itemsData.filter(item => {
      const code = item.품번;
      return code && code !== null && String(code).trim();
    });
    console.log(`   ${validItems.length} valid items (${itemsData.length - validItems.length} skipped - no item code)\n`);

    // 3. Check for existing items
    console.log('3. Checking for duplicates...');
    let newItems = 0;
    let duplicates = 0;
    let errors = 0;

    for (const item of validItems) {
      const itemCode = String(item.품번 || '').trim();
      if (!itemCode) continue;

      // Check if item exists
      const { data: existing, error: selectError } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_code', itemCode)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        // Error other than "not found"
        console.error(`   Warning: Error checking ${itemCode}:`, selectError.message);
        errors++;
        continue;
      }

      if (existing) {
        // Item already exists
        duplicates++;
        continue;
      }

      // Insert new item
      const { error: insertError } = await supabase
        .from('items')
        .insert({
          item_code: itemCode,
          item_name: item.품명 || `품목-${itemCode}`,
          category: item.구분 || '기타',
          spec: item.차종 || null,
          unit: 'EA',
          daily_requirement: item.일소요량 || null,
          current_stock: item['재고(4/28)'] || 0,
          is_active: true
        });

      if (insertError) {
        console.error(`   Warning: Failed to insert ${itemCode}:`, insertError.message);
        errors++;
      } else {
        newItems++;
      }

      // Progress indicator
      if ((newItems + duplicates + errors) % 10 === 0) {
        console.log(`   Progress: ${newItems + duplicates + errors}/${validItems.length} (${newItems} new, ${duplicates} duplicate, ${errors} errors)`);
      }
    }

    console.log(`\n   Final: ${newItems} new items, ${duplicates} duplicates, ${errors} errors\n`);

    // 4. Validation
    console.log('4. Validating results...');
    const { count: totalItems, error: totalError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });

    const { count: activeItems, error: activeError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (totalError) throw totalError;
    if (activeError) throw activeError;

    console.log(`   Total items: ${totalItems || 0}`);
    console.log(`   Active items: ${activeItems || 0}\n`);

    console.log('=======================================');
    console.log('SUCCESS: Phase 3 Complete');
    console.log('=======================================\n');

    return true;
  } catch (error) {
    console.error('\n=======================================');
    console.error('ERROR: Phase 3 Failed');
    console.error('=======================================');
    console.error(error.message || error);
    console.error(error.stack);
    return false;
  }
}

// Execute
phase3ImportComprehensive().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
