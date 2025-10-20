/**
 * Transaction Table Schema Discovery Script
 *
 * This script discovers the actual column structure of sales_transactions
 * and purchase_transactions tables by querying the database directly.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTableSchema(tableName) {
  console.log(`\n📋 Getting schema for ${tableName}...`);

  // Try to get a sample record to see structure
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error(`❌ Error querying ${tableName}:`, error);
    return null;
  }

  // Even with empty table, Supabase returns column information in the response
  console.log(`✅ Table exists and is queryable`);

  // If we got data, show sample
  if (data && data.length > 0) {
    console.log('Sample record:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('Table is empty (expected for new data)');
  }

  return data;
}

async function discoverSchemaByInsert(tableName) {
  console.log(`\n🔍 Attempting schema discovery via insert test for ${tableName}...`);

  // Try inserting minimal record to see what fields are required
  const testRecord = {
    transaction_no: 'TEST-SCHEMA-DISCOVERY',
    transaction_date: '2025-10-01',
    // Deliberately omit other fields to see what errors we get
  };

  const { data, error } = await supabase
    .from(tableName)
    .insert(testRecord)
    .select();

  if (error) {
    console.log('Insert failed (expected):');
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    if (error.details) {
      console.log('Error details:', error.details);
    }
    if (error.hint) {
      console.log('Error hint:', error.hint);
    }
    // Error messages often reveal required fields
  } else {
    console.log('✅ Unexpected success! Test record was inserted.');
    console.log('Record:', JSON.stringify(data, null, 2));
    console.log('\nDeleting test record...');
    // Clean up if it somehow worked
    if (data && data[0]) {
      const deleteResult = await supabase
        .from(tableName)
        .delete()
        .eq('transaction_no', 'TEST-SCHEMA-DISCOVERY');
      if (deleteResult.error) {
        console.error('Failed to delete test record:', deleteResult.error);
      } else {
        console.log('Test record deleted successfully');
      }
    }
  }
}

async function main() {
  console.log('🔍 Discovering transaction table schemas...\n');
  console.log('This will help us fix the test data creation script.\n');
  console.log('=' .repeat(60));

  // Sales Transactions
  console.log('\n📊 SALES TRANSACTIONS TABLE');
  console.log('=' .repeat(60));
  await getTableSchema('sales_transactions');
  await discoverSchemaByInsert('sales_transactions');

  // Purchase Transactions
  console.log('\n\n📊 PURCHASE TRANSACTIONS TABLE');
  console.log('=' .repeat(60));
  await getTableSchema('purchase_transactions');
  await discoverSchemaByInsert('purchase_transactions');

  console.log('\n\n' + '=' .repeat(60));
  console.log('✅ Schema discovery complete!');
  console.log('=' .repeat(60));
  console.log('\nNext step: Update create_test_transactions.js with correct column names');
}

main().catch(console.error);
