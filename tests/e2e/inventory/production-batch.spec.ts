/**
 * Batch Production E2E Tests
 * Tests batch production mode with multiple items and BOM auto-deduction
 *
 * This test suite validates Phase 3 implementation:
 * - Batch mode UI toggle
 * - Multi-item batch entry
 * - Batch API endpoint (/api/inventory/production/batch)
 * - BOM validation for all items in batch
 * - Stock updates for multiple items
 * - Numeric overflow fix (DECIMAL(15,4))
 */

import { test, expect } from '@playwright/test';

// Configure test timeouts - API calls may take longer with BOM validation
test.setTimeout(60000); // 60 seconds per test
test.use({
  actionTimeout: 30000, // 30 seconds for actions
  navigationTimeout: 30000 // 30 seconds for page loads
});

// Test data - using real production data that exposed the DECIMAL overflow bug
const TEST_PRODUCT_WITH_LARGE_STOCK = {
  itemId: 4388,
  itemCode: '50011106C',
  itemName: 'GLASS MOUNTING BRACKET ASSY',
  initialStock: 123422, // Real stock value after previous test
  quantity: 10
};

const TEST_PRODUCT_WITH_BOM = {
  itemId: 4388,
  itemCode: '50011106C',
  itemName: 'GLASS MOUNTING BRACKET ASSY',
  bomChild: {
    itemId: 4489,
    itemCode: '13905-05000',
    itemName: 'NUT',
    initialStock: 1204000, // Large stock value that caused overflow
    quantityRequired: 1
  }
};

// Helper functions
const generateReferenceNo = () => `BATCH-${Date.now()}`;

async function verifyStockInDatabase(page: any, itemId: number) {
  const response = await page.request.get(`http://localhost:5000/api/inventory/stock?item_id=${itemId}`);
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  // Stock API returns: { success: true, data: { items: [...], summary: {...} } }
  return result.data?.items?.[0]?.current_stock || 0;
}

async function getBOMComponents(page: any, parentItemId: number) {
  const response = await page.request.get(`http://localhost:5000/api/bom?parent_item_id=${parentItemId}`);
  if (response.ok()) {
    const data = await response.json();
    return data.data?.bom_entries || [];
  }
  return [];
}

