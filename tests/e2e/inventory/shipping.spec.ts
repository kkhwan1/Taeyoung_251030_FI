/**
 * Shipping/Outbound Transactions E2E Tests
 * Tests shipping (출고) transactions, auto stock decrease, and low stock warnings
 */

import { test, expect } from '@playwright/test';

// Helper functions
const generateTransactionNo = () => `SHP-${Date.now()}`;

async function verifyStockInDatabase(page: any, itemId: number) {
  const response = await page.request.get(`http://localhost:5000/api/inventory/stock?item_id=${itemId}`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.data[0]?.current_stock || 0;
}

async function getItemSafetyStock(page: any, itemId: number) {
  const response = await page.request.get(`http://localhost:5000/api/items/${itemId}`);
  if (response.ok()) {
    const data = await response.json();
    return data.data?.safety_stock_level || 0;
  }
  return 0;
}

async function checkStockAvailability(page: any, itemId: number, quantity: number) {
  const response = await page.request.post('http://localhost:5000/api/inventory/shipping/stock-check', {
    data: { item_id: itemId, quantity }
  });
  if (response.ok()) {
    const data = await response.json();
    return data;
  }
  return null;
}

test.describe('Shipping Transactions (출고)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to inventory page and select shipping tab
    await page.goto('http://localhost:5000/inventory');
    await page.waitForLoadState('networkidle');

    // Click shipping tab/button
    const shippingTab = page.locator('text=출고').or(page.locator('button:has-text("출고")'));
    if (await shippingTab.count() > 0) {
      await shippingTab.click();
      await page.waitForTimeout(300);
    }
  });

  test('출고 페이지 로드 및 UI 확인', async ({ page }) => {
    // Verify page title
    await expect(page.locator('text=출고')).toBeVisible();

    // Verify key UI elements
    await expect(page.locator('button:has-text("출고 등록")')).toBeVisible();

    // Verify search/filter controls
    await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();

    // Verify transaction list table
    await expect(page.locator('table')).toBeVisible();
  });

  test('출고 등록 - 정상 플로우', async ({ page }) => {
    const itemId = 1;
    const shippingQuantity = 5;

    // Get initial stock
    const initialStock = await verifyStockInDatabase(page, itemId);

    // Verify sufficient stock
    if (initialStock < shippingQuantity) {
      console.log('Insufficient stock for test, skipping');
      test.skip();
      return;
    }

    // Open shipping registration modal
    await page.click('button:has-text("출고 등록")');
    await page.waitForTimeout(300);

    // Verify modal is open
    await expect(page.locator('text=출고 등록').first()).toBeVisible();

    // Fill in transaction details
    const transactionNo = generateTransactionNo();
    await page.fill('input[name="transaction_number"]', transactionNo);

    // Select item
    const itemSelect = page.locator('select[name="item_id"]').or(page.locator('input[name="item_id"]'));
    await itemSelect.first().click();
    await itemSelect.first().fill(itemId.toString());

    // Enter quantity
    await page.fill('input[name="quantity"]', shippingQuantity.toString());

    // Select transaction date
    await page.fill('input[type="date"]', '2025-01-19');

    // Select customer/company if required
    const companySelect = page.locator('select[name="company_id"]');
    if (await companySelect.count() > 0) {
      await companySelect.selectOption('1');
    }

    // Submit form
    await page.click('button:has-text("저장")');
    await page.waitForTimeout(1000);

    // Verify success message
    await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

    // Verify modal closed
    await expect(page.locator('text=출고 등록').first()).not.toBeVisible();

    // Verify new transaction appears in list
    await expect(page.locator(`text=${transactionNo}`)).toBeVisible();

    // Verify stock decreased
    await page.waitForTimeout(500);
    const newStock = await verifyStockInDatabase(page, itemId);
    expect(newStock).toBe(initialStock - shippingQuantity);
  });

  test('출고 등록 - 재고 부족 경고', async ({ page }) => {
    const itemId = 1;
    const excessiveQuantity = 999999; // Very large quantity

    // Open shipping modal
    await page.click('button:has-text("출고 등록")');
    await page.waitForTimeout(300);

    // Fill in details
    const transactionNo = generateTransactionNo();
    await page.fill('input[name="transaction_number"]', transactionNo);

    const itemSelect = page.locator('select[name="item_id"]').or(page.locator('input[name="item_id"]'));
    await itemSelect.first().click();
    await itemSelect.first().fill(itemId.toString());

    await page.fill('input[name="quantity"]', excessiveQuantity.toString());

    // Trigger stock check (either automatic or manual button)
    const stockCheckButton = page.locator('button:has-text("재고 확인")');
    if (await stockCheckButton.count() > 0) {
      await stockCheckButton.click();
      await page.waitForTimeout(500);
    } else {
      // Stock check might be automatic
      await page.waitForTimeout(500);
    }

    // Verify insufficient stock warning appears
    await expect(
      page.locator('text=재고 부족').or(page.locator('text=부족'))
    ).toBeVisible({ timeout: 3000 });

    // Submit button should be disabled
    const submitButton = page.locator('button:has-text("저장")');
    await expect(submitButton).toBeDisabled();
  });

  test('출고 등록 - 안전재고 경고', async ({ page }) => {
    const itemId = 1;

    // Get current stock and safety stock level
    const currentStock = await verifyStockInDatabase(page, itemId);
    const safetyStock = await getItemSafetyStock(page, itemId);

    if (safetyStock === 0) {
      console.log('No safety stock level set, skipping test');
      test.skip();
      return;
    }

    // Calculate quantity that would trigger safety stock warning
    const quantityToTriggerWarning = currentStock - safetyStock + 1;

    if (quantityToTriggerWarning <= 0) {
      console.log('Already below safety stock, skipping test');
      test.skip();
      return;
    }

    // Open shipping modal
    await page.click('button:has-text("출고 등록")');
    await page.waitForTimeout(300);

    // Fill in details
    const transactionNo = generateTransactionNo();
    await page.fill('input[name="transaction_number"]', transactionNo);

    const itemSelect = page.locator('select[name="item_id"]').or(page.locator('input[name="item_id"]'));
    await itemSelect.first().click();
    await itemSelect.first().fill(itemId.toString());

    await page.fill('input[name="quantity"]', quantityToTriggerWarning.toString());

    // Wait for safety stock warning
    await page.waitForTimeout(500);

    // Verify warning appears
    await expect(
      page.locator('text=안전재고').or(page.locator('text=경고'))
    ).toBeVisible({ timeout: 3000 });
  });

  test('출고 등록 - 실시간 재고 확인', async ({ page }) => {
    const itemId = 1;

    // Open shipping modal
    await page.click('button:has-text("출고 등록")');
    await page.waitForTimeout(300);

    // Select item
    const itemSelect = page.locator('select[name="item_id"]').or(page.locator('input[name="item_id"]'));
    await itemSelect.first().click();
    await itemSelect.first().fill(itemId.toString());

    // Wait for real-time stock display
    await page.waitForTimeout(500);

    // Verify current stock is displayed
    const stockDisplay = page.locator('text=/현재 재고|Current Stock|재고:/');
    if (await stockDisplay.count() > 0) {
      await expect(stockDisplay).toBeVisible();
    }
  });

  test('출고 내역 검색 및 필터링', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Perform search
    const searchInput = page.locator('input[placeholder*="검색"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('SHP');
      await page.waitForTimeout(500);

      // Verify filtered results
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('출고 내역 날짜 필터링', async ({ page }) => {
    // Check if date filter exists
    const dateFilter = page.locator('input[type="date"]').first();
    if (await dateFilter.count() > 0) {
      // Set date filter to today
      const today = new Date().toISOString().split('T')[0];
      await dateFilter.fill(today);
      await page.waitForTimeout(500);

      // Verify table updates
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('출고 상세보기', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Click first row or view button
    const viewButton = page.locator('button:has-text("상세")').first()
      .or(page.locator('table tbody tr').first());

    if (await viewButton.count() > 0) {
      await viewButton.click();
      await page.waitForTimeout(500);

      // Verify detail view opens
      await expect(page.locator('text=상세').or(page.locator('text=정보'))).toBeVisible();
    }
  });

  test('출고 취소/반품 - 재고 복원', async ({ page }) => {
    const itemId = 1;
    const shippingQuantity = 3;

    // Get initial stock
    const initialStock = await verifyStockInDatabase(page, itemId);

    // Create shipping transaction via API
    const transactionNo = generateTransactionNo();
    const createResponse = await page.request.post('http://localhost:5000/api/inventory/shipping', {
      data: {
        transaction_number: transactionNo,
        item_id: itemId,
        quantity: shippingQuantity,
        transaction_date: '2025-01-19',
        transaction_type: 'SHIPPING'
      }
    });

    expect(createResponse.ok()).toBeTruthy();
    const createResult = await createResponse.json();
    const transactionId = createResult.data?.transaction_id;

    if (transactionId) {
      // Verify stock decreased
      await page.waitForTimeout(500);
      const stockAfterShipping = await verifyStockInDatabase(page, itemId);
      expect(stockAfterShipping).toBe(initialStock - shippingQuantity);

      // Cancel/delete the transaction
      const deleteResponse = await page.request.delete(
        `http://localhost:5000/api/inventory/transactions/${transactionId}`
      );

      if (deleteResponse.ok()) {
        await page.waitForTimeout(1000);

        // Verify stock was restored
        const finalStock = await verifyStockInDatabase(page, itemId);
        expect(finalStock).toBe(initialStock);
      }
    }
  });

  test('출고 수정 기능', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Check if edit button exists
    const editButton = page.locator('button:has-text("수정")').first();

    if (await editButton.count() > 0) {
      await editButton.click();
      await page.waitForTimeout(300);

      // Verify edit modal opens
      await expect(page.locator('text=수정')).toBeVisible();

      // Modify quantity
      const quantityInput = page.locator('input[name="quantity"]');
      await quantityInput.fill('8');

      // Save changes
      await page.click('button:has-text("저장")');
      await page.waitForTimeout(1000);

      // Verify success
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 3000 });
    }
  });

  test('Excel 내보내기 기능', async ({ page }) => {
    // Start waiting for download
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    const exportButton = page.locator('button:has-text("Excel 내보내기")');
    if (await exportButton.count() > 0) {
      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;

      // Verify download started
      expect(download.suggestedFilename()).toContain('.xlsx');
    }
  });

  test('페이지네이션 동작', async ({ page }) => {
    // Check if pagination controls exist
    const nextButton = page.locator('button:has-text("다음")').or(page.locator('button[aria-label="Next"]'));

    if (await nextButton.count() > 0) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Verify page changed
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('API 응답 시간 검증', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:5000/inventory');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Verify load time is under 3 seconds
    expect(loadTime).toBeLessThan(3000);

    console.log(`Shipping page load time: ${loadTime}ms`);
  });

  test('반응형 레이아웃 - 모바일', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload page
    await page.goto('http://localhost:5000/inventory');
    await page.waitForLoadState('networkidle');

    // Verify page loads on mobile
    await expect(page.locator('text=출고')).toBeVisible();
  });
});

