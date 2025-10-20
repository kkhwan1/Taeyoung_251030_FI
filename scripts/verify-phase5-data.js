const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyTables() {
  console.log('=== COMPANIES TABLE ANALYSIS ===\n');

  // Check companies structure and data
  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('company_id, company_code, company_name, company_type')
    .order('company_code')
    .limit(50);

  if (companiesError) {
    console.error('Error fetching companies:', companiesError);
    return;
  }

  console.log('Sample Companies Data (first 10):');
  companies.slice(0, 10).forEach(c => {
    console.log(`  ${c.company_code}: ${c.company_name} (${c.company_type})`);
  });

  // Group by type
  const typeDistribution = {};
  companies.forEach(c => {
    typeDistribution[c.company_type] = (typeDistribution[c.company_type] || 0) + 1;
  });
  console.log('\nCompany Type Distribution:', typeDistribution);

  // Check for specific companies
  const targetCompanies = ['호원오토', '대우사급', '태진금속', '대우엔지니어링'];
  console.log('\nSearching for target companies from Excel:');
  for (const name of targetCompanies) {
    const { data: found } = await supabase
      .from('companies')
      .select('company_code, company_name, company_type')
      .eq('company_name', name)
      .single();

    if (found) {
      console.log(`  ✓ ${name}: ${found.company_code} (${found.company_type})`);
    } else {
      console.log(`  ✗ ${name}: NOT FOUND`);
    }
  }

  console.log('\n=== ITEMS TABLE ANALYSIS ===\n');

  // Check items structure and data
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, spec, unit')
    .order('item_code')
    .limit(50);

  if (itemsError) {
    console.error('Error fetching items:', itemsError);
    return;
  }

  console.log('Sample Items Data (first 10):');
  items.slice(0, 10).forEach(i => {
    console.log(`  ${i.item_code}: ${i.item_name} (spec: ${i.spec || 'N/A'})`);
  });

  // Check for specific item patterns
  const targetCodes = ['65131-L2500', '24435-2S690', '43231-2S660', '98135-L2000'];
  console.log('\nSearching for target item codes from Excel:');
  for (const code of targetCodes) {
    const { data: found } = await supabase
      .from('items')
      .select('item_code, item_name, spec')
      .eq('item_code', code)
      .single();

    if (found) {
      console.log(`  ✓ ${code}: ${found.item_name} (spec: ${found.spec || 'N/A'})`);
    } else {
      console.log(`  ✗ ${code}: NOT FOUND`);
    }
  }

  // Check item code patterns
  console.log('\nItem Code Patterns:');
  const patterns = {
    'Hyundai/Kia Format (XXXXX-XXXXX)': 0,
    'Alphanumeric with dash': 0,
    'Pure numeric': 0,
    'Other formats': 0
  };

  items.forEach(i => {
    if (/^\d{5}-[A-Z0-9]{5}$/.test(i.item_code)) {
      patterns['Hyundai/Kia Format (XXXXX-XXXXX)']++;
    } else if (i.item_code.includes('-')) {
      patterns['Alphanumeric with dash']++;
    } else if (/^\d+$/.test(i.item_code)) {
      patterns['Pure numeric']++;
    } else {
      patterns['Other formats']++;
    }
  });

  Object.entries(patterns).forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count}`);
  });

  console.log('\n=== DATA QUALITY CHECKS ===\n');

  // Check for duplicates in companies
  const { data: companyStats } = await supabase.rpc('execute_sql', {
    query: `
      SELECT
        COUNT(DISTINCT company_name) as unique_names,
        COUNT(*) as total_companies,
        COUNT(DISTINCT company_code) as unique_codes
      FROM companies
      WHERE is_active = true
    `
  });

  if (companyStats && companyStats.length > 0) {
    console.log('Company Statistics:');
    console.log(`  Total active companies: ${companyStats[0].total_companies}`);
    console.log(`  Unique company names: ${companyStats[0].unique_names}`);
    console.log(`  Unique company codes: ${companyStats[0].unique_codes}`);
  }

  // Check for duplicates in items
  const { data: itemStats } = await supabase.rpc('execute_sql', {
    query: `
      SELECT
        COUNT(DISTINCT item_code) as unique_codes,
        COUNT(*) as total_items,
        COUNT(DISTINCT item_name) as unique_names
      FROM items
      WHERE is_active = true
    `
  });

  if (itemStats && itemStats.length > 0) {
    console.log('\nItem Statistics:');
    console.log(`  Total active items: ${itemStats[0].total_items}`);
    console.log(`  Unique item codes: ${itemStats[0].unique_codes}`);
    console.log(`  Unique item names: ${itemStats[0].unique_names}`);
  }

  // Check company code format
  const { data: codeFormats } = await supabase.rpc('execute_sql', {
    query: `
      SELECT
        SUBSTRING(company_code, 1, 3) as prefix,
        COUNT(*) as count
      FROM companies
      WHERE company_code IS NOT NULL
      GROUP BY SUBSTRING(company_code, 1, 3)
      ORDER BY count DESC
    `
  });

  if (codeFormats && codeFormats.length > 0) {
    console.log('\nCompany Code Prefixes:');
    codeFormats.forEach(f => {
      console.log(`  ${f.prefix}: ${f.count} companies`);
    });
  }

  console.log('\n=== MATCHING STRATEGY RECOMMENDATIONS ===\n');

  console.log('1. Company Matching Strategy:');
  console.log('   - Primary: Exact match on company_name');
  console.log('   - Fallback: Create new company with auto-generated company_code');
  console.log('   - Code format: CUS### for customers, SUP### for suppliers');

  console.log('\n2. Item Matching Strategy:');
  console.log('   - Primary: Exact match on item_code');
  console.log('   - Fallback: Create new item with the provided item_code');
  console.log('   - Most items follow Hyundai/Kia part number format (XXXXX-XXXXX)');

  console.log('\n3. Data Quality Issues to Address:');
  console.log('   - Ensure no duplicate company names before import');
  console.log('   - Ensure no duplicate item codes before import');
  console.log('   - Validate Excel data has no empty company names or item codes');
  console.log('   - Consider normalizing company names (trim whitespace, consistent casing)');
}

verifyTables().catch(console.error);