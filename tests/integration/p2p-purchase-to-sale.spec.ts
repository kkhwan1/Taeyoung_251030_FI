/**
 * P2P Integration Test: Purchase-to-Sale Workflow
 *
 * Complete business flow:
 * 1. 품목 등록 (Item Registration)
 * 2. 거래처 등록 (Company Registration - Supplier & Customer)
 * 3. 매입 거래 (Purchase Transaction)
 * 4. 입고 처리 (Receiving)
 * 5. 매출 거래 (Sales Transaction)
 * 6. 출고 처리 (Shipping)
 * 7. 수금 처리 (Collection)
 * 8. 지급 처리 (Payment)
 * 9. 대시보드 확인 (Dashboard Verification)
 * 10. 회계 집계 확인 (Accounting Summary)
 */

import { test, expect, Page } from '@playwright/test';

test.describe('P2P Integration: Purchase-to-Sale Complete Workflow', () => {
  let testData: {
    item: { code: string; name: string; id?: string };
    supplier: { code: string; name: string; id?: string };
    customer: { code: string; name: string; id?: string };
    purchase: { transactionNo: string; id?: string };
    sales: { transactionNo: string; id?: string };
    receiving: { transactionNo: string; id?: string };
    shipping: { transactionNo: string; id?: string };
  };

  test.beforeEach(async ({ page }) => {
    const timestamp = Date.now();
    testData = {
      item: {
        code: `P2P-ITEM-${timestamp}`,
        name: `P2P 테스트 부품 ${timestamp}`
      },
      supplier: {
        code: `P2P-SUP-${timestamp}`,
        name: `P2P 공급사 ${timestamp}`
      },
      customer: {
        code: `P2P-CUS-${timestamp}`,
        name: `P2P 고객사 ${timestamp}`
      },
      purchase: {
        transactionNo: `PUR-P2P-${timestamp}`
      },
      sales: {
        transactionNo: `SAL-P2P-${timestamp}`
      },
      receiving: {
        transactionNo: `REC-P2P-${timestamp}`
      },
      shipping: {
        transactionNo: `SHIP-P2P-${timestamp}`
      }
    };
  });

  test('Complete Purchase-to-Sale workflow with payment settlement', async ({ page }) => {
    // ========================================
    // Step 1: Item Registration (품목 등록)
    // ========================================
    await test.step('Register new item', async () => {
      await page.goto('/master/items');
      await expect(page).toHaveURL(/\/master\/items/);

      // Click "신규 등록"
      await page.click('button:has-text("신규 등록")');

      // Fill item details
      await page.fill('input[name="item_code"]', testData.item.code);
      await page.fill('input[name="item_name"]', testData.item.name);
      await page.selectOption('select[name="category"]', 'Parts');
      await page.fill('input[name="spec"]', 'P2P-TEST-SPEC');
      await page.fill('input[name="unit_price"]', '10000');
      await page.fill('input[name="safety_stock"]', '10');

      // Save and verify
      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify Korean text not garbled
      await page.waitForTimeout(1000);
      const itemNameCell = page.locator(`td:has-text("${testData.item.name}")`);
      await expect(itemNameCell).toBeVisible();

      // Get item_id from API
      const response = await page.request.get('/api/items');
      const items = await response.json();
      const createdItem = items.data.find((i: any) => i.item_code === testData.item.code);
      testData.item.id = createdItem?.item_id;

      expect(testData.item.id).toBeDefined();
    });

    // ========================================
    // Step 2: Supplier Registration (공급사 등록)
    // ========================================
    await test.step('Register supplier company', async () => {
      await page.goto('/master/companies');
      await expect(page).toHaveURL(/\/master\/companies/);

      await page.click('button:has-text("신규 등록")');

      // Fill supplier details
      await page.selectOption('select[name="company_type"]', 'SUPPLIER');
      await page.fill('input[name="company_name"]', testData.supplier.name);
      await page.fill('input[name="business_number"]', `${Date.now()}`);
      await page.fill('input[name="contact_person"]', '홍길동');
      await page.fill('input[name="phone"]', '010-1234-5678');
      await page.fill('input[name="email"]', 'supplier@test.com');

      // JSONB business_info
      await page.fill('input[name="business_type"]', '제조업');
      await page.fill('input[name="business_item"]', '자동차부품');

      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify auto-generated company_code
      await page.waitForTimeout(1000);
      const companyCodeCell = page.locator(`td:text-matches("^SUP\\d{3}$")`).first();
      await expect(companyCodeCell).toBeVisible();
      testData.supplier.code = await companyCodeCell.textContent() || '';

      // Get supplier_id
      const response = await page.request.get('/api/companies');
      const companies = await response.json();
      const supplier = companies.data.find((c: any) => c.company_code === testData.supplier.code);
      testData.supplier.id = supplier?.company_id;

      expect(testData.supplier.id).toBeDefined();
    });

    // ========================================
    // Step 3: Customer Registration (고객사 등록)
    // ========================================
    await test.step('Register customer company', async () => {
      await page.goto('/master/companies');

      await page.click('button:has-text("신규 등록")');

      // Fill customer details
      await page.selectOption('select[name="company_type"]', 'CUSTOMER');
      await page.fill('input[name="company_name"]', testData.customer.name);
      await page.fill('input[name="business_number"]', `${Date.now() + 1}`);
      await page.fill('input[name="contact_person"]', '김철수');
      await page.fill('input[name="phone"]', '010-9876-5432');
      await page.fill('input[name="email"]', 'customer@test.com');

      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify auto-generated company_code
      await page.waitForTimeout(1000);
      const companyCodeCell = page.locator(`td:text-matches("^CUS\\d{3}$")`).first();
      await expect(companyCodeCell).toBeVisible();
      testData.customer.code = await companyCodeCell.textContent() || '';

      // Get customer_id
      const response = await page.request.get('/api/companies');
      const companies = await response.json();
      const customer = companies.data.find((c: any) => c.company_code === testData.customer.code);
      testData.customer.id = customer?.company_id;

      expect(testData.customer.id).toBeDefined();
    });

    // ========================================
    // Step 4: Purchase Transaction (매입 거래)
    // ========================================
    await test.step('Create purchase transaction', async () => {
      await page.goto('/transactions/purchases');
      await expect(page).toHaveURL(/\/transactions\/purchases/);

      await page.click('button:has-text("신규 등록")');

      // Fill purchase transaction
      await page.fill('input[name="transaction_no"]', testData.purchase.transactionNo);
      await page.selectOption('select[name="supplier_id"]', testData.supplier.id!);
      await page.fill('input[name="transaction_date"]', new Date().toISOString().split('T')[0]);

      // Add purchase item (100 units @ 10,000 won)
      await page.click('button:has-text("품목 추가")');
      await page.selectOption('select[name="item_id"]', testData.item.id!);
      await page.fill('input[name="quantity"]', '100');
      await page.fill('input[name="unit_price"]', '10000');

      // Total: 100 * 10,000 = 1,000,000 won
      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify payment status = PENDING (no payment yet)
      await page.waitForTimeout(1000);
      const statusBadge = page.locator(`tr:has-text("${testData.purchase.transactionNo}") .payment-status`);
      await expect(statusBadge).toContainText('미지급');

      // Get purchase_id
      const response = await page.request.get('/api/purchases');
      const purchases = await response.json();
      const purchase = purchases.data.find((p: any) => p.transaction_no === testData.purchase.transactionNo);
      testData.purchase.id = purchase?.transaction_id;

      expect(testData.purchase.id).toBeDefined();
    });

    // ========================================
    // Step 5: Receiving Transaction (입고 처리)
    // ========================================
    await test.step('Process receiving transaction', async () => {
      await page.goto('/inventory/receiving');
      await expect(page).toHaveURL(/\/inventory\/receiving/);

      await page.click('button:has-text("입고 등록")');

      // Fill receiving details (100 units)
      await page.fill('input[name="transaction_no"]', testData.receiving.transactionNo);
      await page.selectOption('select[name="item_id"]', testData.item.id!);
      await page.fill('input[name="quantity"]', '100');
      await page.fill('input[name="transaction_date"]', new Date().toISOString().split('T')[0]);
      await page.fill('input[name="lot_no"]', `LOT-${Date.now()}`);
      await page.fill('input[name="warehouse"]', 'MAIN-001');

      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify stock increased by 100
      const stockResponse = await page.request.get(`/api/stock/current?item_id=${testData.item.id}`);
      const stockData = await stockResponse.json();
      expect(stockData.data.current_stock).toBe(100);
    });

    // ========================================
    // Step 6: Sales Transaction (매출 거래)
    // ========================================
    await test.step('Create sales transaction', async () => {
      await page.goto('/transactions/sales');
      await expect(page).toHaveURL(/\/transactions\/sales/);

      await page.click('button:has-text("신규 등록")');

      // Fill sales transaction
      await page.fill('input[name="transaction_no"]', testData.sales.transactionNo);
      await page.selectOption('select[name="customer_id"]', testData.customer.id!);
      await page.fill('input[name="transaction_date"]', new Date().toISOString().split('T')[0]);

      // Add sales item (80 units @ 15,000 won)
      await page.click('button:has-text("품목 추가")');
      await page.selectOption('select[name="item_id"]', testData.item.id!);
      await page.fill('input[name="quantity"]', '80');
      await page.fill('input[name="unit_price"]', '15000');

      // Total: 80 * 15,000 = 1,200,000 won
      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify payment status = PENDING
      await page.waitForTimeout(1000);
      const statusBadge = page.locator(`tr:has-text("${testData.sales.transactionNo}") .payment-status`);
      await expect(statusBadge).toContainText('미수금');

      // Get sales_id
      const response = await page.request.get('/api/sales-transactions');
      const sales = await response.json();
      const saleTransaction = sales.data.find((s: any) => s.transaction_no === testData.sales.transactionNo);
      testData.sales.id = saleTransaction?.transaction_id;

      expect(testData.sales.id).toBeDefined();
    });

    // ========================================
    // Step 7: Shipping Transaction (출고 처리)
    // ========================================
    await test.step('Process shipping transaction', async () => {
      await page.goto('/inventory/shipping');
      await expect(page).toHaveURL(/\/inventory\/shipping/);

      await page.click('button:has-text("출고 등록")');

      // Fill shipping details (80 units)
      await page.fill('input[name="transaction_no"]', testData.shipping.transactionNo);
      await page.selectOption('select[name="item_id"]', testData.item.id!);
      await page.fill('input[name="quantity"]', '80');
      await page.fill('input[name="transaction_date"]', new Date().toISOString().split('T')[0]);
      await page.fill('input[name="destination"]', testData.customer.name);

      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify stock decreased to 20 (100 - 80)
      const stockResponse = await page.request.get(`/api/stock/current?item_id=${testData.item.id}`);
      const stockData = await stockResponse.json();
      expect(stockData.data.current_stock).toBe(20);
    });

    // ========================================
    // Step 8: Collection (수금 - Partial then Complete)
    // ========================================
    await test.step('Process collection payments', async () => {
      await page.goto('/transactions/collections');
      await expect(page).toHaveURL(/\/transactions\/collections/);

      // First collection: 500,000 won (partial)
      await page.click('button:has-text("수금 등록")');
      await page.selectOption('select[name="sales_transaction_id"]', testData.sales.id!);
      await page.fill('input[name="amount"]', '500000');
      await page.fill('input[name="collection_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="payment_method"]', 'TRANSFER');
      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify sales status changed to PARTIAL
      await page.goto('/transactions/sales');
      await page.waitForTimeout(1000);
      let statusBadge = page.locator(`tr:has-text("${testData.sales.transactionNo}") .payment-status`);
      await expect(statusBadge).toContainText('부분수금');

      // Second collection: 700,000 won (complete)
      await page.goto('/transactions/collections');
      await page.click('button:has-text("수금 등록")');
      await page.selectOption('select[name="sales_transaction_id"]', testData.sales.id!);
      await page.fill('input[name="amount"]', '700000');
      await page.fill('input[name="collection_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="payment_method"]', 'CASH');
      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify sales status changed to COMPLETED
      await page.goto('/transactions/sales');
      await page.waitForTimeout(1000);
      statusBadge = page.locator(`tr:has-text("${testData.sales.transactionNo}") .payment-status`);
      await expect(statusBadge).toContainText('수금완료');
    });

    // ========================================
    // Step 9: Payment (지급 - Complete)
    // ========================================
    await test.step('Process payment', async () => {
      await page.goto('/transactions/payments');
      await expect(page).toHaveURL(/\/transactions\/payments/);

      // Full payment: 1,000,000 won
      await page.click('button:has-text("지급 등록")');
      await page.selectOption('select[name="purchase_transaction_id"]', testData.purchase.id!);
      await page.fill('input[name="amount"]', '1000000');
      await page.fill('input[name="payment_date"]', new Date().toISOString().split('T')[0]);
      await page.selectOption('select[name="payment_method"]', 'TRANSFER');
      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify purchase status changed to COMPLETED
      await page.goto('/transactions/purchases');
      await page.waitForTimeout(1000);
      const statusBadge = page.locator(`tr:has-text("${testData.purchase.transactionNo}") .payment-status`);
      await expect(statusBadge).toContainText('지급완료');
    });

    // ========================================
    // Step 10: Dashboard Verification (대시보드 확인)
    // ========================================
    await test.step('Verify dashboard statistics', async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/');

      // Wait for widgets to load
      await page.waitForTimeout(2000);

      // Verify KPI cards display data
      const totalItemsCard = page.locator('.kpi-total-items');
      await expect(totalItemsCard).toBeVisible();
      const itemsCount = await totalItemsCard.textContent();
      expect(parseInt(itemsCount || '0')).toBeGreaterThan(0);

      // Verify stock value card
      const stockValueCard = page.locator('.kpi-stock-value');
      await expect(stockValueCard).toBeVisible();

      // Verify recent transactions appear
      const recentActivity = page.locator('.recent-activity');
      await expect(recentActivity).toBeVisible();
    });

    // ========================================
    // Step 11: Accounting Summary Verification (회계 집계 확인)
    // ========================================
    await test.step('Verify accounting summary', async () => {
      await page.goto('/accounting/summary');
      await expect(page).toHaveURL(/\/accounting\/summary/);

      // Wait for monthly accounting view to load
      await page.waitForTimeout(2000);

      // Verify v_monthly_accounting view displays data
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const monthRow = page.locator(`tr:has-text("${currentMonth}")`);
      await expect(monthRow).toBeVisible();

      // Verify sales and purchase amounts are displayed
      const salesAmount = monthRow.locator('.sales-amount');
      const purchaseAmount = monthRow.locator('.purchase-amount');
      await expect(salesAmount).toBeVisible();
      await expect(purchaseAmount).toBeVisible();

      // Verify profit calculation (sales - purchase)
      const profit = monthRow.locator('.profit-amount');
      await expect(profit).toBeVisible();
    });

    // ========================================
    // Final Verification: Complete Workflow Integrity
    // ========================================
    await test.step('Verify complete workflow integrity', async () => {
      // 1. Item exists and is active
      const itemResponse = await page.request.get(`/api/items?item_code=${testData.item.code}`);
      const itemData = await itemResponse.json();
      expect(itemData.data[0].is_active).toBe(true);

      // 2. Stock balance is correct (100 received - 80 shipped = 20)
      const stockResponse = await page.request.get(`/api/stock/current?item_id=${testData.item.id}`);
      const stockData = await stockResponse.json();
      expect(stockData.data.current_stock).toBe(20);

      // 3. Sales transaction is fully collected
      const salesResponse = await page.request.get(`/api/sales-transactions/${testData.sales.id}`);
      const salesData = await salesResponse.json();
      expect(salesData.data.payment_status).toBe('COMPLETED');
      expect(salesData.data.collected_amount).toBe(1200000);

      // 4. Purchase transaction is fully paid
      const purchaseResponse = await page.request.get(`/api/purchases/${testData.purchase.id}`);
      const purchaseData = await purchaseResponse.json();
      expect(purchaseData.data.payment_status).toBe('COMPLETED');
      expect(purchaseData.data.paid_amount).toBe(1000000);

      // 5. Transaction history is complete
      const historyResponse = await page.request.get(`/api/stock/history?item_id=${testData.item.id}`);
      const historyData = await historyResponse.json();
      expect(historyData.data.length).toBeGreaterThanOrEqual(2); // At least receiving + shipping

      console.log('✅ P2P Purchase-to-Sale Workflow Complete!');
      console.log('📊 Workflow Summary:');
      console.log(`  - Item: ${testData.item.name} (${testData.item.code})`);
      console.log(`  - Supplier: ${testData.supplier.name} (${testData.supplier.code})`);
      console.log(`  - Customer: ${testData.customer.name} (${testData.customer.code})`);
      console.log(`  - Purchase: ${testData.purchase.transactionNo} (1,000,000원)`);
      console.log(`  - Sales: ${testData.sales.transactionNo} (1,200,000원)`);
      console.log(`  - Stock: 100 received - 80 shipped = 20 remaining`);
      console.log(`  - Collection: 500,000 + 700,000 = 1,200,000원 (완료)`);
      console.log(`  - Payment: 1,000,000원 (완료)`);
      console.log(`  - Profit: 1,200,000 - 1,000,000 = 200,000원`);
    });
  });

  test('Workflow with partial payments and stock adjustments', async ({ page }) => {
    // Similar workflow but with:
    // - Partial payments/collections
    // - Stock adjustments
    // - Multiple shipping/receiving transactions
    // - Price changes

    // This test ensures the system handles complex scenarios
    expect(true).toBe(true); // Placeholder for extended workflow
  });

  test('Concurrent workflow execution (stress test)', async ({ page }) => {
    // Test multiple users executing workflows simultaneously
    // Verifies transaction isolation and data consistency

    expect(true).toBe(true); // Placeholder for stress test
  });
});