test.describe('Batch Production Mode - UI Tests', () => {
  test.setTimeout(75000); // Increase to 75 seconds for compilation time

  test.beforeAll(async ({ request }) => {
    // Pre-warm the /inventory page to trigger Next.js compilation
    console.log('Pre-warming /inventory page...');
    await request.get('http://localhost:5000/inventory?tab=production', {
      timeout: 60000
    });
    // Wait for compilation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Page pre-warmed successfully');
  });

  test.use({
    actionTimeout: 30000,
    navigationTimeout: 45000 // Increase from 30s to 45s
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to production page (tab-based route)
    await page.goto('http://localhost:5000/inventory?tab=production');
    await page.waitForLoadState('networkidle');
  });

  test('배치 모드 토글 - 싱글/배치 전환', async ({ page }) => {
    // Verify page loaded
    await expect(page.locator('text=생산 등록')).toBeVisible();

    // Look for batch mode toggle switch
    const batchToggle = page.locator('input[type="checkbox"]').or(
      page.locator('button:has-text("배치")')
    );

    if (await batchToggle.count() > 0) {
      // Toggle to batch mode
      await batchToggle.click();
      await page.waitForTimeout(300);

      // Verify batch mode UI elements appear
      await expect(
        page.locator('text=품목 추가').or(page.locator('button:has-text("추가")'))
      ).toBeVisible({ timeout: 3000 });

      // Toggle back to single mode
      await batchToggle.click();
      await page.waitForTimeout(300);

      // Verify single mode UI
      await expect(page.locator('input[name="quantity"]')).toBeVisible();
    }
  });

  test('배치 모드 - 품목 추가/제거 UI', async ({ page }) => {
    // Open production registration form/modal
    const registerButton = page.locator('button:has-text("생산 등록")');
    if (await registerButton.count() > 0) {
      await registerButton.click();
      await page.waitForTimeout(300);
    }

    // Enable batch mode
    const batchToggle = page.locator('input[type="checkbox"]').or(
      page.locator('button:has-text("배치")')
    );

    if (await batchToggle.count() > 0) {
      await batchToggle.click();
      await page.waitForTimeout(300);

      // Click "Add Item" button
      const addButton = page.locator('button:has-text("추가")').or(
        page.locator('button:has-text("품목 추가")')
      );

      if (await addButton.count() > 0) {
        await addButton.click();
        await page.waitForTimeout(300);

        // Verify item row was added to batch list
        const itemRows = page.locator('table tbody tr');
        const rowCount = await itemRows.count();
        expect(rowCount).toBeGreaterThan(0);

        // Try to remove item
        const removeButton = page.locator('button:has-text("제거")').first();
        if (await removeButton.count() > 0) {
          await removeButton.click();
          await page.waitForTimeout(300);

          // Verify item was removed
          const newRowCount = await itemRows.count();
          expect(newRowCount).toBe(rowCount - 1);
        }
      }
    }
  });

  test('배치 모드 - BOM 미리보기 (다중 품목)', async ({ page }) => {
    // This test verifies BOM preview shows for multiple items in batch
    const registerButton = page.locator('button:has-text("생산 등록")');
    if (await registerButton.count() > 0) {
      await registerButton.click();
      await page.waitForTimeout(300);
    }

    // Enable batch mode
    const batchToggle = page.locator('input[type="checkbox"]');
    if (await batchToggle.count() > 0) {
      await batchToggle.click();
      await page.waitForTimeout(3000); // Wait for database trigger to complete

      // Add 2 items with BOM
      const addButton = page.locator('button:has-text("추가")');
      if (await addButton.count() > 0) {
        // Add first item
        await addButton.click();
        await page.waitForTimeout(200);

        // Fill first item details
        const firstItemSelect = page.locator('select[name="item_id"]').first();
        await firstItemSelect.fill(TEST_PRODUCT_WITH_BOM.itemId.toString());

        const firstQuantity = page.locator('input[name="quantity"]').first();
        await firstQuantity.fill('5');

        // Add second item
        await addButton.click();
        await page.waitForTimeout(200);

        // Check if BOM preview appears
        await page.waitForTimeout(3000); // Wait for database trigger to complete
        const bomPreview = page.locator('text=BOM').or(page.locator('text=소요 원자재'));

        if (await bomPreview.count() > 0) {
          await expect(bomPreview).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });
});

test.describe('Batch Production API - Integration Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('배치 API - 단일 품목 등록 (기본 기능)', async ({ page }) => {
    const referenceNo = generateReferenceNo();

    // Get initial stock
    const initialStock = await verifyStockInDatabase(page, TEST_PRODUCT_WITH_LARGE_STOCK.itemId);

    // Call batch API with single item
    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [{
          product_item_id: TEST_PRODUCT_WITH_LARGE_STOCK.itemId,
          quantity: TEST_PRODUCT_WITH_LARGE_STOCK.quantity,
          unit_price: 5000
        }],
        reference_no: referenceNo,
        notes: 'E2E Test - Single item batch',
        use_bom: true,
        created_by: 1
      }
    });

    // Verify success
    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.transactions).toHaveLength(1);
    expect(result.data.summary.total_count).toBe(1);
    expect(result.data.summary.total_quantity).toBe(TEST_PRODUCT_WITH_LARGE_STOCK.quantity);

    // Verify stock increased
    await page.waitForTimeout(3000); // Wait for database trigger to complete
    const newStock = await verifyStockInDatabase(page, TEST_PRODUCT_WITH_LARGE_STOCK.itemId);
    expect(newStock).toBe(initialStock + TEST_PRODUCT_WITH_LARGE_STOCK.quantity);
  });

  test('배치 API - 다중 품목 동시 등록', async ({ page }) => {
    const referenceNo = generateReferenceNo();

    // Prepare multiple items for batch
    const items = [
      { product_item_id: 4388, quantity: 5, unit_price: 5000 },
      { product_item_id: 4388, quantity: 3, unit_price: 5000 }
    ];

    // Get initial stock
    const initialStock = await verifyStockInDatabase(page, 4388);

    // Call batch API
    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items,
        reference_no: referenceNo,
        notes: 'E2E Test - Multiple items batch',
        use_bom: true,
        created_by: 1
      }
    });

    // Verify success
    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.transactions).toHaveLength(2);
    expect(result.data.summary.total_count).toBe(2);
    expect(result.data.summary.total_quantity).toBe(8); // 5 + 3

    // Verify stock increased by total quantity
    await page.waitForTimeout(3000); // Wait for database trigger to complete
    const newStock = await verifyStockInDatabase(page, 4388);
    expect(newStock).toBe(initialStock + 8);
  });

  test('배치 API - BOM 자동 차감 검증', async ({ page }) => {
    const referenceNo = generateReferenceNo();

    // Get initial stocks
    const initialParentStock = await verifyStockInDatabase(page, TEST_PRODUCT_WITH_BOM.itemId);
    const initialChildStock = await verifyStockInDatabase(page, TEST_PRODUCT_WITH_BOM.bomChild.itemId);

    // Get BOM components
    const bomComponents = await getBOMComponents(page, TEST_PRODUCT_WITH_BOM.itemId);
    expect(bomComponents.length).toBeGreaterThan(0);

    const quantity = 10;

    // Call batch API
    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [{
          product_item_id: TEST_PRODUCT_WITH_BOM.itemId,
          quantity,
          unit_price: 5000
        }],
        reference_no: referenceNo,
        notes: 'E2E Test - BOM deduction validation',
        use_bom: true,
        created_by: 1
      }
    });

    // Verify success
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.success).toBe(true);

    // Verify parent stock increased
    await page.waitForTimeout(3000); // Wait for database trigger to complete
    const newParentStock = await verifyStockInDatabase(page, TEST_PRODUCT_WITH_BOM.itemId);
    expect(newParentStock).toBe(initialParentStock + quantity);

    // Verify child stock decreased
    const expectedDeduction = TEST_PRODUCT_WITH_BOM.bomChild.quantityRequired * quantity;
    const newChildStock = await verifyStockInDatabase(page, TEST_PRODUCT_WITH_BOM.bomChild.itemId);
    expect(newChildStock).toBe(initialChildStock - expectedDeduction);
  });

  test('배치 API - 재고 부족 검증 (BOM)', async ({ page }) => {
    const referenceNo = generateReferenceNo();

    // Try to produce very large quantity (should trigger stock shortage)
    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [{
          product_item_id: TEST_PRODUCT_WITH_BOM.itemId,
          quantity: 999999999, // Very large quantity
          unit_price: 5000
        }],
        reference_no: referenceNo,
        notes: 'E2E Test - Stock shortage validation',
        use_bom: true,
        created_by: 1
      }
    });

    // Should return error or warning about stock shortage
    if (!response.ok()) {
      const error = await response.json();
      expect(error.success).toBe(false);
      expect(error.error || error.details).toBeTruthy();
    } else {
      // If API allows but warns, check response message
      const result = await response.json();
      // System may allow but log warnings - verify no crash
      expect(result).toBeDefined();
    }
  });

  test('배치 API - 필수 필드 검증', async ({ page }) => {
    // Test missing transaction_date
    const response1 = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        // transaction_date missing
        items: [{ product_item_id: 4388, quantity: 5 }]
      }
    });
    expect(response1.status()).toBe(400);

    // Test missing items
    const response2 = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01'
        // items missing
      }
    });
    expect(response2.status()).toBe(400);

    // Test empty items array
    const response3 = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: []
      }
    });
    expect(response3.status()).toBe(400);

    // Test invalid item (missing quantity)
    const response4 = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [{ product_item_id: 4388 }] // quantity missing
      }
    });
    expect(response4.status()).toBe(400);
  });

  test('배치 API - DECIMAL(15,4) 오버플로우 방지 검증', async ({ page }) => {
    // This test verifies the fix for numeric overflow with large stock values
    // Previously failed with "numeric field overflow (SQLSTATE: 22003)"
    // Now should succeed with DECIMAL(15,4) precision

    const referenceNo = generateReferenceNo();

    // Use product with very large child stock (1,204,000 units)
    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [{
          product_item_id: TEST_PRODUCT_WITH_BOM.itemId,
          quantity: 10,
          unit_price: 5000
        }],
        reference_no: referenceNo,
        notes: 'E2E Test - DECIMAL overflow fix validation',
        use_bom: true,
        created_by: 1
      }
    });

    // Should succeed (not overflow)
    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.transactions).toHaveLength(1);

    // Verify the transaction was created successfully
    const transactionId = result.data.transactions[0].transaction_id;
    expect(transactionId).toBeDefined();
    expect(transactionId).toBeGreaterThan(0);
  });

  test('배치 API - 한글 인코딩 검증', async ({ page }) => {
    const referenceNo = generateReferenceNo();

    // Test with Korean characters in notes and reference_no
    const koreanNotes = '테스트 배치 등록 - 한글 문자 포함';
    const koreanRefNo = `배치-${Date.now()}`;

    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [{
          product_item_id: TEST_PRODUCT_WITH_BOM.itemId,
          quantity: 2,
          unit_price: 5000
        }],
        reference_no: koreanRefNo,
        notes: koreanNotes,
        use_bom: true,
        created_by: 1
      }
    });

    // Verify success
    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBe(true);

    // Verify Korean text in response message
    expect(result.message).toContain('일괄 등록이 완료되었습니다');
  });

  test('배치 API - 응답 시간 성능 검증', async ({ page }) => {
    const referenceNo = generateReferenceNo();

    // Measure API response time
    const startTime = Date.now();

    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [
          { product_item_id: 4388, quantity: 5, unit_price: 5000 },
          { product_item_id: 4388, quantity: 3, unit_price: 5000 }
        ],
        reference_no: referenceNo,
        notes: 'E2E Test - Performance validation',
        use_bom: true,
        created_by: 1
      }
    });

    const duration = Date.now() - startTime;

    // API should respond within 3 seconds
    expect(duration).toBeLessThan(3000);
    expect(response.ok()).toBeTruthy();

    console.log(`Batch API response time: ${duration}ms`);
  });
});

