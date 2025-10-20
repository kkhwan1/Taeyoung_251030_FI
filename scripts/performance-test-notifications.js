// Wave 3 Day 4 Afternoon - Performance Testing Script
// Tests Notifications API and Trends API under load

const BASE_URL = 'http://localhost:5000';

// Performance thresholds (milliseconds)
const THRESHOLDS = {
  basic_query: 200,
  complex_query: 500,
  write_operation: 1000
};

// Test configuration
const LOAD_TEST_CONFIG = {
  concurrent_requests: 10,
  iterations: 5,
  delay_between_iterations: 100 // ms
};

// Statistics collector
class PerformanceStats {
  constructor() {
    this.results = [];
  }

  add(testName, duration, success, details = {}) {
    this.results.push({
      testName,
      duration,
      success,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  getSummary(testName) {
    const tests = this.results.filter(r => r.testName === testName);
    if (tests.length === 0) return null;

    const durations = tests.map(t => t.duration);
    const successCount = tests.filter(t => t.success).length;

    return {
      testName,
      totalRuns: tests.length,
      successRate: ((successCount / tests.length) * 100).toFixed(2) + '%',
      avgDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) + 'ms',
      minDuration: Math.min(...durations).toFixed(2) + 'ms',
      maxDuration: Math.max(...durations).toFixed(2) + 'ms',
      p50: this.percentile(durations, 50).toFixed(2) + 'ms',
      p95: this.percentile(durations, 95).toFixed(2) + 'ms',
      p99: this.percentile(durations, 99).toFixed(2) + 'ms'
    };
  }

  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[index];
  }

  printSummary() {
    const testNames = [...new Set(this.results.map(r => r.testName))];

    console.log('\n========================================');
    console.log('Performance Test Summary');
    console.log('========================================\n');

    testNames.forEach(testName => {
      const summary = this.getSummary(testName);
      console.log(`📊 ${testName}`);
      console.log(`   Total Runs: ${summary.totalRuns}`);
      console.log(`   Success Rate: ${summary.successRate}`);
      console.log(`   Avg Duration: ${summary.avgDuration}`);
      console.log(`   Min/Max: ${summary.minDuration} / ${summary.maxDuration}`);
      console.log(`   P50/P95/P99: ${summary.p50} / ${summary.p95} / ${summary.p99}`);
      console.log('');
    });
  }
}

const stats = new PerformanceStats();

// Helper: Make HTTP request with timing
async function timedRequest(url, options = {}) {
  const startTime = Date.now();
  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      duration,
      data
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      status: 0,
      duration,
      error: error.message
    };
  }
}

// Helper: Run test multiple times
async function runTest(testName, testFn, iterations = 1) {
  console.log(`\n🔍 Running: ${testName} (${iterations} iterations)`);

  for (let i = 0; i < iterations; i++) {
    try {
      await testFn(i);
      await new Promise(resolve => setTimeout(resolve, LOAD_TEST_CONFIG.delay_between_iterations));
    } catch (error) {
      console.error(`   ❌ Iteration ${i + 1} failed:`, error.message);
      stats.add(testName, 0, false, { iteration: i + 1, error: error.message });
    }
  }
}

// Helper: Run concurrent requests
async function runConcurrent(testName, requestFn, concurrency) {
  console.log(`\n⚡ Running ${concurrency} concurrent requests: ${testName}`);

  const promises = Array.from({ length: concurrency }, (_, i) =>
    (async () => {
      const result = await requestFn(i);
      const threshold = THRESHOLDS[result.category] || THRESHOLDS.basic_query;
      const withinThreshold = result.duration <= threshold;

      stats.add(testName, result.duration, result.success, {
        concurrency: i + 1,
        status: result.status,
        withinThreshold
      });

      const status = result.success ? '✅' : '❌';
      const thresholdStatus = withinThreshold ? '⚡' : '⏱️';
      console.log(`   ${status} ${thresholdStatus} Request ${i + 1}: ${result.duration}ms (threshold: ${threshold}ms)`);
    })()
  );

  await Promise.all(promises);
}

// Test 1: Basic Notification Query (Simple)
async function testBasicNotificationQuery() {
  return await timedRequest(`${BASE_URL}/api/notifications?user_id=1&page=1&limit=20`)
    .then(result => ({ ...result, category: 'basic_query' }));
}

// Test 2: Filtered Notification Query (Complex)
async function testFilteredNotificationQuery() {
  return await timedRequest(
    `${BASE_URL}/api/notifications?user_id=1&type=price_alert&is_read=false&start_date=2025-01-01&end_date=2025-12-31&page=1&limit=50`
  ).then(result => ({ ...result, category: 'complex_query' }));
}

// Test 3: Preferences Query (Simple)
async function testPreferencesQuery() {
  return await timedRequest(`${BASE_URL}/api/notifications/preferences?user_id=1`)
    .then(result => ({ ...result, category: 'basic_query' }));
}

// Test 4: Trend Analysis Query (Complex)
async function testTrendAnalysisQuery() {
  return await timedRequest(
    `${BASE_URL}/api/price-analysis/trends?item_id=48&granularity=month&include_forecast=true`
  ).then(result => ({ ...result, category: 'complex_query' }));
}

// Test 5: Pagination Performance
async function testPaginationPerformance(iteration) {
  const page = (iteration % 5) + 1; // Test pages 1-5
  const result = await timedRequest(`${BASE_URL}/api/notifications?user_id=1&page=${page}&limit=20`);

  stats.add('Pagination Performance', result.duration, result.success, {
    page,
    status: result.status
  });

  const threshold = THRESHOLDS.basic_query;
  const withinThreshold = result.duration <= threshold;
  const status = result.success ? '✅' : '❌';
  const thresholdStatus = withinThreshold ? '⚡' : '⏱️';
  console.log(`   ${status} ${thresholdStatus} Page ${page}: ${result.duration}ms`);
}

