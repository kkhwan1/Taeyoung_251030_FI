/**
 * Phase 1 API Performance Benchmark
 *
 * Tests 15 critical endpoints for:
 * - Response time
 * - Status code
 * - Cache hit rates (Task 6 validation)
 * - JSON validity
 */

const API_BASE = 'http://localhost:5000/api';

const endpoints = [
  // Dashboard APIs
  { path: '/dashboard/overview', name: 'Dashboard Overview', critical: true },
  { path: '/dashboard-simple', name: 'Simple Dashboard', critical: true },

  // Master Data APIs
  { path: '/items', name: 'Items List', critical: true },
  { path: '/companies', name: 'Companies List', critical: true },
  { path: '/bom', name: 'BOM List', critical: false },

  // Transaction APIs
  { path: '/inventory', name: 'Inventory Transactions', critical: true },
  { path: '/sales-transactions', name: 'Sales Transactions', critical: true },
  { path: '/purchases', name: 'Purchase Transactions', critical: true },
  { path: '/collections', name: 'Collections', critical: false },
  { path: '/payments', name: 'Payments', critical: false },

  // Price Analysis APIs (Phase P5)
  { path: '/price-analysis/trends', name: 'Price Trends', critical: true },
  { path: '/price-analysis/forecast', name: 'Price Forecast', critical: true },
  { path: '/price-history', name: 'Price History', critical: false },
  { path: '/price-master', name: 'Price Master', critical: false },

  // Accounting APIs (Phase 2)
  { path: '/accounting/monthly', name: 'Monthly Accounting', critical: false }
];

const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0
  }
};

async function testEndpoint(endpoint) {
  const url = `${API_BASE}${endpoint.path}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    let jsonValid = false;
    let dataSize = 0;

    try {
      const data = await response.json();
      jsonValid = true;
      dataSize = JSON.stringify(data).length;
    } catch (e) {
      jsonValid = false;
    }

    const passed = response.ok && jsonValid && responseTime < (endpoint.critical ? 200 : 500);

    const result = {
      endpoint: endpoint.name,
      path: endpoint.path,
      status: response.status,
      responseTime: responseTime,
      jsonValid,
      dataSize,
      critical: endpoint.critical,
      passed,
      threshold: endpoint.critical ? 200 : 500
    };

    results.tests.push(result);
    results.summary.total++;
    if (passed) results.summary.passed++;
    else results.summary.failed++;

    console.log(`${passed ? '✅' : '❌'} ${endpoint.name}: ${responseTime}ms (${response.status})`);

    return result;
  } catch (error) {
    const result = {
      endpoint: endpoint.name,
      path: endpoint.path,
      status: 'ERROR',
      responseTime: 0,
      jsonValid: false,
      dataSize: 0,
      critical: endpoint.critical,
      passed: false,
      error: error.message
    };

    results.tests.push(result);
    results.summary.total++;
    results.summary.failed++;

    console.log(`❌ ${endpoint.name}: ${error.message}`);

    return result;
  }
}

async function testCachePerformance() {
  console.log('\n🔄 Testing Cache Performance (Task 6 Validation)...\n');

  const cacheTestEndpoint = '/items';

  // First request (cold cache)
  const start1 = Date.now();
  await fetch(`${API_BASE}${cacheTestEndpoint}`);
  const cold = Date.now() - start1;

  // Wait 100ms
  await new Promise(resolve => setTimeout(resolve, 100));

  // Second request (warm cache)
  const start2 = Date.now();
  await fetch(`${API_BASE}${cacheTestEndpoint}`);
  const warm = Date.now() - start2;

  const improvement = ((cold - warm) / cold * 100).toFixed(1);

  console.log(`Cold cache: ${cold}ms`);
  console.log(`Warm cache: ${warm}ms`);
  console.log(`Improvement: ${improvement}% (Target: >50%)`);

  return {
    coldCache: cold,
    warmCache: warm,
    improvement: parseFloat(improvement),
    passed: parseFloat(improvement) > 50
  };
}

async function runBenchmark() {
  console.log('🚀 Starting Phase 1 API Performance Benchmark...\n');
  console.log(`API Base URL: ${API_BASE}`);
  console.log(`Total Endpoints: ${endpoints.length}\n`);

  // Test all endpoints
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }

  // Calculate statistics
  const responseTimes = results.tests
    .filter(t => t.responseTime > 0)
    .map(t => t.responseTime)
    .sort((a, b) => a - b);

  results.summary.avgResponseTime = Math.round(
    responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
  );

  const p95Index = Math.floor(responseTimes.length * 0.95);
  results.summary.p95ResponseTime = responseTimes[p95Index] || 0;

  // Test cache performance
  const cacheTest = await testCachePerformance();
  results.cachePerformance = cacheTest;

  console.log('\n📊 Performance Summary:');
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);
  console.log(`Avg Response Time: ${results.summary.avgResponseTime}ms`);
  console.log(`P95 Response Time: ${results.summary.p95ResponseTime}ms`);
  console.log(`Cache Improvement: ${cacheTest.improvement}% ${cacheTest.passed ? '✅' : '❌'}`);

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'c:\\Users\\USER\\claude_code\\FITaeYoungERP\\scripts\\phase1-api-performance-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n✅ Results saved to: scripts/phase1-api-performance-results.json');

  process.exit(results.summary.failed === 0 ? 0 : 1);
}

runBenchmark();
