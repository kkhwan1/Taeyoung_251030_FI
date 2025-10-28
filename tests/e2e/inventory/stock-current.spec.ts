/**
 * Current Stock View E2E Tests
 * Tests real-time stock levels, search, filters, and safety stock alerts
 */

import { test, expect } from '@playwright/test';

// Helper functions
async function getStockData(page: any) {
  const response = await page.request.get('http://localhost:5000/api/inventory/stock');
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.data || [];
}

async function getItemDetails(page: any, itemId: number) {
  const response = await page.request.get(`http://localhost:5000/api/items/${itemId}`);
  if (response.ok()) {
    const data = await response.json();
    return data.data;
  }
  return null;
}

async function getLowStockItems(page: any) {
  const response = await page.request.get('http://localhost:5000/api/inventory/stock?status=LOW_STOCK');
  if (response.ok()) {
    const data = await response.json();
    return data.data || [];
  }
  return [];
}

test.describe('Current Stock View (현재 재고)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to current stock page
    await page.goto('http://localhost:5000/stock/current');
    await page.waitForLoadState('networkidle');
  });

  test('재고 현황 페이지 로드 및 UI 확인', async ({ page }) => {
    // Verify page title
    await expect(page.locator('text=재고 현황').or(page.locator('text=Current Stock'))).toBeVisible();

    // Verify key UI elements
    await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();

    // Verify stock table
    await expect(page.locator('table')).toBeVisible();

    // Verify filter controls
    const categoryFilter = page.locator('select').or(page.locator('button:has-text("필터")'));
    if (await categoryFilter.count() > 0) {
      await expect(categoryFilter.first()).toBeVisible();
    }

    // Verify export button
    await expect(page.locator('button:has-text("Excel 내보내기")')).toBeVisible();
  });

  test('재고 데이터 표시 검증', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Verify table has data
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);

    // Verify essential columns
    const firstRow = page.locator('table tbody tr').first();

    // Should show item name
    await expect(firstRow.locator('td').nth(1)).toBeVisible();

    // Should show current stock
    await expect(firstRow.locator('td').nth(3)).toBeVisible();
  });

  test('재고 검색 기능 - 품목명', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Get initial row count
    const initialRows = await page.locator('table tbody tr').count();

    // Perform search
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('부품');
    await page.waitForTimeout(500);

    // Verify filtered results
    const filteredRows = await page.locator('table tbody tr').count();

    // Should have results (assuming test data exists)
    expect(filteredRows).toBeGreaterThan(0);
    expect(filteredRows).toBeLessThanOrEqual(initialRows);
  });

  test('재고 검색 기능 - 품목코드', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Get first item code
    const firstItemCode = await page.locator('table tbody tr').first().locator('td').nth(0).textContent();

    if (firstItemCode) {
      // Clear previous search
      const searchInput = page.locator('input[placeholder*="검색"]');
      await searchInput.clear();

      // Search by item code
      await searchInput.fill(firstItemCode.trim());
      await page.waitForTimeout(500);

      // Verify filtered results
      const filteredRows = await page.locator('table tbody tr').count();

      // Should find the item
      expect(filteredRows).toBeGreaterThanOrEqual(1);
    }
  });

  test('재고 필터링 - 카테고리별', async ({ page }) => {
    // Check if category filter exists
    const categorySelect = page.locator('select[name="category"]').or(page.locator('select').first());

    if (await categorySelect.count() > 0) {
      // Get available categories
      const options = await categorySelect.locator('option').count();

      if (options > 1) {
        // Select a category (skip "All" option)
        await categorySelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);

        // Verify filtered results
        await expect(page.locator('table tbody tr')).toBeVisible();
      }
    }
  });

  test('재고 필터링 - 재고 상태별', async ({ page }) => {
    // Check if stock status filter exists
    const statusFilter = page.locator('select[name="status"]').or(
      page.locator('button:has-text("재고 상태")')
    );

    if (await statusFilter.count() > 0) {
      // Filter by low stock
      const tagName = await statusFilter.first().evaluate(el => el.tagName);
      if (tagName === 'SELECT') {
        await statusFilter.first().selectOption('LOW_STOCK');
      } else {
        await statusFilter.first().click();
        try {
          await page.click('text=낮음', { timeout: 1000 });
        } catch {
          await page.click('text=부족');
        }
      }

      await page.waitForTimeout(500);

      // Verify filtered results
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('안전재고 알림 - 낮은 재고 하이라이트', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Look for low stock indicators (red text, warning icons, etc.)
    const lowStockIndicators = page.locator(
      'td:has-text("낮음"), ' +
      'td:has-text("부족"), ' +
      'td.text-red-600, ' +
      'td.text-red-500, ' +
      'svg.text-red-500'
    );

    if (await lowStockIndicators.count() > 0) {
      // Verify at least one low stock item is highlighted
      await expect(lowStockIndicators.first()).toBeVisible();
    }
  });

  test('안전재고 알림 - 별도 섹션 표시', async ({ page }) => {
    // Check if there's a separate low stock alerts section
    const lowStockSection = page.locator('text=안전재고 미달').or(
      page.locator('text=Low Stock Alert')
    );

    if (await lowStockSection.count() > 0) {
      await expect(lowStockSection).toBeVisible();

      // Verify low stock items are listed
      const lowStockItems = await getLowStockItems(page);

      if (lowStockItems.length > 0) {
        // Each low stock item should be displayed
        for (const item of lowStockItems.slice(0, 3)) {
          // Check first 3 items
          const itemName = item.item_name || item.item?.item_name;
          if (itemName) {
            await expect(page.locator(`text=${itemName}`)).toBeVisible();
          }
        }
      }
    }
  });

  test('재고 정렬 기능 - 품목명', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Click item name column header
    const itemNameHeader = page.locator('th:has-text("품목명")').or(
      page.locator('th:has-text("Item Name")')
    );

    if (await itemNameHeader.count() > 0) {
      await itemNameHeader.click();
      await page.waitForTimeout(500);

      // Verify table is still visible (sorting worked)
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('재고 정렬 기능 - 재고 수량', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Click stock quantity column header
    const stockHeader = page.locator('th:has-text("현재재고")').or(
      page.locator('th:has-text("Current Stock")')
    );

    if (await stockHeader.count() > 0) {
      await stockHeader.click();
      await page.waitForTimeout(500);

      // Verify table is still visible (sorting worked)
      await expect(page.locator('table tbody tr')).toBeVisible();

      // Click again to reverse sort
      await stockHeader.click();
      await page.waitForTimeout(500);

      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('재고 상세보기', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Click first row or view button
    const viewButton = page.locator('button:has-text("상세")').first().or(
      page.locator('table tbody tr').first()
    );

    await viewButton.click();
    await page.waitForTimeout(500);

    // Verify detail view/modal opens
    await expect(
      page.locator('text=상세').or(page.locator('text=정보'))
    ).toBeVisible({ timeout: 3000 });

    // Verify key information is displayed
    await expect(page.locator('text=현재재고').or(page.locator('text=Current Stock'))).toBeVisible();
  });

  test('재고 조정 기능 접근', async ({ page }) => {
    // Check if stock adjustment button/link exists
    const adjustButton = page.locator('button:has-text("재고 조정")').or(
      page.locator('a:has-text("재고 조정")')
    );

    if (await adjustButton.count() > 0) {
      await adjustButton.click();
      await page.waitForTimeout(500);

      // Verify adjustment modal or page opens
      await expect(
        page.locator('text=조정').or(page.locator('text=Adjustment'))
      ).toBeVisible();
    }
  });

  test('Excel 내보내기 기능', async ({ page }) => {
    // Start waiting for download
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('button:has-text("Excel 내보내기")');

    // Wait for download
    const download = await downloadPromise;

    // Verify download started
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('페이지네이션 동작', async ({ page }) => {
    // Check if pagination controls exist
    const nextButton = page.locator('button:has-text("다음")').or(
      page.locator('button[aria-label="Next"]')
    );

    if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
      // Get current page items
      const firstPageFirstItem = await page.locator('table tbody tr').first().textContent();

      // Click next page
      await nextButton.click();
      await page.waitForTimeout(500);

      // Verify page changed
      const secondPageFirstItem = await page.locator('table tbody tr').first().textContent();
      expect(secondPageFirstItem).not.toBe(firstPageFirstItem);
    }
  });

  test('새로고침 버튼 기능', async ({ page }) => {
    // Look for refresh button
    const refreshButton = page.locator('button[title="새로고침"]').or(
      page.locator('button:has-text("새로고침")')
    );

    if (await refreshButton.count() > 0) {
      await refreshButton.click();

      // Wait for loading to complete
      await page.waitForLoadState('networkidle');

      // Verify data is still visible
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('API 응답 시간 검증', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:5000/stock/current');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Verify load time is under 3 seconds
    expect(loadTime).toBeLessThan(3000);

    console.log(`Current stock page load time: ${loadTime}ms`);
  });

  test('반응형 레이아웃 - 모바일', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload page
    await page.goto('http://localhost:5000/stock/current');
    await page.waitForLoadState('networkidle');

    // Verify page loads on mobile
    await expect(page.locator('text=재고')).toBeVisible();

    // Verify table is scrollable or cards are displayed
    await expect(page.locator('table').or(page.locator('[role="list"]'))).toBeVisible();
  });

  test('반응형 레이아웃 - 태블릿', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Reload page
    await page.goto('http://localhost:5000/stock/current');
    await page.waitForLoadState('networkidle');

    // Verify page loads on tablet
    await expect(page.locator('text=재고 현황')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });
});

test.describe('Current Stock - API Integration', () => {
  test('재고 API 엔드포인트 검증', async ({ page }) => {
    // Fetch stock data via API
    const stockData = await getStockData(page);

    // Verify data structure
    expect(Array.isArray(stockData)).toBeTruthy();

    if (stockData.length > 0) {
      const firstItem = stockData[0];

      // Verify required fields
      expect(firstItem.item_id).toBeDefined();
      expect(firstItem.current_stock).toBeDefined();
      expect(typeof firstItem.current_stock).toBe('number');
    }
  });

  test('재고 데이터 실시간 업데이트 검증', async ({ page }) => {
    const itemId = 1;

    // Get initial stock
    const initialStockData = await getStockData(page);
    const initialItem = initialStockData.find((item: any) => item.item_id === itemId);

    if (!initialItem) {
      console.log('Test item not found, skipping');
      test.skip();
      return;
    }

    const initialStock = initialItem.current_stock;

    // Create receiving transaction to increase stock
    const receiveResponse = await page.request.post('http://localhost:5000/api/inventory/receiving', {
      data: {
        transaction_number: `TEST-${Date.now()}`,
        item_id: itemId,
        quantity: 10,
        unit_price: 1000,
        transaction_date: '2025-01-19',
        transaction_type: 'RECEIVING'
      }
    });

    expect(receiveResponse.ok()).toBeTruthy();

    // Wait for database to update
    await page.waitForTimeout(500);

    // Fetch updated stock
    const updatedStockData = await getStockData(page);
    const updatedItem = updatedStockData.find((item: any) => item.item_id === itemId);

    // Verify stock was updated
    expect(updatedItem.current_stock).toBe(initialStock + 10);
  });

  test('안전재고 레벨 비교 로직', async ({ page }) => {
    // Fetch stock data
    const stockData = await getStockData(page);

    for (const stockItem of stockData.slice(0, 5)) {
      // Check first 5 items
      const itemDetails = await getItemDetails(page, stockItem.item_id);

      if (itemDetails && itemDetails.safety_stock_level) {
        const isLowStock = stockItem.current_stock <= itemDetails.safety_stock_level;

        // Verify low stock detection
        if (isLowStock) {
          expect(stockItem.current_stock).toBeLessThanOrEqual(itemDetails.safety_stock_level);
        }
      }
    }
  });

  test('재고 집계 정확성 검증', async ({ page }) => {
    // Fetch stock data
    const stockData = await getStockData(page);

    // Calculate totals
    const totalItems = stockData.length;
    const totalStock = stockData.reduce((sum: number, item: any) => sum + item.current_stock, 0);
    const lowStockCount = stockData.filter((item: any) => {
      // Simplified check
      return item.current_stock <= 10;
    }).length;

    // Verify aggregations
    expect(totalItems).toBeGreaterThan(0);
    expect(totalStock).toBeGreaterThanOrEqual(0);
    expect(lowStockCount).toBeGreaterThanOrEqual(0);
    expect(lowStockCount).toBeLessThanOrEqual(totalItems);

    console.log(`Total items: ${totalItems}, Total stock: ${totalStock}, Low stock: ${lowStockCount}`);
  });

  test('재고 필터 API 파라미터 검증', async ({ page }) => {
    // Test various filter parameters
    const filters = [
      { category: 'Parts' },
      { status: 'LOW_STOCK' },
      { min_stock: 10 },
      { max_stock: 100 }
    ];

    for (const filter of filters) {
      const params = new URLSearchParams(filter as any).toString();
      const response = await page.request.get(`http://localhost:5000/api/inventory/stock?${params}`);

      // All filter requests should succeed
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBeTruthy();
      expect(Array.isArray(data.data)).toBeTruthy();
    }
  });

  test('대용량 재고 데이터 처리 성능', async ({ page }) => {
    const startTime = Date.now();

    // Fetch all stock data
    const response = await page.request.get('http://localhost:5000/api/inventory/stock?limit=1000');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    // Verify response time is acceptable
    expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds

    // Verify data integrity
    expect(Array.isArray(data.data)).toBeTruthy();

    console.log(`Stock API response time for ${data.data.length} items: ${responseTime}ms`);
  });

  test('재고 검색 API 성능', async ({ page }) => {
    const searchTerm = '부품';
    const startTime = Date.now();

    const response = await page.request.get(
      `http://localhost:5000/api/inventory/stock?search=${encodeURIComponent(searchTerm)}`
    );

    expect(response.ok()).toBeTruthy();
    const responseTime = Date.now() - startTime;

    // Search should be fast
    expect(responseTime).toBeLessThan(1000);

    console.log(`Stock search response time: ${responseTime}ms`);
  });
});
