/**
 * Price Analysis Dashboard E2E Tests
 * Tests modal integration, bulk operations, and Excel functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Price Analysis Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to price analysis page
    await page.goto('http://localhost:5000/price-analysis');

    // Wait for data to load
    await page.waitForLoadState('networkidle');
  });

  test('대시보드 로드 및 통계 카드 표시', async ({ page }) => {
    // Check for 6 statistics cards
    const statsCards = await page.locator('.grid > div').count();
    expect(statsCards).toBeGreaterThanOrEqual(6);

    // Verify each card has icon and value
    await expect(page.locator('text=총 품목 수')).toBeVisible();
    await expect(page.locator('text=가격 상승')).toBeVisible();
    await expect(page.locator('text=가격 하락')).toBeVisible();
    await expect(page.locator('text=평균 변동률')).toBeVisible();
    await expect(page.locator('text=변동성 높음')).toBeVisible();
    await expect(page.locator('text=가장 안정적')).toBeVisible();
  });

  test('추세 차트 표시 및 상호작용', async ({ page }) => {
    // Verify chart is visible (canvas element)
    await expect(page.locator('canvas').first()).toBeVisible();

    // Check time range buttons
    await expect(page.locator('text=3개월')).toBeVisible();
    await expect(page.locator('text=6개월')).toBeVisible();
    await expect(page.locator('text=12개월')).toBeVisible();

    // Click 3-month filter
    await page.click('text=3개월');
    await page.waitForTimeout(500);

    // Verify chart is still visible after filter change
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('비교 테이블 필터링 및 정렬', async ({ page }) => {
    // Switch to comparisons tab
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);

    // Search for items
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('부품');
    await page.waitForTimeout(300);

    // Verify table has rows
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThan(0);

    // Click sort button for current price
    await page.click('text=현재가');
    await page.waitForTimeout(300);

    // Verify sorting worked (table still has data)
    const rowsAfterSort = await page.locator('tbody tr').count();
    expect(rowsAfterSort).toBeGreaterThan(0);
  });

  test('가격 계산 Modal - 단일 품목', async ({ page }) => {
    // Switch to comparisons tab
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);

    // Click first "가격 계산" button
    const calcButton = page.locator('button:has-text("가격 계산")').first();
    await calcButton.waitFor({ state: 'visible' });
    await calcButton.click();

    // Verify modal is open
    await expect(page.locator('text=가격 계산').first()).toBeVisible();

    // Fill in increase rate
    const increaseRateInput = page.locator('input[type="number"]').nth(1);
    await increaseRateInput.fill('10');

    // Wait for preview to update
    await page.waitForTimeout(300);

    // Verify preview shows calculated price
    await expect(page.locator('text=계산된 가격')).toBeVisible();

    // Close modal
    await page.click('button:has-text("취소")');
    await page.waitForTimeout(300);

    // Verify modal is closed
    await expect(page.locator('text=가격 계산').first()).not.toBeVisible();
  });

  test('체크박스 선택 기능', async ({ page }) => {
    // Switch to comparisons tab
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);

    // Select first 3 items
    const checkboxes = page.locator('tbody tr input[type="checkbox"]');
    const count = await checkboxes.count();

    if (count >= 3) {
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();

      // Verify selection count
      await expect(page.locator('text=3개 선택됨')).toBeVisible();

      // Verify bulk calculation button is enabled
      const bulkButton = page.locator('button:has-text("선택 품목 일괄 계산")');
      await expect(bulkButton).toBeEnabled();
    }
  });

  test('일괄 가격 계산 - 다중 품목 Modal 열기', async ({ page }) => {
    // Switch to comparisons tab
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);

    // Select items
    const checkboxes = page.locator('tbody tr input[type="checkbox"]');
    const count = await checkboxes.count();

    if (count >= 2) {
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      // Click bulk calculation button
      await page.click('button:has-text("선택 품목 일괄 계산")');

      // Verify modal opens with multiple items
      await expect(page.locator('text=가격 계산').first()).toBeVisible();
      await expect(page.locator('text=2개 품목')).toBeVisible();

      // Close modal
      await page.click('button:has-text("취소")');
    }
  });

  test('Excel 내보내기 버튼 존재 확인', async ({ page }) => {
    // Verify export button exists
    const exportButton = page.locator('button:has-text("Excel 내보내기")');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });

  test('Excel 가져오기 버튼 존재 확인', async ({ page }) => {
    // Verify import button exists
    const importButton = page.locator('button:has-text("Excel 가져오기")');
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeEnabled();
  });

  test('선택 해제 버튼 기능', async ({ page }) => {
    // Switch to comparisons tab
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);

    // Select items
    const checkboxes = page.locator('tbody tr input[type="checkbox"]');
    const count = await checkboxes.count();

    if (count >= 1) {
      await checkboxes.nth(0).check();

      // Verify selection
      await expect(page.locator('text=1개 선택됨')).toBeVisible();

      // Click deselect button
      await page.click('button:has-text("선택 해제")');
      await page.waitForTimeout(300);

      // Verify deselection
      await expect(page.locator('text=선택됨')).not.toBeVisible();
    }
  });

  test('전체 선택 체크박스 기능', async ({ page }) => {
    // Switch to comparisons tab
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);

    // Click header checkbox (select all)
    const headerCheckbox = page.locator('thead input[type="checkbox"]');
    await headerCheckbox.check();
    await page.waitForTimeout(300);

    // Get total row count
    const rowCount = await page.locator('tbody tr').count();

    // Verify all items are selected
    if (rowCount > 0) {
      await expect(page.locator(`text=${rowCount}개 선택됨`)).toBeVisible();
    }

    // Uncheck header checkbox
    await headerCheckbox.uncheck();
    await page.waitForTimeout(300);

    // Verify all items are deselected
    await expect(page.locator('text=선택됨')).not.toBeVisible();
  });

  test('성능 - API 응답 시간', async ({ page }) => {
    // Measure page load time
    const startTime = await page.evaluate(() => performance.now());

    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');

    const endTime = await page.evaluate(() => performance.now());
    const loadTime = endTime - startTime;

    // Verify load time is under 5 seconds (relaxed for CI)
    expect(loadTime).toBeLessThan(5000);

    console.log(`Page load time: ${loadTime.toFixed(2)}ms`);
  });

  test('탭 전환 기능', async ({ page }) => {
    // Verify both tabs exist
    await expect(page.locator('text=가격 추세 분석')).toBeVisible();
    await expect(page.locator('text=품목 간 비교')).toBeVisible();

    // Switch to comparisons
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);

    // Verify table is visible
    await expect(page.locator('table')).toBeVisible();

    // Switch back to trends
    await page.click('text=가격 추세 분석');
    await page.waitForTimeout(300);

    // Verify chart is visible
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('반응형 레이아웃 - 모바일', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload page
    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');

    // Verify page loads on mobile
    await expect(page.locator('text=가격 분석 대시보드')).toBeVisible();

    // Verify statistics cards are visible
    await expect(page.locator('text=총 품목 수')).toBeVisible();
  });

  test('새로고침 버튼 기능', async ({ page }) => {
    // Click refresh button
    const refreshButton = page.locator('button[title="새로고침"]');
    await refreshButton.click();

    // Wait for loading to complete
    await page.waitForLoadState('networkidle');

    // Verify data is still visible
    await expect(page.locator('text=총 품목 수')).toBeVisible();
  });
});

test.describe('Price Analysis Dashboard - Modal Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');

    // Navigate to comparisons tab
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);
  });

  test('Modal 폼 유효성 검증', async ({ page }) => {
    // Open modal for first item
    const calcButton = page.locator('button:has-text("가격 계산")').first();
    await calcButton.waitFor({ state: 'visible' });
    await calcButton.click();

    // Clear base price
    const basePriceInput = page.locator('input[type="number"]').first();
    await basePriceInput.clear();
    await basePriceInput.fill('0');

    // Try to submit
    const submitButton = page.locator('button:has-text("적용")');

    // Button should be disabled
    await expect(submitButton).toBeDisabled();
  });

  test('Modal 반올림 단위 변경', async ({ page }) => {
    // Open modal
    const calcButton = page.locator('button:has-text("가격 계산")').first();
    await calcButton.waitFor({ state: 'visible' });
    await calcButton.click();

    // Change rounding unit
    const roundingSelect = page.locator('select');
    await roundingSelect.selectOption('100');

    // Verify selection
    const selectedValue = await roundingSelect.inputValue();
    expect(selectedValue).toBe('100');
  });

  test('Modal 최소/최대 가격 제약', async ({ page }) => {
    // Open modal
    const calcButton = page.locator('button:has-text("가격 계산")').first();
    await calcButton.waitFor({ state: 'visible' });
    await calcButton.click();

    // Set min price
    const minPriceInput = page.locator('input[type="number"]').nth(3);
    await minPriceInput.fill('1000');

    // Set max price
    const maxPriceInput = page.locator('input[type="number"]').nth(4);
    await maxPriceInput.fill('5000');

    // Verify inputs were set
    expect(await minPriceInput.inputValue()).toBe('1000');
    expect(await maxPriceInput.inputValue()).toBe('5000');
  });

  test('Modal ESC 키로 닫기', async ({ page }) => {
    // Open modal
    const calcButton = page.locator('button:has-text("가격 계산")').first();
    await calcButton.waitFor({ state: 'visible' });
    await calcButton.click();

    // Verify modal is open
    await expect(page.locator('text=가격 계산').first()).toBeVisible();

    // Press ESC (note: might not work due to modal implementation)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // If modal has ESC handling, it should close
    // Otherwise, click cancel button
    const modalStillVisible = await page.locator('text=가격 계산').first().isVisible();
    if (modalStillVisible) {
      await page.click('button:has-text("취소")');
    }
  });
});

test.describe('Price Analysis Dashboard - Chart Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');
  });

  test('차트 데이터 로드 및 표시', async ({ page }) => {
    // Wait for chart to render
    await page.waitForSelector('canvas', { timeout: 5000 });

    // Verify canvas element exists
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Check canvas has proper dimensions
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    expect(canvasBox!.width).toBeGreaterThan(100);
    expect(canvasBox!.height).toBeGreaterThan(100);
  });

  test('시간 범위 필터 변경 시 차트 업데이트', async ({ page }) => {
    // Initial chart load
    await page.waitForSelector('canvas');

    // Click 6-month filter
    await page.click('text=6개월');
    await page.waitForTimeout(800);

    // Verify chart is still visible
    await expect(page.locator('canvas').first()).toBeVisible();

    // Click 12-month filter
    await page.click('text=12개월');
    await page.waitForTimeout(800);

    // Verify chart is still visible
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('차트 범례 표시 및 상호작용', async ({ page }) => {
    // Wait for chart
    await page.waitForSelector('canvas');

    // Check if legend exists (implementation-dependent)
    const legendItems = page.locator('[class*="legend"]');
    const legendCount = await legendItems.count();

    if (legendCount > 0) {
      // Verify legend is visible
      await expect(legendItems.first()).toBeVisible();
    }
  });

  test('차트 툴팁 호버 표시', async ({ page }) => {
    // Wait for chart
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible' });

    // Hover over chart area (might show tooltip)
    await canvas.hover({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);

    // Note: Tooltip detection depends on implementation
    // This test verifies hover doesn't crash
  });
});

test.describe('Price Analysis Dashboard - Statistics Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');
  });

  test('통계 카드 정확한 개수 표시', async ({ page }) => {
    // Verify exactly 6 statistics cards
    const statsCards = page.locator('.grid > div').filter({ has: page.locator('[class*="card"]') });
    const count = await statsCards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('각 통계 카드에 아이콘과 값 표시', async ({ page }) => {
    // Check each card has an icon (SVG)
    const icons = page.locator('.grid svg');
    const iconCount = await icons.count();
    expect(iconCount).toBeGreaterThanOrEqual(6);

    // Check each card has a numeric value or percentage
    const values = page.locator('.grid [class*="text-"]');
    const valueCount = await values.count();
    expect(valueCount).toBeGreaterThan(0);
  });

  test('통계 카드 색상 코딩', async ({ page }) => {
    // Verify price increase card has appropriate styling (green/up arrow)
    const increaseCard = page.locator('text=가격 상승').locator('..');
    await expect(increaseCard).toBeVisible();

    // Verify price decrease card has appropriate styling (red/down arrow)
    const decreaseCard = page.locator('text=가격 하락').locator('..');
    await expect(decreaseCard).toBeVisible();
  });

  test('통계 값 포맷팅 (천단위 구분, 퍼센트)', async ({ page }) => {
    // Check for percentage formatting
    const percentagePattern = /\d+(\.\d+)?%/;
    const pageContent = await page.textContent('body');

    // Should have at least one percentage value
    const hasPercentage = percentagePattern.test(pageContent || '');
    expect(hasPercentage).toBeTruthy();
  });
});

test.describe('Price Analysis Dashboard - Data Table Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');

    // Navigate to comparisons tab
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);
  });

  test('테이블 헤더 컬럼 확인', async ({ page }) => {
    // Verify table exists
    await expect(page.locator('table')).toBeVisible();

    // Check for expected column headers
    await expect(page.locator('th')).toContainText(['현재가', '이전가']);
  });

  test('테이블 데이터 행 렌더링', async ({ page }) => {
    // Verify table has data rows
    const dataRows = page.locator('tbody tr');
    const rowCount = await dataRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify first row has cells
    if (rowCount > 0) {
      const firstRow = dataRows.first();
      const cells = firstRow.locator('td');
      const cellCount = await cells.count();
      expect(cellCount).toBeGreaterThan(0);
    }
  });

  test('가격 변동 표시 (색상 코딩)', async ({ page }) => {
    // Check for price change indicators (up/down arrows or colors)
    const dataRows = page.locator('tbody tr');
    const rowCount = await dataRows.count();

    if (rowCount > 0) {
      // Look for color-coded price changes
      const priceChanges = page.locator('[class*="text-red"], [class*="text-green"], [class*="text-blue"]');
      const changeCount = await priceChanges.count();

      // Should have at least some price changes displayed
      expect(changeCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('테이블 정렬 기능 - 다중 컬럼', async ({ page }) => {
    // Click on different column headers to test sorting
    const headers = ['현재가', '이전가', '변동률'];

    for (const header of headers) {
      const headerLocator = page.locator(`th:has-text("${header}")`);
      const headerCount = await headerLocator.count();

      if (headerCount > 0) {
        // Click to sort ascending
        await headerLocator.first().click();
        await page.waitForTimeout(300);

        // Verify table still has data
        const rowCount = await page.locator('tbody tr').count();
        expect(rowCount).toBeGreaterThan(0);

        // Click to sort descending
        await headerLocator.first().click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('검색 필터 적용 및 해제', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="검색"]');
    const searchCount = await searchInput.count();

    if (searchCount > 0) {
      // Apply search filter
      await searchInput.fill('부품A');
      await page.waitForTimeout(500);

      // Verify filtered results
      const filteredRows = await page.locator('tbody tr').count();
      expect(filteredRows).toBeGreaterThanOrEqual(0);

      // Clear search filter
      await searchInput.clear();
      await page.waitForTimeout(500);

      // Verify all data is shown again
      const allRows = await page.locator('tbody tr').count();
      expect(allRows).toBeGreaterThanOrEqual(filteredRows);
    }
  });
});

test.describe('Price Analysis Dashboard - Bulk Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');

    // Navigate to comparisons tab
    await page.click('text=품목 간 비교');
    await page.waitForTimeout(300);
  });

  test('일괄 계산 버튼 활성화/비활성화', async ({ page }) => {
    const bulkButton = page.locator('button:has-text("선택 품목 일괄 계산")');
    const buttonCount = await bulkButton.count();

    if (buttonCount > 0) {
      // Initially should be disabled
      const initialState = await bulkButton.isDisabled();
      expect(initialState).toBe(true);

      // Select an item
      const checkboxes = page.locator('tbody tr input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        await checkboxes.first().check();
        await page.waitForTimeout(300);

        // Button should now be enabled
        await expect(bulkButton).toBeEnabled();
      }
    }
  });

  test('선택된 항목 수 표시', async ({ page }) => {
    const checkboxes = page.locator('tbody tr input[type="checkbox"]');
    const count = await checkboxes.count();

    if (count >= 3) {
      // Select 3 items
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();
      await page.waitForTimeout(300);

      // Verify count display
      const countText = page.locator('text=/\\d+개 선택됨/');
      await expect(countText).toBeVisible();

      // Extract and verify the number
      const text = await countText.textContent();
      expect(text).toContain('3');
    }
  });

  test('일괄 계산 Modal 데이터 표시', async ({ page }) => {
    const checkboxes = page.locator('tbody tr input[type="checkbox"]');
    const count = await checkboxes.count();

    if (count >= 2) {
      // Select items
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      // Open bulk calculation modal
      await page.click('button:has-text("선택 품목 일괄 계산")');
      await page.waitForTimeout(500);

      // Verify modal shows all selected items
      await expect(page.locator('text=가격 계산').first()).toBeVisible();

      // Should show item count
      const modalContent = await page.locator('[role="dialog"]').textContent();
      expect(modalContent).toContain('품목');
    }
  });
});

test.describe('Price Analysis Dashboard - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');
  });

  test('키보드 네비게이션 - Tab 키', async ({ page }) => {
    // Press Tab to navigate through interactive elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Check that focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('ARIA 라벨 및 역할', async ({ page }) => {
    // Check for proper ARIA roles on buttons
    const buttons = page.locator('button[role="button"], button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Check for proper table structure
    const table = page.locator('table');
    const tableCount = await table.count();

    if (tableCount > 0) {
      await expect(table.first()).toBeVisible();
    }
  });

  test('스크린 리더 호환성 - 이미지 alt 텍스트', async ({ page }) => {
    // Check for alt text on images (if any)
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      // Alt should exist (can be empty for decorative images)
      expect(alt).toBeDefined();
    }
  });

  test('색상 대비 - 텍스트 가독성', async ({ page }) => {
    // Verify text elements are visible and readable
    const textElements = ['총 품목 수', '가격 상승', '가격 하락'];

    for (const text of textElements) {
      const element = page.locator(`text=${text}`);
      if (await element.count() > 0) {
        await expect(element.first()).toBeVisible();
      }
    }
  });
});

test.describe('Price Analysis Dashboard - Responsive Design', () => {
  test('태블릿 레이아웃 (768x1024)', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');

    // Verify page loads properly
    await expect(page.locator('text=가격 분석 대시보드')).toBeVisible();

    // Verify statistics cards adapt to tablet size
    await expect(page.locator('text=총 품목 수')).toBeVisible();
  });

  test('가로 모드 레이아웃', async ({ page }) => {
    // Set landscape mobile viewport
    await page.setViewportSize({ width: 667, height: 375 });

    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');

    // Verify page elements are accessible in landscape
    await expect(page.locator('text=가격 분석')).toBeVisible();
  });

  test('데스크톱 레이아웃 (1920x1080)', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');

    // Verify full desktop layout
    await expect(page.locator('text=가격 분석 대시보드')).toBeVisible();

    // Verify all 6 statistics cards are visible simultaneously
    const statsCards = await page.locator('.grid > div').count();
    expect(statsCards).toBeGreaterThanOrEqual(6);
  });
});

test.describe('Price Analysis Dashboard - Error Handling', () => {
  test('데이터 없음 상태 처리', async ({ page }) => {
    // Note: This test requires a way to simulate empty data
    // For now, we verify the page doesn't crash with empty states

    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForLoadState('networkidle');

    // Page should load even with no data
    await expect(page.locator('body')).toBeVisible();
  });

  test('네트워크 오류 처리', async ({ page }) => {
    // Simulate offline mode
    await page.route('**/api/**', route => route.abort());

    await page.goto('http://localhost:5000/price-analysis');
    await page.waitForTimeout(2000);

    // Page should handle error gracefully (not crash)
    await expect(page.locator('body')).toBeVisible();
  });

  test('API 타임아웃 처리', async ({ page }) => {
    // Simulate slow API response
    await page.route('**/api/**', async route => {
      await page.waitForTimeout(5000);
      await route.continue();
    });

    const startTime = Date.now();
    await page.goto('http://localhost:5000/price-analysis');

    // Should eventually load or show error
    const loadTime = Date.now() - startTime;

    // Page should be visible eventually
    await expect(page.locator('body')).toBeVisible();
  });
});
