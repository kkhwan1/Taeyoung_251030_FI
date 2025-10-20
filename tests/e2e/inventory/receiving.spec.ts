/**
 * Receiving Transactions E2E Tests
 * Tests receiving (입고) transactions and automatic stock increases
 */

import { test, expect } from '@playwright/test';

// Helper to generate unique transaction number
const generateTransactionNo = () => `RCV-${Date.now()}`;

// Helper to verify database changes via API
async function verifyStockInDatabase(page: any, itemId: number, expectedChange: number) {
  const response = await page.request.get(`http://localhost:5000/api/inventory/stock?item_id=${itemId}`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.data[0]?.current_stock || 0;
}

test.describe('Receiving Transactions (입고)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to receiving page
    await page.goto('http://localhost:5000/inventory/receiving');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 로드 및 기본 UI 확인', async ({ page }) => {
    // Verify page title
    await expect(page.locator('text=입고 관리')).toBeVisible();

    // Verify key UI elements
    await expect(page.locator('button:has-text("입고 등록")')).toBeVisible();
    await expect(page.locator('button:has-text("Excel 내보내기")')).toBeVisible();

    // Verify search/filter controls
    await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();

    // Verify transaction list table
    await expect(page.locator('table')).toBeVisible();
  });

  test('입고 등록 - 정상 플로우', async ({ page }) => {
    // Get initial stock level via API
    const itemId = 1; // Assuming test item exists
    const initialStock = await verifyStockInDatabase(page, itemId, 0);

    // Click "입고 등록" button
    await page.click('button:has-text("입고 등록")');
    await page.waitForTimeout(300);

    // Verify modal is open
    await expect(page.locator('text=입고 등록').first()).toBeVisible();

    // Fill in transaction details
    const transactionNo = generateTransactionNo();
    await page.fill('input[name="transaction_number"]', transactionNo);

    // Select item (assuming dropdown/autocomplete exists)
    const itemSelect = page.locator('select[name="item_id"]').or(page.locator('input[name="item_id"]'));
    await itemSelect.first().click();
    await itemSelect.first().fill('1');

    // Enter quantity
    const quantityInput = page.locator('input[name="quantity"]');
    await quantityInput.fill('100');

    // Enter unit price
    const priceInput = page.locator('input[name="unit_price"]');
    await priceInput.fill('5000');

    // Select transaction date
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill('2025-01-19');

    // Enter supplier/company (if required)
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
    await expect(page.locator('text=입고 등록').first()).not.toBeVisible();

    // Verify new transaction appears in list
    await expect(page.locator(`text=${transactionNo}`)).toBeVisible();

    // Verify stock increased in database
    const newStock = await verifyStockInDatabase(page, itemId, 100);
    expect(newStock).toBeGreaterThanOrEqual(initialStock + 100);
  });

  test('입고 등록 - 필수 필드 검증', async ({ page }) => {
    // Open registration modal
    await page.click('button:has-text("입고 등록")');
    await page.waitForTimeout(300);

    // Try to submit without filling required fields
    await page.click('button:has-text("저장")');
    await page.waitForTimeout(300);

    // Verify validation error or disabled button
    const submitButton = page.locator('button:has-text("저장")');
    const isDisabled = await submitButton.isDisabled();

    // Either button should be disabled OR validation error should appear
    if (!isDisabled) {
      await expect(page.locator('text=필수')).toBeVisible();
    }
  });

  test('입고 등록 - 수량 음수 방지', async ({ page }) => {
    // Open registration modal
    await page.click('button:has-text("입고 등록")');
    await page.waitForTimeout(300);

    // Try to enter negative quantity
    const quantityInput = page.locator('input[name="quantity"]');
    await quantityInput.fill('-100');

    // Verify validation prevents negative values
    const value = await quantityInput.inputValue();
    expect(Number(value)).toBeGreaterThanOrEqual(0);
  });

  test('입고 내역 검색 기능', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Get initial row count
    const initialRows = await page.locator('table tbody tr').count();

    // Perform search
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('RCV');
    await page.waitForTimeout(500);

    // Verify filtered results
    const filteredRows = await page.locator('table tbody tr').count();

    // Should have some results (assuming test data exists)
    expect(filteredRows).toBeGreaterThan(0);
  });

  test('입고 내역 날짜 필터링', async ({ page }) => {
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

  test('입고 상세보기', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Click first row or view button
    const viewButton = page.locator('button:has-text("상세")').first()
      .or(page.locator('table tbody tr').first());

    if (await viewButton.count() > 0) {
      await viewButton.click();
      await page.waitForTimeout(500);

      // Verify detail view/modal opens
      await expect(page.locator('text=상세').or(page.locator('text=정보'))).toBeVisible();
    }
  });

  test('입고 취소/삭제 기능', async ({ page }) => {
    // Check if cancel/delete button exists
    const deleteButton = page.locator('button:has-text("취소")').first()
      .or(page.locator('button:has-text("삭제")').first());

    if (await deleteButton.count() > 0) {
      // Get item ID and quantity before deletion
      const firstRow = page.locator('table tbody tr').first();
      const itemId = await firstRow.getAttribute('data-item-id');

      if (itemId) {
        const initialStock = await verifyStockInDatabase(page, Number(itemId), 0);

        // Click delete button
        await deleteButton.click();
        await page.waitForTimeout(300);

        // Confirm deletion if confirmation dialog appears
        const confirmButton = page.locator('button:has-text("확인")');
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }

        // Verify success message
        await expect(page.locator('text=삭제').or(page.locator('text=취소'))).toBeVisible({ timeout: 3000 });

        // Verify stock decreased (rollback)
        const newStock = await verifyStockInDatabase(page, Number(itemId), 0);
        expect(newStock).toBeLessThanOrEqual(initialStock);
      }
    }
  });

  test('Excel 내보내기 기능', async ({ page }) => {
    // Start waiting for download before clicking
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
    const nextButton = page.locator('button:has-text("다음")').or(page.locator('button[aria-label="Next"]'));

    if (await nextButton.count() > 0) {
      // Click next page
      await nextButton.click();
      await page.waitForTimeout(500);

      // Verify page changed (URL or table content updated)
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('대량 입고 처리 - 성능 테스트', async ({ page }) => {
    // This test verifies system can handle multiple receiving transactions
    const transactionsToCreate = 3;

    for (let i = 0; i < transactionsToCreate; i++) {
      // Open modal
      await page.click('button:has-text("입고 등록")');
      await page.waitForTimeout(300);

      // Fill minimum required fields
      const transactionNo = generateTransactionNo();
      await page.fill('input[name="transaction_number"]', transactionNo);

      const itemSelect = page.locator('select[name="item_id"]').or(page.locator('input[name="item_id"]'));
      await itemSelect.first().click();
      await itemSelect.first().fill('1');

      await page.fill('input[name="quantity"]', '10');
      await page.fill('input[name="unit_price"]', '1000');

      const dateInput = page.locator('input[type="date"]');
      await dateInput.fill('2025-01-19');

      // Submit
      await page.click('button:has-text("저장")');
      await page.waitForTimeout(1000);

      // Verify success
      await expect(page.locator(`text=${transactionNo}`)).toBeVisible({ timeout: 3000 });
    }

    // Verify all transactions were created
    await page.waitForTimeout(1000);
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(transactionsToCreate);
  });

  test('입고 수정 기능', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr');

    // Check if edit button exists
    const editButton = page.locator('button:has-text("수정")').first();

    if (await editButton.count() > 0) {
      await editButton.click();
      await page.waitForTimeout(300);

      // Verify edit modal opens
      await expect(page.locator('text=수정')).toBeVisible();

      // Modify quantity
      const quantityInput = page.locator('input[name="quantity"]');
      await quantityInput.fill('150');

      // Save changes
      await page.click('button:has-text("저장")');
      await page.waitForTimeout(1000);

      // Verify success
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 3000 });
    }
  });

  test('API 응답 시간 검증', async ({ page }) => {
    // Measure API response time
    const startTime = Date.now();

    await page.goto('http://localhost:5000/inventory/receiving');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Verify load time is under 3 seconds
    expect(loadTime).toBeLessThan(3000);

    console.log(`Receiving page load time: ${loadTime}ms`);
  });

  test('반응형 레이아웃 - 모바일', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload page
    await page.goto('http://localhost:5000/inventory/receiving');
    await page.waitForLoadState('networkidle');

    // Verify page loads on mobile
    await expect(page.locator('text=입고')).toBeVisible();

    // Verify mobile menu if exists
    const menuButton = page.locator('button[aria-label="Menu"]');
    if (await menuButton.count() > 0) {
      await menuButton.click();
      await expect(page.locator('nav')).toBeVisible();
    }
  });
});

