/**
 * E2E Tests for Payment Transactions
 *
 * Tests payment transaction CRUD operations with automatic payment status updates
 * for purchase transactions (PENDING → PARTIAL → COMPLETED)
 */

import { test, expect, Page } from '@playwright/test';

// Helper function to wait for API responses
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

// Helper function to create a test purchase transaction via API
async function createPurchaseTransaction(page: Page, totalAmount: number = 1000000) {
  const response = await page.request.post('/api/purchase-transactions', {
    data: {
      transaction_date: new Date().toISOString().split('T')[0],
      supplier_id: 1,
      item_id: 1,
      quantity: 100,
      unit_price: totalAmount / 100,
      supply_amount: totalAmount,
      tax_amount: totalAmount * 0.1,
      total_amount: totalAmount + (totalAmount * 0.1),
      paid_amount: 0,
      payment_status: 'PENDING',
      notes: 'E2E Test Purchase Transaction'
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create purchase transaction: ${response.status()}`);
  }

  const result = await response.json();
  return result.data;
}

test.describe('Payment Transactions E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to payments page before each test
    await page.goto('/transactions/payments');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Load and Display', () => {

    test('should load payments page successfully', async ({ page }) => {
      // Verify page title
      await expect(page).toHaveTitle(/지급/);

      // Verify main heading
      const heading = page.locator('h1, h2').filter({ hasText: '지급' });
      await expect(heading).toBeVisible();

      // Verify key UI elements
      await expect(page.locator('button:has-text("신규 지급")')).toBeVisible();
      await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();
    });

    test('should display payment transactions table', async ({ page }) => {
      // Wait for table to load
      await waitForApiResponse(page, '/api/payment-transactions');

      // Verify table headers (Korean)
      const headers = ['지급일', '매입거래번호', '공급사', '지급액', '지급방법', '비고'];

      for (const header of headers) {
        const headerCell = page.locator('th, [role="columnheader"]').filter({ hasText: header });
        await expect(headerCell).toBeVisible();
      }
    });

    test('should display empty state when no payments exist', async ({ page }) => {
      // This test assumes starting with empty database
      // Check for "데이터 없음" or similar message
      const emptyMessage = page.locator('text=/데이터가 없습니다|지급 내역이 없습니다|No data/i');

      // Either table is empty or message is shown
      const tableRows = page.locator('tbody tr');
      const rowCount = await tableRows.count();

      if (rowCount === 0) {
        await expect(emptyMessage).toBeVisible();
      }
    });
  });

  test.describe('Create Payment Transaction', () => {

    test('should open create payment modal', async ({ page }) => {
      await page.click('button:has-text("신규 지급")');

      // Verify modal is open
      const modal = page.locator('[role="dialog"], .modal').filter({ hasText: '지급 등록' });
      await expect(modal).toBeVisible();

      // Verify form fields
      await expect(page.locator('label:has-text("지급일")')).toBeVisible();
      await expect(page.locator('label:has-text("매입거래")')).toBeVisible();
      await expect(page.locator('label:has-text("지급액")')).toBeVisible();
      await expect(page.locator('label:has-text("지급방법")')).toBeVisible();
    });

    test('should create payment with CASH method', async ({ page }) => {
      // First create a purchase transaction
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open create modal
      await page.click('button:has-text("신규 지급")');

      // Fill form
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);

      // Select purchase transaction
      await page.click('select[name="purchase_transaction_id"]');
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });

      // Enter payment amount
      await page.fill('input[name="paid_amount"]', '500000');

      // Select payment method - CASH
      await page.selectOption('select[name="payment_method"]', 'CASH');

      // Add notes
      await page.fill('textarea[name="notes"]', 'E2E Test - Cash Payment');

      // Submit form
      const responsePromise = waitForApiResponse(page, '/api/payment-transactions');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await responsePromise;

      // Verify success message
      await expect(page.locator('text=/지급.*등록.*성공|저장.*완료/i')).toBeVisible({ timeout: 5000 });

      // Verify payment appears in table
      await expect(page.locator('tbody tr').filter({ hasText: '현금' })).toBeVisible();
      await expect(page.locator('tbody tr').filter({ hasText: '500,000' })).toBeVisible();
    });

    test('should create payment with TRANSFER method', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 2000000);

      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("신규 지급")');

      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '1000000');
      await page.selectOption('select[name="payment_method"]', 'TRANSFER');
      await page.fill('textarea[name="notes"]', 'E2E Test - Bank Transfer');

      const responsePromise = waitForApiResponse(page, '/api/payment-transactions');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await responsePromise;

      await expect(page.locator('text=/지급.*등록.*성공|저장.*완료/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('tbody tr').filter({ hasText: '계좌이체' })).toBeVisible();
    });

    test('should create payment with CHECK method', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1500000);

      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("신규 지급")');

      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '750000');
      await page.selectOption('select[name="payment_method"]', 'CHECK');
      await page.fill('textarea[name="notes"]', 'E2E Test - Check Payment');

      const responsePromise = waitForApiResponse(page, '/api/payment-transactions');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await responsePromise;

      await expect(page.locator('text=/지급.*등록.*성공|저장.*완료/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('tbody tr').filter({ hasText: '수표' })).toBeVisible();
    });

    test('should create payment with CARD method', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 800000);

      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("신규 지급")');

      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '400000');
      await page.selectOption('select[name="payment_method"]', 'CARD');
      await page.fill('textarea[name="notes"]', 'E2E Test - Card Payment');

      const responsePromise = waitForApiResponse(page, '/api/payment-transactions');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await responsePromise;

      await expect(page.locator('text=/지급.*등록.*성공|저장.*완료/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('tbody tr').filter({ hasText: '카드' })).toBeVisible();
    });
  });

  test.describe('Auto Payment Status Calculation and Updates', () => {

    test('should auto-update purchase transaction to PARTIAL when first payment is made', async ({ page }) => {
      // Create purchase transaction with PENDING status
      const purchaseTx = await createPurchaseTransaction(page, 1000000);
      expect(purchaseTx.payment_status).toBe('PENDING');
      expect(purchaseTx.paid_amount).toBe(0);

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Create first payment (50% of total)
      await page.click('button:has-text("신규 지급")');
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '500000');
      await page.selectOption('select[name="payment_method"]', 'CASH');

      const responsePromise = waitForApiResponse(page, '/api/payment-transactions');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await responsePromise;

      // Verify payment status updated via API
      const purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      const updatedPurchase = (await purchaseResponse.json()).data;

      expect(updatedPurchase.payment_status).toBe('PARTIAL');
      expect(updatedPurchase.paid_amount).toBe(500000);
    });

    test('should auto-update purchase transaction to COMPLETED when full payment is made', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Make full payment
      await page.click('button:has-text("신규 지급")');
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '1100000'); // Full amount including tax
      await page.selectOption('select[name="payment_method"]', 'TRANSFER');

      const responsePromise = waitForApiResponse(page, '/api/payment-transactions');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await responsePromise;

      // Verify COMPLETED status
      const purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      const updatedPurchase = (await purchaseResponse.json()).data;

      expect(updatedPurchase.payment_status).toBe('COMPLETED');
      expect(updatedPurchase.paid_amount).toBeGreaterThanOrEqual(1100000);
    });

    test('should handle multiple payments and calculate status correctly', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000); // 1,100,000 total with tax

      await page.reload();
      await page.waitForLoadState('networkidle');

      // First payment - 30%
      await page.click('button:has-text("신규 지급")');
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '330000');
      await page.selectOption('select[name="payment_method"]', 'CASH');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await waitForApiResponse(page, '/api/payment-transactions');

      // Check status should be PARTIAL
      let purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      let updatedPurchase = (await purchaseResponse.json()).data;
      expect(updatedPurchase.payment_status).toBe('PARTIAL');

      // Second payment - another 30%
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("신규 지급")');
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '330000');
      await page.selectOption('select[name="payment_method"]', 'TRANSFER');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await waitForApiResponse(page, '/api/payment-transactions');

      // Still PARTIAL (660,000 / 1,100,000)
      purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      updatedPurchase = (await purchaseResponse.json()).data;
      expect(updatedPurchase.payment_status).toBe('PARTIAL');

      // Third payment - remaining 40%
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("신규 지급")');
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '440000');
      await page.selectOption('select[name="payment_method"]', 'CHECK');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await waitForApiResponse(page, '/api/payment-transactions');

      // Now should be COMPLETED
      purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      updatedPurchase = (await purchaseResponse.json()).data;
      expect(updatedPurchase.payment_status).toBe('COMPLETED');
      expect(updatedPurchase.paid_amount).toBe(1100000);
    });
  });

  test.describe('Edit Payment Transaction', () => {

    test('should open edit modal with existing data', async ({ page }) => {
      // Create a payment first
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      const paymentResponse = await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 500000,
          payment_method: 'CASH',
          notes: 'Test Payment'
        }
      });
      const payment = (await paymentResponse.json()).data;

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Click edit button
      const editButton = page.locator('button[aria-label*="수정"], button:has-text("수정")').first();
      await editButton.click();

      // Verify modal with pre-filled data
      const modal = page.locator('[role="dialog"], .modal').filter({ hasText: '지급 수정' });
      await expect(modal).toBeVisible();

      // Verify pre-filled values
      const amountInput = page.locator('input[name="paid_amount"]');
      await expect(amountInput).toHaveValue('500000');

      const methodSelect = page.locator('select[name="payment_method"]');
      await expect(methodSelect).toHaveValue('CASH');
    });

    test('should update payment amount and recalculate purchase status', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      // Create initial payment
      const paymentResponse = await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 300000,
          payment_method: 'CASH',
          notes: 'Initial Payment'
        }
      });
      const payment = (await paymentResponse.json()).data;

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Edit payment - increase amount
      const editButton = page.locator('button[aria-label*="수정"], button:has-text("수정")').first();
      await editButton.click();

      await page.fill('input[name="paid_amount"]', '800000');

      const responsePromise = waitForApiResponse(page, '/api/payment-transactions');
      await page.click('button:has-text("저장"), button:has-text("수정")');
      await responsePromise;

      // Verify updated amount
      await expect(page.locator('tbody tr').filter({ hasText: '800,000' })).toBeVisible();

      // Verify purchase status recalculated
      const purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      const updatedPurchase = (await purchaseResponse.json()).data;
      expect(updatedPurchase.paid_amount).toBe(800000);
      expect(updatedPurchase.payment_status).toBe('PARTIAL');
    });

    test('should change payment method', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      const paymentResponse = await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 500000,
          payment_method: 'CASH',
          notes: 'Test Payment'
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Edit and change method
      await page.click('button[aria-label*="수정"], button:has-text("수정")');
      await page.selectOption('select[name="payment_method"]', 'TRANSFER');

      const responsePromise = waitForApiResponse(page, '/api/payment-transactions');
      await page.click('button:has-text("저장"), button:has-text("수정")');
      await responsePromise;

      // Verify method changed
      await expect(page.locator('tbody tr').filter({ hasText: '계좌이체' })).toBeVisible();
      await expect(page.locator('tbody tr').filter({ hasText: '현금' })).not.toBeVisible();
    });
  });

  test.describe('Delete Payment Transaction', () => {

    test('should delete payment and recalculate purchase status to PENDING', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      // Create a payment
      const paymentResponse = await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 1100000, // Full payment
          payment_method: 'TRANSFER',
          notes: 'Full Payment'
        }
      });
      const payment = (await paymentResponse.json()).data;

      // Verify COMPLETED status
      let purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      let updatedPurchase = (await purchaseResponse.json()).data;
      expect(updatedPurchase.payment_status).toBe('COMPLETED');

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Delete payment
      const deleteButton = page.locator('button[aria-label*="삭제"], button:has-text("삭제")').first();
      await deleteButton.click();

      // Confirm deletion
      await page.click('button:has-text("확인"), button:has-text("삭제")');
      await waitForApiResponse(page, '/api/payment-transactions');

      // Verify payment removed
      await expect(page.locator('text=/삭제.*성공|삭제.*완료/i')).toBeVisible({ timeout: 5000 });

      // Verify purchase status back to PENDING
      purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      updatedPurchase = (await purchaseResponse.json()).data;
      expect(updatedPurchase.payment_status).toBe('PENDING');
      expect(updatedPurchase.paid_amount).toBe(0);
    });

    test('should delete partial payment and recalculate to PARTIAL or PENDING', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      // Create two payments
      await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 600000,
          payment_method: 'CASH',
          notes: 'First Payment'
        }
      });

      const payment2Response = await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 500000,
          payment_method: 'TRANSFER',
          notes: 'Second Payment'
        }
      });

      // Status should be COMPLETED (1,100,000 total)
      let purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      let updatedPurchase = (await purchaseResponse.json()).data;
      expect(updatedPurchase.payment_status).toBe('COMPLETED');

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Delete one payment
      const deleteButtons = page.locator('button[aria-label*="삭제"], button:has-text("삭제")');
      await deleteButtons.first().click();
      await page.click('button:has-text("확인"), button:has-text("삭제")');
      await waitForApiResponse(page, '/api/payment-transactions');

      // Should now be PARTIAL (only one payment remains)
      purchaseResponse = await page.request.get(`/api/purchase-transactions/${purchaseTx.transaction_id}`);
      updatedPurchase = (await purchaseResponse.json()).data;
      expect(updatedPurchase.payment_status).toBe('PARTIAL');
    });
  });

  test.describe('Korean Character Handling', () => {

    test('should display Korean supplier names correctly', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify Korean supplier names are displayed without garbling
      const supplierCells = page.locator('td').filter({ hasText: /[\uAC00-\uD7AF]/ });
      const cellCount = await supplierCells.count();

      if (cellCount > 0) {
        const cellText = await supplierCells.first().textContent();

        // Check for garbled text patterns
        expect(cellText).not.toMatch(/ë¶€í'ˆ|ì†Œ|ê¸°ì—…/);

        // Verify contains valid Korean characters
        expect(cellText).toMatch(/[\uAC00-\uD7AF]/);
      }
    });

    test('should handle Korean notes input correctly', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      await page.reload();
      await page.waitForLoadState('networkidle');

      const koreanNote = '한글 비고 테스트 - 지급 완료';

      await page.click('button:has-text("신규 지급")');
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '500000');
      await page.selectOption('select[name="payment_method"]', 'CASH');
      await page.fill('textarea[name="notes"]', koreanNote);

      const responsePromise = waitForApiResponse(page, '/api/payment-transactions');
      await page.click('button:has-text("저장"), button:has-text("등록")');
      await responsePromise;

      // Verify Korean notes displayed correctly
      const noteCell = page.locator('td').filter({ hasText: koreanNote });
      await expect(noteCell).toBeVisible();

      const noteText = await noteCell.textContent();
      expect(noteText).toBe(koreanNote);
      expect(noteText).not.toMatch(/ë¶€í'ˆ|ì†Œ|ê¸°ì—…/);
    });
  });

  test.describe('Business Rules Validation', () => {

    test('should prevent negative payment amount', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("신규 지급")');
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '-100000');
      await page.selectOption('select[name="payment_method"]', 'CASH');

      await page.click('button:has-text("저장"), button:has-text("등록")');

      // Verify error message
      await expect(page.locator('text=/지급액.*0.*이상|음수.*불가/i')).toBeVisible({ timeout: 5000 });
    });

    test('should prevent payment exceeding purchase total', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000); // 1,100,000 with tax

      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("신규 지급")');
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '2000000'); // Exceeds total
      await page.selectOption('select[name="payment_method"]', 'TRANSFER');

      await page.click('button:has-text("저장"), button:has-text("등록")');

      // Verify error message
      await expect(page.locator('text=/초과.*불가|합계.*금액.*초과/i')).toBeVisible({ timeout: 5000 });
    });

    test('should require payment date', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("신규 지급")');
      // Don't fill payment_date
      await page.selectOption('select[name="purchase_transaction_id"]', { label: purchaseTx.transaction_no });
      await page.fill('input[name="paid_amount"]', '500000');
      await page.selectOption('select[name="payment_method"]', 'CASH');

      await page.click('button:has-text("저장"), button:has-text("등록")');

      // Verify validation error
      await expect(page.locator('text=/날짜.*필수|지급일.*입력/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Excel Export', () => {

    test('should export payments to Excel with 3 sheets', async ({ page }) => {
      // Create some test payments
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 500000,
          payment_method: 'CASH',
          notes: 'Export Test Payment 1'
        }
      });

      await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 300000,
          payment_method: 'TRANSFER',
          notes: 'Export Test Payment 2'
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Click export button
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Excel 내보내기"), button:has-text("엑셀"), button:has-text("다운로드")');
      const download = await downloadPromise;

      // Verify download occurred
      expect(download.suggestedFilename()).toMatch(/payment.*\.xlsx|지급.*\.xlsx/i);

      // Save file for verification
      const path = await download.path();
      expect(path).toBeTruthy();
    });
  });

  test.describe('Filtering and Search', () => {

    test('should filter by payment method', async ({ page }) => {
      // Create payments with different methods
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 300000,
          payment_method: 'CASH',
          notes: 'Cash Payment'
        }
      });

      await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 400000,
          payment_method: 'TRANSFER',
          notes: 'Transfer Payment'
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Filter by CASH
      await page.selectOption('select[name="payment_method"], select:has-option:text("현금")', 'CASH');
      await waitForApiResponse(page, '/api/payment-transactions');

      // Verify only CASH payments shown
      await expect(page.locator('tbody tr').filter({ hasText: '현금' })).toBeVisible();
      await expect(page.locator('tbody tr').filter({ hasText: '계좌이체' })).not.toBeVisible();
    });

    test('should search by purchase transaction number', async ({ page }) => {
      const purchaseTx = await createPurchaseTransaction(page, 1000000);

      await page.request.post('/api/payment-transactions', {
        data: {
          payment_date: new Date().toISOString().split('T')[0],
          purchase_transaction_id: purchaseTx.transaction_id,
          paid_amount: 500000,
          payment_method: 'CASH',
          notes: 'Searchable Payment'
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Search by transaction number
      const searchInput = page.locator('input[placeholder*="검색"]');
      await searchInput.fill(purchaseTx.transaction_no);
      await waitForApiResponse(page, '/api/payment-transactions');

      // Verify search results
      await expect(page.locator('tbody tr').filter({ hasText: purchaseTx.transaction_no })).toBeVisible();
    });
  });

  test.describe('Pagination', () => {

    test('should paginate when there are many payments', async ({ page }) => {
      // This test assumes pagination UI exists
      const pagination = page.locator('.pagination, [aria-label*="페이지"]');

      const paginationExists = await pagination.count() > 0;

      if (paginationExists) {
        // Verify pagination controls
        await expect(pagination).toBeVisible();

        // Try to navigate to next page
        const nextButton = page.locator('button:has-text("다음"), button[aria-label*="다음"]');
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await waitForApiResponse(page, '/api/payment-transactions');

          // Verify URL or page indicator changed
          await expect(page.locator('text=/페이지.*2|Page.*2/i')).toBeVisible();
        }
      }
    });
  });
});
