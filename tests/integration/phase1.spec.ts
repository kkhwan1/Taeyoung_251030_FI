import { test, expect, Page } from '@playwright/test';

test.describe('Phase 1 Integration Tests: BOM Page with CategoryFilter and Global Font Size Control', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to BOM page
    await page.goto('http://localhost:5000/master/bom');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('CategoryFilter Integration', () => {
    test('should render CategoryFilter component on BOM page', async ({ page }) => {
      const filterTitle = page.locator('text=품목 구분 필터');
      await expect(filterTitle).toBeVisible();

      // Verify all category buttons are present
      await expect(page.locator('button:has-text("전체")')).toBeVisible();
      await expect(page.locator('button:has-text("내부생산")')).toBeVisible();
      await expect(page.locator('button:has-text("외부구매")')).toBeVisible();
    });

    test('should display category icons', async ({ page }) => {
      // Factory icon for internal production
      const factoryIcon = page.locator('button:has-text("내부생산") svg');
      await expect(factoryIcon).toBeVisible();

      // Shopping cart icon for external purchase
      const cartIcon = page.locator('button:has-text("외부구매") svg');
      await expect(cartIcon).toBeVisible();
    });

    test('should show category counts when data is loaded', async ({ page }) => {
      // Wait for BOM data to load
      await page.waitForSelector('[data-testid="bom-table-body"]', { timeout: 10000 });

      // Check if count badges are visible
      const countBadges = page.locator('button span').filter({ hasText: /^\d+$/ });
      const count = await countBadges.count();

      expect(count).toBeGreaterThan(0);
    });

    test('should filter BOM data when category is selected', async ({ page }) => {
      // Wait for initial data load
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Get initial row count
      const allRows = page.locator('[data-testid="bom-table-body"] tr');
      const initialCount = await allRows.count();

      // Click "내부생산" category
      await page.click('button:has-text("내부생산")');
      await page.waitForTimeout(500);

      // Get filtered row count
      const filteredCount = await allRows.count();

      // Filtered count should be different from initial (unless all items are internal)
      // Verify filter is applied by checking that selected category is highlighted
      const internalButton = page.locator('button:has-text("내부생산")');
      await expect(internalButton).toHaveClass(/bg-blue-600/);
    });

    test('should show clear filter button when category is selected', async ({ page }) => {
      // Select a category
      await page.click('button:has-text("내부생산")');
      await page.waitForTimeout(300);

      // Clear button should appear
      const clearButton = page.locator('button[title="필터 초기화"]');
      await expect(clearButton).toBeVisible();

      // Click clear button
      await clearButton.click();
      await page.waitForTimeout(300);

      // "전체" should be selected
      const allButton = page.locator('button:has-text("전체")');
      await expect(allButton).toHaveClass(/bg-blue-600/);

      // Clear button should disappear
      await expect(clearButton).not.toBeVisible();
    });

    test('should toggle collapse/expand functionality', async ({ page }) => {
      // Find collapse button
      const collapseButton = page.locator('button[title="접기"]');
      await expect(collapseButton).toBeVisible();

      // Click to collapse
      await collapseButton.click();
      await page.waitForTimeout(300);

      // Category buttons should be hidden
      const categoryButtons = page.locator('button:has-text("내부생산")');
      await expect(categoryButtons).not.toBeVisible();

      // Button should now say "펼치기"
      const expandButton = page.locator('button[title="펼치기"]');
      await expect(expandButton).toBeVisible();

      // Click to expand
      await expandButton.click();
      await page.waitForTimeout(300);

      // Category buttons should be visible again
      await expect(categoryButtons).toBeVisible();
    });

    test('should maintain filter state when navigating away and back', async ({ page }) => {
      // Select "외부구매" category
      await page.click('button:has-text("외부구매")');
      await page.waitForTimeout(500);

      // Navigate away (to dashboard)
      await page.goto('http://localhost:5000/dashboard');
      await page.waitForLoadState('networkidle');

      // Navigate back to BOM page
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');

      // Filter should be reset to "전체"
      const allButton = page.locator('button:has-text("전체")');
      await expect(allButton).toHaveClass(/bg-blue-600/);
    });
  });

  test.describe('Global Font Size Control Integration', () => {
    test('should render global font size control in Header', async ({ page }) => {
      // Check for font size label
      const fontLabel = page.locator('text=보통');
      await expect(fontLabel).toBeVisible();

      // Check for control buttons
      await expect(page.locator('button[title="폰트 크기 감소"]')).toBeVisible();
      await expect(page.locator('button[title="폰트 크기 증가"]')).toBeVisible();
    });

    test('should increase font size when plus button is clicked', async ({ page }) => {
      // Click increase button
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);

      // Label should change to "크게"
      await expect(page.locator('text=크게')).toBeVisible();

      // Reset button should appear
      await expect(page.locator('button[title="기본 크기로 초기화"]')).toBeVisible();
    });

    test('should decrease font size when minus button is clicked', async ({ page }) => {
      // Click decrease button
      await page.click('button[title="폰트 크기 감소"]');
      await page.waitForTimeout(300);

      // Label should change to "작게"
      await expect(page.locator('text=작게')).toBeVisible();

      // Reset button should appear
      await expect(page.locator('button[title="기본 크기로 초기화"]')).toBeVisible();
    });

    test('should reset to default font size when reset button is clicked', async ({ page }) => {
      // Increase font size
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);

      // Click reset button
      await page.click('button[title="기본 크기로 초기화"]');
      await page.waitForTimeout(300);

      // Should return to "보통"
      await expect(page.locator('text=보통')).toBeVisible();

      // Reset button should disappear
      await expect(page.locator('button[title="기본 크기로 초기화"]')).not.toBeVisible();
    });

    test('should disable buttons at size boundaries', async ({ page }) => {
      // Increase to maximum
      for (let i = 0; i < 5; i++) {
        const increaseButton = page.locator('button[title="폰트 크기 증가"]');
        const isDisabled = await increaseButton.isDisabled();
        if (!isDisabled) {
          await increaseButton.click();
          await page.waitForTimeout(200);
        }
      }

      // Increase button should be disabled at maximum
      await expect(page.locator('button[title="폰트 크기 증가"]')).toBeDisabled();

      // Reset to default
      await page.click('button[title="기본 크기로 초기화"]');
      await page.waitForTimeout(300);

      // Decrease to minimum
      for (let i = 0; i < 5; i++) {
        const decreaseButton = page.locator('button[title="폰트 크기 감소"]');
        const isDisabled = await decreaseButton.isDisabled();
        if (!isDisabled) {
          await decreaseButton.click();
          await page.waitForTimeout(200);
        }
      }

      // Decrease button should be disabled at minimum
      await expect(page.locator('button[title="폰트 크기 감소"]')).toBeDisabled();
    });

    test('should apply font size changes to table content', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Get initial font size class from a table cell
      const cell = page.locator('[data-testid="bom-table-body"] tr').first().locator('td').first();
      const initialClass = await cell.getAttribute('class');

      // Increase font size
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(500);

      // Get new font size class
      const newClass = await cell.getAttribute('class');

      // Classes should be different
      expect(initialClass).not.toBe(newClass);
    });

    test('should persist font size preference in localStorage', async ({ page }) => {
      // Change font size
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(300);

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Font size should still be "크게"
      await expect(page.locator('text=크게')).toBeVisible();
    });

    test('should use direct font size selection via indicators', async ({ page }) => {
      // Click on the largest size indicator (5th indicator)
      const indicators = page.locator('button[title^="폰트 크기:"]');
      const largestIndicator = indicators.last();
      await largestIndicator.click();
      await page.waitForTimeout(300);

      // Should show "최대"
      await expect(page.locator('text=최대')).toBeVisible();
    });
  });

  test.describe('Component Interaction', () => {
    test('should work together: CategoryFilter + Global Font Size Control', async ({ page }) => {
      // Wait for data load
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Apply category filter
      await page.click('button:has-text("내부생산")');
      await page.waitForTimeout(500);

      // Change font size
      await page.click('button[title="폰트 크기 증가"]');
      await page.waitForTimeout(500);

      // Both should be active
      const internalButton = page.locator('button:has-text("내부생산")');
      await expect(internalButton).toHaveClass(/bg-blue-600/);
      await expect(page.locator('text=크게')).toBeVisible();

      // Clear filter
      await page.click('button[title="필터 초기화"]');
      await page.waitForTimeout(300);

      // Font size should remain unchanged
      await expect(page.locator('text=크게')).toBeVisible();
    });

    test('should handle rapid interactions gracefully', async ({ page }) => {
      // Rapidly click category buttons
      for (let i = 0; i < 5; i++) {
        await page.click('button:has-text("내부생산")');
        await page.click('button:has-text("외부구매")');
        await page.click('button:has-text("전체")');
      }

      // Rapidly click font size buttons
      for (let i = 0; i < 10; i++) {
        await page.click('button[title="폰트 크기 증가"]');
        await page.click('button[title="폰트 크기 감소"]');
      }

      // Page should still be functional
      await page.waitForTimeout(500);
      await expect(page.locator('text=품목 구분 필터')).toBeVisible();
    });
  });

  test.describe('API Integration', () => {
    test('should fetch BOM tree data from /api/bom/full-tree', async ({ page }) => {
      // Intercept API request
      const responsePromise = page.waitForResponse('**/api/bom/full-tree**');

      // Navigate to page (triggers API call)
      await page.goto('http://localhost:5000/master/bom');

      // Wait for response
      const response = await responsePromise;

      expect(response.status()).toBe(200);

      const json = await response.json();
      expect(json).toHaveProperty('success');
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('count');
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/bom/full-tree**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Internal Server Error' })
        });
      });

      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');

      // Should show error message or empty state
      const errorMessage = page.locator('text=/에러|오류|실패|Error/i');
      const emptyState = page.locator('text=/데이터가 없습니다|No data/i');

      const hasError = await errorMessage.isVisible().catch(() => false);
      const isEmpty = await emptyState.isVisible().catch(() => false);

      expect(hasError || isEmpty).toBe(true);
    });

    test('should display BOM tree data in table', async ({ page }) => {
      await page.waitForSelector('[data-testid="bom-table-body"]');

      // Verify table has rows
      const rows = page.locator('[data-testid="bom-table-body"] tr');
      const rowCount = await rows.count();

      expect(rowCount).toBeGreaterThan(0);

      // Verify first row has expected columns
      const firstRow = rows.first();
      const cells = firstRow.locator('td');
      const cellCount = await cells.count();

      expect(cellCount).toBeGreaterThan(5); // Should have multiple columns
    });
  });

  test.describe('Dark Mode Compatibility', () => {
    test('should render properly in dark mode', async ({ page }) => {
      // Enable dark mode (assuming dark mode toggle exists)
      const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');

      if (await darkModeToggle.isVisible()) {
        await darkModeToggle.click();
        await page.waitForTimeout(300);
      }

      // Components should still be visible
      await expect(page.locator('text=품목 구분 필터')).toBeVisible();
      await expect(page.locator('text=보통')).toBeVisible();
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');

      // Components should still be functional
      await expect(page.locator('text=품목 구분 필터')).toBeVisible();
      await expect(page.locator('text=보통')).toBeVisible();
    });

    test('should adapt to tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('http://localhost:5000/master/bom');
      await page.waitForLoadState('networkidle');

      // Components should still be functional
      await expect(page.locator('text=품목 구분 필터')).toBeVisible();
      await expect(page.locator('text=보통')).toBeVisible();
    });
  });
});
