/**
 * Phase 4: Validation and Summary
 * - Count records across all tables
 * - Data quality checks
 * - Generate final report
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function phase4Validation() {
  console.log('=======================================');
  console.log('PHASE 4: VALIDATION & SUMMARY');
  console.log('=======================================\n');

  try {
    // 1. Record counts
    console.log('1. Record Counts');
    console.log('   ---------------------------------------');

    const counts = {};

    // Items
    const { count: itemsCount } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });
    counts.items = itemsCount || 0;
    console.log(`   items: ${counts.items}`);

    // Items with price
    const { count: itemsWithPrice } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .not('price', 'is', null)
      .gt('price', 0);
    counts.itemsWithPrice = itemsWithPrice || 0;
    console.log(`   items_with_price: ${counts.itemsWithPrice} (${((counts.itemsWithPrice / counts.items) * 100).toFixed(1)}%)`);

    // BOM
    const { count: bomCount } = await supabase
      .from('bom')
      .select('*', { count: 'exact', head: true });
    counts.bom = bomCount || 0;
    console.log(`   bom: ${counts.bom}`);

    // Inbound transactions
    const { count: inboundCount } = await supabase
      .from('inventory_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'INBOUND');
    counts.inbound = inboundCount || 0;
    console.log(`   inbound_transactions: ${counts.inbound}`);

    // All inventory transactions
    const { count: totalTransactions } = await supabase
      .from('inventory_transactions')
      .select('*', { count: 'exact', head: true });
    counts.totalTransactions = totalTransactions || 0;
    console.log(`   total_transactions: ${counts.totalTransactions}\n`);

    // 2. Data quality checks
    console.log('2. Data Quality');
    console.log('   ---------------------------------------');

    // Items with spec
    const { count: itemsWithSpec } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .not('spec', 'is', null)
      .neq('spec', 'NaN');
    console.log(`   items_with_spec: ${itemsWithSpec || 0} (${(((itemsWithSpec || 0) / counts.items) * 100).toFixed(1)}%)`);

    // Items with material
    const { count: itemsWithMaterial } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .not('material', 'is', null)
      .neq('material', 'NaN');
    console.log(`   items_with_material: ${itemsWithMaterial || 0} (${(((itemsWithMaterial || 0) / counts.items) * 100).toFixed(1)}%)`);

    // Items with supplier
    const { count: itemsWithSupplier } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .not('supplier_id', 'is', null);
    console.log(`   items_with_supplier: ${itemsWithSupplier || 0} (${(((itemsWithSupplier || 0) / counts.items) * 100).toFixed(1)}%)`);

    // Active items
    const { count: activeItems } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    console.log(`   active_items: ${activeItems || 0} (${(((activeItems || 0) / counts.items) * 100).toFixed(1)}%)\n`);

    // 3. Category breakdown
    console.log('3. Items by Category (Top 10)');
    console.log('   ---------------------------------------');

    const { data: categories } = await supabase
      .from('items')
      .select('category')
      .not('category', 'is', null);

    if (categories) {
      const categoryMap = {};
      categories.forEach(item => {
        categoryMap[item.category] = (categoryMap[item.category] || 0) + 1;
      });

      const sortedCategories = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      sortedCategories.forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`);
      });
    }

    console.log('\n=======================================');
    console.log('VALIDATION SUMMARY');
    console.log('=======================================\n');

    console.log('STATUS:');
    console.log(`  ${counts.bom === 0 ? '✅' : '❌'} BOM table cleaned (${counts.bom} records)`);
    console.log(`  ${counts.itemsWithPrice >= 400 ? '✅' : '⚠️'} Items with prices (${counts.itemsWithPrice}/${counts.items})`);
    console.log(`  ${counts.items >= 726 ? '✅' : '⚠️'} Total items (${counts.items})`);
    console.log(`  ${counts.inbound > 0 ? '✅' : '⚠️'} Inbound transactions (${counts.inbound})\n`);

    console.log('DATA QUALITY METRICS:');
    console.log(`  Price Coverage: ${((counts.itemsWithPrice / counts.items) * 100).toFixed(1)}%`);
    console.log(`  Spec Coverage: ${(((itemsWithSpec || 0) / counts.items) * 100).toFixed(1)}%`);
    console.log(`  Material Coverage: ${(((itemsWithMaterial || 0) / counts.items) * 100).toFixed(1)}%`);
    console.log(`  Supplier Coverage: ${(((itemsWithSupplier || 0) / counts.items) * 100).toFixed(1)}%`);
    console.log(`  Active Items: ${(((activeItems || 0) / counts.items) * 100).toFixed(1)}%\n`);

    console.log('NEXT STEPS:');
    console.log('  1. Review data quality metrics in the UI');
    console.log('  2. Import inbound transactions (when files available)');
    console.log('  3. Configure BOM relationships');
    console.log('  4. Verify calculations and reports\n');

    console.log('=======================================');
    console.log('SUCCESS: Validation Complete');
    console.log('=======================================\n');

    return true;
  } catch (error) {
    console.error('\n=======================================');
    console.error('ERROR: Validation Failed');
    console.error('=======================================');
    console.error(error.message || error);
    console.error(error.stack);
    return false;
  }
}

// Execute
phase4Validation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