// Test 6: Load Test - Concurrent Basic Queries
async function testConcurrentBasicQueries() {
  await runConcurrent(
    'Concurrent Basic Queries',
    testBasicNotificationQuery,
    LOAD_TEST_CONFIG.concurrent_requests
  );
}

// Test 7: Load Test - Concurrent Complex Queries
async function testConcurrentComplexQueries() {
  await runConcurrent(
    'Concurrent Complex Queries',
    testFilteredNotificationQuery,
    LOAD_TEST_CONFIG.concurrent_requests
  );
}

// Test 8: Load Test - Mixed Queries
async function testMixedLoadQueries() {
  const queries = [
    testBasicNotificationQuery,
    testFilteredNotificationQuery,
    testPreferencesQuery,
    testTrendAnalysisQuery
  ];

  await runConcurrent(
    'Mixed Load Queries',
    (i) => queries[i % queries.length](),
    LOAD_TEST_CONFIG.concurrent_requests
  );
}

// Test 9: Write Operation Performance
async function testWriteOperationPerformance(iteration) {
  const result = await timedRequest(`${BASE_URL}/api/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: 1,
      type: 'system',
      title: `성능 테스트 알림 #${iteration}`,
      message: `성능 테스트를 위해 생성된 알림입니다. (반복 ${iteration})`,
      is_read: false
    })
  });

  stats.add('Write Operation Performance', result.duration, result.success, {
    iteration,
    status: result.status,
    category: 'write_operation'
  });

  const threshold = THRESHOLDS.write_operation;
  const withinThreshold = result.duration <= threshold;
  const status = result.success ? '✅' : '❌';
  const thresholdStatus = withinThreshold ? '⚡' : '⏱️';
  console.log(`   ${status} ${thresholdStatus} Write ${iteration}: ${result.duration}ms`);
}

// Test 10: Cache Effectiveness (Multiple Identical Queries)
async function testCacheEffectiveness() {
  console.log('\n🔍 Testing Cache Effectiveness (5 identical queries)');

  const durations = [];

  for (let i = 0; i < 5; i++) {
    const result = await timedRequest(`${BASE_URL}/api/notifications?user_id=1&page=1&limit=20`);
    durations.push(result.duration);

    stats.add('Cache Effectiveness', result.duration, result.success, {
      iteration: i + 1,
      status: result.status
    });

    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} Query ${i + 1}: ${result.duration}ms`);
  }

  // Analyze cache improvement
  const firstQuery = durations[0];
  const avgSubsequent = durations.slice(1).reduce((a, b) => a + b, 0) / (durations.length - 1);
  const improvement = ((firstQuery - avgSubsequent) / firstQuery * 100).toFixed(2);

  console.log(`\n   📊 First Query: ${firstQuery}ms`);
  console.log(`   📊 Avg Subsequent: ${avgSubsequent.toFixed(2)}ms`);
  console.log(`   📊 Improvement: ${improvement}%`);
}

// Main test runner
async function runAllTests() {
  console.log('========================================');
  console.log('Wave 3 Day 4 - Performance Testing');
  console.log('========================================');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Thresholds: Basic=${THRESHOLDS.basic_query}ms, Complex=${THRESHOLDS.complex_query}ms, Write=${THRESHOLDS.write_operation}ms`);
  console.log('');

  try {
    // Sequential Tests
    await runTest('Pagination Performance', testPaginationPerformance, 5);

    // Write Performance
    await runTest('Write Operation Performance', testWriteOperationPerformance, 3);

    // Cache Effectiveness
    await testCacheEffectiveness();

    // Load Tests - Concurrent Requests
    await testConcurrentBasicQueries();
    await testConcurrentComplexQueries();
    await testMixedLoadQueries();

    // Print summary
    stats.printSummary();

    // Performance Analysis
    console.log('========================================');
    console.log('Performance Analysis');
    console.log('========================================\n');

    const allResults = stats.results;
    const successRate = ((allResults.filter(r => r.success).length / allResults.length) * 100).toFixed(2);
    const avgDuration = (allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length).toFixed(2);

    console.log(`✅ Overall Success Rate: ${successRate}%`);
    console.log(`⏱️  Average Response Time: ${avgDuration}ms`);

    // Threshold compliance
    const basicQueryResults = allResults.filter(r => r.category === 'basic_query');
    const complexQueryResults = allResults.filter(r => r.category === 'complex_query');
    const writeOpResults = allResults.filter(r => r.category === 'write_operation');

    if (basicQueryResults.length > 0) {
      const basicCompliance = (basicQueryResults.filter(r => r.duration <= THRESHOLDS.basic_query).length / basicQueryResults.length * 100).toFixed(2);
      console.log(`⚡ Basic Query Threshold Compliance: ${basicCompliance}%`);
    }

    if (complexQueryResults.length > 0) {
      const complexCompliance = (complexQueryResults.filter(r => r.duration <= THRESHOLDS.complex_query).length / complexQueryResults.length * 100).toFixed(2);
      console.log(`⚡ Complex Query Threshold Compliance: ${complexCompliance}%`);
    }

    if (writeOpResults.length > 0) {
      const writeCompliance = (writeOpResults.filter(r => r.duration <= THRESHOLDS.write_operation).length / writeOpResults.length * 100).toFixed(2);
      console.log(`⚡ Write Operation Threshold Compliance: ${writeCompliance}%`);
    }

    console.log('\n========================================');
    console.log('Performance Test Complete');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();
