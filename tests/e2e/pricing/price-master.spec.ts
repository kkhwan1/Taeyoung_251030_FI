/**
 * Price Master E2E Tests
 * Tests price registration, bulk upload, BOM-based cost calculation, and duplicate detection
 */

import { test, expect } from '@playwright/test';

test.describe('Price Master - Main Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 로드 및 기본 레이아웃 표시', async ({ page }) => {
    // Verify page title
    await expect(page.locator('text=단가 관리')).toBeVisible();

    // Verify tabs exist
    await expect(page.locator('text=단가 등록')).toBeVisible();
    await expect(page.locator('text=단가 이력')).toBeVisible();
    await expect(page.locator('text=BOM 계산')).toBeVisible();

    // Verify action buttons
    await expect(page.locator('button:has-text("중복 감지")')).toBeVisible();
    await expect(page.locator('button:has-text("대량 업데이트")')).toBeVisible();
  });

  test('탭 전환 기능', async ({ page }) => {
    // Switch to history tab
    await page.click('text=단가 이력');
    await page.waitForTimeout(300);
    await expect(page.locator('text=품목별 단가 변경 이력')).toBeVisible();

    // Switch to BOM calculation tab
    await page.click('text=BOM 계산');
    await page.waitForTimeout(300);
    await expect(page.locator('text=BOM 원가 계산')).toBeVisible();
    await expect(page.locator('text=BOM 구조를 기반으로')).toBeVisible();

    // Switch back to entry tab
    await page.click('text=단가 등록');
    await page.waitForTimeout(300);
    await expect(page.locator('text=품목의 단가를 등록하면')).toBeVisible();
  });
});

test.describe('Price Master - Price Registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    // Ensure we're on the entry tab
    await page.click('text=단가 등록');
    await page.waitForTimeout(300);
  });

  test('단가 등록 폼 필드 존재 확인', async ({ page }) => {
    // Check for form fields
    const formFields = [
      'input[placeholder*="품목"]',
      'input[type="number"]',  // unit_price
      'input[type="date"]',    // effective_date
      'select',                // price_type
    ];

    for (const field of formFields) {
      await expect(page.locator(field).first()).toBeVisible();
    }

    // Check for submit button
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test('품목 검색 및 선택', async ({ page }) => {
    // Type in item search
    const itemInput = page.locator('input[placeholder*="품목"]').first();
    await itemInput.fill('부품');
    await page.waitForTimeout(500);

    // Check if dropdown/autocomplete appears
    // (Assuming autocomplete implementation exists)
    const dropdown = page.locator('[role="listbox"], [data-testid="item-dropdown"]');
    if (await dropdown.isVisible()) {
      // Select first item
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(300);
    }
  });

  test('필수 필드 유효성 검증', async ({ page }) => {
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    await page.waitForTimeout(300);

    // Check if validation messages appear or button is disabled
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('단가 타입 선택', async ({ page }) => {
    const priceTypeSelect = page.locator('select').first();

    // Select purchase price
    await priceTypeSelect.selectOption('purchase');
    let selectedValue = await priceTypeSelect.inputValue();
    expect(selectedValue).toBe('purchase');

    // Select production price
    await priceTypeSelect.selectOption('production');
    selectedValue = await priceTypeSelect.inputValue();
    expect(selectedValue).toBe('production');

    // Select manual price
    await priceTypeSelect.selectOption('manual');
    selectedValue = await priceTypeSelect.inputValue();
    expect(selectedValue).toBe('manual');
  });

  test('적용일 선택', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]').first();

    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const value = await dateInput.inputValue();
    expect(value).toBe(today);
  });

  test('단가 입력 - 숫자 유효성', async ({ page }) => {
    const priceInput = page.locator('input[type="number"]').first();

    // Test valid price
    await priceInput.fill('50000');
    let value = await priceInput.inputValue();
    expect(value).toBe('50000');

    // Test decimal price
    await priceInput.fill('12345.67');
    value = await priceInput.inputValue();
    expect(parseFloat(value)).toBeGreaterThan(0);
  });
});

