// Wave 3 Day 4 - Test Script for Notifications and Trend Analysis APIs
// scripts/test-notifications-trends.js

const BASE_URL = 'http://localhost:5000';

// Test utilities
function log(section, message, data = null) {
  console.log(`\n[${section}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logError(section, message, error) {
  console.error(`\n[${section}] ❌ ${message}`);
  console.error(error.message || error);
}

function logSuccess(section, message) {
  console.log(`\n[${section}] ✅ ${message}`);
}

// Performance tracking
function startTimer() {
  return Date.now();
}

function endTimer(start, threshold = 200) {
  const elapsed = Date.now() - start;
  const status = elapsed < threshold ? '✅' : '⚠️';
  console.log(`${status} Response time: ${elapsed}ms (threshold: ${threshold}ms)`);
  return elapsed;
}

// API test functions
async function testNotificationsAPI() {
  console.log('\n========================================');
  console.log('Testing Notifications API');
  console.log('========================================');

  let createdNotificationId = null;

  // Test 1: Create notification
  try {
    log('Test 1', 'Creating new notification (가격 알림)...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 1,
        type: 'price_alert',
        title: '가격 상승 알림',
        message: '부품A의 가격이 10% 상승했습니다. 현재 가격: ₩12,000',
        item_id: 48,
        is_read: false
      })
    });

    endTimer(start);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    if (!result.success || !result.data) {
      throw new Error('Invalid response format');
    }

    createdNotificationId = result.data.notification_id;
    logSuccess('Test 1', `Notification created with ID: ${createdNotificationId}`);
    log('Test 1', 'Response:', result.data);
  } catch (error) {
    logError('Test 1', 'Failed to create notification', error);
  }

  // Test 2: Create system notification
  try {
    log('Test 2', 'Creating system notification...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 1,
        type: 'system',
        title: '시스템 업데이트',
        message: '새로운 기능이 추가되었습니다. 확인해보세요!',
        is_read: false
      })
    });

    endTimer(start);

    const result = await response.json();

    if (response.ok && result.success) {
      logSuccess('Test 2', 'System notification created');
    }
  } catch (error) {
    logError('Test 2', 'Failed to create system notification', error);
  }

  // Test 3: Get all notifications for user
  try {
    log('Test 3', 'Fetching all notifications for user_id=1...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications?user_id=1&page=1&limit=10`);

    endTimer(start);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    logSuccess('Test 3', `Retrieved ${result.data?.length || 0} notifications`);
    log('Test 3', 'Pagination:', result.pagination);
  } catch (error) {
    logError('Test 3', 'Failed to fetch notifications', error);
  }

  // Test 4: Get unread notifications only
  try {
    log('Test 4', 'Fetching unread notifications...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications?user_id=1&is_read=false`);

    endTimer(start);

    const result = await response.json();

    if (response.ok && result.success) {
      logSuccess('Test 4', `Found ${result.data?.length || 0} unread notifications`);
    }
  } catch (error) {
    logError('Test 4', 'Failed to fetch unread notifications', error);
  }

  // Test 5: Filter by notification type
  try {
    log('Test 5', 'Filtering notifications by type (price_alert)...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications?user_id=1&type=price_alert`);

    endTimer(start);

    const result = await response.json();

    if (response.ok && result.success) {
      logSuccess('Test 5', `Found ${result.data?.length || 0} price alert notifications`);
    }
  } catch (error) {
    logError('Test 5', 'Failed to filter notifications', error);
  }

  // Test 6: Mark notification as read
  if (createdNotificationId) {
    try {
      log('Test 6', `Marking notification ${createdNotificationId} as read...`);
      const start = startTimer();

      const response = await fetch(`${BASE_URL}/api/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_id: createdNotificationId,
          is_read: true
        })
      });

      endTimer(start);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      logSuccess('Test 6', 'Notification marked as read');
      log('Test 6', 'Updated notification:', result.data);
    } catch (error) {
      logError('Test 6', 'Failed to update notification', error);
    }
  }

  // Test 7: Delete notification
  if (createdNotificationId) {
    try {
      log('Test 7', `Deleting notification ${createdNotificationId}...`);
      const start = startTimer();

      const response = await fetch(`${BASE_URL}/api/notifications?notification_id=${createdNotificationId}`, {
        method: 'DELETE'
      });

      endTimer(start);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      logSuccess('Test 7', 'Notification deleted successfully');
    } catch (error) {
      logError('Test 7', 'Failed to delete notification', error);
    }
  }

  // Test 8: Invalid request - missing required field
  try {
    log('Test 8', 'Testing validation - missing user_id...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'system',
        title: '테스트',
        message: '테스트 메시지'
        // user_id missing
      })
    });

    endTimer(start);

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logSuccess('Test 8', 'Validation error correctly handled');
      log('Test 8', 'Error:', result.error);
    } else {
      logError('Test 8', 'Expected validation error but got success', result);
    }
  } catch (error) {
    logError('Test 8', 'Unexpected error', error);
  }
}

async function testNotificationPreferencesAPI() {
  console.log('\n========================================');
  console.log('Testing Notification Preferences API');
  console.log('========================================');

  // Test 1: Get default preferences (user not found)
  try {
    log('Test 1', 'Getting preferences for new user (user_id=999)...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications/preferences?user_id=999`);

    endTimer(start);

    const result = await response.json();

    if (response.ok && result.success) {
      logSuccess('Test 1', 'Default preferences returned');
      log('Test 1', 'Preferences:', result.data);
    }
  } catch (error) {
    logError('Test 1', 'Failed to get default preferences', error);
  }

  // Test 2: Update preferences (upsert)
  try {
    log('Test 2', 'Updating notification preferences for user_id=1...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 1,
        email_enabled: true,
        push_enabled: true,
        price_threshold: 5000,
        categories: ['원자재', '외주가공', '소모품']
      })
    });

    endTimer(start);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    logSuccess('Test 2', 'Preferences updated successfully');
    log('Test 2', 'Updated preferences:', result.data);
  } catch (error) {
    logError('Test 2', 'Failed to update preferences', error);
  }

  // Test 3: Get existing preferences
  try {
    log('Test 3', 'Getting updated preferences for user_id=1...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications/preferences?user_id=1`);

    endTimer(start);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    logSuccess('Test 3', 'Retrieved existing preferences');
    log('Test 3', 'Preferences:', result.data);
  } catch (error) {
    logError('Test 3', 'Failed to get preferences', error);
  }

  // Test 4: Partial update (only email_enabled)
  try {
    log('Test 4', 'Partial update - disabling email notifications...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 1,
        email_enabled: false
      })
    });

    endTimer(start);

    const result = await response.json();

    if (response.ok && result.success) {
      logSuccess('Test 4', 'Partial update successful');
      log('Test 4', 'Updated preferences:', result.data);
    }
  } catch (error) {
    logError('Test 4', 'Failed partial update', error);
  }

  // Test 5: Invalid request - missing user_id
  try {
    log('Test 5', 'Testing validation - missing user_id...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/notifications/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_enabled: true
        // user_id missing
      })
    });

    endTimer(start);

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logSuccess('Test 5', 'Validation error correctly handled');
    } else {
      logError('Test 5', 'Expected validation error', result);
    }
  } catch (error) {
    logError('Test 5', 'Unexpected error', error);
  }
}

