const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pybjnkbmtlyaftuiieyq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5Ympua2JtdGx5YWZ0dWlpZXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg3ODY1NCwiZXhwIjoyMDc0NDU0NjU0fQ.rRg1ARqtxlf2mAbvrI-0isAZsupx32I2VlOSbKfvdGc'
);

async function runRawSQL(query) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pybjnkbmtlyaftuiieyq.supabase.co'}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5Ympua2JtdGx5YWZ0dWlpZXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg3ODY1NCwiZXhwIjoyMDc0NDU0NjU0fQ.rRg1ARqtxlf2mAbvrI-0isAZsupx32I2VlOSbKfvdGc',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5Ympua2JtdGx5YWZ0dWlpZXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg3ODY1NCwiZXhwIjoyMDc0NDU0NjU0fQ.rRg1ARqtxlf2mAbvrI-0isAZsupx32I2VlOSbKfvdGc'}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      // If rpc doesn't exist, try direct SQL through the REST API
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

async function validateCoatingStatus() {
  console.log('🔍 Validating coating_status implementation...\n');

  // 1. Check if column exists and get its properties
  console.log('1️⃣ Checking column schema...');
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('*')
    .limit(1);

  if (itemsError) {
    console.error('❌ Error accessing items table:', itemsError.message);
    return;
  }

  if (items && items.length > 0) {
    const hasCoatingStatus = 'coating_status' in items[0];
    console.log(`✅ Column 'coating_status' exists: ${hasCoatingStatus}`);

    if (hasCoatingStatus) {
      console.log('   Sample value:', items[0].coating_status || 'null');
    }
  }

  // 2. Check data distribution
  console.log('\n2️⃣ Checking data distribution...');
  const { data: allItems, error: allError } = await supabase
    .from('items')
    .select('coating_status');

  if (allItems && !allError) {
    const distribution = {};
    let nullCount = 0;

    allItems.forEach(item => {
      if (item.coating_status === null || item.coating_status === undefined) {
        nullCount++;
      } else {
        distribution[item.coating_status] = (distribution[item.coating_status] || 0) + 1;
      }
    });

    console.log('✅ Coating status distribution:');
    console.log(`   Total items: ${allItems.length}`);
    console.log(`   NULL values: ${nullCount}`);
    Object.entries(distribution).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} items (${((count / allItems.length) * 100).toFixed(1)}%)`);
    });
  } else {
    console.error('❌ Error fetching distribution:', allError?.message);
  }

  // 3. Test constraint with valid values
  console.log('\n3️⃣ Testing constraint with valid values...');
  const validStatuses = ['none', 'zinc', 'nickel', 'chrome', 'black', 'painting', 'powder'];

  for (const status of validStatuses) {
    const testCode = `TEST-${status.toUpperCase()}-${Date.now()}`;
    const { data: insertData, error: insertError } = await supabase
      .from('items')
      .insert({
        item_code: testCode,
        item_name: `Test Item - ${status}`,
        unit: '개',
        coating_status: status
      })
      .select()
      .single();

    if (insertError) {
      console.log(`   ❌ Failed to insert with status '${status}': ${insertError.message}`);
    } else {
      console.log(`   ✅ Successfully inserted with status '${status}'`);
      // Clean up test data
      await supabase.from('items').delete().eq('item_id', insertData.item_id);
    }
  }

  // 4. Test constraint with invalid value (should fail)
  console.log('\n4️⃣ Testing constraint with invalid value...');
  const invalidTestCode = `TEST-INVALID-${Date.now()}`;
  const { data: invalidData, error: invalidError } = await supabase
    .from('items')
    .insert({
      item_code: invalidTestCode,
      item_name: 'Test Item - Invalid',
      unit: '개',
      coating_status: 'invalid_status'
    })
    .select()
    .single();

  if (invalidError) {
    console.log('   ✅ Constraint working! Rejected invalid value as expected');
    console.log(`   Error: ${invalidError.message}`);
  } else {
    console.log('   ⚠️ WARNING: Invalid value was accepted (constraint may not be active)');
    // Clean up if it was inserted
    if (invalidData) {
      await supabase.from('items').delete().eq('item_id', invalidData.item_id);
    }
  }

  // 5. Check sample items with coating status
  console.log('\n5️⃣ Sample items with coating status...');
  const { data: sampleItems, error: sampleError } = await supabase
    .from('items')
    .select('item_id, item_code, item_name, coating_status')
    .not('coating_status', 'is', null)
    .limit(10);

  if (sampleItems && !sampleError) {
    console.log('✅ Sample items:');
    sampleItems.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.item_code} - ${item.item_name}`);
      console.log(`      Coating: ${item.coating_status}`);
    });
  } else {
    console.log('❌ Error fetching samples:', sampleError?.message);
  }

  console.log('\n✅ Validation complete!');
}

// Run validation
validateCoatingStatus()
  .then(() => {
    console.log('\n🎉 Coating status validation finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  });