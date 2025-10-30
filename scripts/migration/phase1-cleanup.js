/**
 * Phase 1: Data Cleanup
 * - Delete all BOM records (130 invalid)
 * - Clean up items with price = 0 or NULL
 * - Remove "NaN" strings from spec and material fields
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function phase1Cleanup() {
  console.log('=======================================');
  console.log('PHASE 1: DATA CLEANUP');
  console.log('=======================================\n');

  try {
    // 1. Delete all BOM records
    console.log('1. Deleting all BOM records...');
    const { error: bomError, count: bomDeleted } = await supabase
      .from('bom')
      .delete()
      .neq('bom_id', 0);

    if (bomError) throw bomError;
    console.log(`   Success: Deleted BOM records\n`);

    // 2. Clean up items with price = 0 or NULL
    console.log('2. Cleaning up items with zero/null prices...');
    const { error: priceError } = await supabase
      .from('items')
      .update({ price: null, updated_at: new Date().toISOString() })
      .or('price.eq.0,price.is.null');

    if (priceError) throw priceError;
    console.log(`   Success: Cleaned up price fields\n`);

    // 3. Clean up "NaN" strings
    console.log('3. Cleaning up "NaN" strings...');
    const { data: nanItems, error: nanSelectError } = await supabase
      .from('items')
      .select('item_id, spec, material')
      .or('spec.eq.NaN,material.eq.NaN');

    if (nanSelectError) throw nanSelectError;

    if (nanItems && nanItems.length > 0) {
      let cleaned = 0;
      for (const item of nanItems) {
        const updates = { updated_at: new Date().toISOString() };
        if (item.spec === 'NaN') updates.spec = null;
        if (item.material === 'NaN') updates.material = null;

        const { error } = await supabase
          .from('items')
          .update(updates)
          .eq('item_id', item.item_id);

        if (error) {
          console.error(`   Warning: Failed to update item ${item.item_id}:`, error.message);
        } else {
          cleaned++;
        }
      }
      console.log(`   Success: Cleaned up ${cleaned} NaN strings\n`);
    } else {
      console.log(`   Success: No NaN strings found\n`);
    }

    // Validation
    console.log('4. Validating cleanup results...');
    const { count: bomCount, error: bomCountError } = await supabase
      .from('bom')
      .select('*', { count: 'exact', head: true });

    const { count: nullPriceCount, error: priceCountError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .is('price', null);

    if (bomCountError) throw bomCountError;
    if (priceCountError) throw priceCountError;

    console.log(`   BOM records: ${bomCount || 0} (expected: 0)`);
    console.log(`   Items with NULL price: ${nullPriceCount || 0}\n`);

    console.log('=======================================');
    console.log('SUCCESS: Phase 1 Complete');
    console.log('=======================================\n');

    return true;
  } catch (error) {
    console.error('\n=======================================');
    console.error('ERROR: Phase 1 Failed');
    console.error('=======================================');
    console.error(error.message || error);
    return false;
  }
}

// Execute
phase1Cleanup().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
