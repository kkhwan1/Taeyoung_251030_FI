/**
 * Test script for notifications cursor-based pagination
 * Tests both cursor and offset pagination with Korean UTF-8 data
 *
 * Usage:
 *   node scripts/test-notifications-cursor.js
 */

const API_URL = process.env.API_URL || 'http://localhost:5000';

// Test data with Korean characters
const testNotifications = [
  {
    user_id: 1,
    type: 'price_alert',
    title: '가격 변동 알림',
    message: '부품A의 가격이 10% 상승했습니다',
    item_id: 1
  },
  {
    user_id: 1,
    type: 'price_change',
    title: '가격 변경 완료',
    message: '부품B의 가격이 업데이트되었습니다',
    item_id: 2
  },
  {
    user_id: 1,
    type: 'system',
    title: '시스템 알림',
    message: '정기 점검이 예정되어 있습니다'
  }
];

/**
 * Color formatting for terminal output
 */
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
 * Create test notifications
 */
async function createTestNotifications() {
  logSection('Creating Test Notifications with Korean UTF-8');

  const createdIds = [];

  for (const notification of testNotifications) {
    try {
      const response = await fetch(`${API_URL}/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(notification)
      });

      const result = await response.json();

      if (result.success) {
        createdIds.push(result.data.notification_id);
        logSuccess(`Created: ${notification.title} (ID: ${result.data.notification_id})`);

        // Verify Korean characters
        if (result.data.title === notification.title) {
          logSuccess(`  UTF-8 preserved: ${result.data.title}`);
        } else {
          logError(`  UTF-8 corrupted: ${result.data.title}`);
        }
      } else {
        logError(`Failed to create: ${notification.title}`);
        console.log('  Error:', result.error);
      }
    } catch (error) {
      logError(`Exception: ${error.message}`);
    }
  }

  return createdIds;
}

/**
 * Test offset-based pagination (backward compatibility)
 */
async function testOffsetPagination(user_id = 1) {
  logSection('Testing Offset-Based Pagination (Backward Compatibility)');

  try {
    const startTime = Date.now();

    // Page 1
    const response = await fetch(
      `${API_URL}/api/notifications?user_id=${user_id}&page=1&limit=2`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=utf-8'
        }
      }
    );

    const result = await response.json();
    const duration = Date.now() - startTime;

    if (result.success) {
      logSuccess(`Page 1 fetched in ${duration}ms`);
      console.log('  Pagination:', {
        page: result.pagination.page,
        limit: result.pagination.limit,
        totalCount: result.pagination.totalCount,
        totalPages: result.pagination.totalPages,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev
      });

      // Verify Korean encoding
      if (result.data.length > 0) {
        const firstItem = result.data[0];
        logInfo(`First item title: ${firstItem.title}`);

        if (firstItem.title.includes('�') || firstItem.title.includes('ë')) {
          logError('UTF-8 encoding corrupted!');
        } else {
          logSuccess('UTF-8 encoding preserved');
        }
      }
    } else {
      logError('Offset pagination failed');
      console.log('  Error:', result.error);
    }

    return result;
  } catch (error) {
    logError(`Exception: ${error.message}`);
    return null;
  }
}

/**
 * Test cursor-based pagination
 */
async function testCursorPagination(user_id = 1) {
  logSection('Testing Cursor-Based Pagination (Forward)');

  try {
    // First page (no cursor)
    const startTime1 = Date.now();
    const response1 = await fetch(
      `${API_URL}/api/notifications?user_id=${user_id}&limit=2`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=utf-8'
        }
      }
    );

    const result1 = await response1.json();
    const duration1 = Date.now() - startTime1;

    if (result1.success) {
      logSuccess(`Page 1 fetched in ${duration1}ms`);
      console.log('  Pagination:', {
        limit: result1.pagination.limit,
        hasNext: result1.pagination.hasNext,
        hasPrev: result1.pagination.hasPrev,
        nextCursor: result1.pagination.nextCursor ? 'present' : 'null',
        prevCursor: result1.pagination.prevCursor ? 'present' : 'null'
      });

      // Verify Korean encoding
      if (result1.data.length > 0) {
        const firstItem = result1.data[0];
        logInfo(`First item title: ${firstItem.title}`);

        if (firstItem.title.includes('�') || firstItem.title.includes('ë')) {
          logError('UTF-8 encoding corrupted!');
        } else {
          logSuccess('UTF-8 encoding preserved');
        }
      }

      // Test next page if cursor exists
      if (result1.pagination.hasNext && result1.pagination.nextCursor) {
        logSection('Testing Cursor-Based Pagination (Next Page)');

        const startTime2 = Date.now();
        const response2 = await fetch(
          `${API_URL}/api/notifications?user_id=${user_id}&limit=2&cursor=${encodeURIComponent(result1.pagination.nextCursor)}&direction=forward`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json; charset=utf-8'
            }
          }
        );

        const result2 = await response2.json();
        const duration2 = Date.now() - startTime2;

        if (result2.success) {
          logSuccess(`Page 2 fetched in ${duration2}ms`);
          console.log('  Pagination:', {
            limit: result2.pagination.limit,
            hasNext: result2.pagination.hasNext,
            hasPrev: result2.pagination.hasPrev,
            nextCursor: result2.pagination.nextCursor ? 'present' : 'null',
            prevCursor: result2.pagination.prevCursor ? 'present' : 'null'
          });

          // Performance comparison
          if (duration1 > 0 && duration2 > 0) {
            const improvement = ((duration1 - duration2) / duration1 * 100).toFixed(1);
            if (duration2 < duration1) {
              logSuccess(`Cursor pagination ${Math.abs(improvement)}% faster`);
            } else {
              logInfo(`Cursor pagination ${Math.abs(improvement)}% slower (cache effect)`);
            }
          }
        } else {
          logError('Cursor page 2 failed');
          console.log('  Error:', result2.error);
        }
      }
    } else {
      logError('Cursor pagination failed');
      console.log('  Error:', result1.error);
    }

    return result1;
  } catch (error) {
    logError(`Exception: ${error.message}`);
    return null;
  }
}

/**
 * Test backward pagination
 */
async function testBackwardPagination(cursor, user_id = 1) {
  logSection('Testing Cursor-Based Pagination (Backward)');

  try {
    const startTime = Date.now();
    const response = await fetch(
      `${API_URL}/api/notifications?user_id=${user_id}&limit=2&cursor=${encodeURIComponent(cursor)}&direction=backward`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=utf-8'
        }
      }
    );

    const result = await response.json();
    const duration = Date.now() - startTime;

    if (result.success) {
      logSuccess(`Backward page fetched in ${duration}ms`);
      console.log('  Pagination:', {
        limit: result.pagination.limit,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev
      });
    } else {
      logError('Backward pagination failed');
      console.log('  Error:', result.error);
    }

    return result;
  } catch (error) {
    logError(`Exception: ${error.message}`);
    return null;
  }
}

/**
 * Test cache performance
 */
async function testCachePerformance(user_id = 1) {
  logSection('Testing Cache Performance');

  try {
    // First request (cache miss)
    const startTime1 = Date.now();
    const response1 = await fetch(
      `${API_URL}/api/notifications?user_id=${user_id}&limit=10`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=utf-8'
        }
      }
    );
    const result1 = await response1.json();
    const duration1 = Date.now() - startTime1;

    logInfo(`First request (cache miss): ${duration1}ms`);

    // Wait 100ms
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second request (cache hit)
    const startTime2 = Date.now();
    const response2 = await fetch(
      `${API_URL}/api/notifications?user_id=${user_id}&limit=10`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json; charset=utf-8'
        }
      }
    );
    const result2 = await response2.json();
    const duration2 = Date.now() - startTime2;

    logInfo(`Second request (cache hit): ${duration2}ms`);

    if (result2.cached) {
      logSuccess('Cache working correctly');

      if (duration2 < duration1) {
        const improvement = ((duration1 - duration2) / duration1 * 100).toFixed(1);
        logSuccess(`Cache improved response time by ${improvement}%`);
      }
    } else {
      logError('Cache not working');
    }
  } catch (error) {
    logError(`Exception: ${error.message}`);
  }
}

/**
 * Cleanup test notifications
 */
async function cleanup(notificationIds) {
  logSection('Cleaning Up Test Notifications');

  for (const id of notificationIds) {
    try {
      const response = await fetch(
        `${API_URL}/api/notifications?notification_id=${id}`,
        {
          method: 'DELETE'
        }
      );

      const result = await response.json();

      if (result.success) {
        logSuccess(`Deleted notification ${id}`);
      } else {
        logError(`Failed to delete notification ${id}`);
      }
    } catch (error) {
      logError(`Exception: ${error.message}`);
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n🚀 Notifications Cursor Pagination Test Suite', 'bold');
  log(`API URL: ${API_URL}`, 'cyan');

  // Create test data
  const createdIds = await createTestNotifications();

  if (createdIds.length === 0) {
    logError('No test data created. Aborting tests.');
    return;
  }

  // Test offset pagination
  await testOffsetPagination(1);

  // Test cursor pagination
  const cursorResult = await testCursorPagination(1);

  // Test backward pagination if we have a cursor
  if (cursorResult?.pagination?.nextCursor) {
    await testBackwardPagination(cursorResult.pagination.nextCursor, 1);
  }

  // Test cache performance
  await testCachePerformance(1);

  // Cleanup
  await cleanup(createdIds);

  logSection('Test Suite Completed');
  logSuccess('All tests finished');
}

// Run tests
runTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