test.describe('Receiving Transactions - Database Integration', () => {
  test('입고 트랜잭션 원자성 검증', async ({ page }) => {
    // This test verifies that receiving transaction is atomic
    // Either both inventory_transactions and stock updates succeed, or both fail

    const itemId = 1;
    const initialStock = await verifyStockInDatabase(page, itemId, 0);

    // Create receiving transaction via API directly
    const transactionNo = generateTransactionNo();
    const response = await page.request.post('http://localhost:5000/api/inventory/receiving', {
      data: {
        transaction_number: transactionNo,
        item_id: itemId,
        quantity: 50,
        unit_price: 3000,
        transaction_date: '2025-01-19',
        transaction_type: 'RECEIVING'
      }
    });

    expect(response.ok()).toBeTruthy();

    // Verify stock was updated atomically
    const newStock = await verifyStockInDatabase(page, itemId, 50);
    expect(newStock).toBe(initialStock + 50);
  });

  test('동시 입고 처리 - 레이스 컨디션 방지', async ({ page }) => {
    // This test verifies concurrent receiving transactions don't cause race conditions
    const itemId = 1;
    const initialStock = await verifyStockInDatabase(page, itemId, 0);

    // Create multiple concurrent transactions
    const promises = [];
    for (let i = 0; i < 3; i++) {
      const transactionNo = generateTransactionNo() + `-${i}`;
      promises.push(
        page.request.post('http://localhost:5000/api/inventory/receiving', {
          data: {
            transaction_number: transactionNo,
            item_id: itemId,
            quantity: 10,
            unit_price: 1000,
            transaction_date: '2025-01-19',
            transaction_type: 'RECEIVING'
          }
        })
      );
    }

    const responses = await Promise.all(promises);

    // Verify all transactions succeeded
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });

    // Verify final stock is correct (initial + 30)
    await page.waitForTimeout(1000); // Allow DB to settle
    const finalStock = await verifyStockInDatabase(page, itemId, 30);
    expect(finalStock).toBe(initialStock + 30);
  });

  test('입고 후 재고 히스토리 생성 확인', async ({ page }) => {
    // Create receiving transaction
    const transactionNo = generateTransactionNo();
    const itemId = 1;

    await page.request.post('http://localhost:5000/api/inventory/receiving', {
      data: {
        transaction_number: transactionNo,
        item_id: itemId,
        quantity: 25,
        unit_price: 2000,
        transaction_date: '2025-01-19',
        transaction_type: 'RECEIVING'
      }
    });

    // Verify history record was created
    const historyResponse = await page.request.get(
      `http://localhost:5000/api/stock/history?item_id=${itemId}&transaction_type=RECEIVING`
    );

    expect(historyResponse.ok()).toBeTruthy();
    const historyData = await historyResponse.json();

    // Should find the transaction in history
    const foundTransaction = historyData.data.some(
      (tx: any) => tx.transaction_number === transactionNo
    );
    expect(foundTransaction).toBeTruthy();
  });
});