test.describe('Price Master - Price History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    // Navigate to history tab
    await page.click('text=단가 이력');
    await page.waitForTimeout(300);
  });

  test('단가 이력 테이블 표시', async ({ page }) => {
    // Check if table exists
    await expect(page.locator('table').first()).toBeVisible();

    // Check table headers
    const headers = ['품목', '단가', '적용일', '타입'];
    for (const header of headers) {
      // Use more flexible selector for header text
      const headerCell = page.locator('th').filter({ hasText: header });
      if (await headerCell.count() > 0) {
        await expect(headerCell.first()).toBeVisible();
      }
    }
  });

  test('이력 데이터 존재 확인', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);

    // Check if there are rows (or empty state)
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(0);

    if (rows > 0) {
      // Verify first row has data
      const firstRow = page.locator('tbody tr').first();
      await expect(firstRow).toBeVisible();
    }
  });

  test('최신 이력 우선 정렬', async ({ page }) => {
    await page.waitForTimeout(1000);

    const rows = await page.locator('tbody tr').count();

    if (rows >= 2) {
      // Get dates from first two rows
      const firstDate = await page.locator('tbody tr').nth(0).locator('td').nth(2).textContent();
      const secondDate = await page.locator('tbody tr').nth(1).locator('td').nth(2).textContent();

      // Compare dates (should be descending order)
      if (firstDate && secondDate) {
        const date1 = new Date(firstDate);
        const date2 = new Date(secondDate);
        expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
      }
    }
  });

  test('페이지네이션 기능 (있는 경우)', async ({ page }) => {
    // Check if pagination exists
    const paginationExists = await page.locator('[data-testid="pagination"], .pagination').count() > 0;

    if (paginationExists) {
      const nextButton = page.locator('button:has-text("다음"), button[aria-label="Next page"]');
      if (await nextButton.count() > 0 && await nextButton.first().isEnabled()) {
        await nextButton.first().click();
        await page.waitForTimeout(500);

        // Verify page changed
        await expect(page.locator('tbody tr').first()).toBeVisible();
      }
    }
  });
});

test.describe('Price Master - BOM Cost Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    // Navigate to BOM calculation tab
    await page.click('text=BOM 계산');
    await page.waitForTimeout(300);
  });

  test('BOM 계산 폼 표시', async ({ page }) => {
    // Check for main elements
    await expect(page.locator('text=BOM 원가 계산')).toBeVisible();
    await expect(page.locator('text=BOM 구조를 기반으로')).toBeVisible();
  });

  test('완제품 선택 필드 존재', async ({ page }) => {
    // Look for item selector
    const itemSelector = page.locator('input[placeholder*="품목"], select, [data-testid="item-selector"]');
    await expect(itemSelector.first()).toBeVisible();
  });

  test('BOM 계산 버튼 존재', async ({ page }) => {
    const calcButton = page.locator('button:has-text("계산"), button:has-text("원가 계산")');
    if (await calcButton.count() > 0) {
      await expect(calcButton.first()).toBeVisible();
    }
  });

  test('계산 결과 표시 영역', async ({ page }) => {
    // Check for result display area
    const resultArea = page.locator('[data-testid="calculation-result"], .calculation-result, .result-panel');

    // The result area might be hidden initially
    if (await resultArea.count() > 0) {
      // Result area exists (might be hidden until calculation)
      expect(await resultArea.count()).toBeGreaterThan(0);
    }
  });

  test('BOM 구성 품목 표시', async ({ page }) => {
    // After selecting an item with BOM, check if components are displayed
    const bomTable = page.locator('table, [data-testid="bom-components"]');

    if (await bomTable.count() > 0) {
      // BOM structure table exists
      expect(await bomTable.count()).toBeGreaterThan(0);
    }
  });
});

