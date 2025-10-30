const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://pybjnkbmtlyaftuiieyq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Error: Supabase key not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const backupDir = path.join(__dirname, '..');

async function backupAndAnalyze() {
  console.log('=== DATABASE BACKUP AND ANALYSIS ===\n');

  // 1. Backup items
  console.log('Backing up items table...');
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('*')
    .eq('is_active', true);

  if (itemsError) {
    console.error('Items error:', itemsError);
  } else {
    console.log(`Items backed up: ${items.length} records`);
    fs.writeFileSync(
      path.join(backupDir, 'backup_items.json'),
      JSON.stringify(items, null, 2)
    );
  }

  // 2. Backup companies
  console.log('\nBacking up companies table...');
  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('*')
    .eq('is_active', true);

  if (companiesError) {
    console.error('Companies error:', companiesError);
  } else {
    console.log(`Companies backed up: ${companies.length} records`);
    fs.writeFileSync(
      path.join(backupDir, 'backup_companies.json'),
      JSON.stringify(companies, null, 2)
    );
  }

  // 3. Backup bom
  console.log('\nBacking up bom table...');
  const { data: bom, error: bomError } = await supabase
    .from('bom')
    .select('*')
    .eq('is_active', true);

  if (bomError) {
    console.error('BOM error:', bomError);
  } else {
    console.log(`BOM backed up: ${bom.length} records`);
    fs.writeFileSync(
      path.join(backupDir, 'backup_bom.json'),
      JSON.stringify(bom, null, 2)
    );
  }

  // 4. Backup inventory_transactions
  console.log('\nBacking up inventory_transactions table...');
  const { data: inventory, error: inventoryError } = await supabase
    .from('inventory_transactions')
    .select('*');

  if (inventoryError) {
    console.error('Inventory error:', inventoryError);
  } else {
    console.log(`Inventory transactions backed up: ${inventory.length} records`);
    fs.writeFileSync(
      path.join(backupDir, 'backup_inventory.json'),
      JSON.stringify(inventory, null, 2)
    );
  }

  // 5. Data quality analysis
  console.log('\n\n=== DATA QUALITY ANALYSIS ===\n');

  // Check for NaN strings
  const nanItems = items.filter(i =>
    i.spec === 'NaN' || i.material === 'NaN' ||
    i.spec === null || i.material === null
  );
  console.log(`Items with NaN/null spec or material: ${nanItems.length}`);
  if (nanItems.length > 0) {
    console.log('Sample records:');
    nanItems.slice(0, 3).forEach(i => {
      console.log(`  - ID: ${i.item_id}, Code: ${i.item_code}, Name: ${i.item_name}, Spec: ${i.spec}, Material: ${i.material}`);
    });
  }

  // Check for zero prices
  const zeroPriceItems = items.filter(i => i.price === 0 || i.price === null);
  console.log(`\nItems with zero or null price: ${zeroPriceItems.length}`);
  if (zeroPriceItems.length > 0) {
    console.log('Sample records:');
    zeroPriceItems.slice(0, 3).forEach(i => {
      console.log(`  - ID: ${i.item_id}, Code: ${i.item_code}, Name: ${i.item_name}, Price: ${i.price}`);
    });
  }

  // Check for duplicates
  const itemCodes = items.map(i => i.item_code);
  const duplicates = itemCodes.filter((code, index) => itemCodes.indexOf(code) !== index);
  const uniqueDuplicates = [...new Set(duplicates)];
  console.log(`\nDuplicate item codes: ${uniqueDuplicates.length}`);
  if (uniqueDuplicates.length > 0) {
    console.log('Duplicates:', uniqueDuplicates);
  }

  // Check for incomplete records
  const incompleteItems = items.filter(i =>
    !i.item_code || !i.item_name || i.item_name === ''
  );
  console.log(`\nIncomplete items (missing code or name): ${incompleteItems.length}`);
  if (incompleteItems.length > 0) {
    console.log('Sample:');
    incompleteItems.slice(0, 3).forEach(i => {
      console.log(`  - ID: ${i.item_id}, Code: ${i.item_code}, Name: ${i.item_name}`);
    });
  }

  // Company analysis
  const incompleteCompanies = companies.filter(c =>
    !c.company_code || !c.company_name || c.company_name === ''
  );
  console.log(`\nIncomplete companies: ${incompleteCompanies.length}`);
  if (incompleteCompanies.length > 0) {
    console.log('Sample:');
    incompleteCompanies.slice(0, 3).forEach(c => {
      console.log(`  - ID: ${c.company_id}, Code: ${c.company_code}, Name: ${c.company_name}`);
    });
  }

  // BOM analysis
  const incompleteBom = bom.filter(b =>
    !b.product_id || !b.component_id || !b.quantity
  );
  console.log(`\nIncomplete BOM records: ${incompleteBom.length}`);
  if (incompleteBom.length > 0) {
    console.log('Sample:');
    incompleteBom.slice(0, 3).forEach(b => {
      console.log(`  - ID: ${b.bom_id}, Product: ${b.product_id}, Component: ${b.component_id}, Quantity: ${b.quantity}`);
    });
  }

  // Inventory analysis
  console.log(`\nTotal inventory transactions: ${inventory.length}`);
  const inventoryByType = {};
  inventory.forEach(t => {
    inventoryByType[t.transaction_type] = (inventoryByType[t.transaction_type] || 0) + 1;
  });
  console.log('Breakdown by type:');
  Object.entries(inventoryByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });

  console.log('\n\n=== BACKUP SUMMARY ===');
  console.log(`Total records backed up: ${items.length + companies.length + bom.length + inventory.length}`);
  console.log('\nBackup files created:');
  console.log('  - backup_items.json');
  console.log('  - backup_companies.json');
  console.log('  - backup_bom.json');
  console.log('  - backup_inventory.json');

  console.log('\n\n=== RECOMMENDED CLEANUP ACTIONS ===');

  if (nanItems.length > 0) {
    console.log(`\n1. Clean NaN/null values: ${nanItems.length} items need spec/material cleanup`);
  }

  if (zeroPriceItems.length > 0) {
    console.log(`\n2. Fix zero prices: ${zeroPriceItems.length} items have zero/null prices`);
  }

  if (uniqueDuplicates.length > 0) {
    console.log(`\n3. Resolve duplicates: ${uniqueDuplicates.length} duplicate item codes found`);
  }

  if (incompleteItems.length > 0) {
    console.log(`\n4. Remove incomplete items: ${incompleteItems.length} items with missing required fields`);
  }

  if (incompleteCompanies.length > 0) {
    console.log(`\n5. Remove incomplete companies: ${incompleteCompanies.length} companies with missing required fields`);
  }

  if (incompleteBom.length > 0) {
    console.log(`\n6. Remove incomplete BOM: ${incompleteBom.length} BOM records with missing required fields`);
  }

  console.log('\n\nReady for cleanup operations');
}

backupAndAnalyze().catch(console.error);
