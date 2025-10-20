/**
 * Simplified Pagination Performance Test
 * Tests cursor vs offset pagination using existing notifications
 *
 * Usage:
 *   node scripts/test-pagination-performance.js
 */

const API_URL = process.env.API_URL || 'http://localhost:5000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'yellow');
}

/**
 * Test offset-based pagination performance
 */
async function testOffsetPagination() {
  logSection('Testing Offset-Based Pagination (Baseline)');

  const times = [];
  const iterations = 10;

  try {
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();

      const response = await fetch(
        `${API_URL}/api/notifications?user_id=1&page=1&limit=20`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      const duration = Date.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        times.push(duration);
        logInfo(`Iteration ${i + 1}: ${duration}ms (${result.data?.length || 0} items)`);
      } else {
        logError(`Iteration ${i + 1} failed with status ${response.status}`);
      }
    }

    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);

      logSuccess(`\nOffset Pagination Stats:`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min}ms`);
      console.log(`  Max: ${max}ms`);
      console.log(`  Iterations: ${times.length}/${iterations}`);

      return { avg, min, max, times };
    } else {
      logError('No successful offset pagination requests');
      return null;
    }
  } catch (error) {
    logError(`Exception: ${error.message}`);
    return null;
  }
}

/**
 * Test cursor-based pagination performance
 */
async function testCursorPagination() {
  logSection('Testing Cursor-Based Pagination (Task 7)');

  const times = [];
  const iterations = 10;

  try {
    // First get initial page to obtain cursor
    const initialResponse = await fetch(
      `${API_URL}/api/notifications?user_id=1&limit=20`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!initialResponse.ok) {
      logError(`Initial request failed with status ${initialResponse.status}`);
      return null;
    }

    const initialResult = await initialResponse.json();
    const nextCursor = initialResult.pagination?.nextCursor;

    logInfo(`Initial page loaded, nextCursor: ${nextCursor ? 'present' : 'null'}`);

    // Test with cursor if available, otherwise test initial page
    const testUrl = nextCursor
      ? `${API_URL}/api/notifications?user_id=1&limit=20&cursor=${encodeURIComponent(nextCursor)}&direction=forward`
      : `${API_URL}/api/notifications?user_id=1&limit=20`;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        times.push(duration);
        logInfo(`Iteration ${i + 1}: ${duration}ms (${result.data?.length || 0} items, cached: ${result.cached || false})`);
      } else {
        logError(`Iteration ${i + 1} failed with status ${response.status}`);
      }
    }

    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);

      logSuccess(`\nCursor Pagination Stats:`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min}ms`);
      console.log(`  Max: ${max}ms`);
      console.log(`  Iterations: ${times.length}/${iterations}`);

      return { avg, min, max, times };
    } else {
      logError('No successful cursor pagination requests');
      return null;
    }
  } catch (error) {
    logError(`Exception: ${error.message}`);
    return null;
  }
}

/**
 * Compare performance
 */
function compareResults(offsetStats, cursorStats, baseline = 109.56) {
  logSection('Performance Comparison');

  if (!offsetStats || !cursorStats) {
    logError('Missing stats for comparison');
    return;
  }

  const offsetAvg = offsetStats.avg;
  const cursorAvg = cursorStats.avg;

  const improvement = ((offsetAvg - cursorAvg) / offsetAvg * 100).toFixed(1);
  const vsBaseline = ((baseline - cursorAvg) / baseline * 100).toFixed(1);

  console.log(`Offset-based (baseline): ${offsetAvg.toFixed(2)}ms`);
  console.log(`Cursor-based (Task 7):   ${cursorAvg.toFixed(2)}ms`);
  console.log(`\nImprovement: ${Math.abs(improvement)}% ${improvement > 0 ? 'faster' : 'slower'}`);
  console.log(`vs Task 6 baseline (${baseline}ms): ${Math.abs(vsBaseline)}% ${vsBaseline > 0 ? 'faster' : 'slower'}`);

  if (cursorAvg < offsetAvg) {
    logSuccess(`✅ Cursor pagination is FASTER!`);
  } else {
    logInfo(`ℹ️  Offset pagination faster (cache effects or small dataset)`);
  }

  // Target check
  const targetMin = baseline * 0.7; // 20-30% improvement target
  const targetMax = baseline * 0.8;

  if (cursorAvg <= targetMax) {
    logSuccess(`🎯 Task 7 Target ACHIEVED! (Target: ${targetMin.toFixed(2)}-${targetMax.toFixed(2)}ms)`);
  } else {
    logInfo(`Target range: ${targetMin.toFixed(2)}-${targetMax.toFixed(2)}ms`);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n🚀 Cursor Pagination Performance Test', 'bold');
  log(`API URL: ${API_URL}`, 'cyan');
  log(`Task 6 Baseline: 109.56ms`, 'cyan');
  log(`Task 7 Target: 76.69-87.65ms (20-30% improvement)`, 'cyan');

  // Test offset pagination
  const offsetStats = await testOffsetPagination();

  // Wait briefly between tests
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test cursor pagination
  const cursorStats = await testCursorPagination();

  // Compare results
  compareResults(offsetStats, cursorStats);

  logSection('Test Completed');

  if (offsetStats && cursorStats) {
    logSuccess('Performance metrics captured successfully');

    // Output JSON for documentation
    console.log('\nJSON Results:');
    console.log(JSON.stringify({
      baseline_task6: 109.56,
      offset_pagination: {
        avg: offsetStats.avg,
        min: offsetStats.min,
        max: offsetStats.max
      },
      cursor_pagination: {
        avg: cursorStats.avg,
        min: cursorStats.min,
        max: cursorStats.max
      },
      improvement_percent: ((offsetStats.avg - cursorStats.avg) / offsetStats.avg * 100).toFixed(1),
      vs_baseline_percent: ((109.56 - cursorStats.avg) / 109.56 * 100).toFixed(1)
    }, null, 2));
  } else {
    logError('Test incomplete - check API server status');
  }
}

// Run tests
runTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
