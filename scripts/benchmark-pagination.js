/**
 * Pagination Performance Benchmark Script
 *
 * Compares OFFSET-based vs cursor-based pagination performance
 * Run before and after migration to validate 20-30% improvement target
 *
 * Usage:
 *   node scripts/benchmark-pagination.js
 */

const ENDPOINTS = [
  { name: 'Items', path: '/api/items', totalRecords: 500 },
  { name: 'Price History', path: '/api/price-history', totalRecords: 1000 },
  { name: 'Sales Transactions', path: '/api/sales-transactions', totalRecords: 800 },
  { name: 'Purchase Transactions', path: '/api/purchase-transactions', totalRecords: 600 },
  { name: 'Inventory Transactions', path: '/api/inventory/transactions', totalRecords: 400 }
];

const BASE_URL = 'http://localhost:5000';
const PAGE_SIZES = [20, 50, 100];
const DEEP_PAGES = [1, 5, 10, 20, 50]; // Test performance degradation on deep pages

/**
 * Measure response time for a single request
 */
async function measureRequest(url) {
  const start = Date.now();
  try {
    const response = await fetch(url);
    const data = await response.json();
    const duration = Date.now() - start;

    return {
      success: response.ok && data.success,
      duration,
      recordCount: data.data?.length || 0,
      cached: data.cached || false
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * Benchmark OFFSET-based pagination (old method)
 */
async function benchmarkOffset(endpoint, pageSize, pageNumber) {
  const offset = (pageNumber - 1) * pageSize;
  const url = `${BASE_URL}${endpoint.path}?limit=${pageSize}&offset=${offset}`;

  return await measureRequest(url);
}

/**
 * Benchmark cursor-based pagination (new method)
 */
async function benchmarkCursor(endpoint, pageSize, cursor = null, direction = 'forward') {
  let url = `${BASE_URL}${endpoint.path}?limit=${pageSize}`;
  if (cursor) {
    url += `&cursor=${encodeURIComponent(cursor)}&direction=${direction}`;
  }

  const result = await measureRequest(url);
  return {
    ...result,
    nextCursor: result.success ? result.pagination?.nextCursor : null,
    prevCursor: result.success ? result.pagination?.prevCursor : null
  };
}

/**
 * Run comprehensive benchmark suite
 */
async function runBenchmark() {
  console.log('🚀 Pagination Performance Benchmark');
  console.log('=====================================\n');

  const results = [];

  for (const endpoint of ENDPOINTS) {
    console.log(`\n📊 Endpoint: ${endpoint.name}`);
    console.log(`   Total Records: ${endpoint.totalRecords}`);
    console.log('   ---------------------------------');

    for (const pageSize of PAGE_SIZES) {
      console.log(`\n   Page Size: ${pageSize}`);

      // Test shallow pages (1-5)
      for (const page of DEEP_PAGES.filter(p => p <= 5)) {
        const offsetResult = await benchmarkOffset(endpoint, pageSize, page);

        results.push({
          endpoint: endpoint.name,
          method: 'OFFSET',
          pageSize,
          page,
          depth: 'shallow',
          duration: offsetResult.duration,
          cached: offsetResult.cached,
          success: offsetResult.success
        });

        console.log(`     Page ${page} (OFFSET): ${offsetResult.duration}ms ${offsetResult.cached ? '(cached)' : ''}`);

        // Wait between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Test deep pages (10-50) - where OFFSET degrades
      for (const page of DEEP_PAGES.filter(p => p > 5)) {
        // Only test if endpoint has enough records
        const maxPage = Math.ceil(endpoint.totalRecords / pageSize);
        if (page > maxPage) continue;

        const offsetResult = await benchmarkOffset(endpoint, pageSize, page);

        results.push({
          endpoint: endpoint.name,
          method: 'OFFSET',
          pageSize,
          page,
          depth: 'deep',
          duration: offsetResult.duration,
          cached: offsetResult.cached,
          success: offsetResult.success
        });

        console.log(`     Page ${page} (OFFSET): ${offsetResult.duration}ms ${offsetResult.cached ? '(cached)' : ''} [DEEP]`);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Test cursor-based (if endpoint supports it)
      // Skip for now - will add after migration
    }
  }

  // Generate summary report
  console.log('\n\n📈 Summary Report');
  console.log('=================\n');

  const avgByDepth = {};

  for (const result of results) {
    const key = `${result.depth}-${result.pageSize}`;
    if (!avgByDepth[key]) {
      avgByDepth[key] = { total: 0, count: 0, cached: 0 };
    }
    avgByDepth[key].total += result.duration;
    avgByDepth[key].count += 1;
    if (result.cached) avgByDepth[key].cached += 1;
  }

  console.log('Average Response Times (uncached):');
  console.log('------------------------------------');

  for (const [key, stats] of Object.entries(avgByDepth)) {
    const [depth, pageSize] = key.split('-');
    const avg = Math.round(stats.total / stats.count);
    const cacheRate = Math.round((stats.cached / stats.count) * 100);

    console.log(`  ${depth.padEnd(8)} | Page Size ${pageSize.padEnd(3)} | Avg: ${String(avg).padStart(4)}ms | Cache Hit: ${cacheRate}%`);
  }

  // Performance degradation analysis
  console.log('\n\n⚠️  Performance Degradation (OFFSET Method):');
  console.log('----------------------------------------------');

  for (const pageSize of PAGE_SIZES) {
    const shallowKey = `shallow-${pageSize}`;
    const deepKey = `deep-${pageSize}`;

    if (avgByDepth[shallowKey] && avgByDepth[deepKey]) {
      const shallowAvg = avgByDepth[shallowKey].total / avgByDepth[shallowKey].count;
      const deepAvg = avgByDepth[deepKey].total / avgByDepth[deepKey].count;
      const degradation = Math.round(((deepAvg - shallowAvg) / shallowAvg) * 100);

      console.log(`  Page Size ${pageSize}: ${degradation}% slower for deep pages (${Math.round(shallowAvg)}ms → ${Math.round(deepAvg)}ms)`);
    }
  }

  // Save results to JSON
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `benchmark-results-${timestamp}.json`;

  fs.writeFileSync(filename, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    summary: avgByDepth
  }, null, 2));

  console.log(`\n\n✅ Results saved to: ${filename}`);
  console.log('\n💡 Next Steps:');
  console.log('   1. Migrate endpoints to cursor-based pagination');
  console.log('   2. Run this benchmark again');
  console.log('   3. Compare results to validate 20-30% improvement\n');
}

// Run benchmark
runBenchmark().catch(error => {
  console.error('❌ Benchmark failed:', error);
  process.exit(1);
});