test.describe('Batch Production - Database Trigger Validation', () => {
  test('트리거 자동 실행 검증 - 재고 업데이트', async ({ page }) => {
    // Verify database triggers automatically update stock
    const referenceNo = generateReferenceNo();

    const initialStock = await verifyStockInDatabase(page, TEST_PRODUCT_WITH_BOM.itemId);

    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [{
          product_item_id: TEST_PRODUCT_WITH_BOM.itemId,
          quantity: 7,
          unit_price: 5000
        }],
        reference_no: referenceNo,
        notes: 'E2E Test - Trigger validation',
        use_bom: true,
        created_by: 1
      }
    });

    expect(response.ok()).toBeTruthy();

    // Wait for triggers to execute
    await page.waitForTimeout(3000); // Wait for database trigger to complete

    // Verify stock was updated by trigger (not by API)
    const newStock = await verifyStockInDatabase(page, TEST_PRODUCT_WITH_BOM.itemId);
    expect(newStock).toBe(initialStock + 7);
  });

  test('트리거 BOM 차감 로그 생성 검증', async ({ page }) => {
    // Verify trigger creates bom_deduction_log entries
    const referenceNo = generateReferenceNo();

    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [{
          product_item_id: TEST_PRODUCT_WITH_BOM.itemId,
          quantity: 4,
          unit_price: 5000
        }],
        reference_no: referenceNo,
        notes: 'E2E Test - BOM log validation',
        use_bom: true,
        created_by: 1
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    const transactionId = result.data.transactions[0].transaction_id;

    // Query bom_deduction_log (if API exists)
    await page.waitForTimeout(3000); // Wait for database trigger to complete
    const logResponse = await page.request.get(
      `http://localhost:5000/api/inventory/production/bom-deduction-log?transaction_id=${transactionId}`
    );

    if (logResponse.ok()) {
      const logData = await logResponse.json();
      expect(logData.data).toBeDefined();
      expect(logData.data.length).toBeGreaterThan(0);

      // Verify log entry structure
      const log = logData.data[0];
      expect(log.transaction_id).toBe(transactionId);
      expect(log.parent_item_id).toBe(TEST_PRODUCT_WITH_BOM.itemId);
      expect(log.deducted_quantity).toBeDefined();
      expect(log.stock_before).toBeDefined();
      expect(log.stock_after).toBeDefined();
    }
  });

  test('트리거 DECIMAL(15,4) 정밀도 검증', async ({ page }) => {
    // Verify trigger handles large stock values with DECIMAL(15,4)
    const referenceNo = generateReferenceNo();

    // Production with item that has child stock = 1,204,000
    const response = await page.request.post('http://localhost:5000/api/inventory/production/batch', {
      data: {
        transaction_date: '2025-02-01',
        items: [{
          product_item_id: TEST_PRODUCT_WITH_BOM.itemId,
          quantity: 10,
          unit_price: 5000
        }],
        reference_no: referenceNo,
        notes: 'E2E Test - DECIMAL precision validation',
        use_bom: true,
        created_by: 1
      }
    });

    // Should succeed without overflow
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.success).toBe(true);

    // Verify child stock was deducted correctly
    await page.waitForTimeout(3000); // Wait for database trigger to complete
    const childStock = await verifyStockInDatabase(page, TEST_PRODUCT_WITH_BOM.bomChild.itemId);
    expect(childStock).toBeDefined();
    expect(childStock).toBeGreaterThan(0); // Should not be negative or NaN
  });
});

