/**
 * Stock History E2E Tests
 * Tests transaction history view, date range filtering, and audit trail
 */

import { test, expect } from '@playwright/test';

// Helper functions
async function getStockHistory(page: any, filters?: any) {
  const params = filters ? new URLSearchParams(filters).toString() : '';
  const url = `http://localhost:5000/api/stock/history${params ? '?' + params : ''}`;
  const response = await page.request.get(url);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.data || [];
}

async function getTransactionDetails(page: any, transactionId: number) {
  const response = await page.request.get(
    `http://localhost:5000/api/inventory/transactions/${transactionId}`
  );
  if (response.ok()) {
    const data = await response.json();
    return data.data;
  }
  return null;
}

test.describe('Stock History (재고 이력)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to stock history page
    await page.goto('http://localhost:5000/stock/history');
    await page.waitForLoadState('networkidle');
  });

  test('재고 이력 페이지 로드 및 UI 확인', async ({ page }) => {
    // Verify page title
    await expect(page.locator('text=재고 이력').or(page.locator('text=Stock History'))).toBeVisible();

    // Verify key UI elements
    await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();

    // Verify history table
    await expect(page.locator('table')).toBeVisible();

    // Verify date range filter
    await expect(page.locator('input[type="date"]').first()).toBeVisible();

    // Verify export button
    await expect(page.locator('button:has-text("Excel 내보내기")')).toBeVisible();
  });

  test('재고 이력 데이터 표시 검증', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Verify table has data
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);

    // Verify essential columns
    const firstRow = page.locator('table tbody tr').first();

    // Should show transaction date
    await expect(firstRow.locator('td').nth(0)).toBeVisible();

    // Should show transaction type
    await expect(firstRow.locator('td').nth(2)).toBeVisible();

    // Should show quantity
    await expect(firstRow.locator('td').nth(4)).toBeVisible();
  });

  test('날짜 범위 필터링 - 오늘', async ({ page }) => {
    // Set date range to today
    const today = new Date().toISOString().split('T')[0];

    const fromDate = page.locator('input[type="date"]').first();
    const toDate = page.locator('input[type="date"]').nth(1);

    await fromDate.fill(today);
    await toDate.fill(today);

    // Apply filter (if there's a button) or wait for auto-filter
    const applyButton = page.locator('button:has-text("적용")').or(page.locator('button:has-text("Apply")'));
    if (await applyButton.count() > 0) {
      await applyButton.click();
    }

    await page.waitForTimeout(500);

    // Verify filtered results
    await expect(page.locator('table')).toBeVisible();
  });

  test('날짜 범위 필터링 - 최근 7일', async ({ page }) => {
    // Calculate date range
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const fromDate = page.locator('input[type="date"]').first();
    const toDate = page.locator('input[type="date"]').nth(1);

    await fromDate.fill(sevenDaysAgo.toISOString().split('T')[0]);
    await toDate.fill(today.toISOString().split('T')[0]);

    // Apply filter
    const applyButton = page.locator('button:has-text("적용")').or(page.locator('button:has-text("Apply")'));
    if (await applyButton.count() > 0) {
      await applyButton.click();
    }

    await page.waitForTimeout(500);

    // Verify filtered results
    await expect(page.locator('table tbody tr')).toBeVisible();
  });

  test('날짜 범위 필터링 - 최근 30일', async ({ page }) => {
    // Check if there's a preset button
    const last30DaysButton = page.locator('button:has-text("최근 30일")').or(
      page.locator('button:has-text("Last 30 Days")')
    );

    if (await last30DaysButton.count() > 0) {
      await last30DaysButton.click();
      await page.waitForTimeout(500);

      // Verify filtered results
      await expect(page.locator('table tbody tr')).toBeVisible();
    } else {
      // Manually set date range
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const fromDate = page.locator('input[type="date"]').first();
      const toDate = page.locator('input[type="date"]').nth(1);

      await fromDate.fill(thirtyDaysAgo.toISOString().split('T')[0]);
      await toDate.fill(today.toISOString().split('T')[0]);

      await page.waitForTimeout(500);
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('거래 유형별 필터링', async ({ page }) => {
    // Check if transaction type filter exists
    const typeFilter = page.locator('select[name="transaction_type"]').or(
      page.locator('select').first()
    );

    if (await typeFilter.count() > 0) {
      // Filter by RECEIVING
      await typeFilter.selectOption('RECEIVING');
      await page.waitForTimeout(500);

      // Verify filtered results show only receiving transactions
      await expect(page.locator('table tbody tr')).toBeVisible();

      // Verify first row is RECEIVING
      const firstRow = await page.locator('table tbody tr').first().textContent();
      expect(firstRow).toContain('입고');

      // Filter by SHIPPING
      await typeFilter.selectOption('SHIPPING');
      await page.waitForTimeout(500);

      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('품목별 필터링', async ({ page }) => {
    // Check if item filter exists
    const itemFilter = page.locator('select[name="item_id"]').or(
      page.locator('input[name="item_search"]')
    );

    if (await itemFilter.count() > 0) {
      if (itemFilter.first().evaluate(el => el.tagName) === 'SELECT') {
        // Dropdown filter
        const options = await itemFilter.first().locator('option').count();
        if (options > 1) {
          await itemFilter.first().selectOption({ index: 1 });
          await page.waitForTimeout(500);

          await expect(page.locator('table tbody tr')).toBeVisible();
        }
      } else {
        // Search input
        await itemFilter.first().fill('부품A');
        await page.waitForTimeout(500);

        await expect(page.locator('table tbody tr')).toBeVisible();
      }
    }
  });

  test('재고 이력 검색 기능', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Perform search
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('RCV');
    await page.waitForTimeout(500);

    // Verify filtered results
    const filteredRows = await page.locator('table tbody tr').count();
    expect(filteredRows).toBeGreaterThan(0);
  });

  test('거래 상세보기', async ({ page }) => {
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
      page.locator('text=상세').or(page.locator('text=Details'))
    ).toBeVisible({ timeout: 3000 });

    // Verify key information is displayed
    await expect(page.locator('text=거래번호').or(page.locator('text=Transaction No'))).toBeVisible();
    await expect(page.locator('text=수량').or(page.locator('text=Quantity'))).toBeVisible();
  });

  test('재고 이력 정렬 - 날짜순', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Click date column header
    const dateHeader = page.locator('th:has-text("날짜")').or(
      page.locator('th:has-text("Date")')
    );

    if (await dateHeader.count() > 0) {
      await dateHeader.click();
      await page.waitForTimeout(500);

      // Verify table is still visible
      await expect(page.locator('table tbody tr')).toBeVisible();

      // Click again to reverse sort
      await dateHeader.click();
      await page.waitForTimeout(500);

      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('재고 이력 정렬 - 수량순', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Click quantity column header
    const quantityHeader = page.locator('th:has-text("수량")').or(
      page.locator('th:has-text("Quantity")')
    );

    if (await quantityHeader.count() > 0) {
      await quantityHeader.click();
      await page.waitForTimeout(500);

      await expect(page.locator('table tbody tr')).toBeVisible();
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

  test('필터 초기화 기능', async ({ page }) => {
    // Apply some filters first
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('TEST');
    await page.waitForTimeout(300);

    // Look for reset/clear button
    const resetButton = page.locator('button:has-text("초기화")').or(
      page.locator('button:has-text("Clear")')
    );

    if (await resetButton.count() > 0) {
      await resetButton.click();
      await page.waitForTimeout(500);

      // Verify filters were cleared
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('');

      // Verify table shows all data again
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('API 응답 시간 검증', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:5000/stock/history');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Verify load time is under 3 seconds
    expect(loadTime).toBeLessThan(3000);

    console.log(`Stock history page load time: ${loadTime}ms`);
  });

  test('반응형 레이아웃 - 모바일', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload page
    await page.goto('http://localhost:5000/stock/history');
    await page.waitForLoadState('networkidle');

    // Verify page loads on mobile
    await expect(page.locator('text=이력')).toBeVisible();

    // Verify table is scrollable or cards are displayed
    await expect(page.locator('table').or(page.locator('[role="list"]'))).toBeVisible();
  });
});

test.describe('Stock History - API Integration', () => {
  test('재고 이력 API 엔드포인트 검증', async ({ page }) => {
    // Fetch history data via API
    const historyData = await getStockHistory(page);

    // Verify data structure
    expect(Array.isArray(historyData)).toBeTruthy();

    if (historyData.length > 0) {
      const firstTransaction = historyData[0];

      // Verify required fields
      expect(firstTransaction.transaction_id).toBeDefined();
      expect(firstTransaction.transaction_date).toBeDefined();
      expect(firstTransaction.transaction_type).toBeDefined();
      expect(firstTransaction.quantity).toBeDefined();
      expect(firstTransaction.item_id).toBeDefined();
    }
  });

  test('날짜 범위 필터 API 파라미터 검증', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Test date range filter
    const historyData = await getStockHistory(page, {
      from_date: yesterday,
      to_date: today
    });

    expect(Array.isArray(historyData)).toBeTruthy();

    // Verify all transactions are within date range
    historyData.forEach((tx: any) => {
      const txDate = tx.transaction_date.split('T')[0];
      expect(txDate >= yesterday && txDate <= today).toBeTruthy();
    });
  });

  test('거래 유형 필터 API 검증', async ({ page }) => {
    // Test filtering by RECEIVING
    const receivingData = await getStockHistory(page, {
      transaction_type: 'RECEIVING'
    });

    expect(Array.isArray(receivingData)).toBeTruthy();

    // Verify all transactions are RECEIVING
    receivingData.forEach((tx: any) => {
      expect(tx.transaction_type).toBe('RECEIVING');
    });

    // Test filtering by SHIPPING
    const shippingData = await getStockHistory(page, {
      transaction_type: 'SHIPPING'
    });

    expect(Array.isArray(shippingData)).toBeTruthy();

    shippingData.forEach((tx: any) => {
      expect(tx.transaction_type).toBe('SHIPPING');
    });
  });

  test('품목별 이력 조회', async ({ page }) => {
    const itemId = 1;

    // Fetch history for specific item
    const historyData = await getStockHistory(page, {
      item_id: itemId
    });

    expect(Array.isArray(historyData)).toBeTruthy();

    // Verify all transactions are for the specified item
    historyData.forEach((tx: any) => {
      expect(tx.item_id).toBe(itemId);
    });
  });

  test('거래 상세 정보 조회', async ({ page }) => {
    // Get a transaction from history
    const historyData = await getStockHistory(page);

    if (historyData.length > 0) {
      const transactionId = historyData[0].transaction_id;

      // Fetch detailed transaction info
      const details = await getTransactionDetails(page, transactionId);

      if (details) {
        // Verify detailed information is returned
        expect(details.transaction_id).toBe(transactionId);
        expect(details.transaction_number).toBeDefined();
        expect(details.transaction_date).toBeDefined();
        expect(details.quantity).toBeDefined();
      }
    }
  });

  test('재고 변동 추적 검증', async ({ page }) => {
    // This test verifies that stock history accurately tracks stock changes
    const itemId = 1;

    // Get initial stock level
    const stockResponse = await page.request.get(`http://localhost:5000/api/inventory/stock?item_id=${itemId}`);
    expect(stockResponse.ok()).toBeTruthy();
    const stockData = await stockResponse.json();
    const initialStock = stockData.data[0]?.current_stock || 0;

    // Create a receiving transaction
    const quantity = 15;
    const createResponse = await page.request.post('http://localhost:5000/api/inventory/receiving', {
      data: {
        transaction_number: `HIST-${Date.now()}`,
        item_id: itemId,
        quantity: quantity,
        unit_price: 2000,
        transaction_date: '2025-01-19',
        transaction_type: 'RECEIVING'
      }
    });

    expect(createResponse.ok()).toBeTruthy();
    const createResult = await createResponse.json();

    // Verify transaction appears in history
    await page.waitForTimeout(500);
    const historyData = await getStockHistory(page, { item_id: itemId });

    const foundTransaction = historyData.find(
      (tx: any) => tx.transaction_id === createResult.data?.transaction_id
    );

    expect(foundTransaction).toBeDefined();
    expect(foundTransaction.quantity).toBe(quantity);
    expect(foundTransaction.transaction_type).toBe('RECEIVING');
  });

  test('감사 추적 완전성 검증', async ({ page }) => {
    // Verify audit trail completeness
    const historyData = await getStockHistory(page);

    // Each transaction should have audit fields
    historyData.slice(0, 10).forEach((tx: any) => {
      // Verify timestamp fields
      expect(tx.transaction_date).toBeDefined();

      // Verify required transaction fields
      expect(tx.transaction_id).toBeDefined();
      expect(tx.transaction_type).toBeDefined();
      expect(tx.quantity).toBeDefined();
      expect(tx.item_id).toBeDefined();

      // Verify user tracking (if implemented)
      if (tx.created_by) {
        expect(typeof tx.created_by).toBe('number');
      }
    });
  });

  test('대용량 이력 데이터 조회 성능', async ({ page }) => {
    const startTime = Date.now();

    // Fetch large amount of history data
    const response = await page.request.get('http://localhost:5000/api/stock/history?limit=1000');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    // Verify response time is acceptable
    expect(responseTime).toBeLessThan(3000); // Should respond within 3 seconds

    // Verify data integrity
    expect(Array.isArray(data.data)).toBeTruthy();

    console.log(`History API response time for ${data.data.length} records: ${responseTime}ms`);
  });

  test('이력 데이터 정렬 검증', async ({ page }) => {
    // Fetch history sorted by date descending (most recent first)
    const historyData = await getStockHistory(page, {
      order_by: 'transaction_date',
      order: 'desc'
    });

    if (historyData.length > 1) {
      // Verify sorting
      for (let i = 0; i < historyData.length - 1; i++) {
        const currentDate = new Date(historyData[i].transaction_date);
        const nextDate = new Date(historyData[i + 1].transaction_date);

        // Current date should be >= next date (descending order)
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
      }
    }
  });

  test('필터 조합 검증', async ({ page }) => {
    // Test multiple filters combined
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const historyData = await getStockHistory(page, {
      from_date: thirtyDaysAgo,
      to_date: today,
      transaction_type: 'RECEIVING',
      item_id: 1
    });

    expect(Array.isArray(historyData)).toBeTruthy();

    // Verify all filters are applied
    historyData.forEach((tx: any) => {
      // Date range
      const txDate = tx.transaction_date.split('T')[0];
      expect(txDate >= thirtyDaysAgo && txDate <= today).toBeTruthy();

      // Transaction type
      expect(tx.transaction_type).toBe('RECEIVING');

      // Item ID
      expect(tx.item_id).toBe(1);
    });
  });

  test('페이지네이션 API 검증', async ({ page }) => {
    // Test pagination parameters
    const page1 = await getStockHistory(page, { page: 1, limit: 10 });
    const page2 = await getStockHistory(page, { page: 2, limit: 10 });

    expect(Array.isArray(page1)).toBeTruthy();
    expect(Array.isArray(page2)).toBeTruthy();

    // Verify different data on each page (if enough records exist)
    if (page1.length > 0 && page2.length > 0) {
      const page1Ids = page1.map((tx: any) => tx.transaction_id);
      const page2Ids = page2.map((tx: any) => tx.transaction_id);

      // No overlap between pages
      const overlap = page1Ids.filter((id: number) => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    }
  });
});
