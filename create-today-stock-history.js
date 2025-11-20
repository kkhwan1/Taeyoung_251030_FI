// Create stock history data for today (2025-11-19) for testing multi-column sorting
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = 'http://localhost:5000';
const SUPABASE_URL = 'https://pybjnkbmtlyaftuiieyq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5Ympua2JtdGx5YWZ0dWlpZXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg3ODY1NCwiZXhwIjoyMDc0NDU0NjU0fQ.rRg1ARqtxlf2mAbvrI-0isAZsupx32I2VlOSbKfvdGc';

async function createTodayStockHistory() {
  console.log('Creating stock history for 2025-11-19...\n');

  try {
    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find the item with code 50011106C using direct database query
    console.log('Finding item 50011106C...');
    const { data: targetItem, error: itemError } = await supabase
      .from('items')
      .select('*')
      .eq('item_code', '50011106C')
      .single();

    if (itemError || !targetItem) {
      console.error('Item 50011106C not found:', itemError?.message);
      return;
    }

    console.log(`✅ Found item: ${targetItem.item_name} (ID: ${targetItem.item_id})`);
    console.log(`   Current stock: ${targetItem.current_stock}\n`);

    // Create various transaction types for today (2025-11-19)
    const transactions = [
      // Morning 8:00 - 입고 (Purchase)
      {
        time: '2025-11-19T08:00:00',
        type: 'purchase',
        quantity: 500,
        company: 319  // SUP037 - 태창정밀자동차부품(주)
      },
      // Morning 10:00 - 입고 (Purchase)
      {
        time: '2025-11-19T10:00:00',
        type: 'purchase',
        quantity: 300,
        company: 320  // SUP038 - 테스트회사
      },
      // Noon 12:00 - 생산 (Production)
      {
        time: '2025-11-19T12:00:00',
        type: 'production',
        quantity: 150
      },
      // Afternoon 14:00 - 출고 (Sales)
      {
        time: '2025-11-19T14:00:00',
        type: 'sales',
        quantity: -200,
        company: 337  // CUS011 - 테스트회사_1762763479512
      },
      // Afternoon 16:00 - 조정 (Adjustment +)
      {
        time: '2025-11-19T16:00:00',
        type: 'adjustment',
        quantity: 50
      },
      // Evening 18:00 - 조정 (Adjustment -)
      {
        time: '2025-11-19T18:00:00',
        type: 'adjustment',
        quantity: -30
      }
    ];

    let createdCount = 0;

    for (const txn of transactions) {
      try {
        let endpoint = '';
        let requestBody = {};

        if (txn.type === 'purchase') {
          endpoint = '/api/inventory/receiving';
          requestBody = {
            transaction_date: txn.time,
            item_id: targetItem.item_id,
            quantity: txn.quantity,
            unit_price: 100,
            company_id: txn.company,
            notes: `Test purchase transaction for ${txn.time}`
          };
        } else if (txn.type === 'sales') {
          endpoint = '/api/inventory/shipping';
          requestBody = {
            transaction_date: txn.time,
            item_id: targetItem.item_id,
            quantity: Math.abs(txn.quantity),
            unit_price: 150,
            company_id: txn.company,
            notes: `Test sales transaction for ${txn.time}`,
            created_by: 1
          };
        } else if (txn.type === 'production') {
          // Create a production batch first
          const batchResponse = await fetch(`${BASE_URL}/api/inventory/production/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              batch_number: `BATCH-TEST-${Date.now()}`,
              product_id: targetItem.item_id,
              planned_quantity: txn.quantity,
              planned_start_date: txn.time,
              planned_end_date: txn.time,
              status: 'COMPLETED'
            })
          });

          const batchText = await batchResponse.text();
          const batchData = JSON.parse(batchText);

          if (batchData.success) {
            console.log(`✅ Created production batch: ${batchData.data.batch_number}`);
            createdCount++;
          }
          continue;
        } else if (txn.type === 'adjustment') {
          endpoint = '/api/stock/adjustment';
          requestBody = {
            item_id: targetItem.item_id,
            adjustment_type: txn.quantity > 0 ? 'INCREASE' : 'DECREASE',
            quantity: Math.abs(txn.quantity),
            reason: `Test adjustment for ${txn.time}`,
            adjustment_date: txn.time,
            created_by: 1
          };
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();
        const responseData = JSON.parse(responseText);

        if (responseData.success) {
          console.log(`✅ Created ${txn.type} transaction at ${txn.time.substring(11, 16)}`);
          createdCount++;
        } else {
          console.log(`❌ Failed to create ${txn.type} transaction: ${responseData.error}`);
        }

      } catch (error) {
        console.error(`❌ Error creating ${txn.type} transaction:`, error.message);
      }

      // Wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n=== Created ${createdCount} transactions for 2025-11-19 ✅ ===`);
    console.log('Refresh the stock history modal to see the new data.');

  } catch (error) {
    console.error('❌ Failed to create stock history:', error.message);
    console.error(error.stack);
  }
}

createTodayStockHistory().catch(console.error);