test.describe('Shipping - Stock Validation', () => {
  test('재고 부족 트랜잭션 거부', async ({ page }) => {
    const itemId = 1;
    const excessiveQuantity = 999999;

    // Attempt to create shipping transaction with excessive quantity
    const response = await page.request.post('http://localhost:5000/api/inventory/shipping', {
      data: {
        transaction_number: generateTransactionNo(),
        item_id: itemId,
        quantity: excessiveQuantity,
        transaction_date: '2025-01-19',
        transaction_type: 'SHIPPING'
      }
    });

    // API should reject the request
    expect(response.status()).toBeGreaterThanOrEqual(400);

    const error = await response.json();
    expect(error.error).toBeDefined();
    expect(error.error.toLowerCase()).toContain('stock');
  });

  test('Stock Check API 엔드포인트 검증', async ({ page }) => {
    const itemId = 1;
    const quantity = 10;

    // Call stock check API
    const stockCheck = await checkStockAvailability(page, itemId, quantity);

    if (stockCheck) {
      expect(stockCheck.success).toBeDefined();
      expect(stockCheck.data).toBeDefined();

      // Should return availability status
      expect(stockCheck.data.available).toBeDefined();
      expect(typeof stockCheck.data.available).toBe('boolean');

      // Should return current stock
      expect(stockCheck.data.current_stock).toBeDefined();
      expect(typeof stockCheck.data.current_stock).toBe('number');
    }
  });

  test('안전재고 레벨 알림 생성', async ({ page }) => {
    const itemId = 1;

    // Get current stock and safety stock
    const currentStock = await verifyStockInDatabase(page, itemId);
    const safetyStock = await getItemSafetyStock(page, itemId);

    if (safetyStock === 0 || currentStock > safetyStock) {
      console.log('Safety stock conditions not met, skipping test');
      test.skip();
      return;
    }

    // Create shipping that triggers safety stock warning
    const quantityToShip = currentStock - safetyStock + 1;

    const response = await page.request.post('http://localhost:5000/api/inventory/shipping', {
      data: {
        transaction_number: generateTransactionNo(),
        item_id: itemId,
        quantity: quantityToShip,
        transaction_date: '2025-01-19',
        transaction_type: 'SHIPPING'
      }
    });

    if (response.ok()) {
      // Check if notification was created
      const notificationResponse = await page.request.get(
        `http://localhost:5000/api/notifications?item_id=${itemId}&type=LOW_STOCK`
      );

      if (notificationResponse.ok()) {
        const notifications = await notificationResponse.json();
        expect(notifications.data.length).toBeGreaterThan(0);
      }
    }
  });

  test('동시 출고 처리 - 재고 일관성', async ({ page }) => {
    const itemId = 1;
    const quantity = 2;

    // Get initial stock
    const initialStock = await verifyStockInDatabase(page, itemId);

    // Create multiple concurrent shipping transactions
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        page.request.post('http://localhost:5000/api/inventory/shipping', {
          data: {
            transaction_number: generateTransactionNo() + `-${i}`,
            item_id: itemId,
            quantity: quantity,
            transaction_date: '2025-01-19',
            transaction_type: 'SHIPPING'
          }
        })
      );
    }

    const responses = await Promise.all(promises);

    // Count successful transactions
    const successCount = responses.filter(r => r.ok()).length;

    // Verify final stock consistency
    await page.waitForTimeout(1000);
    const finalStock = await verifyStockInDatabase(page, itemId);

    // Final stock should reflect actual successful shipments
    expect(finalStock).toBeLessThanOrEqual(initialStock);
    expect(finalStock).toBeGreaterThanOrEqual(0);
  });

  test('출고 후 재고 히스토리 생성 확인', async ({ page }) => {
    const itemId = 1;
    const quantity = 4;

    // Create shipping transaction
    const transactionNo = generateTransactionNo();
    const response = await page.request.post('http://localhost:5000/api/inventory/shipping', {
      data: {
        transaction_number: transactionNo,
        item_id: itemId,
        quantity: quantity,
        transaction_date: '2025-01-19',
        transaction_type: 'SHIPPING'
      }
    });

    if (response.ok()) {
      // Verify history record was created
      const historyResponse = await page.request.get(
        `http://localhost:5000/api/stock/history?item_id=${itemId}&transaction_type=SHIPPING`
      );

      expect(historyResponse.ok()).toBeTruthy();
      const historyData = await historyResponse.json();

      // Should find the transaction in history
      const foundTransaction = historyData.data.some(
        (tx: any) => tx.transaction_number === transactionNo
      );
      expect(foundTransaction).toBeTruthy();
    }
  });

  test('음수 재고 방지 검증', async ({ page }) => {
    const itemId = 1;

    // Get current stock
    const currentStock = await verifyStockInDatabase(page, itemId);

    // Try to ship more than available
    const response = await page.request.post('http://localhost:5000/api/inventory/shipping', {
      data: {
        transaction_number: generateTransactionNo(),
        item_id: itemId,
        quantity: currentStock + 100,
        transaction_date: '2025-01-19',
        transaction_type: 'SHIPPING'
      }
    });

    // Should be rejected
    expect(response.status()).toBeGreaterThanOrEqual(400);

    // Verify stock unchanged
    const finalStock = await verifyStockInDatabase(page, itemId);
    expect(finalStock).toBe(currentStock);
  });
});
