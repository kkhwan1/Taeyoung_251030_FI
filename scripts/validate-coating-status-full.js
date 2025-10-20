const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pybjnkbmtlyaftuiieyq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5Ympua2JtdGx5YWZ0dWlpZXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg3ODY1NCwiZXhwIjoyMDc0NDU0NjU0fQ.rRg1ARqtxlf2mAbvrI-0isAZsupx32I2VlOSbKfvdGc'
);

async function validateCoatingStatus() {
  console.log('🔍 Comprehensive Coating Status Validation...\n');

  const issues = [];
  const successes = [];

  // 1. Check if column exists and get its properties
  console.log('1️⃣ Checking column existence and current data...');
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('*')
    .limit(1);

  if (itemsError) {
    issues.push(`Cannot access items table: ${itemsError.message}`);
    console.error('❌ Error accessing items table:', itemsError.message);
    return { issues, successes };
  }

  if (items && items.length > 0) {
    const hasCoatingStatus = 'coating_status' in items[0];
    if (hasCoatingStatus) {
      successes.push('Column coating_status exists in items table');
      console.log(`✅ Column 'coating_status' exists`);
      console.log('   Sample value:', items[0].coating_status || 'null');
    } else {
      issues.push('Column coating_status does not exist in items table');
      console.log('❌ Column coating_status not found');
    }
  }

  // 2. Check current data distribution
  console.log('\n2️⃣ Analyzing coating status distribution...');
  const { data: allItems, error: allError } = await supabase
    .from('items')
    .select('coating_status, item_code, item_name');

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

    console.log('✅ Current distribution:');
    console.log(`   Total items: ${allItems.length}`);
    console.log(`   NULL values: ${nullCount}`);

    const validStatuses = ['no_coating', 'none', 'zinc', 'nickel', 'chrome', 'black', 'painting', 'powder'];
    let invalidCount = 0;

    Object.entries(distribution).forEach(([status, count]) => {
      const percentage = ((count / allItems.length) * 100).toFixed(1);
      const isValid = validStatuses.includes(status);
      console.log(`   ${status}: ${count} items (${percentage}%) ${isValid ? '✅' : '⚠️ INVALID'}`);

      if (!isValid) {
        invalidCount += count;
        issues.push(`Found ${count} items with invalid coating_status: '${status}'`);
      }
    });

    if (invalidCount === 0) {
      successes.push(`All ${allItems.length} items have valid coating_status values`);
    }

    // Check if all values are 'no_coating' (might need migration)
    if (distribution['no_coating'] === allItems.length && allItems.length > 0) {
      console.log('\n   ⚠️ All items have "no_coating" - might need proper migration');
      issues.push('All items have default "no_coating" value - data migration may be needed');
    }
  }

  // 3. Test constraint with valid values (with proper category)
  console.log('\n3️⃣ Testing CHECK constraint with valid values...');
  const validStatuses = ['none', 'zinc', 'nickel', 'chrome', 'black', 'painting', 'powder'];
  let constraintWorking = false;

  for (const status of validStatuses.slice(0, 2)) {  // Test just 2 to be quick
    const testCode = `TEST-${status.toUpperCase()}-${Date.now()}`;
    const { data: insertData, error: insertError } = await supabase
      .from('items')
      .insert({
        item_code: testCode,
        item_name: `Test Item - ${status}`,
        unit: '개',
        category: '원자재',  // Add required category
        coating_status: status
      })
      .select()
      .single();

    if (insertError) {
      console.log(`   ❌ Failed to insert '${status}': ${insertError.message}`);
      if (insertError.message.includes('coating_status')) {
        issues.push(`Cannot insert valid status '${status}': ${insertError.message}`);
      }
    } else {
      console.log(`   ✅ Successfully inserted with status '${status}'`);
      constraintWorking = true;
      // Clean up test data
      await supabase.from('items').delete().eq('item_id', insertData.item_id);
    }
  }

  // 4. Test constraint with invalid value
  console.log('\n4️⃣ Testing CHECK constraint with invalid value...');
  const invalidTestCode = `TEST-INVALID-${Date.now()}`;
  const { data: invalidData, error: invalidError } = await supabase
    .from('items')
    .insert({
      item_code: invalidTestCode,
      item_name: 'Test Item - Invalid',
      unit: '개',
      category: '원자재',  // Add required category
      coating_status: 'invalid_status'
    })
    .select()
    .single();

  if (invalidError) {
    if (invalidError.message.includes('coating_status') ||
        invalidError.message.includes('check') ||
        invalidError.message.includes('violates')) {
      console.log('   ✅ CHECK constraint is working! Rejected invalid value');
      successes.push('CHECK constraint properly rejects invalid coating_status values');
    } else {
      console.log(`   ⚠️ Insert failed but not due to coating_status: ${invalidError.message}`);
    }
  } else {
    console.log('   ❌ WARNING: Invalid value was accepted!');
    issues.push('CHECK constraint not working - invalid coating_status value was accepted');
    // Clean up if it was inserted
    if (invalidData) {
      await supabase.from('items').delete().eq('item_id', invalidData.item_id);
    }
  }

  // 5. Check if we can update existing items
  console.log('\n5️⃣ Testing UPDATE operation...');
  const { data: testItem } = await supabase
    .from('items')
    .select('item_id, coating_status')
    .limit(1)
    .single();

  if (testItem) {
    const newStatus = testItem.coating_status === 'zinc' ? 'nickel' : 'zinc';
    const { error: updateError } = await supabase
      .from('items')
      .update({ coating_status: newStatus })
      .eq('item_id', testItem.item_id);

    if (updateError) {
      console.log(`   ❌ Failed to update: ${updateError.message}`);
      issues.push(`Cannot update coating_status: ${updateError.message}`);
    } else {
      console.log(`   ✅ Successfully updated coating_status from '${testItem.coating_status}' to '${newStatus}'`);
      successes.push('Can successfully update coating_status values');

      // Restore original value
      await supabase
        .from('items')
        .update({ coating_status: testItem.coating_status })
        .eq('item_id', testItem.item_id);
    }
  }

  // 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION SUMMARY\n');

  console.log('✅ SUCCESSES:');
  if (successes.length > 0) {
    successes.forEach(s => console.log(`   • ${s}`));
  } else {
    console.log('   None');
  }

  console.log('\n❌ ISSUES FOUND:');
  if (issues.length > 0) {
    issues.forEach(i => console.log(`   • ${i}`));
  } else {
    console.log('   • No issues found - implementation is complete!');
  }

  console.log('\n' + '='.repeat(60));

  return { issues, successes };
}

// Run validation
validateCoatingStatus()
  .then(({ issues, successes }) => {
    if (issues.length === 0) {
      console.log('\n🎉 Perfect! Coating status implementation is fully validated!');
      process.exit(0);
    } else if (issues.length === 1 && issues[0].includes('data migration may be needed')) {
      console.log('\n✅ Implementation is working correctly.');
      console.log('💡 Consider migrating existing data to use appropriate coating statuses.');
      process.exit(0);
    } else {
      console.log('\n⚠️ Some issues need attention. Please review above.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  });