/**
 * Integration Tests for Business Rules
 * Phase P3 Wave 2 - Backend Agent 1
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ Assertion failed: ${message}`);
  }
}

async function testAPI(name, testFn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await testFn();
    console.log(`✅ PASSED: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ FAILED: ${name}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

// Cleanup helper
async function cleanupTestData(itemId, priceMonth) {
  try {
    const response = await fetch(
      `${BASE_URL}/api/price-history/${itemId}?price_month=${priceMonth}`,
      { method: 'DELETE' }
    );
    if (response.ok) {
      console.log(`   🧹 Cleaned up test data: item ${itemId}, month ${priceMonth}`);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Test Cases
const tests = [
  {
    name: '양수 가격 검증 - 음수 단가 차단',
    test: async () => {
      const res = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: 1,
          price_month: '2025-11-01',
          unit_price: -1000
        })
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const data = await res.json();
      assert(data.error?.includes('0보다 커야'), `Expected positive price error, got: ${data.error}`);
    }
  },

  {
    name: '양수 가격 검증 - 0 단가 차단',
    test: async () => {
      const res = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: 1,
          price_month: '2025-11-01',
          unit_price: 0
        })
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const data = await res.json();
      assert(data.error?.includes('0보다 커야'), `Expected positive price error, got: ${data.error}`);
    }
  },

  {
    name: '날짜 형식 검증 - 잘못된 형식',
    test: async () => {
      const res = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: 1,
          price_month: '2025-13-01', // Invalid month
          unit_price: 10000
        })
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const data = await res.json();
      assert(
        data.error?.includes('형식') || data.error?.includes('날짜'),
        `Expected date format error, got: ${data.error}`
      );
    }
  },

  {
    name: '미래 날짜 차단',
    test: async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);
      const futureMonth = futureDate.toISOString().slice(0, 7) + '-01';

      const res = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: 1,
          price_month: futureMonth,
          unit_price: 10000
        })
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const data = await res.json();
      assert(
        data.error?.includes('미래'),
        `Expected future date error, got: ${data.error}`
      );
    }
  },

  {
    name: '중복 체크 및 100% 인상 경고',
    test: async () => {
      const testMonth = '2025-10-01';
      const testItemId = 1;

      // Cleanup first
      await cleanupTestData(testItemId, testMonth);

      // 1. 기존 가격 생성 (10,000원)
      const res1 = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: testItemId,
          price_month: testMonth,
          unit_price: 10000
        })
      });

      assert(res1.status === 201, `Initial insert failed with status ${res1.status}`);

      // 2. 150% 인상 시도 (25,000원) - 중복 에러 + 경고
      const res2 = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: testItemId,
          price_month: testMonth,
          unit_price: 25000
        })
      });

      assert(res2.status === 409, `Expected 409 conflict, got ${res2.status}`);
      const data = await res2.json();
      assert(data.error?.includes('이미 존재'), `Expected duplicate error, got: ${data.error}`);
      assert(
        data.warning?.includes('100%') || data.details?.increase_rate,
        `Expected increase warning, got: ${JSON.stringify(data)}`
      );

      // Cleanup
      await cleanupTestData(testItemId, testMonth);
    }
  },

  {
    name: '50% 하락 경고',
    test: async () => {
      const testMonth = '2025-09-01';
      const testItemId = 2;

      await cleanupTestData(testItemId, testMonth);

      // 1. 기존 가격 생성 (20,000원)
      const res1 = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: testItemId,
          price_month: testMonth,
          unit_price: 20000
        })
      });

      assert(res1.status === 201, `Initial insert failed`);

      // 2. 60% 하락 시도 (8,000원)
      const res2 = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: testItemId,
          price_month: testMonth,
          unit_price: 8000
        })
      });

      assert(res2.status === 409, `Expected 409, got ${res2.status}`);
      const data = await res2.json();
      assert(
        data.warning?.includes('하락') || data.warning?.includes('50%'),
        `Expected decrease warning, got: ${JSON.stringify(data)}`
      );

      await cleanupTestData(testItemId, testMonth);
    }
  },

  {
    name: 'Bulk Update - 양수 가격 검증',
    test: async () => {
      const res = await fetch(`${BASE_URL}/api/price-history/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [
            {
              item_id: 1,
              price_month: '2025-12-01',
              unit_price: 10000
            },
            {
              item_id: 2,
              price_month: '2025-12-01',
              unit_price: -5000 // Invalid
            },
            {
              item_id: 3,
              price_month: '2025-12-01',
              unit_price: 15000
            }
          ],
          override_existing: true
        })
      });

      assert(res.ok, `Bulk update failed with status ${res.status}`);
      const data = await res.json();
      assert(data.data.failed_count >= 1, 'Expected at least 1 failure for negative price');
      assert(
        data.data.failed_items.some(f => f.error.includes('0보다 커야')),
        'Expected positive price error in failed items'
      );

      // Cleanup
      await cleanupTestData(1, '2025-12-01');
      await cleanupTestData(3, '2025-12-01');
    }
  },

  {
    name: 'Bulk Update - 중복 체크 with 인상률 경고',
    test: async () => {
      const testMonth = '2025-08-01';

      // Cleanup
      await cleanupTestData(1, testMonth);
      await cleanupTestData(2, testMonth);

      // 1. 기존 데이터 생성
      await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: 1,
          price_month: testMonth,
          unit_price: 10000
        })
      });

      // 2. Bulk update with duplicate (150% increase)
      const res = await fetch(`${BASE_URL}/api/price-history/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [
            {
              item_id: 1,
              price_month: testMonth,
              unit_price: 25000 // 150% increase
            },
            {
              item_id: 2,
              price_month: testMonth,
              unit_price: 12000 // New entry
            }
          ],
          override_existing: false
        })
      });

      assert(res.ok, `Bulk update failed with status ${res.status}`);
      const data = await res.json();
      assert(data.data.success_count === 1, 'Expected 1 successful insert');
      assert(data.data.failed_count >= 1, 'Expected at least 1 failure for duplicate');

      const failedItem = data.data.failed_items.find(f => f.item_id === 1);
      assert(failedItem, 'Expected failed item for item_id 1');
      assert(
        failedItem.warning?.includes('100%') || failedItem.details?.increase_rate,
        `Expected increase warning, got: ${JSON.stringify(failedItem)}`
      );

      // Cleanup
      await cleanupTestData(1, testMonth);
      await cleanupTestData(2, testMonth);
    }
  },

  {
    name: 'Error Message - 한글 메시지 확인',
    test: async () => {
      const res = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: 999999, // Non-existent item
          price_month: '2025-11-01',
          unit_price: 10000
        })
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const data = await res.json();
      assert(
        data.error?.includes('품목') || data.error?.includes('찾을 수 없'),
        `Expected Korean error message, got: ${data.error}`
      );
    }
  },

  {
    name: '정상 가격 생성 - 모든 검증 통과',
    test: async () => {
      const testMonth = '2025-07-01';
      const testItemId = 1;

      await cleanupTestData(testItemId, testMonth);

      const res = await fetch(`${BASE_URL}/api/price-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: testItemId,
          price_month: testMonth,
          unit_price: 12500,
          price_per_kg: 10000,
          note: '테스트 가격 이력'
        })
      });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Expected success true');
      assert(data.data.unit_price === 12500, 'Expected unit_price 12500');
      assert(data.message?.includes('성공'), `Expected success message in Korean, got: ${data.message}`);

      await cleanupTestData(testItemId, testMonth);
    }
  }
];

// Run all tests
async function runTests() {
  console.log('🚀 Starting Business Rules Integration Tests');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log('=' .repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await testAPI(test.name, test.test);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log(`   Total: ${tests.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('=' .repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

// Execute tests
runTests().catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});
