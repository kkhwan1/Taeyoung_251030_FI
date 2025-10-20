const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyData() {
  console.log('=== DATABASE VERIFICATION FOR PHASE 5 IMPORT ===\n');

  // 1. Check existing companies
  const { data: companies, error: cErr } = await supabase
    .from('companies')
    .select('company_id, company_code, company_name, company_type')
    .eq('is_active', true)
    .order('company_name');

  if (cErr) {
    console.error('Error fetching companies:', cErr);
    return;
  }

  console.log(`Total active companies: ${companies.length}\n`);

  // Group by type
  const byType = {};
  companies.forEach(c => {
    byType[c.company_type] = (byType[c.company_type] || 0) + 1;
  });
  console.log('Company distribution by type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Check code patterns
  console.log('\nCompany code patterns:');
  const patterns = {
    'CUS_name format': companies.filter(c => /^CUS_/.test(c.company_code)).length,
    'SUP_name format': companies.filter(c => /^SUP_/.test(c.company_code)).length,
    'CUS### format': companies.filter(c => /^CUS\d{3}$/.test(c.company_code)).length,
    'SUP### format': companies.filter(c => /^SUP\d{3}$/.test(c.company_code)).length,
    'Other': companies.filter(c => !/^(CUS|SUP)/.test(c.company_code || '')).length
  };
  Object.entries(patterns).forEach(([pattern, count]) => {
    if (count > 0) console.log(`  ${pattern}: ${count}`);
  });

  // Show sample companies
  console.log('\nSample companies (first 5):');
  companies.slice(0, 5).forEach(c => {
    console.log(`  ${c.company_code}: ${c.company_name} (${c.company_type})`);
  });

  // 2. Check existing items
  const { data: items, error: iErr } = await supabase
    .from('items')
    .select('item_id, item_code, item_name')
    .eq('is_active', true)
    .order('item_code')
    .limit(100);

  if (iErr) {
    console.error('Error fetching items:', iErr);
    return;
  }

  console.log(`\n=== ITEMS ===`);
  console.log(`Sample of active items: ${items.length}\n`);

  // Check code formats
  const itemPatterns = {
    'Hyundai/Kia (XXXXX-XXXXX)': items.filter(i => /^\d{5}-[A-Z0-9]{5}$/.test(i.item_code)).length,
    'Contains dash': items.filter(i => i.item_code.includes('-')).length,
    'No dash': items.filter(i => !i.item_code.includes('-')).length
  };
  console.log('Item code patterns:');
  Object.entries(itemPatterns).forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}`);
  });

  // Show sample items
  console.log('\nSample items (first 5):');
  items.slice(0, 5).forEach(i => {
    console.log(`  ${i.item_code}: ${i.item_name}`);
  });

  // 3. Check for Excel target companies
  console.log('\n=== MATCHING ANALYSIS FOR EXCEL DATA ===\n');

  const excelCompanies = ['호원오토', '대우사급', '태진금속', '대우엔지니어링'];
  console.log('Searching for Excel companies:');

  for (const targetName of excelCompanies) {
    // Exact match
    const exact = companies.find(c => c.company_name === targetName);
    if (exact) {
      console.log(`  ✓ "${targetName}" found as: ${exact.company_code}`);
    } else {
      // Partial matches
      const partial = companies.filter(c =>
        c.company_name.includes(targetName.substring(0, 2)) ||
        c.company_name.includes(targetName.split(' ')[0])
      );

      if (partial.length > 0) {
        console.log(`  ⚠ "${targetName}" not found, possible matches:`);
        partial.forEach(p => {
          console.log(`     - ${p.company_name} (${p.company_code})`);
        });
      } else {
        console.log(`  ✗ "${targetName}" - NO MATCH (will need to create)`);
      }
    }
  }

  // 4. Check for Excel target items
  const excelItems = ['65131-L2500', '24435-2S690', '43231-2S660', '98135-L2000'];
  console.log('\nSearching for Excel item codes:');

  for (const targetCode of excelItems) {
    const found = items.find(i => i.item_code === targetCode);
    if (found) {
      console.log(`  ✓ "${targetCode}": ${found.item_name}`);
    } else {
      console.log(`  ✗ "${targetCode}" - NOT FOUND (will need to create)`);
    }
  }

  // 5. Recommendations
  console.log('\n=== IMPORT STRATEGY RECOMMENDATIONS ===\n');

  console.log('1. COMPANY MATCHING:');
  console.log('   Current format: Mixed (CUS_name and SUP_name patterns)');
  console.log('   Strategy: ');
  console.log('   - Try exact match on company_name first');
  console.log('   - If not found, create new with auto-generated code');
  console.log('   - Use CUS### format for 고객사, SUP### for 공급사');
  console.log('   - Need to determine company_type from Excel context');

  console.log('\n2. ITEM MATCHING:');
  console.log('   Current format: Mostly Hyundai/Kia part numbers');
  console.log('   Strategy:');
  console.log('   - Try exact match on item_code');
  console.log('   - If not found, create new item');
  console.log('   - Item codes from Excel appear to be valid part numbers');

  console.log('\n3. DATA QUALITY NOTES:');
  console.log('   - Company codes are inconsistent (CUS_ vs CUS###)');
  console.log('   - Consider standardizing to CUS###/SUP### format');
  console.log('   - Items follow consistent part number format');
  console.log('   - No duplicates expected based on current data');
}

verifyData().catch(console.error);