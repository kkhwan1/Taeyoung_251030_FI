/**
 * Full Chain Automation Test Script
 * Tests the complete 코일→판재 manufacturing chain automation
 *
 * Test Flow:
 * 1. Create BLANKING operation (코일 → 판재)
 * 2. Start operation (PENDING → IN_PROGRESS)
 * 3. Complete operation (IN_PROGRESS → COMPLETED)
 * 4. Verify automatic stock movement
 * 5. Verify LOT number generation
 * 6. Check stock_history audit trail
 *
 * @date 2025-02-06
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test configuration
const TEST_CONFIG = {
  coilItemCode: 'TEST-COIL-001',
  plateItemCode: 'TEST-PLATE-001',
  operationType: 'BLANKING',
  inputQuantity: 100,  // 100 KG of coil
  outputQuantity: 50,  // 50 EA of plates
};

async function step1_CreateOperation(coilItem, plateItem) {
  console.log('\n📋 Step 1: Create BLANKING Operation');
  console.log('─'.repeat(60));

  const operationData = {
    operation_type: TEST_CONFIG.operationType,
    input_item_id: coilItem.item_id,
    output_item_id: plateItem.item_id,
    input_quantity: TEST_CONFIG.inputQuantity,
    output_quantity: TEST_CONFIG.outputQuantity,
    status: 'PENDING',
    operator_id: null,  // No operator for test
    notes: 'Test chain automation - BLANKING operation'
  };

  console.log('\n🔧 Creating operation with data:');
  console.log(`   Type: ${operationData.operation_type}`);
  console.log(`   Input: ${coilItem.item_name} (ID: ${coilItem.item_id})`);
  console.log(`   Output: ${plateItem.item_name} (ID: ${plateItem.item_id})`);
  console.log(`   Input Qty: ${operationData.input_quantity} KG`);
  console.log(`   Output Qty: ${operationData.output_quantity} EA`);

  const { data, error } = await supabase
    .from('process_operations')
    .insert(operationData)
    .select(`
      *,
      input_item:items!input_item_id(item_id, item_name, item_code, current_stock),
      output_item:items!output_item_id(item_id, item_name, item_code, current_stock)
    `)
    .single();

  if (error) {
    console.error('❌ Failed to create operation:', error);
    throw error;
  }

  console.log('\n✅ Operation created successfully:');
  console.log(`   Operation ID: ${data.operation_id}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Created at: ${data.created_at}`);

  return data;
}

async function step2_StartOperation(operationId) {
  console.log('\n\n🚀 Step 2: Start Operation (PENDING → IN_PROGRESS)');
  console.log('─'.repeat(60));

  const { data, error } = await supabase
    .from('process_operations')
    .update({
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString()
    })
    .eq('operation_id', operationId)
    .select(`
      *,
      input_item:items!input_item_id(item_id, item_name, current_stock),
      output_item:items!output_item_id(item_id, item_name, current_stock)
    `)
    .single();

  if (error) {
    console.error('❌ Failed to start operation:', error);
    throw error;
  }

  console.log('\n✅ Operation started successfully:');
  console.log(`   Operation ID: ${data.operation_id}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Started at: ${data.started_at}`);

  return data;
}

async function step3_CompleteOperation(operationId) {
  console.log('\n\n✨ Step 3: Complete Operation (IN_PROGRESS → COMPLETED)');
  console.log('─'.repeat(60));
  console.log('⚠️  This should trigger automatic stock movement!');

  const { data, error } = await supabase
    .from('process_operations')
    .update({
      status: 'COMPLETED',
      completed_at: new Date().toISOString()
    })
    .eq('operation_id', operationId)
    .select(`
      *,
      input_item:items!input_item_id(item_id, item_name, current_stock),
      output_item:items!output_item_id(item_id, item_name, current_stock)
    `)
    .single();

  if (error) {
    console.error('❌ Failed to complete operation:', error);
    throw error;
  }

  console.log('\n✅ Operation completed successfully:');
  console.log(`   Operation ID: ${data.operation_id}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Completed at: ${data.completed_at}`);
  console.log(`   LOT Number: ${data.lot_number || 'Not generated'}`);
  console.log(`   Efficiency: ${data.efficiency || 'Not calculated'}%`);

  return data;
}

async function step4_VerifyStockMovement(beforeOperation, afterOperation) {
  console.log('\n\n📊 Step 4: Verify Automatic Stock Movement');
  console.log('─'.repeat(60));

  // Fetch fresh stock data
  const { data: freshCoil, error: coilError } = await supabase
    .from('items')
    .select('item_id, item_name, current_stock')
    .eq('item_code', TEST_CONFIG.coilItemCode)
    .single();

  const { data: freshPlate, error: plateError } = await supabase
    .from('items')
    .select('item_id, item_name, current_stock')
    .eq('item_code', TEST_CONFIG.plateItemCode)
    .single();

  if (coilError || plateError) {
    console.error('❌ Failed to fetch updated stock:', coilError || plateError);
    throw coilError || plateError;
  }

  console.log('\n🔍 Stock Comparison:');
  console.log(`\n   ${beforeOperation.input_item.item_name} (코일):`);
  console.log(`      Before: ${beforeOperation.input_item.current_stock} KG`);
  console.log(`      After:  ${freshCoil.current_stock} KG`);
  console.log(`      Change: ${freshCoil.current_stock - beforeOperation.input_item.current_stock} KG`);
  console.log(`      Expected: -${TEST_CONFIG.inputQuantity} KG`);

  console.log(`\n   ${beforeOperation.output_item.item_name} (판재):`);
  console.log(`      Before: ${beforeOperation.output_item.current_stock} EA`);
  console.log(`      After:  ${freshPlate.current_stock} EA`);
  console.log(`      Change: +${freshPlate.current_stock - beforeOperation.output_item.current_stock} EA`);
  console.log(`      Expected: +${TEST_CONFIG.outputQuantity} EA`);

  // Verify expected changes
  const coilChange = freshCoil.current_stock - beforeOperation.input_item.current_stock;
  const plateChange = freshPlate.current_stock - beforeOperation.output_item.current_stock;

  const coilCorrect = coilChange === -TEST_CONFIG.inputQuantity;
  const plateCorrect = plateChange === TEST_CONFIG.outputQuantity;

  console.log('\n📋 Verification Results:');
  console.log(`   ${coilCorrect ? '✅' : '❌'} Coil stock decreased by ${TEST_CONFIG.inputQuantity} KG`);
  console.log(`   ${plateCorrect ? '✅' : '❌'} Plate stock increased by ${TEST_CONFIG.outputQuantity} EA`);

  return {
    coilCorrect,
    plateCorrect,
    success: coilCorrect && plateCorrect
  };
}

async function step5_CheckStockHistory(operationId) {
  console.log('\n\n📜 Step 5: Check stock_history Audit Trail');
  console.log('─'.repeat(60));

  const { data: history, error } = await supabase
    .from('stock_history')
    .select(`
      *,
      item:items(item_id, item_name, item_code)
    `)
    .eq('operation_id', operationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to fetch stock history:', error);
    throw error;
  }

  console.log(`\n✅ Found ${history.length} stock history records:`);

  history.forEach((record, index) => {
    console.log(`\n   Record ${index + 1}:`);
    console.log(`      Item: ${record.item.item_name} (${record.item.item_code})`);
    console.log(`      Type: ${record.movement_type}`);
    console.log(`      Quantity: ${record.quantity_change > 0 ? '+' : ''}${record.quantity_change}`);
    console.log(`      Reference: ${record.reference_type} #${record.reference_id}`);
    console.log(`      Created: ${record.created_at}`);
  });

  return history;
}

async function main() {
  try {
    console.log('\n🎯 Full Chain Automation Test');
    console.log('='.repeat(60));
    console.log('Testing: 코일 (BLANKING) → 판재');
    console.log('='.repeat(60));

    // Get test items
    const { data: testItems, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, category, current_stock, unit')
      .in('item_code', [TEST_CONFIG.coilItemCode, TEST_CONFIG.plateItemCode])
      .order('item_code');

    if (itemsError || !testItems || testItems.length !== 2) {
      console.error('❌ Failed to fetch test items');
      throw itemsError || new Error('Test items not found');
    }

    const coilItem = testItems.find(item => item.item_code === TEST_CONFIG.coilItemCode);
    const plateItem = testItems.find(item => item.item_code === TEST_CONFIG.plateItemCode);

    console.log('\n📦 Test Items:');
    console.log(`   코일: ${coilItem.item_name} (Stock: ${coilItem.current_stock} ${coilItem.unit})`);
    console.log(`   판재: ${plateItem.item_name} (Stock: ${plateItem.current_stock} ${plateItem.unit})`);

    // Execute test steps
    const operation = await step1_CreateOperation(coilItem, plateItem);
    const startedOperation = await step2_StartOperation(operation.operation_id);
    const completedOperation = await step3_CompleteOperation(operation.operation_id);
    const stockVerification = await step4_VerifyStockMovement(operation, completedOperation);
    const history = await step5_CheckStockHistory(operation.operation_id);

    // Final summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 FINAL TEST SUMMARY');
    console.log('='.repeat(60));

    console.log('\n✅ Test Execution:');
    console.log(`   [✓] Step 1: Operation created (ID: ${operation.operation_id})`);
    console.log(`   [✓] Step 2: Operation started`);
    console.log(`   [✓] Step 3: Operation completed`);
    console.log(`   [${stockVerification.success ? '✓' : '✗'}] Step 4: Stock movement ${stockVerification.success ? 'verified' : 'FAILED'}`);
    console.log(`   [${history.length > 0 ? '✓' : '✗'}] Step 5: Stock history recorded (${history.length} entries)`);

    console.log('\n📋 Key Features Verified:');
    console.log(`   ${completedOperation.lot_number ? '✅' : '❌'} LOT number generation: ${completedOperation.lot_number || 'NOT GENERATED'}`);
    console.log(`   ${completedOperation.efficiency ? '✅' : '❌'} Efficiency calculation: ${completedOperation.efficiency || 'NOT CALCULATED'}%`);
    console.log(`   ${stockVerification.coilCorrect ? '✅' : '❌'} Input stock decreased correctly`);
    console.log(`   ${stockVerification.plateCorrect ? '✅' : '❌'} Output stock increased correctly`);
    console.log(`   ${history.length === 2 ? '✅' : '❌'} Audit trail complete (${history.length}/2 records)`);

    const allTestsPassed = stockVerification.success &&
                          history.length >= 2 &&
                          completedOperation.lot_number &&
                          completedOperation.efficiency;

    console.log('\n' + '='.repeat(60));
    if (allTestsPassed) {
      console.log('🎉 ALL TESTS PASSED - CHAIN AUTOMATION WORKING!');
    } else {
      console.log('⚠️  SOME TESTS FAILED - REVIEW RESULTS ABOVE');
    }
    console.log('='.repeat(60) + '\n');

    process.exit(allTestsPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack trace:', error);
    process.exit(1);
  }
}

// Run the test
main();