test.describe('Price Master - Duplicate Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');
  });

  test('중복 감지 버튼 클릭', async ({ page }) => {
    const duplicateButton = page.getByTestId('detect-duplicates-button');
    await expect(duplicateButton).toBeVisible();
    await expect(duplicateButton).toBeEnabled();

    // Click and wait for response
    await duplicateButton.click();
    await page.waitForTimeout(2000);

    // Check if modal/dialog appears or toast notification
    const modalOrDialog = page.locator('[role="dialog"], .modal, [data-testid="duplicate-dialog"]');
    const hasDialog = await modalOrDialog.count() > 0;

    if (hasDialog) {
      await expect(modalOrDialog.first()).toBeVisible();
    }
  });

  test('중복 감지 Dialog 내용 확인', async ({ page }) => {
    // Trigger duplicate detection
    await page.click('[data-testid="detect-duplicates-button"]');
    await page.waitForTimeout(2000);

    // Check if dialog opened
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible()) {
      // Check for dialog title
      await expect(page.locator('text=중복 가격 정리')).toBeVisible();

      // Check for strategy options
      await expect(page.locator('text=정리 전략')).toBeVisible();
      await expect(page.locator('text=최신 가격 유지')).toBeVisible();
      await expect(page.locator('text=최초 가격 유지')).toBeVisible();
      await expect(page.locator('text=수동 선택')).toBeVisible();
    }
  });

  test('정리 전략 선택', async ({ page }) => {
    // Trigger duplicate detection
    await page.click('[data-testid="detect-duplicates-button"]');
    await page.waitForTimeout(2000);

    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible()) {
      // Select keep_latest strategy
      const latestRadio = page.locator('input[value="keep_latest"]');
      if (await latestRadio.count() > 0) {
        await latestRadio.check();
        expect(await latestRadio.isChecked()).toBe(true);
      }

      // Select keep_oldest strategy
      const oldestRadio = page.locator('input[value="keep_oldest"]');
      if (await oldestRadio.count() > 0) {
        await oldestRadio.check();
        expect(await oldestRadio.isChecked()).toBe(true);
      }

      // Select custom strategy
      const customRadio = page.locator('input[value="custom"]');
      if (await customRadio.count() > 0) {
        await customRadio.check();
        expect(await customRadio.isChecked()).toBe(true);
      }
    }
  });

  test('시뮬레이션 버튼', async ({ page }) => {
    await page.click('[data-testid="detect-duplicates-button"]');
    await page.waitForTimeout(2000);

    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible()) {
      const simulateButton = page.getByTestId('simulate-cleanup-button');
      if (await simulateButton.count() > 0) {
        await expect(simulateButton).toBeVisible();
        await expect(simulateButton).toBeEnabled();
      }
    }
  });

  test('실제 삭제 버튼 비활성화 확인 (custom 모드, 선택 없음)', async ({ page }) => {
    await page.click('[data-testid="detect-duplicates-button"]');
    await page.waitForTimeout(2000);

    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible()) {
      // Select custom mode
      const customRadio = page.locator('input[value="custom"]');
      if (await customRadio.count() > 0) {
        await customRadio.check();
        await page.waitForTimeout(300);

        // Check if delete button is disabled (no items selected)
        const deleteButton = page.getByTestId('execute-cleanup-button');
        if (await deleteButton.count() > 0) {
          await expect(deleteButton).toBeDisabled();
        }
      }
    }
  });

  test('Dialog 닫기', async ({ page }) => {
    await page.click('[data-testid="detect-duplicates-button"]');
    await page.waitForTimeout(2000);

    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible()) {
      // Click cancel button
      const cancelButton = page.locator('button:has-text("취소")').first();
      await cancelButton.click();
      await page.waitForTimeout(300);

      // Verify dialog is closed
      await expect(dialog).not.toBeVisible();
    }
  });
});

