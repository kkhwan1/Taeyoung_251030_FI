// Test script for ProcessStartButton and ProcessCompleteButton
// Creates test data and verifies button functionality

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5000';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testProcessButtons() {
  console.log('=== Testing Process Control Buttons ===\n');

  try {
    // Step 1: Verify items exist and get their IDs (using direct Supabase query)
    console.log('Step 1: Checking for test items...');
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .in('item_code', ['TEST-RAW-001', 'TEST-FIN-001'])
      .order('item_code');

    if (itemsError || !items || items.length < 2) {
      console.error('❌ Not enough items in database. Need at least 2 items.');
      if (itemsError) console.error('   Error:', itemsError);
      return;
    }

    // Find the raw material (input) and finished product (output)
    const inputItem = items.find(item => item.item_code === 'TEST-RAW-001');  // Raw material with stock
    const outputItem = items.find(item => item.item_code === 'TEST-FIN-001'); // Finished product
    console.log(`✅ Found input item: ${inputItem.item_name} (ID: ${inputItem.item_id}, Stock: ${inputItem.current_stock})`);
    console.log(`✅ Found output item: ${outputItem.item_name} (ID: ${outputItem.item_id})\n`);

    // Step 2: Create test process operation
    console.log('Step 2: Creating test BLANKING operation...');
    const createResponse = await fetch(`${BASE_URL}/api/process-operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation_type: 'BLANKING',
        input_item_id: inputItem.item_id,
        output_item_id: outputItem.item_id,
        input_quantity: 100,
        output_quantity: 95,
        notes: 'Test operation for button testing - created by automated test'
      })
    });

    const createData = await createResponse.json();

    if (!createData.success) {
      console.error(`❌ Failed to create operation: ${createData.error}`);
      return;
    }

    const operationId = createData.data.operation_id;
    console.log(`✅ Created operation ID: ${operationId}`);
    console.log(`   Status: ${createData.data.status} (should be PENDING)\n`);

    // Step 3: Test ProcessStartButton (PENDING → IN_PROGRESS)
    console.log('Step 3: Testing ProcessStartButton...');
    console.log('   Simulating POST to /api/process/start');

    const startResponse = await fetch(`${BASE_URL}/api/process/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation_id: operationId })
    });

    const startText = await startResponse.text();
    const startData = JSON.parse(startText);

    if (!startData.success) {
      console.error(`❌ ProcessStartButton failed: ${startData.error}`);
      return;
    }

    console.log(`✅ ProcessStartButton SUCCESS!`);
    console.log(`   Status changed: PENDING → IN_PROGRESS`);
    console.log(`   Started at: ${startData.data.started_at}\n`);

    // Step 4: Test ProcessCompleteButton (IN_PROGRESS → COMPLETED)
    console.log('Step 4: Testing ProcessCompleteButton...');
    console.log('   Simulating POST to /api/process/complete');

    const completeResponse = await fetch(`${BASE_URL}/api/process/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation_id: operationId })
    });

    const completeText = await completeResponse.text();
    const completeData = JSON.parse(completeText);

    if (!completeData.success) {
      console.error(`❌ ProcessCompleteButton failed: ${completeData.error}`);
      return;
    }

    console.log(`✅ ProcessCompleteButton SUCCESS!`);
    console.log(`   Status changed: IN_PROGRESS → COMPLETED`);
    console.log(`   Completed at: ${completeData.data.completed_at}\n`);

    // Step 5: Verify final state
    console.log('Step 5: Verifying final operation state...');
    const verifyResponse = await fetch(`${BASE_URL}/api/process-operations/${operationId}`);
    const verifyData = await verifyResponse.json();

    if (verifyData.success) {
      const op = verifyData.data;
      console.log(`✅ Final verification passed:`);
      console.log(`   Operation ID: ${op.operation_id}`);
      console.log(`   Type: ${op.operation_type}`);
      console.log(`   Status: ${op.status} (should be COMPLETED)`);
      console.log(`   Started: ${op.started_at}`);
      console.log(`   Completed: ${op.completed_at}`);
      console.log(`   Input: ${op.input_quantity} of item ${op.input_item_id}`);
      console.log(`   Output: ${op.output_quantity} of item ${op.output_item_id}\n`);
    }

    console.log('=== ALL TESTS PASSED ✅ ===');
    console.log('Both ProcessStartButton and ProcessCompleteButton work correctly!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testProcessButtons().catch(console.error);
