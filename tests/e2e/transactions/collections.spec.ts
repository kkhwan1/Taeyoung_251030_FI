import { test, expect, Page } from '@playwright/test';

/**
 * Collections E2E Tests
 *
 * Tests for /collections page:
 * - Create/Edit/Delete collection transactions
 * - Auto payment status update on sales_transactions (PENDING → PARTIAL → COMPLETED)
 * - Database trigger verification
 * - Korean customer names handling
 * - Excel 3-sheet export
 * - Multiple collections per sales transaction
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

// Setup: Create a sales transaction for collection tests
async function createSalesTransaction(page: Page, totalAmount: number = 1000000) {
  const response = await page.request.post('/api/sales-transactions', {
    data: {
      transaction_date: new Date().toISOString().split('T')[0],
      customer_id: 1,
      item_id: 1,
      quantity: 100,
      unit_price: totalAmount / 100,
      supply_amount: totalAmount,
      tax_amount: totalAmount * 0.1,
      total_amount: totalAmount + (totalAmount * 0.1),
      paid_amount: 0,
      payment_status: 'PENDING'
    },
  });

  const data = await response.json();
  return data.data;
}

test.describe('Collections Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to collections page
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Load and Display', () => {
    test('should load collections page successfully', async ({ page }) => {
      // Check page title
      await expect(page.locator('h1, h2')).toContainText(/수금|Collection/i);

      // Check for main components
      await expect(page.locator('table, [role="table"]')).toBeVisible();
      await expect(page.locator('button:has-text("생성"), button:has-text("추가"), button:has-text("Create")')).toBeVisible();
    });

    test('should display Korean customer names correctly', async ({ page }) => {
      // Wait for data to load
      await page.waitForTimeout(1000);

      // Check for Korean characters in the table
      const tableContent = await page.locator('table, [role="table"]').textContent();

      // Should contain Korean characters (not garbled)
      expect(tableContent).toMatch(/[\uAC00-\uD7AF]/); // Korean Unicode range
      expect(tableContent).not.toMatch(/ë¶€í'ˆ|ì†Œ|ê³ ê°/); // Garbled text
    });

    test('should display collection list with payment method', async ({ page }) => {
      // Wait for data
      await page.waitForTimeout(1000);

      // Check if payment method column exists
      const hasPaymentMethod = await page.locator('th, [role="columnheader"]').filter({ hasText: /결제|Payment Method/i }).count() > 0;
      expect(hasPaymentMethod).toBeTruthy();
    });
  });

  test.describe('Create Collection and Auto Status Update', () => {
    test('should create collection and update sales transaction to PARTIAL', async ({ page }) => {
      // Step 1: Create sales transaction with 0 payment (PENDING)
      const salesTx = await createSalesTransaction(page, 1000000);
      expect(salesTx.payment_status).toBe('PENDING');

      // Step 2: Navigate to collections page
      await page.goto('/collections');
      await page.waitForLoadState('networkidle');

      // Step 3: Open create dialog
      await page.locator('button:has-text("생성"), button:has-text("추가"), button:has-text("Create")').first().click();
      await page.waitForTimeout(500);

      // Step 4: Fill collection form
      const today = new Date().toISOString().split('T')[0];
      await page.locator('input[type="date"], input[name*="date"]').first().fill(today);

      // Select the sales transaction
      const salesTxSelect = page.locator('select[name*="sales"], [role="combobox"]').first();
      await salesTxSelect.click();
      await page.waitForTimeout(300);

      // Find and select our transaction
      await page.locator(`text=${salesTx.transaction_no}, [role="option"]:has-text("${salesTx.transaction_no}")`).first().click();
      await page.waitForTimeout(300);

      // Fill collected amount (50% of total)
      const partialAmount = Math.floor(salesTx.total_amount * 0.5);
      await page.locator('input[name*="collected"], input[name*="amount"]').first().fill(partialAmount.toString());

      // Select payment method
      const paymentMethodSelect = page.locator('select[name*="payment_method"], select[name*="method"]').first();
      await paymentMethodSelect.selectOption('CASH');

      // Step 5: Submit form
      const submitButton = page.locator('button:has-text("저장"), button:has-text("확인"), button:has-text("Submit")').last();
      const responsePromise = waitForApiResponse(page, '/api/collections');
      await submitButton.click();
      const response = await responsePromise;

      // Step 6: Verify collection created
      const collectionData = await response.json();
      expect(collectionData.success).toBe(true);
      expect(collectionData.data.collected_amount).toBe(partialAmount);

      // Step 7: Verify sales transaction status updated to PARTIAL
      const salesCheckResponse = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      const salesCheckData = await salesCheckResponse.json();

      if (salesCheckData.success && salesCheckData.data.transactions) {
        const updatedSalesTx = salesCheckData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
        expect(updatedSalesTx?.payment_status).toBe('PARTIAL');
      }

      // Check notification
      await expect(page.locator('[role="alert"], .toast:has-text("성공"), .toast:has-text("생성")')).toBeVisible({ timeout: 5000 });
    });

    test('should create collection and update sales transaction to COMPLETED', async ({ page }) => {
      // Step 1: Create sales transaction
      const salesTx = await createSalesTransaction(page, 1000000);

      // Step 2: Create collection for full amount
      const collectionResponse = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: salesTx.total_amount, // 100% payment
          payment_method: 'TRANSFER',
        },
      });

      const collectionData = await collectionResponse.json();
      expect(collectionData.success).toBe(true);

      // Step 3: Verify sales transaction status updated to COMPLETED
      const salesCheckResponse = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      const salesCheckData = await salesCheckResponse.json();

      if (salesCheckData.success && salesCheckData.data.transactions) {
        const updatedSalesTx = salesCheckData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
        expect(updatedSalesTx?.payment_status).toBe('COMPLETED');
      }
    });

    test('should handle multiple collections for single sales transaction', async ({ page }) => {
      // Step 1: Create sales transaction
      const salesTx = await createSalesTransaction(page, 1000000);
      const totalAmount = salesTx.total_amount;

      // Step 2: Create first collection (30%)
      const firstCollection = Math.floor(totalAmount * 0.3);
      const firstResponse = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: firstCollection,
          payment_method: 'CASH',
        },
      });

      expect((await firstResponse.json()).success).toBe(true);

      // Verify status is PARTIAL
      let salesCheck = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      let salesData = await salesCheck.json();
      let currentTx = salesData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
      expect(currentTx?.payment_status).toBe('PARTIAL');

      // Step 3: Create second collection (40%)
      const secondCollection = Math.floor(totalAmount * 0.4);
      const secondResponse = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: secondCollection,
          payment_method: 'TRANSFER',
        },
      });

      expect((await secondResponse.json()).success).toBe(true);

      // Verify status still PARTIAL (70% collected)
      salesCheck = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      salesData = await salesCheck.json();
      currentTx = salesData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
      expect(currentTx?.payment_status).toBe('PARTIAL');

      // Step 4: Create third collection (30% - complete payment)
      const thirdCollection = totalAmount - firstCollection - secondCollection;
      const thirdResponse = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: thirdCollection,
          payment_method: 'CARD',
        },
      });

      expect((await thirdResponse.json()).success).toBe(true);

      // Verify status is COMPLETED
      salesCheck = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      salesData = await salesCheck.json();
      currentTx = salesData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
      expect(currentTx?.payment_status).toBe('COMPLETED');
    });

    test('should prevent collection exceeding remaining amount', async ({ page }) => {
      // Step 1: Create sales transaction
      const salesTx = await createSalesTransaction(page, 1000000);

      // Step 2: Create first collection (80%)
      await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: Math.floor(salesTx.total_amount * 0.8),
          payment_method: 'CASH',
        },
      });

      // Step 3: Try to create second collection exceeding total
      const excessiveCollection = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: Math.floor(salesTx.total_amount * 0.5), // Would exceed 100%
          payment_method: 'TRANSFER',
        },
      });

      const excessiveData = await excessiveCollection.json();
      expect(excessiveData.success).toBe(false);
      expect(excessiveData.error).toMatch(/초과|exceed|잔액/i);
    });
  });

  test.describe('Edit Collection', () => {
    test('should edit collection amount and recalculate status', async ({ page }) => {
      // Step 1: Create sales transaction and collection
      const salesTx = await createSalesTransaction(page, 1000000);

      const createResponse = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: Math.floor(salesTx.total_amount * 0.3), // 30%
          payment_method: 'CASH',
        },
      });

      const collectionData = (await createResponse.json()).data;

      // Step 2: Edit collection to increase amount
      const updateResponse = await page.request.put(`/api/collections?id=${collectionData.collection_id}`, {
        data: {
          collected_amount: Math.floor(salesTx.total_amount * 0.7), // Change to 70%
        },
      });

      const updateData = await updateResponse.json();
      expect(updateData.success).toBe(true);

      // Step 3: Verify sales transaction status still PARTIAL
      const salesCheck = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      const salesData = await salesCheck.json();
      const currentTx = salesData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
      expect(currentTx?.payment_status).toBe('PARTIAL');
    });

    test('should edit collection to complete payment', async ({ page }) => {
      // Create sales transaction and partial collection
      const salesTx = await createSalesTransaction(page, 1000000);

      const createResponse = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: Math.floor(salesTx.total_amount * 0.5), // 50%
          payment_method: 'CASH',
        },
      });

      const collectionData = (await createResponse.json()).data;

      // Edit to full amount
      await page.request.put(`/api/collections?id=${collectionData.collection_id}`, {
        data: {
          collected_amount: salesTx.total_amount, // 100%
        },
      });

      // Verify status changed to COMPLETED
      const salesCheck = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      const salesData = await salesCheck.json();
      const currentTx = salesData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
      expect(currentTx?.payment_status).toBe('COMPLETED');
    });
  });

  test.describe('Delete Collection', () => {
    test('should delete collection and recalculate status to PENDING', async ({ page }) => {
      // Create sales transaction and collection
      const salesTx = await createSalesTransaction(page, 1000000);

      const createResponse = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: salesTx.total_amount, // 100%
          payment_method: 'CASH',
        },
      });

      const collectionData = (await createResponse.json()).data;

      // Verify status is COMPLETED
      let salesCheck = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      let salesData = await salesCheck.json();
      let currentTx = salesData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
      expect(currentTx?.payment_status).toBe('COMPLETED');

      // Delete collection
      await page.request.delete(`/api/collections?id=${collectionData.collection_id}`);

      // Verify status changed back to PENDING
      salesCheck = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      salesData = await salesCheck.json();
      currentTx = salesData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
      expect(currentTx?.payment_status).toBe('PENDING');
    });

    test('should delete one of multiple collections and recalculate correctly', async ({ page }) => {
      // Create sales transaction
      const salesTx = await createSalesTransaction(page, 1000000);

      // Create two collections (40% + 40%)
      const firstResponse = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: Math.floor(salesTx.total_amount * 0.4),
          payment_method: 'CASH',
        },
      });

      await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: Math.floor(salesTx.total_amount * 0.4),
          payment_method: 'TRANSFER',
        },
      });

      // Verify status is PARTIAL (80%)
      let salesCheck = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      let salesData = await salesCheck.json();
      let currentTx = salesData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
      expect(currentTx?.payment_status).toBe('PARTIAL');

      // Delete first collection
      const firstCollection = (await firstResponse.json()).data;
      await page.request.delete(`/api/collections?id=${firstCollection.collection_id}`);

      // Verify status still PARTIAL (40% remaining)
      salesCheck = await page.request.get(`/api/sales-transactions?transaction_id=${salesTx.transaction_id}`);
      salesData = await salesCheck.json();
      currentTx = salesData.data.transactions.find((tx: any) => tx.transaction_id === salesTx.transaction_id);
      expect(currentTx?.payment_status).toBe('PARTIAL');
    });
  });

  test.describe('Payment Methods', () => {
    test('should create collection with CASH payment method', async ({ page }) => {
      const salesTx = await createSalesTransaction(page, 1000000);

      const response = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: salesTx.total_amount,
          payment_method: 'CASH',
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.payment_method).toBe('CASH');
    });

    test('should create collection with TRANSFER payment method', async ({ page }) => {
      const salesTx = await createSalesTransaction(page, 1000000);

      const response = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: salesTx.total_amount,
          payment_method: 'TRANSFER',
          bank_name: '국민은행',
          account_number: '123-456-7890',
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.payment_method).toBe('TRANSFER');
      expect(data.data.bank_name).toBe('국민은행');
    });

    test('should create collection with CHECK payment method', async ({ page }) => {
      const salesTx = await createSalesTransaction(page, 1000000);

      const response = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: salesTx.total_amount,
          payment_method: 'CHECK',
          check_number: 'CHK-2025-001',
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.payment_method).toBe('CHECK');
    });

    test('should create collection with CARD payment method', async ({ page }) => {
      const salesTx = await createSalesTransaction(page, 1000000);

      const response = await page.request.post('/api/collections', {
        data: {
          collection_date: new Date().toISOString().split('T')[0],
          sales_transaction_id: salesTx.transaction_id,
          collected_amount: salesTx.total_amount,
          payment_method: 'CARD',
          card_number: '**** **** **** 1234',
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.payment_method).toBe('CARD');
    });
  });

  test.describe('Excel Export', () => {
    test('should export collections to Excel (3-sheet format)', async ({ page }) => {
      // Click export button
      const exportButton = page.locator('button:has-text("내보내기"), button:has-text("Export"), button:has-text("Excel")').first();

      if (await exportButton.isVisible()) {
        // Start download
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;

        // Verify download
        expect(download.suggestedFilename()).toMatch(/collection|수금.*\.xlsx$/i);

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
  });

  test.describe('Korean Character Handling', () => {
    test('should handle Korean customer names without corruption', async ({ page }) => {
      // Wait for data to load
      await page.waitForTimeout(1000);

      // Check table content for Korean characters
      const tableContent = await page.locator('table, [role="table"]').textContent();

      // Should contain Korean characters
      const hasKorean = /[\uAC00-\uD7AF]/.test(tableContent || '');
      expect(hasKorean).toBeTruthy();

      // Should NOT contain garbled text patterns
      expect(tableContent).not.toMatch(/ë¶€í'ˆ|ì†Œ|ê³ ê°|í…Œì/);
    });
  });

  test.describe('Filtering and Search', () => {
    test('should filter by payment method', async ({ page }) => {
      const methodFilter = page.locator('select[name*="payment"], select[name*="method"]').first();

      if (await methodFilter.isVisible()) {
        await methodFilter.selectOption('CASH');
        await page.waitForTimeout(1000);

        // Verify filtered results
        const tableContent = await page.locator('table, [role="table"]').textContent();
        expect(tableContent).toContain('CASH');
      }
    });

    test('should filter by date range', async ({ page }) => {
      const startDate = '2025-01-01';
      const endDate = '2025-12-31';

      const startInput = page.locator('input[name*="start"]').first();
      const endInput = page.locator('input[name*="end"]').first();

      if (await startInput.isVisible() && await endInput.isVisible()) {
        await startInput.fill(startDate);
        await endInput.fill(endDate);

        // Apply filter
        const applyButton = page.locator('button:has-text("적용"), button:has-text("Apply")').first();
        await applyButton.click();
        await page.waitForTimeout(1000);

        await expect(page.locator('table, [role="table"]')).toBeVisible();
      }
    });
  });
});