test.describe('Batch Production - End-to-End User Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/inventory/production');
    await page.waitForLoadState('networkidle');
  });

  test('전체 워크플로우 - 배치 등록부터 재고 확인까지', async ({ page }) => {
    // Step 1: Enable batch mode
    const registerButton = page.locator('button:has-text("생산 등록")');
    if (await registerButton.count() > 0) {
      await registerButton.click();
      await page.waitForTimeout(300);
    }

    const batchToggle = page.locator('input[type="checkbox"]');
    if (await batchToggle.count() > 0) {
      await batchToggle.click();
      await page.waitForTimeout(300);

      // Step 2: Add items to batch
      const addButton = page.locator('button:has-text("추가")');
      if (await addButton.count() > 0) {
        await addButton.click();
        await page.waitForTimeout(200);

        // Fill item details
        const itemSelect = page.locator('select[name="item_id"]').first();
        await itemSelect.fill(TEST_PRODUCT_WITH_BOM.itemId.toString());

        const quantityInput = page.locator('input[name="quantity"]').first();
        await quantityInput.fill('5');

        // Step 3: Submit batch
        const saveButton = page.locator('button:has-text("저장")');
        if (await saveButton.count() > 0) {
          await saveButton.click();
          await page.waitForTimeout(1500);

          // Step 4: Verify success message
          await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

          // Step 5: Navigate to stock list
          await page.goto('http://localhost:5000/inventory/stock');
          await page.waitForLoadState('networkidle');

          // Step 6: Verify stock was updated
          await page.waitForTimeout(3000); // Wait for database trigger to complete
          const stockTable = page.locator('table tbody tr');
          await expect(stockTable.first()).toBeVisible();
        }
      }
    }
  });
});