async function testTrendAnalysisAPI() {
  console.log('\n========================================');
  console.log('Testing Trend Analysis API');
  console.log('========================================');

  // Test 1: Basic trend analysis (monthly, no forecast)
  try {
    log('Test 1', 'Basic trend analysis - monthly granularity...');
    const start = startTimer();

    const response = await fetch(`${BASE_URL}/api/price-analysis/trends?granularity=month`);

    endTimer(start);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    logSuccess('Test 1', 'Trend analysis completed');
    log('Test 1', 'Statistics:', result.data?.statistics);
    log('Test 1', `Found ${result.data?.time_series?.length || 0} periods`);
  } catch (error) {
    logError('Test 1', 'Failed to get trend analysis', error);
  }

  // Test 2: Trend analysis with forecast
  try {
    log('Test 2', 'Trend analysis with forecast (3 periods)...');
    const start = startTimer();

    const response = await fetch(
      `${BASE_URL}/api/price-analysis/trends?granularity=month&include_forecast=true`
    );

    endTimer(start);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    logSuccess('Test 2', 'Trend analysis with forecast completed');
    log('Test 2', 'Statistics:', result.data?.statistics);
    log('Test 2', 'Forecast:', result.data?.forecast);
  } catch (error) {
    logError('Test 2', 'Failed to get trend forecast', error);
  }

  // Test 3: Specific item trend
  try {
    log('Test 3', 'Trend analysis for specific item (item_id=48)...');
    const start = startTimer();

    const response = await fetch(
      `${BASE_URL}/api/price-analysis/trends?item_id=48&granularity=month&include_forecast=true`
    );

    endTimer(start);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    logSuccess('Test 3', `Trend for item: ${result.data?.item_name || 'Unknown'}`);
    log('Test 3', 'Time series sample:', result.data?.time_series?.slice(0, 3));
    log('Test 3', 'Statistics:', result.data?.statistics);
    log('Test 3', 'Forecast:', result.data?.forecast);
  } catch (error) {
    logError('Test 3', 'Failed to get item trend', error);
  }

  // Test 4: Custom date range
  try {
    log('Test 4', 'Trend analysis with custom date range (last 6 months)...');
    const start = startTimer();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const response = await fetch(
      `${BASE_URL}/api/price-analysis/trends?start_date=${startStr}&end_date=${endStr}&granularity=month`
    );

    endTimer(start);

    const result = await response.json();

    if (response.ok && result.success) {
      logSuccess('Test 4', `Custom date range: ${startStr} to ${endStr}`);
      log('Test 4', `Periods found: ${result.data?.time_series?.length || 0}`);
      log('Test 4', 'Statistics:', result.data?.statistics);
    }
  } catch (error) {
    logError('Test 4', 'Failed with custom date range', error);
  }

  // Test 5: Weekly granularity
  try {
    log('Test 5', 'Trend analysis with weekly granularity...');
    const start = startTimer();

    const response = await fetch(
      `${BASE_URL}/api/price-analysis/trends?granularity=week&include_forecast=true`
    );

    endTimer(start);

    const result = await response.json();

    if (response.ok && result.success) {
      logSuccess('Test 5', 'Weekly trend analysis completed');
      log('Test 5', `Periods: ${result.data?.time_series?.length || 0}`);
      log('Test 5', 'Sample periods:', result.data?.time_series?.slice(0, 3));
    }
  } catch (error) {
    logError('Test 5', 'Failed weekly trend analysis', error);
  }

  // Test 6: Invalid date range (start > end)
  try {
    log('Test 6', 'Testing validation - invalid date range...');
    const start = startTimer();

    const response = await fetch(
      `${BASE_URL}/api/price-analysis/trends?start_date=2024-12-01&end_date=2024-01-01`
    );

    endTimer(start);

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logSuccess('Test 6', 'Invalid date range correctly rejected');
    } else {
      logError('Test 6', 'Expected validation error', result);
    }
  } catch (error) {
    logError('Test 6', 'Unexpected error', error);
  }

  // Test 7: Performance test with large date range
  try {
    log('Test 7', 'Performance test - 2 year date range...');
    const start = startTimer();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const response = await fetch(
      `${BASE_URL}/api/price-analysis/trends?start_date=${startStr}&end_date=${endStr}&granularity=month&include_forecast=true`
    );

    const elapsed = endTimer(start, 500); // 500ms threshold for large dataset

    const result = await response.json();

    if (response.ok && result.success) {
      logSuccess('Test 7', `Processed ${result.data?.time_series?.length || 0} periods in ${elapsed}ms`);
    }
  } catch (error) {
    logError('Test 7', 'Performance test failed', error);
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Wave 3 Day 4 - API Test Suite        ║');
  console.log('║  Notifications + Trend Analysis        ║');
  console.log('╚════════════════════════════════════════╝');

  const overallStart = startTimer();

  await testNotificationsAPI();
  await testNotificationPreferencesAPI();
  await testTrendAnalysisAPI();

  const totalElapsed = Date.now() - overallStart;

  console.log('\n========================================');
  console.log('Test Suite Complete');
  console.log('========================================');
  console.log(`Total execution time: ${totalElapsed}ms`);
  console.log('\n✅ All tests completed. Check output above for results.');
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
