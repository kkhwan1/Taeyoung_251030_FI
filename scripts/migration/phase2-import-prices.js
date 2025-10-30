/**
 * Phase 2: Import Price Data
 * - Load price-master.json (243 records)
 * - Batch insert into price_master table
 * - Update items table with latest prices
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

async function phase2ImportPrices() {
  console.log('=======================================');
  console.log('PHASE 2: IMPORT PRICE DATA');
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

    // 2. Batch insert price_master records
    console.log('2. Importing prices into price_master table...');
    const batchSize = 100;
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < priceData.prices.length; i += batchSize) {
      const batch = priceData.prices.slice(i, i + batchSize);

      // Transform data for insert
      const records = batch.map(p => ({
        item_code: p.item_code,
        price: p.price,
        supplier: p.supplier,
        price_month: `${p.price_month}-01`, // Convert '2025-04' to '2025-04-01'
      }));

      // Insert with upsert logic
      const { data, error } = await supabase
        .from('price_master')
        .upsert(records, {
          onConflict: 'item_code,price_month',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error(`   Warning: Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
        errors += batch.length;
      } else {
        imported += batch.length;
      }

      // Progress indicator
      console.log(`   Progress: ${imported + errors}/${priceData.prices.length} (${imported} imported, ${errors} errors)`);
    }

    console.log(`\n   Summary: ${imported} records imported, ${errors} errors\n`);

    // 3. Update items table with latest prices
    console.log('3. Updating items table with latest prices...');

    // Get all items
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code');

    if (itemsError) throw itemsError;

    console.log(`   Found ${items.length} items to update`);

    let updated = 0;
    let notFound = 0;

    for (const item of items) {
      // Get latest price for this item
      const { data: latestPrice, error: priceError } = await supabase
        .from('price_master')
        .select('price')
        .eq('item_code', item.item_code)
        .order('price_month', { ascending: false })
        .limit(1)
        .single();

      if (priceError || !latestPrice) {
        notFound++;
        continue;
      }

      // Update item price
      const { error: updateError } = await supabase
        .from('items')
        .update({
          price: latestPrice.price,
          updated_at: new Date().toISOString()
        })
        .eq('item_id', item.item_id);

      if (updateError) {
        console.error(`   Warning: Failed to update item ${item.item_code}:`, updateError.message);
      } else {
        updated++;
      }

      // Progress every 50 items
      if ((updated + notFound) % 50 === 0) {
        console.log(`   Progress: ${updated + notFound}/${items.length} (${updated} updated, ${notFound} no price)`);
      }
    }

    console.log(`\n   Summary: ${updated} items updated, ${notFound} no price found\n`);

    // 4. Validation
    console.log('4. Validating import results...');
    const { count: priceCount, error: countError } = await supabase
      .from('price_master')
      .select('*', { count: 'exact', head: true });

    const { count: itemsWithPrice, error: itemsPriceError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .not('price', 'is', null)
      .gt('price', 0);

    if (countError) throw countError;
    if (itemsPriceError) throw itemsPriceError;

    console.log(`   price_master records: ${priceCount || 0}`);
    console.log(`   items with price > 0: ${itemsWithPrice || 0}\n`);

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
phase2ImportPrices().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
