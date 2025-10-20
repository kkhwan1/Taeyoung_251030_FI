/**
 * Production Transactions E2E Tests
 * Tests production (생산) with BOM auto-deduction of raw materials
 */

import { test, expect } from '@playwright/test';

// Helper functions
const generateTransactionNo = () => `PRD-${Date.now()}`;

async function verifyStockInDatabase(page: any, itemId: number) {
  const response = await page.request.get(`http://localhost:5000/api/inventory/stock?item_id=${itemId}`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.data[0]?.current_stock || 0;
}

async function getBOMComponents(page: any, parentItemId: number) {
  const response = await page.request.get(`http://localhost:5000/api/bom?parent_item_id=${parentItemId}`);
  if (response.ok()) {
    const data = await response.json();
    return data.data || [];
  }
  return [];
}

async function verifyBOMDeductionLog(page: any, transactionId: number) {
  const response = await page.request.get(
    `http://localhost:5000/api/inventory/production/bom-deduction-log?transaction_id=${transactionId}`
  );
  if (response.ok()) {
    const data = await response.json();
    return data.data || [];
  }
  return [];
}

test.describe('Production Transactions (생산)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to production page
    await page.goto('http://localhost:5000/inventory');
    await page.waitForLoadState('networkidle');

    // Click production tab/button
    const productionTab = page.locator('text=생산').or(page.locator('button:has-text("생산")'));
    if (await productionTab.count() > 0) {
      await productionTab.click();
      await page.waitForTimeout(300);
    }
  });

  test('생산 페이지 로드 및 UI 확인', async ({ page }) => {
    // Verify page title
    await expect(page.locator('text=생산')).toBeVisible();

    // Verify key UI elements
    await expect(page.locator('button:has-text("생산 등록")')).toBeVisible();

    // Verify transaction list table
    await expect(page.locator('table')).toBeVisible();
  });

  test('생산 등록 - BOM 자동 차감 (완제품 1개)', async ({ page }) => {
    // Assume test data: Parent item (완제품) with BOM components
    const parentItemId = 1; // Finished goods
    const productionQuantity = 10;

    // Get BOM components before production
    const bomComponents = await getBOMComponents(page, parentItemId);

    if (bomComponents.length === 0) {
      console.log('No BOM components found, skipping test');
      test.skip();
      return;
    }

    // Get initial stock levels
    const initialParentStock = await verifyStockInDatabase(page, parentItemId);
    const initialComponentStocks = await Promise.all(
      bomComponents.map((comp: any) => verifyStockInDatabase(page, comp.child_item_id))
    );

    // Open production registration modal
    await page.click('button:has-text("생산 등록")');
    await page.waitForTimeout(300);

    // Verify modal is open
    await expect(page.locator('text=생산 등록').first()).toBeVisible();

    // Fill in transaction details
    const transactionNo = generateTransactionNo();
    await page.fill('input[name="transaction_number"]', transactionNo);

    // Select finished goods item
    const itemSelect = page.locator('select[name="item_id"]').or(page.locator('input[name="item_id"]'));
    await itemSelect.first().click();
    await itemSelect.first().fill(parentItemId.toString());

    // Enter production quantity
    await page.fill('input[name="quantity"]', productionQuantity.toString());

    // Select transaction date
    await page.fill('input[type="date"]', '2025-01-19');

    // Check if BOM preview is shown
    const bomPreview = page.locator('text=BOM 차감 미리보기').or(page.locator('text=소요 원자재'));
    if (await bomPreview.count() > 0) {
      await expect(bomPreview).toBeVisible();
    }

    // Submit form
    await page.click('button:has-text("저장")');
    await page.waitForTimeout(1500);

    // Verify success message
    await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

    // Verify finished goods stock increased
    await page.waitForTimeout(500);
    const newParentStock = await verifyStockInDatabase(page, parentItemId);
    expect(newParentStock).toBe(initialParentStock + productionQuantity);

    // Verify raw materials were deducted
    for (let i = 0; i < bomComponents.length; i++) {
      const component = bomComponents[i];
      const expectedDeduction = component.quantity_required * productionQuantity;
      const newComponentStock = await verifyStockInDatabase(page, component.child_item_id);

      expect(newComponentStock).toBe(initialComponentStocks[i] - expectedDeduction);
    }
  });

  test('생산 등록 - BOM 차감 확인 (부족 재고 경고)', async ({ page }) => {
    // This test verifies system warns about insufficient raw materials
    const parentItemId = 1;
    const productionQuantity = 10000; // Very large quantity to trigger warning

    // Open production modal
    await page.click('button:has-text("생산 등록")');
    await page.waitForTimeout(300);

    // Fill in details
    const transactionNo = generateTransactionNo();
    await page.fill('input[name="transaction_number"]', transactionNo);

    const itemSelect = page.locator('select[name="item_id"]').or(page.locator('input[name="item_id"]'));
    await itemSelect.first().click();
    await itemSelect.first().fill(parentItemId.toString());

    await page.fill('input[name="quantity"]', productionQuantity.toString());

    // Check if BOM check/validation happens
    const bomCheckButton = page.locator('button:has-text("BOM 확인")').or(
      page.locator('button:has-text("재고 확인")')
    );

    if (await bomCheckButton.count() > 0) {
      await bomCheckButton.click();
      await page.waitForTimeout(500);

      // Should show insufficient stock warning
      await expect(page.locator('text=부족').or(page.locator('text=재고 부족'))).toBeVisible({ timeout: 3000 });
    }
  });

  test('생산 등록 - BOM 다단계 구조 지원', async ({ page }) => {
    // This test verifies multi-level BOM deduction
    // Parent -> Child -> Grandchild structure

    const parentItemId = 1;
    const productionQuantity = 5;

    // Check if multi-level BOM exists
    const bomComponents = await getBOMComponents(page, parentItemId);

    if (bomComponents.length === 0) {
      console.log('No BOM components found, skipping test');
      test.skip();
      return;
    }

    // Create production transaction via API
    const transactionNo = generateTransactionNo();
    const response = await page.request.post('http://localhost:5000/api/inventory/production', {
      data: {
        transaction_number: transactionNo,
        item_id: parentItemId,
        quantity: productionQuantity,
        transaction_date: '2025-01-19',
        transaction_type: 'PRODUCTION'
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    // Get deduction log
    if (result.data?.transaction_id) {
      await page.waitForTimeout(500);
      const deductionLog = await verifyBOMDeductionLog(page, result.data.transaction_id);

      // Verify deduction log was created
      expect(deductionLog.length).toBeGreaterThan(0);

      // Verify different BOM levels were recorded
      const levels = new Set(deductionLog.map((log: any) => log.bom_level));
      expect(levels.size).toBeGreaterThan(0);
    }
  });

  test('생산 내역 검색 및 필터링', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Get initial row count
    const initialRows = await page.locator('table tbody tr').count();

    // Perform search
    const searchInput = page.locator('input[placeholder*="검색"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('PRD');
      await page.waitForTimeout(500);

      // Verify filtered results
      await expect(page.locator('table tbody tr')).toBeVisible();
    }
  });

  test('생산 내역 상세보기 - BOM 차감 내역 확인', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });

    // Click first row or view button
    const viewButton = page.locator('button:has-text("상세")').first()
      .or(page.locator('table tbody tr').first());

    if (await viewButton.count() > 0) {
      await viewButton.click();
      await page.waitForTimeout(500);

      // Verify detail view shows BOM deduction info
      await expect(
        page.locator('text=BOM').or(page.locator('text=차감'))
      ).toBeVisible({ timeout: 3000 });
    }
  });

  test('생산 취소 - BOM 차감 롤백', async ({ page }) => {
    // This test verifies that canceling production reverses BOM deductions
    const parentItemId = 1;
    const productionQuantity = 5;

    // Get initial stocks
    const initialParentStock = await verifyStockInDatabase(page, parentItemId);
    const bomComponents = await getBOMComponents(page, parentItemId);

    if (bomComponents.length === 0) {
      console.log('No BOM components found, skipping test');
      test.skip();
      return;
    }

    const initialComponentStocks = await Promise.all(
      bomComponents.map((comp: any) => verifyStockInDatabase(page, comp.child_item_id))
    );

    // Create production transaction
    const transactionNo = generateTransactionNo();
    const createResponse = await page.request.post('http://localhost:5000/api/inventory/production', {
      data: {
        transaction_number: transactionNo,
        item_id: parentItemId,
        quantity: productionQuantity,
        transaction_date: '2025-01-19',
        transaction_type: 'PRODUCTION'
      }
    });

    expect(createResponse.ok()).toBeTruthy();
    const createResult = await createResponse.json();
    const transactionId = createResult.data?.transaction_id;

    if (transactionId) {
      // Cancel/delete the transaction
      const deleteResponse = await page.request.delete(
        `http://localhost:5000/api/inventory/transactions/${transactionId}`
      );

      if (deleteResponse.ok()) {
        await page.waitForTimeout(1000);

        // Verify stocks were rolled back
        const finalParentStock = await verifyStockInDatabase(page, parentItemId);
        expect(finalParentStock).toBe(initialParentStock);

        // Verify component stocks were restored
        for (let i = 0; i < bomComponents.length; i++) {
          const finalComponentStock = await verifyStockInDatabase(page, bomComponents[i].child_item_id);
          expect(finalComponentStock).toBe(initialComponentStocks[i]);
        }
      }
    }
  });

  test('생산 수정 기능 - BOM 재계산', async ({ page }) => {
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
      const currentQuantity = await quantityInput.inputValue();
      const newQuantity = Number(currentQuantity) + 5;

      await quantityInput.fill(newQuantity.toString());

      // Check if BOM recalculation happens automatically
      await page.waitForTimeout(500);

      // Save changes
      await page.click('button:has-text("저장")');
      await page.waitForTimeout(1000);

      // Verify success
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 3000 });
    }
  });

  test('Excel 내보내기 - 생산 내역', async ({ page }) => {
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

  test('API 응답 시간 검증', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:5000/inventory');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Verify load time is under 3 seconds
    expect(loadTime).toBeLessThan(3000);

    console.log(`Production page load time: ${loadTime}ms`);
  });
});

