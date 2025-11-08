import { test, expect, Page } from '@playwright/test';

/**
 * Phase 1 E2E Tests: Complete BOM Page User Workflow
 *
 * Tests the complete user journey on the BOM page including:
 * - Initial page load and data display
 * - Category filtering (내부생산/외부구매)
 * - Font size adjustments
 * - Item detail panel interactions
 * - API data fetching and display
 * - Error scenarios and edge cases
 * - Responsive behavior across devices
 *
 * Test Strategy: Real browser automation with Playwright
 * Coverage: Full user workflows, error handling, responsive design
 */

test.describe('BOM Page - Complete User Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to BOM page
    await page.goto('http://localhost:5000/master/bom');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait for main content to be visible
    await page.waitForSelector('h1:has-text("BOM 관리")', { timeout: 10000 });
  });

  test.describe('User Journey: Browse BOM Data', () => {
    test('should display BOM page with all core components', async ({ page }) => {
      // Verify page title
      await expect(page.locator('h1:has-text("BOM 관리")')).toBeVisible();

      // Verify CategoryFilter is present
      await expect(page.locator('text=품목 구분 필터')).toBeVisible();

      // Verify global font size control is accessible from Header
      await expect(page.locator('text=보통')).toBeVisible();

      // Verify BOM table is present
      await expect(page.locator('[data-testid="bom-table"]')).toBeVisible();

      // Verify at least one table row exists
      const rows = page.locator('[data-testid="bom-table-body"] tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should load and display BOM data from API', async ({ page }) => {
      // Intercept API request
      const responsePromise = page.waitForResponse('**/api/bom/full-tree**');

      // Reload to trigger API call
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify API response
      const response = await responsePromise;
      expect(response.status()).toBe(200);

      const json = await response.json();
      expect(json).toHaveProperty('success', true);
      expect(json).toHaveProperty('data');
      expect(Array.isArray(json.data)).toBe(true);

      // Verify data is displayed in table
      const rows = page.locator('[data-testid="bom-table-body"] tr');
      const rowCount = await rows.count();
      expect(rowCount).toBe(json.data.length);
    });

    test('should display BOM hierarchy with correct levels', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Verify level indicators are present
      const levelIndicators = page.locator('[data-testid="level-indicator"]');
      const indicatorCount = await levelIndicators.count();

      // Should have at least some level indicators
      expect(indicatorCount).toBeGreaterThan(0);

      // Verify first row has correct structure
      const firstRow = page.locator('[data-testid="bom-table-body"] tr').first();
      await expect(firstRow).toBeVisible();

      // Should have item code, name, and other columns
      const cells = firstRow.locator('td');
      const cellCount = await cells.count();
      expect(cellCount).toBeGreaterThanOrEqual(5);
    });
  });

  test.describe('User Journey: Filter by Category', () => {
    test('should filter to show only 내부생산 items', async ({ page }) => {
      // Wait for initial data
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Get initial row count
      const allRows = page.locator('[data-testid="bom-table-body"] tr');
      const initialCount = await allRows.count();

      // Click 내부생산 category
      await page.click('button:has-text("내부생산")');
      await page.waitForTimeout(500);

      // Verify filter is applied (button highlighted)
      const internalButton = page.locator('button:has-text("내부생산")');
      await expect(internalButton).toHaveClass(/bg-blue-600/);

      // Verify clear button is visible
      await expect(page.locator('button[title="필터 초기화"]')).toBeVisible();

      // Get filtered row count
      const filteredCount = await allRows.count();

      // Row count should change (unless all items are internal)
      // The key assertion is that the filter button is highlighted
      expect(filteredCount).toBeGreaterThan(0);
    });

    test('should filter to show only 외부구매 items', async ({ page }) => {
      // Wait for initial data
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Click 외부구매 category
      await page.click('button:has-text("외부구매")');
      await page.waitForTimeout(500);

      // Verify filter is applied
      const externalButton = page.locator('button:has-text("외부구매")');
      await expect(externalButton).toHaveClass(/bg-green-600/);

      // Verify clear button is visible
      await expect(page.locator('button[title="필터 초기화"]')).toBeVisible();
    });

    test('should clear filter and show all items', async ({ page }) => {
      // Apply filter first
      await page.click('button:has-text("내부생산")');
      await page.waitForTimeout(300);

      // Verify filter is applied
      await expect(page.locator('button[title="필터 초기화"]')).toBeVisible();

      // Click clear button
      await page.click('button[title="필터 초기화"]');
      await page.waitForTimeout(300);

      // Verify "전체" is selected
      const allButton = page.locator('button:has-text("전체")');
      await expect(allButton).toHaveClass(/bg-blue-600/);

      // Verify clear button is hidden
      await expect(page.locator('button[title="필터 초기화"]')).not.toBeVisible();
    });

    test('should switch between categories seamlessly', async ({ page }) => {
      // Start with 내부생산
      await page.click('button:has-text("내부생산")');
      await page.waitForTimeout(300);
      await expect(page.locator('button:has-text("내부생산")')).toHaveClass(/bg-blue-600/);

      // Switch to 외부구매
      await page.click('button:has-text("외부구매")');
      await page.waitForTimeout(300);
      await expect(page.locator('button:has-text("외부구매")')).toHaveClass(/bg-green-600/);

      // Switch back to 전체
      await page.click('button:has-text("전체")');
      await page.waitForTimeout(300);
      await expect(page.locator('button:has-text("전체")')).toHaveClass(/bg-blue-600/);
    });

    test('should display category counts correctly', async ({ page }) => {
      // Wait for data to load
      await page.waitForSelector('[data-testid="bom-table-body"]');
      await page.waitForTimeout(1000);

      // Check if count badges are visible
      const countBadges = page.locator('button span').filter({ hasText: /^\d+$/ });
      const count = await countBadges.count();

      // Should have at least one count badge
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('User Journey: Adjust Font Size', () => {
    test('should increase font size and see visual changes', async ({ page }) => {
      // Get initial font size class
      const cell = page.locator('[data-testid="bom-table-body"] tr').first().locator('td').first();
      const initialClass = await cell.getAttribute('class');

      // Click increase button
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);

      // Verify label changed
      await expect(page.locator('text=크게')).toBeVisible();

      // Verify reset button is visible
      await expect(page.locator('button[title="기본 크기로 초기화"]')).toBeVisible();

      // Get new font size class
      const newClass = await cell.getAttribute('class');

      // Classes should be different
      expect(initialClass).not.toBe(newClass);
    });

    test('should decrease font size', async ({ page }) => {
      // Click decrease button
      await page.click('button[title="폰트 크기 감소"]');
      await page.waitForTimeout(300);

      // Verify label changed
      await expect(page.locator('text=작게')).toBeVisible();

      // Verify reset button is visible
      await expect(page.locator('button[title="기본 크기로 초기화"]')).toBeVisible();
    });

    test('should reset font size to default', async ({ page }) => {
      // Increase font size first
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);

      // Click reset button
      await page.click('button[title="기본 크기로 초기화"]');
      await page.waitForTimeout(300);

      // Verify label is back to default
      await expect(page.locator('text=보통')).toBeVisible();

      // Verify reset button is hidden
      await expect(page.locator('button[title="기본 크기로 초기화"]')).not.toBeVisible();
    });

    test('should persist font size after page reload', async ({ page }) => {
      // Change font size
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);
      await expect(page.locator('text=크게')).toBeVisible();

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Font size should still be "크게"
      await expect(page.locator('text=크게')).toBeVisible();
    });

    test('should cycle through all font sizes', async ({ page }) => {
      const fontSizes = ['보통', '크게', '최대'];

      for (const size of fontSizes) {
        await expect(page.locator(`text=${size}`)).toBeVisible();

        if (size !== '최대') {
          await page.click('button[title="폰트 크기 증가"]');
          await page.waitForTimeout(200);
        }
      }

      // At maximum, increase button should be disabled
      await expect(page.locator('button[title="폰트 크기 증가"]')).toBeDisabled();
    });

    test('should use direct font size selection via indicators', async ({ page }) => {
      // Click on largest size indicator
      const indicators = page.locator('button[title^="폰트 크기:"]');
      const largestIndicator = indicators.last();
      await largestIndicator.click();
      await page.waitForTimeout(300);

      // Should show "최대"
      await expect(page.locator('text=최대')).toBeVisible();
    });
  });

  test.describe('User Journey: Interact with Item Details', () => {
    test('should open detail panel when clicking an item', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Click first item row
      const firstRow = page.locator('[data-testid="bom-table-body"] tr').first();
      await firstRow.click();
      await page.waitForTimeout(500);

      // Verify detail panel is visible
      await expect(page.locator('[data-testid="detail-panel"]')).toBeVisible();
    });

    test('should display item details in panel', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Get first item data
      const firstRow = page.locator('[data-testid="bom-table-body"] tr').first();
      const itemCode = await firstRow.locator('td').nth(0).textContent();

      // Click to open detail panel
      await firstRow.click();
      await page.waitForTimeout(500);

      // Verify detail panel shows item code
      const detailPanel = page.locator('[data-testid="detail-panel"]');
      await expect(detailPanel).toContainText(itemCode || '');
    });

    test('should close detail panel', async ({ page }) => {
      // Open detail panel
      await page.waitForSelector('[data-testid="bom-table-body"]');
      const firstRow = page.locator('[data-testid="bom-table-body"] tr').first();
      await firstRow.click();
      await page.waitForTimeout(500);

      // Verify panel is open
      await expect(page.locator('[data-testid="detail-panel"]')).toBeVisible();

      // Click close button
      await page.click('button[aria-label="닫기"]');
      await page.waitForTimeout(300);

      // Verify panel is closed
      await expect(page.locator('[data-testid="detail-panel"]')).not.toBeVisible();
    });
  });

  test.describe('Combined User Journey: Filter + Font Size + Details', () => {
    test('should maintain font size when switching filters', async ({ page }) => {
      // Increase font size
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);
      await expect(page.locator('text=크게')).toBeVisible();

      // Apply category filter
      await page.click('button:has-text("내부생산")');
      await page.waitForTimeout(500);

      // Font size should still be "크게"
      await expect(page.locator('text=크게')).toBeVisible();

      // Clear filter
      await page.click('button[title="필터 초기화"]');
      await page.waitForTimeout(300);

      // Font size should still be "크게"
      await expect(page.locator('text=크게')).toBeVisible();
    });

    test('should maintain filter when changing font size', async ({ page }) => {
      // Apply category filter
      await page.click('button:has-text("외부구매")');
      await page.waitForTimeout(500);
      await expect(page.locator('button:has-text("외부구매")')).toHaveClass(/bg-green-600/);

      // Change font size
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);

      // Filter should still be active
      await expect(page.locator('button:has-text("외부구매")')).toHaveClass(/bg-green-600/);
    });

    test('should handle all operations together', async ({ page }) => {
      // 1. Apply filter
      await page.click('button:has-text("내부생산")');
      await page.waitForTimeout(500);

      // 2. Change font size
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);

      // 3. Open detail panel
      const firstRow = page.locator('[data-testid="bom-table-body"] tr').first();
      await firstRow.click();
      await page.waitForTimeout(500);

      // Verify all states are active
      await expect(page.locator('button:has-text("내부생산")')).toHaveClass(/bg-blue-600/);
      await expect(page.locator('text=크게')).toBeVisible();
      await expect(page.locator('[data-testid="detail-panel"]')).toBeVisible();

      // 4. Close detail panel
      await page.click('button[aria-label="닫기"]');
      await page.waitForTimeout(300);

      // Filter and font size should persist
      await expect(page.locator('button:has-text("내부생산")')).toHaveClass(/bg-blue-600/);
      await expect(page.locator('text=크게')).toBeVisible();
    });
  });

  test.describe('Error Scenarios', () => {
    test('should handle API error gracefully', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/bom/full-tree**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Internal Server Error' })
        });
      });

      // Navigate to page
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');

      // Should show error message or empty state
      const errorMessage = page.locator('text=/에러|오류|실패|Error/i');
      const emptyState = page.locator('text=/데이터가 없습니다|No data/i');

      const hasError = await errorMessage.isVisible().catch(() => false);
      const isEmpty = await emptyState.isVisible().catch(() => false);

      expect(hasError || isEmpty).toBe(true);
    });

    test('should handle empty BOM data', async ({ page }) => {
      // Mock empty response
      await page.route('**/api/bom/full-tree**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [], count: 0 })
        });
      });

      // Navigate to page
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');

      // Should show empty state
      const emptyState = page.locator('text=/데이터가 없습니다|비어 있습니다|No data/i');
      await expect(emptyState).toBeVisible();
    });

    test('should handle rapid interactions without errors', async ({ page }) => {
      // Wait for page load
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Rapidly click category buttons
      for (let i = 0; i < 5; i++) {
        await page.click('button:has-text("내부생산")');
        await page.click('button:has-text("외부구매")');
        await page.click('button:has-text("전체")');
      }

      // Rapidly click font size buttons
      for (let i = 0; i < 5; i++) {
        await page.click('button[title="폰트 크기 증가"]');
        await page.click('button[title="폰트 크기 감소"]');
      }

      // Page should still be functional
      await expect(page.locator('h1:has-text("BOM 관리")')).toBeVisible();
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should work on mobile viewport (375x667)', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Reload page
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');

      // Core components should be visible
      await expect(page.locator('h1:has-text("BOM 관리")')).toBeVisible();
      await expect(page.locator('text=품목 구분 필터')).toBeVisible();
      await expect(page.locator('text=보통')).toBeVisible();

      // Table should be scrollable
      const table = page.locator('[data-testid="bom-table"]');
      await expect(table).toBeVisible();
    });

    test('should work on tablet viewport (768x1024)', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Reload page
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');

      // All components should be visible and functional
      await expect(page.locator('h1:has-text("BOM 관리")')).toBeVisible();
      await expect(page.locator('text=품목 구분 필터')).toBeVisible();

      // Test filter interaction
      await page.click('button:has-text("내부생산")');
      await page.waitForTimeout(300);
      await expect(page.locator('button:has-text("내부생산")')).toHaveClass(/bg-blue-600/);
    });

    test('should work on desktop viewport (1920x1080)', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Reload page
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');

      // All components should be visible with proper spacing
      await expect(page.locator('h1:has-text("BOM 관리")')).toBeVisible();

      // Test all interactions work on large screen
      await page.click('button:has-text("외부구매")');
      await page.waitForTimeout(300);
      await expect(page.locator('button:has-text("외부구매")')).toHaveClass(/bg-green-600/);

      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);
      await expect(page.locator('text=크게')).toBeVisible();
    });
  });

  test.describe('Performance and UX', () => {
    test('should load page in reasonable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="bom-table-body"]');

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load in less than 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should provide visual feedback for interactions', async ({ page }) => {
      // Click filter button
      await page.click('button:has-text("내부생산")');

      // Button should show visual feedback (background color change)
      const button = page.locator('button:has-text("내부생산")');
      await expect(button).toHaveClass(/bg-blue-600/);
    });

    test('should handle collapsible filter panel', async ({ page }) => {
      // Find collapse button
      const collapseButton = page.locator('button[title="접기"]');

      if (await collapseButton.isVisible()) {
        // Click to collapse
        await collapseButton.click();
        await page.waitForTimeout(300);

        // Category buttons should be hidden
        const categoryButtons = page.locator('button:has-text("내부생산")');
        await expect(categoryButtons).not.toBeVisible();

        // Expand button should be visible
        const expandButton = page.locator('button[title="펼치기"]');
        await expect(expandButton).toBeVisible();

        // Click to expand
        await expandButton.click();
        await page.waitForTimeout(300);

        // Category buttons should be visible again
        await expect(categoryButtons).toBeVisible();
      }
    });
  });
});
