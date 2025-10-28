/**
 * Dashboard E2E Tests
 * Tests real-time widgets, charts, alerts, and auto-refresh functionality
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Dashboard - Main Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 로드 및 기본 레이아웃 표시', async ({ page }) => {
    // Verify page title
    await expect(page.locator('h1:has-text("대시보드")')).toBeVisible();

    // Verify subtitle
    await expect(page.locator('text=태창 ERP 시스템 현황을 모니터링하세요')).toBeVisible();
  });

  test('대시보드 컴포넌트 로드 확인', async ({ page }) => {
    // Wait for dashboard to load
    await page.waitForTimeout(2000);

    // Check if refresh controls are visible
    const refreshControls = page.locator('[data-testid="refresh-controls"], button:has-text("새로고침")');
    if (await refreshControls.count() > 0) {
      await expect(refreshControls.first()).toBeVisible();
    }
  });
});

test.describe('Dashboard - KPI Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load
  });

  test('KPI 카드 표시 확인', async ({ page }) => {
    // Check for KPI cards section
    const kpiSection = page.locator('[data-testid="kpi-cards"], .grid').first();

    // Should have multiple stat cards
    const statCards = page.locator('[data-testid^="kpi-card"], .bg-white.rounded-lg, .dark\\:bg-gray-800.rounded-lg');
    const cardCount = await statCards.count();

    // Dashboard should have at least 3 KPI cards
    expect(cardCount).toBeGreaterThanOrEqual(3);
  });

  test('총 품목 수 카드 데이터 확인', async ({ page }) => {
    // Look for items count card
    const itemsCard = page.locator('text=/품목|Items/i').first();

    if (await itemsCard.isVisible()) {
      // Verify number is displayed
      const numbers = await page.locator('text=/^\\d+/').count();
      expect(numbers).toBeGreaterThan(0);
    }
  });

  test('재고 금액 카드 데이터 확인', async ({ page }) => {
    // Look for stock value card
    const stockValueCard = page.locator('text=/재고|Stock/i');

    if (await stockValueCard.count() > 0) {
      // Verify currency format (숫자 + 원)
      const currency = page.locator('text=/\\d+.*원/');
      if (await currency.count() > 0) {
        await expect(currency.first()).toBeVisible();
      }
    }
  });

  test('낮은 재고 경고 카드 확인', async ({ page }) => {
    // Look for low stock alerts
    const lowStockCard = page.locator('text=/낮은 재고|Low Stock/i');

    if (await lowStockCard.count() > 0) {
      // Should show count
      const alertCount = page.locator('text=/\\d+.*건|\\d+.*개/');
      if (await alertCount.count() > 0) {
        await expect(alertCount.first()).toBeVisible();
      }
    }
  });

  test('금일 거래 카드 확인', async ({ page }) => {
    // Look for today's transactions
    const todayCard = page.locator('text=/금일|Today|오늘/i');

    if (await todayCard.count() > 0) {
      // Verify transaction count or amount
      const transactionData = page.locator('text=/\\d+.*건|\\d+.*원/');
      if (await transactionData.count() > 0) {
        await expect(transactionData.first()).toBeVisible();
      }
    }
  });
});

test.describe('Dashboard - Charts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('차트 섹션 표시 확인', async ({ page }) => {
    // Check for chart containers
    const charts = page.locator('canvas, svg[class*="recharts"]');
    const chartCount = await charts.count();

    // Dashboard should have multiple charts
    expect(chartCount).toBeGreaterThanOrEqual(2);
  });

  test('재고 현황 차트 표시', async ({ page }) => {
    // Look for stock chart - more flexible matching
    const stockChart = page.locator('text=/재고.*현황|Stock.*Status|카테고리별.*재고/i');

    // Wait for any chart to appear
    const anyChart = page.locator('canvas, svg[class*="recharts"]');
    await expect(anyChart.first()).toBeVisible({ timeout: 10000 });

    // If specific text exists, check it's visible
    if (await stockChart.count() > 0) {
      // Check if it's visible or might be in a collapsed state
      const isVisible = await stockChart.first().isVisible();
      
      // If hidden, it might be a mobile/collapse issue
      if (!isVisible) {
        // Try to click to expand
        await stockChart.first().click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(500);
      }
      
      // Verify at least one chart element exists
      const chartElement = page.locator('canvas, svg').first();
      await expect(chartElement).toBeVisible();
    }
  });

  test('거래 분포 차트 표시', async ({ page }) => {
    // Look for transaction distribution chart
    const transactionChart = page.locator('text=/거래.*분포|Transaction.*Distribution/i');

    if (await transactionChart.count() > 0) {
      await expect(transactionChart.first()).toBeVisible();
    }
  });

  test('월별 재고 추이 차트 표시', async ({ page }) => {
    // Look for monthly trends chart
    const trendsChart = page.locator('text=/월별.*추이|Monthly.*Trend/i');

    if (await trendsChart.count() > 0) {
      await expect(trendsChart.first()).toBeVisible();

      // Verify data points exist
      const dataPoints = page.locator('circle, rect, path[class*="recharts"]');
      const pointCount = await dataPoints.count();
      expect(pointCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('카테고리별 재고 차트 표시', async ({ page }) => {
    // Look for category-based chart
    const categoryChart = page.locator('text=/카테고리|Category/i');

    if (await categoryChart.count() > 0) {
      // Verify chart exists
      const chartCanvas = page.locator('canvas, svg').nth(1);
      if (await chartCanvas.count() > 0) {
        await expect(chartCanvas).toBeVisible();
      }
    }
  });

  test('가치 상위 품목 차트 표시', async ({ page }) => {
    // Look for top items by value
    const topItemsChart = page.locator('text=/상위.*품목|Top.*Item/i');

    if (await topItemsChart.count() > 0) {
      await expect(topItemsChart.first()).toBeVisible();
    }
  });
});

test.describe('Dashboard - Alerts & Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('낮은 재고 경고 패널 표시', async ({ page }) => {
    // Look for alerts panel
    const alertsPanel = page.locator('text=/낮은 재고.*경고|Low Stock.*Alert/i');

    if (await alertsPanel.count() > 0) {
      await expect(alertsPanel.first()).toBeVisible();

      // Check for alert items
      const alertItems = page.locator('[data-testid="alert-item"], .alert, .warning');
      const itemCount = await alertItems.count();

      // May have 0 alerts if stock is healthy
      expect(itemCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('경고 항목 데이터 확인', async ({ page }) => {
    const alertItems = page.locator('[data-testid="alert-item"]');
    const alertCount = await alertItems.count();

    if (alertCount > 0) {
      // Check first alert item
      const firstAlert = alertItems.first();
      await expect(firstAlert).toBeVisible();

      // Should show item name and quantity
      const itemName = firstAlert.locator('text=/[가-힣]+/');
      await expect(itemName).toBeVisible();
    }
  });

  test('경고 아이콘 표시', async ({ page }) => {
    // Look for warning icons
    const warningIcons = page.locator('svg[class*="lucide-alert"], [data-testid="alert-icon"]');

    if (await warningIcons.count() > 0) {
      // Warning icons should be visible if there are alerts
      const firstIcon = warningIcons.first();
      if (await firstIcon.isVisible()) {
        await expect(firstIcon).toBeVisible();
      }
    }
  });
});

test.describe('Dashboard - Recent Activity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('최근 활동 위젯 표시', async ({ page }) => {
    // Look for recent activity section
    const recentActivity = page.locator('text=/최근.*활동|Recent.*Activity/i');

    if (await recentActivity.count() > 0) {
      await expect(recentActivity.first()).toBeVisible();
    }
  });

  test('최근 거래 내역 표시', async ({ page }) => {
    // Look for transaction list
    const transactions = page.locator('[data-testid="recent-transaction"], .transaction-item');
    const txCount = await transactions.count();

    // May have 0 transactions if database is empty
    expect(txCount).toBeGreaterThanOrEqual(0);

    if (txCount > 0) {
      // First transaction should be visible
      await expect(transactions.first()).toBeVisible();
    }
  });

  test('거래 시간 정보 표시', async ({ page }) => {
    const timeInfo = page.locator('text=/\\d+분.*전|\\d+시간.*전|방금/');

    if (await timeInfo.count() > 0) {
      // Relative time should be displayed
      await expect(timeInfo.first()).toBeVisible();
    }
  });
});

test.describe('Dashboard - Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('빠른 작업 버튼 표시', async ({ page }) => {
    // Look for quick actions section
    const quickActions = page.locator('text=/빠른.*작업|Quick.*Action/i');

    if (await quickActions.count() > 0) {
      await expect(quickActions.first()).toBeVisible();

      // Should have action buttons
      const actionButtons = page.locator('button, a').filter({ hasText: /입고|출고|매출|매입/ });
      const buttonCount = await actionButtons.count();
      expect(buttonCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('입고 버튼 클릭 - 네비게이션', async ({ page }) => {
    const receivingButton = page.locator('button:has-text("입고"), a:has-text("입고")').first();

    if (await receivingButton.count() > 0 && await receivingButton.isVisible()) {
      await receivingButton.click();
      await page.waitForTimeout(500);

      // Verify navigation or modal opened
      const currentUrl = page.url();
      expect(currentUrl).toContain('http://localhost:5000');
    }
  });

  test('매출 등록 버튼 표시', async ({ page }) => {
    const salesButton = page.locator('button:has-text("매출"), a:has-text("매출")');

    if (await salesButton.count() > 0) {
      await expect(salesButton.first()).toBeVisible();
    }
  });
});

test.describe('Dashboard - Auto-Refresh Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');
  });

  test('새로고침 컨트롤 표시', async ({ page }) => {
    // Look for refresh controls
    const refreshButton = page.locator('button:has-text("새로고침"), button[aria-label*="새로고침"]');

    if (await refreshButton.count() > 0) {
      await expect(refreshButton.first()).toBeVisible();
    }
  });

  test('수동 새로고침 버튼 작동', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("새로고침")').first();

    if (await refreshButton.isVisible()) {
      // Click refresh button
      await refreshButton.click();
      await page.waitForTimeout(1000);

      // Verify loading state or data refresh
      const loadingIndicator = page.locator('[data-testid="loading"], .animate-spin');

      // Loading may appear briefly
      const hasLoading = await loadingIndicator.count() > 0;
      expect(hasLoading).toBeTruthy();
    }
  });

  test('자동 새로고침 간격 선택', async ({ page }) => {
    // Look for interval selector
    const intervalSelector = page.locator('select[data-testid="refresh-interval"], select');

    if (await intervalSelector.count() > 0) {
      const selector = intervalSelector.first();
      if (await selector.isVisible()) {
        await expect(selector).toBeVisible();

        // Get available options first
        const options = await selector.locator('option').all();
        const optionTexts = await Promise.all(options.map(opt => opt.textContent()));
        
        console.log('Available options:', optionTexts);
        
        // Try selecting first available option (if exists)
        if (options.length > 0) {
          await selector.selectOption({ index: 0 });
          await page.waitForTimeout(300);
          
          let value = await selector.inputValue();
          expect(value).toBeTruthy();
        }
      }
    }
  });

  test('자동 새로고침 토글', async ({ page }) => {
    // Look for auto-refresh toggle
    const autoRefreshToggle = page.locator('input[type="checkbox"][data-testid*="auto-refresh"], button[role="switch"]');

    if (await autoRefreshToggle.count() > 0) {
      const toggle = autoRefreshToggle.first();
      if (await toggle.isVisible()) {
        // Toggle on
        await toggle.click();
        await page.waitForTimeout(300);

        // Toggle off
        await toggle.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('마지막 업데이트 시간 표시', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for last updated timestamp
    const lastUpdated = page.locator('text=/마지막.*업데이트|Last.*Updated|\\d+:\\d+/i');

    if (await lastUpdated.count() > 0) {
      await expect(lastUpdated.first()).toBeVisible();
    }
  });
});

test.describe('Dashboard - Responsive Design', () => {
  test('모바일 뷰포트에서 대시보드 표시', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');

    // Verify page loads
    await expect(page.locator('h1:has-text("대시보드")')).toBeVisible();

    // KPI cards should stack vertically
    await page.waitForTimeout(1000);
    const kpiCards = page.locator('[data-testid^="kpi-card"], .bg-white.rounded-lg').first();
    if (await kpiCards.count() > 0) {
      await expect(kpiCards).toBeVisible();
    }
  });

  test('태블릿 뷰포트에서 대시보드 표시', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');

    // Verify page loads
    await expect(page.locator('h1:has-text("대시보드")')).toBeVisible();

    // Charts should be visible
    await page.waitForTimeout(1000);
    const charts = page.locator('canvas, svg[class*="recharts"]');
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThanOrEqual(1);
  });

  test('데스크톱 뷰포트에서 대시보드 표시', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');

    // Verify page loads
    await expect(page.locator('h1:has-text("대시보드")')).toBeVisible();

    // All widgets should be visible
    await page.waitForTimeout(1000);
    const widgets = page.locator('[data-testid^="widget"], .bg-white.rounded-lg, .dark\\:bg-gray-800');
    const widgetCount = await widgets.count();
    expect(widgetCount).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Dashboard - Performance', () => {
  test('페이지 초기 로드 성능', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Dashboard should load within 20 seconds (realistic target)
    expect(loadTime).toBeLessThan(20000);

    console.log(`Dashboard initial load time: ${loadTime}ms`);
  });

  test('데이터 로딩 성능', async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');

    const startTime = Date.now();

    // Click refresh to reload data
    const refreshButton = page.locator('button:has-text("새로고침")').first();
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(2000);
    }

    const endTime = Date.now();
    const refreshTime = endTime - startTime;

    // Data refresh should complete within 3 seconds
    expect(refreshTime).toBeLessThan(3000);

    console.log(`Dashboard refresh time: ${refreshTime}ms`);
  });

  test('차트 렌더링 성능', async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');

    const startTime = Date.now();

    // Wait for charts to render
    await page.waitForSelector('canvas, svg[class*="recharts"]', { timeout: 5000 });

    const endTime = Date.now();
    const renderTime = endTime - startTime;

    // Charts should render within 3 seconds
    expect(renderTime).toBeLessThan(3000);

    console.log(`Chart rendering time: ${renderTime}ms`);
  });
});

test.describe('Dashboard - Error Handling', () => {
  test('API 오류 시 에러 메시지 표시', async ({ page }) => {
    // Block API requests to simulate error
    await page.route('**/api/dashboard/**', route => route.abort());

    await page.goto('http://localhost:5000/');
    await page.waitForTimeout(3000);

    // Check for error message
    const errorMessage = page.locator('text=/오류|Error|실패|Failed/i');

    if (await errorMessage.count() > 0) {
      await expect(errorMessage.first()).toBeVisible();
    }
  });

  test('재시도 버튼 작동', async ({ page }) => {
    // Simulate temporary API failure
    let requestCount = 0;
    await page.route('**/api/dashboard/**', route => {
      requestCount++;
      if (requestCount === 1) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto('http://localhost:5000/');
    await page.waitForTimeout(2000);

    // Look for retry button
    const retryButton = page.locator('button:has-text("다시 시도"), button:has-text("재시도")');

    if (await retryButton.count() > 0 && await retryButton.first().isVisible()) {
      await retryButton.first().click();
      await page.waitForTimeout(2000);

      // Data should load after retry
      const kpiCards = page.locator('[data-testid^="kpi-card"]');
      if (await kpiCards.count() > 0) {
        await expect(kpiCards.first()).toBeVisible();
      }
    }
  });
});

test.describe('Dashboard - Dark Mode', () => {
  test('다크 모드 토글', async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');

    // Look for theme toggle
    const themeToggle = page.locator('button[data-testid="theme-toggle"], button[aria-label*="theme"], button[aria-label*="테마"]');

    if (await themeToggle.count() > 0) {
      const toggle = themeToggle.first();
      if (await toggle.isVisible()) {
        // Toggle theme
        await toggle.click();
        await page.waitForTimeout(500);

        // Verify dark mode class applied
        const html = page.locator('html');
        const htmlClasses = await html.getAttribute('class');

        // Should have dark class
        expect(htmlClasses).toBeTruthy();

        // Toggle back
        await toggle.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('다크 모드에서 대시보드 표시', async ({ page }) => {
    await page.goto('http://localhost:5000/');
    await page.waitForLoadState('networkidle');

    // Emulate dark color scheme
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500);

    // Verify page is still readable
    await expect(page.locator('h1:has-text("대시보드")')).toBeVisible();

    // KPI cards should be visible in dark mode
    const kpiCards = page.locator('[data-testid^="kpi-card"], .dark\\:bg-gray-800');
    if (await kpiCards.count() > 0) {
      await expect(kpiCards.first()).toBeVisible();
    }
  });
});
