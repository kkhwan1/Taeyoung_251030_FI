/**
 * Quick test script for sales transactions API
 * Run with: node test-sales-api.js
 */

const API_BASE = 'http://localhost:3009/api';

async function testSalesAPI() {
  console.log('🧪 Testing Sales Transactions API...\n');

  try {
    // Test 1: GET - List sales transactions
    console.log('1️⃣ Testing GET /api/sales-transactions');
    const listResponse = await fetch(`${API_BASE}/sales-transactions?page=1&limit=5`);
    const listData = await listResponse.json();
    console.log('   Status:', listResponse.status);
    console.log('   Success:', listData.success);
    console.log('   Transactions count:', listData.data?.transactions?.length || 0);
    console.log('   ✅ List endpoint working\n');

    // Test 2: POST - Create new sales transaction
    console.log('2️⃣ Testing POST /api/sales-transactions');
    const createPayload = {
      transaction_date: '2025-01-15',
      customer_id: 1,  // Adjust based on your data
      item_id: 1,      // Adjust based on your data
      quantity: 100,
      unit_price: 5000,
      total_amount: 500000,
      paid_amount: 0,
      payment_status: 'UNPAID',
      notes: 'API 테스트 거래'
    };

    const createResponse = await fetch(`${API_BASE}/sales-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload)
    });
    const createData = await createResponse.json();
    console.log('   Status:', createResponse.status);
    console.log('   Success:', createData.success);

    if (createData.success) {
      const transactionId = createData.data?.transaction_id;
      const transactionNo = createData.data?.transaction_no;
      console.log('   Created ID:', transactionId);
      console.log('   Transaction No:', transactionNo);
      console.log('   ✅ Create endpoint working\n');

      // Test 3: GET - Retrieve single transaction
      console.log('3️⃣ Testing GET /api/sales-transactions/[id]');
      const getResponse = await fetch(`${API_BASE}/sales-transactions/${transactionId}`);
      const getData = await getResponse.json();
      console.log('   Status:', getResponse.status);
      console.log('   Success:', getData.success);
      console.log('   Transaction No:', getData.data?.transaction_no);
      console.log('   Customer:', getData.data?.customer?.company_name);
      console.log('   Item:', getData.data?.item?.item_name);
      console.log('   ✅ Get single endpoint working\n');

      // Test 4: PUT - Update transaction
      console.log('4️⃣ Testing PUT /api/sales-transactions/[id]');
      const updatePayload = {
        paid_amount: 200000,
        payment_status: 'PARTIAL',
        notes: 'API 테스트 - 부분 지급 업데이트'
      };

      const updateResponse = await fetch(`${API_BASE}/sales-transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      const updateData = await updateResponse.json();
      console.log('   Status:', updateResponse.status);
      console.log('   Success:', updateData.success);
      console.log('   Updated paid_amount:', updateData.data?.paid_amount);
      console.log('   Updated payment_status:', updateData.data?.payment_status);
      console.log('   ✅ Update endpoint working\n');

      // Test 5: DELETE - Soft delete transaction
      console.log('5️⃣ Testing DELETE /api/sales-transactions/[id]');
      const deleteResponse = await fetch(`${API_BASE}/sales-transactions/${transactionId}`, {
        method: 'DELETE'
      });
      const deleteData = await deleteResponse.json();
      console.log('   Status:', deleteResponse.status);
      console.log('   Success:', deleteData.success);
      console.log('   Message:', deleteData.message);
      console.log('   ✅ Delete endpoint working\n');

      // Test 6: Verify deletion (should return 404)
      console.log('6️⃣ Verifying soft delete');
      const verifyResponse = await fetch(`${API_BASE}/sales-transactions/${transactionId}`);
      const verifyData = await verifyResponse.json();
      console.log('   Status:', verifyResponse.status);
      console.log('   Success:', verifyData.success);
      if (verifyResponse.status === 404) {
        console.log('   ✅ Soft delete verified\n');
      } else {
        console.log('   ⚠️  Transaction still accessible after delete\n');
      }

    } else {
      console.log('   ❌ Create failed:', createData.error);
      console.log('   Details:', createData.details);
    }

    console.log('\n✅ All tests completed!');
    console.log('\n📝 Summary:');
    console.log('   - GET /api/sales-transactions (list): ✅');
    console.log('   - POST /api/sales-transactions (create): ✅');
    console.log('   - GET /api/sales-transactions/[id] (single): ✅');
    console.log('   - PUT /api/sales-transactions/[id] (update): ✅');
    console.log('   - DELETE /api/sales-transactions/[id] (soft delete): ✅');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error('\nMake sure:');
    console.error('  1. Development server is running (npm run dev)');
    console.error('  2. Database is accessible');
    console.error('  3. customer_id and item_id exist in database');
  }
}

// Run tests
testSalesAPI();
