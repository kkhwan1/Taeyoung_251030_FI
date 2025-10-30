const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pybjnkbmtlyaftuiieyq.supabase.co';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRole) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function queryDatabase() {
  console.log('====== SUPABASE DATABASE QUERY ======\n');

  try {
    // 1. Count all records
    console.log('1. TOTAL RECORDS COUNT\n');
    const tables = ['items', 'companies', 'bom', 'inventory_transactions', 'purchase_transactions', 'sales_transactions', 'collections', 'payments', 'price_master'];
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`${table}: ERROR - ${error.message}`);
      } else {
        console.log(`${table}: ${count} records`);
      }
    }

    console.log('\n2. ITEMS TABLE SAMPLE (10 records)\n');
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, spec, category, unit, unit_price, current_stock, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (itemsError) {
      console.log('ERROR:', itemsError.message);
    } else {
      console.log(JSON.stringify(items, null, 2));
    }

    console.log('\n3. COMPANIES TABLE SAMPLE (10 records)\n');
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('company_id, company_code, company_name, company_type, business_number, phone, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (companiesError) {
      console.log('ERROR:', companiesError.message);
    } else {
      console.log(JSON.stringify(companies, null, 2));
    }

    console.log('\n4. BOM TABLE SAMPLE (10 records)\n');
    const { data: bom, error: bomError } = await supabase
      .from('bom')
      .select('bom_id, parent_item_id, child_item_id, quantity_required, level_no, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (bomError) {
      console.log('ERROR:', bomError.message);
    } else {
      console.log(JSON.stringify(bom, null, 2));
    }

    console.log('\n5. INVENTORY TRANSACTIONS SAMPLE (10 records)\n');
    const { data: invTrans, error: invTransError } = await supabase
      .from('inventory_transactions')
      .select('transaction_id, transaction_date, transaction_type, item_id, quantity, unit, company_id, reference_number')
      .order('transaction_date', { ascending: false })
      .limit(10);
    
    if (invTransError) {
      console.log('ERROR:', invTransError.message);
    } else {
      console.log(JSON.stringify(invTrans, null, 2));
    }

    console.log('\n6. ITEMS BY CATEGORY\n');
    const { data: categoryStats, error: categoryError } = await supabase
      .from('items')
      .select('category')
      .eq('is_active', true);
    
    if (categoryError) {
      console.log('ERROR:', categoryError.message);
    } else {
      const categoryCounts = {};
      categoryStats.forEach(item => {
        const cat = item.category || 'Uncategorized';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      console.log(JSON.stringify(categoryCounts, null, 2));
    }

    console.log('\n7. COMPANIES BY TYPE\n');
    const { data: typeStats, error: typeError } = await supabase
      .from('companies')
      .select('company_type')
      .eq('is_active', true);
    
    if (typeError) {
      console.log('ERROR:', typeError.message);
    } else {
      const typeCounts = {};
      typeStats.forEach(company => {
        const type = company.company_type || 'Uncategorized';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      console.log(JSON.stringify(typeCounts, null, 2));
    }

    console.log('\n8. RECENT SALES TRANSACTIONS (5 records)\n');
    const { data: sales, error: salesError } = await supabase
      .from('sales_transactions')
      .select('transaction_id, transaction_no, transaction_date, total_amount, payment_status')
      .order('transaction_date', { ascending: false })
      .limit(5);
    
    if (salesError) {
      console.log('ERROR:', salesError.message);
    } else {
      console.log(JSON.stringify(sales, null, 2));
    }

    console.log('\n9. RECENT PURCHASE TRANSACTIONS (5 records)\n');
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchase_transactions')
      .select('transaction_id, transaction_no, transaction_date, total_amount, payment_status')
      .order('transaction_date', { ascending: false })
      .limit(5);
    
    if (purchasesError) {
      console.log('ERROR:', purchasesError.message);
    } else {
      console.log(JSON.stringify(purchases, null, 2));
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

queryDatabase().then(() => {
  console.log('\n====== QUERY COMPLETED ======');
  process.exit(0);
});
