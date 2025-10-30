/**
 * Phase 2: Update Prices (Simplified)
 * - Load price-master.json (243 records)
 * - Update items table with latest prices
 * - Store price metadata in description field
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

async function phase2UpdatePrices() {
  console.log('=======================================');
  console.log('PHASE 2: UPDATE ITEM PRICES');
  console.log('=======================================\n');

  try {
    // 1. Load price master data
    const priceFilePath = path.join(__dirname, 'data', 'clean-data', 'price-master.json');
    console.log(`1. Loading price data from: ${priceFilePath}`);

    if (!fs.existsSync(priceFilePath)) {
      throw new Error(`File not found: ${priceFilePath}`);
    }

    const priceData = JSON.parse(fs.readFileSync(priceFilePath, 'utf-8'));
    console.log(`   Loaded ${priceData.prices.length} price records\n`);

    // 2. Group prices by item_code (get latest)
    console.log('2. Processing price data...');
    const priceMap = new Map();

    for (const p of priceData.prices) {
      const existing = priceMap.get(p.item_code);
      if (!existing || p.price_month > existing.price_month) {
        priceMap.set(p.item_code, p);
      }
    }

    console.log(`   Processed ${priceMap.size} unique items with prices\n`);

    // 3. Update items table
    console.log('3. Updating items table...');
    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const [itemCode, priceInfo] of priceMap.entries()) {
      // Check if item exists
      const { data: item, error: selectError } = await supabase
        .from('items')
        .select('item_id, item_code, item_name')
        .eq('item_code', itemCode)
        .single();

      if (selectError || !item) {
        notFound++;
        continue;
      }

      // Update price
      const { error: updateError } = await supabase
        .from('items')
        .update({
          price: priceInfo.price,
          updated_at: new Date().toISOString()
        })
        .eq('item_id', item.item_id);

      if (updateError) {
        console.error(`   Warning: Failed to update ${itemCode}:`, updateError.message);
        errors++;
      } else {
        updated++;
      }

      // Progress indicator
      if ((updated + notFound + errors) % 20 === 0) {
        console.log(`   Progress: ${updated + notFound + errors}/${priceMap.size} (${updated} updated, ${notFound} not found, ${errors} errors)`);
      }
    }

    console.log(`\n   Final: ${updated} updated, ${notFound} not found, ${errors} errors\n`);

    // 4. Validation
    console.log('4. Validating results...');
    const { count: itemsWithPrice, error: countError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .not('price', 'is', null)
      .gt('price', 0);

    const { count: totalItems, error: totalError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    if (totalError) throw totalError;

    console.log(`   Total items: ${totalItems || 0}`);
    console.log(`   Items with price > 0: ${itemsWithPrice || 0}`);
    console.log(`   Percentage: ${((itemsWithPrice / totalItems) * 100).toFixed(1)}%\n`);

    console.log('=======================================');
    console.log('SUCCESS: Phase 2 Complete');
    console.log('=======================================\n');

    return true;
  } catch (error) {
    console.error('\n=======================================');
    console.error('ERROR: Phase 2 Failed');
    console.error('=======================================');
    console.error(error.message || error);
    console.error(error.stack);
    return false;
  }
}

// Execute
phase2UpdatePrices().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
