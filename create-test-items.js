// Create test items for process button testing
const BASE_URL = 'http://localhost:5000';

async function createTestItems() {
  console.log('Creating test items for process button testing...\n');

  try {
    // Create input item (raw material)
    console.log('Creating input item (raw material)...');
    const inputResponse = await fetch(`${BASE_URL}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_code: 'TEST-RAW-001',
        item_name: '테스트 원자재',
        spec: 'Test raw material for blanking',
        unit: 'EA',
        current_stock: 1000,
        safety_stock: 100,
        is_active: true
      })
    });

    const inputText = await inputResponse.text();
    const inputData = JSON.parse(inputText);

    if (!inputData.success) {
      console.error(`❌ Failed to create input item: ${inputData.error}`);
      return;
    }

    console.log(`✅ Created input item: ${inputData.data.item_name} (ID: ${inputData.data.item_id})`);
    console.log(`   Stock: ${inputData.data.current_stock}\n`);

    // Create output item (finished product)
    console.log('Creating output item (finished product)...');
    const outputResponse = await fetch(`${BASE_URL}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_code: 'TEST-FIN-001',
        item_name: '테스트 완제품',
        spec: 'Test finished product from blanking',
        unit: 'EA',
        current_stock: 0,
        safety_stock: 50,
        is_active: true
      })
    });

    const outputText = await outputResponse.text();
    const outputData = JSON.parse(outputText);

    if (!outputData.success) {
      console.error(`❌ Failed to create output item: ${outputData.error}`);
      return;
    }

    console.log(`✅ Created output item: ${outputData.data.item_name} (ID: ${outputData.data.item_id})`);
    console.log(`   Stock: ${outputData.data.current_stock}\n`);

    console.log('=== Test items created successfully ✅ ===');
    console.log('You can now run test-process-buttons.js');

  } catch (error) {
    console.error('❌ Failed to create test items:', error.message);
    console.error(error.stack);
  }
}

createTestItems().catch(console.error);