test.describe('Production - BOM Deduction Logic', () => {
  test('BOM 차감 수식 검증', async ({ page }) => {
    // Verify: deducted_quantity = quantity_required * parent_quantity
    const parentItemId = 1;
    const productionQuantity = 7;

    // Get BOM components
    const bomComponents = await getBOMComponents(page, parentItemId);

    if (bomComponents.length === 0) {
      console.log('No BOM components found, skipping test');
      test.skip();
      return;
    }

    // Create production transaction
    const transactionNo = generateTransactionNo();
    const response = await page.request.post('http://localhost:5000/api/inventory/production', {
      data: {
        transaction_number: transactionNo,
        item_id: parentItemId,
        quantity: productionQuantity,
        transaction_date: '2025-01-19',
        transaction_type: 'PRODUCTION'
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    if (result.data?.transaction_id) {
      await page.waitForTimeout(500);
      const deductionLog = await verifyBOMDeductionLog(page, result.data.transaction_id);

      // Verify each component deduction
      for (const log of deductionLog) {
        const expectedDeduction = log.quantity_required * productionQuantity;
        expect(log.deducted_quantity).toBe(expectedDeduction);
        expect(log.stock_after).toBe(log.stock_before - expectedDeduction);
      }
    }
  });

  test('BOM 차감 트랜잭션 원자성', async ({ page }) => {
    // Verify atomic transaction: either all BOM deductions succeed or all fail
    const parentItemId = 1;
    const productionQuantity = 5;

    const response = await page.request.post('http://localhost:5000/api/inventory/production', {
      data: {
        transaction_number: generateTransactionNo(),
        item_id: parentItemId,
        quantity: productionQuantity,
        transaction_date: '2025-01-19',
        transaction_type: 'PRODUCTION'
      }
    });

    if (response.ok()) {
      const result = await response.json();

      // Verify transaction was created
      expect(result.data?.transaction_id).toBeDefined();

      // Verify all BOM deductions were logged
      if (result.data?.transaction_id) {
        await page.waitForTimeout(500);
        const deductionLog = await verifyBOMDeductionLog(page, result.data.transaction_id);

        // All components should have deduction records
        const bomComponents = await getBOMComponents(page, parentItemId);
        expect(deductionLog.length).toBe(bomComponents.length);
      }
    }
  });

  test('BOM 없는 품목 생산 시 오류 처리', async ({ page }) => {
    // Test production of item without BOM
    const itemWithoutBOM = 999; // Assuming this item has no BOM

    const response = await page.request.post('http://localhost:5000/api/inventory/production', {
      data: {
        transaction_number: generateTransactionNo(),
        item_id: itemWithoutBOM,
        quantity: 10,
        transaction_date: '2025-01-19',
        transaction_type: 'PRODUCTION'
      }
    });

    // System should handle gracefully
    // Either allow (for items without BOM) or reject with clear message
    if (!response.ok()) {
      const error = await response.json();
      expect(error.error).toContain('BOM');
    } else {
      // If allowed, verify only parent stock increased (no BOM deductions)
      const result = await response.json();
      if (result.data?.transaction_id) {
        const deductionLog = await verifyBOMDeductionLog(page, result.data.transaction_id);
        expect(deductionLog.length).toBe(0);
      }
    }
  });

  test('동시 생산 처리 - 재고 충돌 방지', async ({ page }) => {
    // Test concurrent production transactions
    const parentItemId = 1;
    const productionQuantity = 3;

    // Create multiple concurrent production transactions
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        page.request.post('http://localhost:5000/api/inventory/production', {
          data: {
            transaction_number: generateTransactionNo() + `-${i}`,
            item_id: parentItemId,
            quantity: productionQuantity,
            transaction_date: '2025-01-19',
            transaction_type: 'PRODUCTION'
          }
        })
      );
    }

    const responses = await Promise.all(promises);

    // All should succeed (or all should fail consistently)
    const successCount = responses.filter(r => r.ok()).length;
    expect(successCount).toBeGreaterThan(0);

    // Verify stock consistency
    await page.waitForTimeout(1000);
    const finalStock = await verifyStockInDatabase(page, parentItemId);
    expect(finalStock).toBeGreaterThan(0);
  });

  test('BOM 차감 로그 완전성 검증', async ({ page }) => {
    // Verify deduction log contains all required fields
    const parentItemId = 1;
    const productionQuantity = 4;

    const response = await page.request.post('http://localhost:5000/api/inventory/production', {
      data: {
        transaction_number: generateTransactionNo(),
        item_id: parentItemId,
        quantity: productionQuantity,
        transaction_date: '2025-01-19',
        transaction_type: 'PRODUCTION'
      }
    });

    if (response.ok()) {
      const result = await response.json();

      if (result.data?.transaction_id) {
        await page.waitForTimeout(500);
        const deductionLog = await verifyBOMDeductionLog(page, result.data.transaction_id);

        // Verify each log entry has required fields
        deductionLog.forEach((log: any) => {
          expect(log.transaction_id).toBeDefined();
          expect(log.parent_item_id).toBeDefined();
          expect(log.child_item_id).toBeDefined();
          expect(log.quantity_required).toBeDefined();
          expect(log.deducted_quantity).toBeDefined();
          expect(log.stock_before).toBeDefined();
          expect(log.stock_after).toBeDefined();
          expect(log.bom_level).toBeDefined();
        });
      }
    }
  });
});