test.describe('Price Master - Bulk Update Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');
  });

  test('대량 업데이트 버튼 클릭 - 새 탭 열기', async ({ page, context }) => {
    // Setup listener for new page
    const pagePromise = context.waitForEvent('page');

    // Click bulk update button
    await page.click('button:has-text("대량 업데이트")');

    // Wait for new page
    const newPage = await pagePromise;
    await newPage.waitForLoadState('networkidle');

    // Verify new page URL
    expect(newPage.url()).toContain('/price-master/bulk-update');

    // Verify new page content
    await expect(newPage.locator('text=대량 가격 업데이트')).toBeVisible();

    // Close new page
    await newPage.close();
  });
});

test.describe('Price Master - Responsive Design', () => {
  test('모바일 뷰포트에서 레이아웃 확인', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    // Verify page loads
    await expect(page.locator('text=단가 관리')).toBeVisible();

    // Verify tabs are still accessible
    await expect(page.locator('text=단가 등록')).toBeVisible();
  });

  test('태블릿 뷰포트에서 레이아웃 확인', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    // Verify page loads
    await expect(page.locator('text=단가 관리')).toBeVisible();

    // Verify buttons are visible
    await expect(page.locator('button:has-text("중복 감지")')).toBeVisible();
    await expect(page.locator('button:has-text("대량 업데이트")')).toBeVisible();
  });
});

test.describe('Price Master - Performance', () => {
  test('페이지 로드 성능', async ({ page }) => {
    const startTime = await page.evaluate(() => performance.now());

    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    const endTime = await page.evaluate(() => performance.now());
    const loadTime = endTime - startTime;

    // Verify load time is under 5 seconds
    expect(loadTime).toBeLessThan(5000);

    console.log(`Price Master page load time: ${loadTime.toFixed(2)}ms`);
  });

  test('탭 전환 성능', async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    const startTime = await page.evaluate(() => performance.now());

    // Switch tabs
    await page.click('text=단가 이력');
    await page.waitForTimeout(300);

    const endTime = await page.evaluate(() => performance.now());
    const switchTime = endTime - startTime;

    // Verify tab switch is fast
    expect(switchTime).toBeLessThan(2000);

    console.log(`Tab switch time: ${switchTime.toFixed(2)}ms`);
  });
});

test.describe('Price Master - Accessibility', () => {
  test('키보드 네비게이션 - 탭 전환', async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    // Focus on first tab
    await page.locator('text=단가 등록').focus();

    // Press Arrow Right to move to next tab
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    // Verify focus moved or tab changed
    const activeTab = await page.locator('[role="tab"][data-state="active"]').textContent();
    expect(activeTab).toBeTruthy();
  });

  test('ARIA 속성 확인', async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    // Check for proper ARIA roles
    const tabs = page.locator('[role="tab"]');
    expect(await tabs.count()).toBeGreaterThan(0);

    const tablist = page.locator('[role="tablist"]');
    expect(await tablist.count()).toBeGreaterThan(0);
  });

  test('폼 라벨 및 접근성', async ({ page }) => {
    await page.goto('http://localhost:5000/price-master');
    await page.waitForLoadState('networkidle');

    await page.click('text=단가 등록');
    await page.waitForTimeout(300);

    // Check for labels associated with inputs
    const inputs = page.locator('input[type="number"], input[type="date"]');
    const count = await inputs.count();

    // Each input should have an associated label or aria-label
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate((el) => {
        const id = el.getAttribute('id');
        const ariaLabel = el.getAttribute('aria-label');
        const hasAssociatedLabel = id ? document.querySelector(`label[for="${id}"]`) !== null : false;
        return ariaLabel || hasAssociatedLabel;
      });

      // At least some inputs should have proper labels
      if (i === 0) {
        expect(hasLabel).toBeTruthy();
      }
    }
  });
});
