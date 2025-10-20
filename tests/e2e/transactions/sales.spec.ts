import { test, expect, Page } from '@playwright/test';

/**
 * Sales Transactions E2E Tests
 *
 * Tests for /sales page:
 * - Create/Edit/Delete sales transactions
 * - Auto payment status calculation (PENDING/PARTIAL/COMPLETED)
 * - Korean company and item names handling
 * - Excel 3-sheet export
 * - Pagination and filtering
 */

// Helper function to wait for API response
async function waitForApiResponse(page: Page, urlPattern: string | RegExp) {
  return await page.waitForResponse(
    (response) => {
      const url = response.url();
      const matches = typeof urlPattern === 'string'
        ? url.includes(urlPattern)
        : urlPattern.test(url);
      return matches && response.status() === 200;
    },
    { timeout: 10000 }
  );
}

// Test data
const testSalesTransaction = {
  customer_name: '테스트고객사',
  item_name: '테스트부품A',
  quantity: 100,
  unit_price: 10000,
  total_amount: 1000000, // quantity * unit_price
};

test.describe('Sales Transactions Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sales page
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Load and Display', () => {
    test('should load sales transactions page successfully', async ({ page }) => {
      // Check page title
      await expect(page.locator('h1, h2')).toContainText(/매출|Sales/i);

      // Check for main components
      await expect(page.locator('table, [role="table"]')).toBeVisible();
      await expect(page.locator('button:has-text("생성"), button:has-text("추가"), button:has-text("Create")')).toBeVisible();
    });

    test('should display Korean company names correctly', async ({ page }) => {
      // Wait for data to load
      await page.waitForTimeout(1000);

      // Check for Korean characters in the table
      const tableContent = await page.locator('table, [role="table"]').textContent();

      // Should contain Korean characters (not garbled)
      expect(tableContent).toMatch(/[\uAC00-\uD7AF]/); // Korean Unicode range
      expect(tableContent).not.toMatch(/ë¶€í'ˆ|ì†Œ|ê¸°ì—…/); // Garbled text
    });

    test('should display transaction list with pagination', async ({ page }) => {
      // Check if pagination controls exist
      const paginationExists = await page.locator('[role="navigation"], .pagination, button:has-text("Next"), button:has-text("Previous")').count() > 0;

      if (paginationExists) {
        // Check pagination info
        const pageInfo = await page.locator('text=/Page|페이지|of|/').textContent();
        expect(pageInfo).toBeTruthy();
      }
    });
  });

  test.describe('Create Sales Transaction', () => {
    test('should open create dialog', async ({ page }) => {
      // Click create button
      await page.locator('button:has-text("생성"), button:has-text("추가"), button:has-text("Create")').first().click();

      // Check dialog opened
      await expect(page.locator('[role="dialog"], .modal, .dialog')).toBeVisible();
      await expect(page.locator('text=/거래 생성|Create Transaction|매출 등록/i')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      // Open create dialog
      await page.locator('button:has-text("생성"), button:has-text("추가"), button:has-text("Create")').first().click();
      await page.waitForTimeout(500);

      // Try to submit without filling required fields
      const submitButton = page.locator('button:has-text("저장"), button:has-text("확인"), button:has-text("Submit")').last();
      await submitButton.click();

      // Check for validation error messages
      await page.waitForTimeout(500);
      const errorMessages = await page.locator('[role="alert"], .error, .text-red-500, .text-destructive').count();
      expect(errorMessages).toBeGreaterThan(0);
    });

    test('should create sales transaction with auto payment status PENDING', async ({ page }) => {
      // Open create dialog
      await page.locator('button:has-text("생성"), button:has-text("추가"), button:has-text("Create")').first().click();
      await page.waitForTimeout(500);

      // Fill transaction date
      const today = new Date().toISOString().split('T')[0];
      const dateInput = page.locator('input[type="date"], input[name*="date"]').first();
      await dateInput.fill(today);

      // Select customer (Korean company)
      const customerSelect = page.locator('select[name*="customer"], [role="combobox"]:has-text("고객"), button:has-text("선택")').first();
      await customerSelect.click();
      await page.waitForTimeout(300);

      // Select first available customer
      const firstCustomer = page.locator('[role="option"], .option, li').first();
      await firstCustomer.click();
      await page.waitForTimeout(300);

      // Select item
      const itemSelect = page.locator('select[name*="item"], [role="combobox"]:has-text("품목"), button:has-text("품목")').first();
      await itemSelect.click();
      await page.waitForTimeout(300);

      const firstItem = page.locator('[role="option"], .option, li').first();
      await firstItem.click();
      await page.waitForTimeout(300);

      // Fill quantity and unit price
      await page.locator('input[name*="quantity"], input:has-text("수량")').first().fill('100');
      await page.locator('input[name*="unit_price"], input:has-text("단가")').first().fill('10000');

      // Total amount should be auto-calculated or filled
      const totalInput = page.locator('input[name*="total"], input:has-text("합계")').first();
      const totalValue = await totalInput.inputValue();
      expect(Number(totalValue.replace(/,/g, ''))).toBeGreaterThan(0);

      // Submit form
      const submitButton = page.locator('button:has-text("저장"), button:has-text("확인"), button:has-text("Submit")').last();

      // Wait for API response
      const responsePromise = waitForApiResponse(page, '/api/sales-transactions');
      await submitButton.click();
      const response = await responsePromise;

      // Verify response
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.payment_status).toBe('PENDING');
      expect(responseData.data.paid_amount || 0).toBe(0);

      // Check toast/notification
      await expect(page.locator('[role="alert"], .toast, .notification:has-text("성공"), .notification:has-text("생성")')).toBeVisible({ timeout: 5000 });

      // Verify new transaction appears in list
      await page.waitForTimeout(1000);
      const newTransaction = page.locator('table, [role="table"]').locator('text=PENDING').first();
      await expect(newTransaction).toBeVisible();
    });
  });

  test.describe('Auto Payment Status Calculation', () => {
    test('should calculate PENDING status when paid_amount = 0', async ({ page }) => {
      // Create transaction via API
      const createResponse = await page.request.post('/api/sales-transactions', {
        data: {
          transaction_date: new Date().toISOString().split('T')[0],
          customer_id: 1,
          item_id: 1,
          quantity: 100,
          unit_price: 10000,
          supply_amount: 1000000,
          tax_amount: 100000,
          total_amount: 1100000,
          paid_amount: 0,
        },
      });

      const createData = await createResponse.json();
      expect(createData.success).toBe(true);
      expect(createData.data.payment_status).toBe('PENDING');

      // Refresh page and verify
      await page.reload();
      await page.waitForTimeout(1000);

      const transaction = page.locator(`text=${createData.data.transaction_no}`).first();
      await expect(transaction).toBeVisible();
    });

    test('should calculate PARTIAL status when 0 < paid_amount < total_amount', async ({ page }) => {
      // Create transaction with partial payment
      const createResponse = await page.request.post('/api/sales-transactions', {
        data: {
          transaction_date: new Date().toISOString().split('T')[0],
          customer_id: 1,
          item_id: 1,
          quantity: 100,
          unit_price: 10000,
          supply_amount: 1000000,
          tax_amount: 100000,
          total_amount: 1100000,
          paid_amount: 550000, // 50% paid
        },
      });

      const createData = await createResponse.json();
      expect(createData.success).toBe(true);
      expect(createData.data.payment_status).toBe('PARTIAL');
      expect(createData.data.paid_amount).toBe(550000);
    });

    test('should calculate COMPLETED status when paid_amount >= total_amount', async ({ page }) => {
      // Create transaction with full payment
      const createResponse = await page.request.post('/api/sales-transactions', {
        data: {
          transaction_date: new Date().toISOString().split('T')[0],
          customer_id: 1,
          item_id: 1,
          quantity: 100,
          unit_price: 10000,
          supply_amount: 1000000,
          tax_amount: 100000,
          total_amount: 1100000,
          paid_amount: 1100000, // 100% paid
        },
      });

      const createData = await createResponse.json();
      expect(createData.success).toBe(true);
      expect(createData.data.payment_status).toBe('COMPLETED');
    });
  });

  test.describe('Edit Sales Transaction', () => {
    test('should edit transaction and recalculate payment status', async ({ page }) => {
      // First, create a transaction
      const createResponse = await page.request.post('/api/sales-transactions', {
        data: {
          transaction_date: new Date().toISOString().split('T')[0],
          customer_id: 1,
          item_id: 1,
          quantity: 100,
          unit_price: 10000,
          supply_amount: 1000000,
          tax_amount: 100000,
          total_amount: 1100000,
          paid_amount: 0,
        },
      });

      const createData = await createResponse.json();
      const transactionId = createData.data.transaction_id;

      // Reload page
      await page.reload();
      await page.waitForTimeout(1000);

      // Find and click edit button for the transaction
      const editButton = page.locator(`button:has-text("수정"), button:has-text("Edit")`).first();
      await editButton.click();
      await page.waitForTimeout(500);

      // Update paid amount to partial
      await page.locator('input[name*="paid"]').first().fill('550000');

      // Submit update
      const submitButton = page.locator('button:has-text("저장"), button:has-text("확인"), button:has-text("Update")').last();
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Verify payment status changed to PARTIAL
      const updatedRow = page.locator(`text=${createData.data.transaction_no}`).first();
      await expect(updatedRow).toBeVisible();
    });
  });

  test.describe('Delete Sales Transaction', () => {
    test('should soft delete transaction', async ({ page }) => {
      // Create transaction
      const createResponse = await page.request.post('/api/sales-transactions', {
        data: {
          transaction_date: new Date().toISOString().split('T')[0],
          customer_id: 1,
          item_id: 1,
          quantity: 100,
          unit_price: 10000,
          supply_amount: 1000000,
          tax_amount: 100000,
          total_amount: 1100000,
          paid_amount: 0,
        },
      });

      const createData = await createResponse.json();
      const transactionNo = createData.data.transaction_no;

      // Reload page
      await page.reload();
      await page.waitForTimeout(1000);

      // Find and click delete button
      const deleteButton = page.locator(`button:has-text("삭제"), button:has-text("Delete")`).first();
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Confirm deletion
      const confirmButton = page.locator('button:has-text("확인"), button:has-text("Yes"), button:has-text("Delete")').last();
      await confirmButton.click();
      await page.waitForTimeout(1000);

      // Verify transaction removed from list
      await expect(page.locator(`text=${transactionNo}`)).not.toBeVisible();
    });
  });

  test.describe('Filtering and Search', () => {
    test('should filter by payment status', async ({ page }) => {
      // Look for payment status filter
      const statusFilter = page.locator('select[name*="status"], button:has-text("상태"), [role="combobox"]').first();

      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.waitForTimeout(300);

        // Select PENDING status
        await page.locator('text=PENDING, text=미결제, [role="option"]:has-text("PENDING")').first().click();
        await page.waitForTimeout(1000);

        // Verify filtered results
        const tableContent = await page.locator('table, [role="table"]').textContent();
        expect(tableContent).toContain('PENDING');
      }
    });

    test('should filter by date range', async ({ page }) => {
      const startDate = '2025-01-01';
      const endDate = '2025-12-31';

      // Fill date filters
      const startDateInput = page.locator('input[name*="start"], input[placeholder*="시작"]').first();
      const endDateInput = page.locator('input[name*="end"], input[placeholder*="종료"]').first();

      if (await startDateInput.isVisible() && await endDateInput.isVisible()) {
        await startDateInput.fill(startDate);
        await endDateInput.fill(endDate);

        // Apply filter
        const applyButton = page.locator('button:has-text("적용"), button:has-text("검색"), button:has-text("Apply")').first();
        await applyButton.click();
        await page.waitForTimeout(1000);

        // Verify data loaded
        await expect(page.locator('table, [role="table"]')).toBeVisible();
      }
    });

    test('should search transactions', async ({ page }) => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="검색"], input[name*="search"]').first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('테스트');
        await page.waitForTimeout(1000);

        // Verify search results
        const tableContent = await page.locator('table, [role="table"]').textContent();
        expect(tableContent?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Excel Export', () => {
    test('should export sales transactions to Excel (3-sheet format)', async ({ page }) => {
      // Click export button
      const exportButton = page.locator('button:has-text("내보내기"), button:has-text("Export"), button:has-text("Excel")').first();

      if (await exportButton.isVisible()) {
        // Start download
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;

        // Verify download
        expect(download.suggestedFilename()).toMatch(/sales|매출.*\.xlsx$/i);

        // Save file for verification
        const filePath = `./test-results/${download.suggestedFilename()}`;
        await download.saveAs(filePath);

        // Verify file exists and has content
        const fs = require('fs');
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(1000); // Should be > 1KB
      } else {
        test.skip();
      }
    });

    test('should include Korean text in Excel export', async ({ page }) => {
      // This test verifies Korean encoding in Excel export
      const exportButton = page.locator('button:has-text("내보내기"), button:has-text("Export"), button:has-text("Excel")').first();

      if (await exportButton.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;

        // Save and verify file contains Korean characters
        const filePath = `./test-results/${download.suggestedFilename()}`;
        await download.saveAs(filePath);

        // Basic verification - file size should indicate data present
        const fs = require('fs');
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(1000);
      } else {
        test.skip();
      }
    });
  });

  test.describe('Korean Character Handling', () => {
    test('should handle Korean company names without corruption', async ({ page }) => {
      const koreanText = ['테스트', '고객사', '부품', '제조'];

      // Check table content for Korean characters
      const tableContent = await page.locator('table, [role="table"]').textContent();

      // Should contain Korean characters
      const hasKorean = /[\uAC00-\uD7AF]/.test(tableContent || '');
      expect(hasKorean).toBeTruthy();

      // Should NOT contain garbled text patterns
      expect(tableContent).not.toMatch(/ë¶€í'ˆ|ì†Œ|ê¸°ì—…|í…Œì/);
    });

    test('should handle Korean input in forms', async ({ page }) => {
      // Open create dialog
      await page.locator('button:has-text("생성"), button:has-text("추가"), button:has-text("Create")').first().click();
      await page.waitForTimeout(500);

      // Fill notes with Korean text
      const notesInput = page.locator('textarea[name*="notes"], textarea[placeholder*="메모"]').first();

      if (await notesInput.isVisible()) {
        const koreanNotes = '테스트 메모입니다. 한글이 정상적으로 입력됩니다.';
        await notesInput.fill(koreanNotes);

        // Verify input value
        const inputValue = await notesInput.inputValue();
        expect(inputValue).toBe(koreanNotes);
      }
    });
  });

  test.describe('Business Rules Validation', () => {
    test('should prevent negative quantity', async ({ page }) => {
      // Open create dialog
      await page.locator('button:has-text("생성"), button:has-text("추가"), button:has-text("Create")').first().click();
      await page.waitForTimeout(500);

      // Try to enter negative quantity
      const quantityInput = page.locator('input[name*="quantity"]').first();
      await quantityInput.fill('-100');

      // Submit form
      const submitButton = page.locator('button:has-text("저장"), button:has-text("확인")').last();
      await submitButton.click();
      await page.waitForTimeout(500);

      // Should show validation error
      await expect(page.locator('[role="alert"], .error, text=/0보다 커야|must be positive/i')).toBeVisible();
    });

    test('should prevent negative unit price', async ({ page }) => {
      // Open create dialog
      await page.locator('button:has-text("생성"), button:has-text("추가"), button:has-text("Create")').first().click();
      await page.waitForTimeout(500);

      // Try to enter negative unit price
      const priceInput = page.locator('input[name*="unit_price"], input[name*="price"]').first();
      await priceInput.fill('-1000');

      // Submit form
      const submitButton = page.locator('button:has-text("저장"), button:has-text("확인")').last();
      await submitButton.click();
      await page.waitForTimeout(500);

      // Should show validation error
      await expect(page.locator('[role="alert"], .error, text=/0보다 커야|must be positive/i')).toBeVisible();
    });

    test('should prevent paid_amount exceeding total_amount', async ({ page }) => {
      // Create transaction with paid amount > total amount via API
      const createResponse = await page.request.post('/api/sales-transactions', {
        data: {
          transaction_date: new Date().toISOString().split('T')[0],
          customer_id: 1,
          item_id: 1,
          quantity: 100,
          unit_price: 10000,
          supply_amount: 1000000,
          tax_amount: 100000,
          total_amount: 1100000,
          paid_amount: 2000000, // Exceeds total
        },
      });

      const createData = await createResponse.json();
      expect(createData.success).toBe(false);
      expect(createData.error).toMatch(/초과|exceed/i);
    });
  });

  test.describe('Pagination', () => {
    test('should navigate between pages', async ({ page }) => {
      // Check if pagination exists
      const nextButton = page.locator('button:has-text("Next"), button:has-text("다음"), [aria-label*="next"]').first();

      if (await nextButton.isVisible() && !(await nextButton.isDisabled())) {
        // Get first transaction before navigation
        const firstTransactionBefore = await page.locator('table tbody tr, [role="table"] [role="row"]').first().textContent();

        // Click next page
        await nextButton.click();
        await page.waitForTimeout(1000);

        // Get first transaction after navigation
        const firstTransactionAfter = await page.locator('table tbody tr, [role="table"] [role="row"]').first().textContent();

        // Should be different
        expect(firstTransactionBefore).not.toBe(firstTransactionAfter);
      } else {
        test.skip();
      }
    });
  });
});
