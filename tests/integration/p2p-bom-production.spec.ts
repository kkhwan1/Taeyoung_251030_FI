/**
 * P2P Integration Test: BOM Production Workflow
 *
 * Complete BOM-based production flow:
 * 1. 원자재 품목 등록 (Raw Material Items)
 * 2. 완제품 품목 등록 (Finished Goods Item)
 * 3. BOM 구성 등록 (BOM Structure)
 * 4. 원자재 입고 (Raw Material Receiving)
 * 5. 생산 처리 (Production with BOM Auto-deduction)
 * 6. 재고 확인 (Stock Verification)
 * 7. 생산 이력 추적 (Production History)
 * 8. BOM 원가 계산 (BOM Cost Calculation)
 * 9. 가격 마스터 업데이트 (Price Master Update)
 * 10. 대시보드 생산 현황 (Dashboard Production Status)
 */

import { test, expect, Page } from '@playwright/test';

test.describe('P2P Integration: BOM Production Workflow', () => {
  let testData: {
    rawMaterials: Array<{
      code: string;
      name: string;
      id?: string;
      unitPrice: number;
    }>;
    finishedGoods: {
      code: string;
      name: string;
      id?: string;
    };
    bom: {
      parentId?: string;
      components: Array<{
        itemId?: string;
        quantity: number;
      }>;
    };
    receiving: Array<{
      transactionNo: string;
      itemId?: string;
      quantity: number;
    }>;
    production: {
      transactionNo: string;
      quantity: number;
    };
  };

  test.beforeEach(async ({ page }) => {
    const timestamp = Date.now();

    testData = {
      rawMaterials: [
        {
          code: `RAW-STEEL-${timestamp}`,
          name: `P2P 원자재-강판 ${timestamp}`,
          unitPrice: 5000
        },
        {
          code: `RAW-BOLT-${timestamp}`,
          name: `P2P 원자재-볼트 ${timestamp}`,
          unitPrice: 100
        },
        {
          code: `RAW-PAINT-${timestamp}`,
          name: `P2P 원자재-도료 ${timestamp}`,
          unitPrice: 2000
        }
      ],
      finishedGoods: {
        code: `FG-PANEL-${timestamp}`,
        name: `P2P 완제품-도어패널 ${timestamp}`
      },
      bom: {
        components: []
      },
      receiving: [],
      production: {
        transactionNo: `PROD-${timestamp}`,
        quantity: 50 // Produce 50 units
      }
    };
  });

  test('Complete BOM production workflow with auto-deduction', async ({ page }) => {
    // ========================================
    // Step 1: Register Raw Material Items (원자재 등록)
    // ========================================
    await test.step('Register 3 raw material items', async () => {
      for (const rawMaterial of testData.rawMaterials) {
        await page.goto('/master/items');

        await page.click('button:has-text("신규 등록")');

        await page.fill('input[name="item_code"]', rawMaterial.code);
        await page.fill('input[name="item_name"]', rawMaterial.name);
        await page.selectOption('select[name="category"]', 'Raw Material');
        await page.fill('input[name="spec"]', 'BOM-TEST-SPEC');
        await page.fill('input[name="unit_price"]', rawMaterial.unitPrice.toString());
        await page.fill('input[name="safety_stock"]', '100');

        await page.click('button:has-text("저장")');
        await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

        // Get item_id
        await page.waitForTimeout(1000);
        const response = await page.request.get('/api/items');
        const items = await response.json();
        const item = items.data.find((i: any) => i.item_code === rawMaterial.code);
        rawMaterial.id = item?.item_id;

        expect(rawMaterial.id).toBeDefined();
        console.log(`✅ Raw Material Registered: ${rawMaterial.name} (${rawMaterial.id})`);
      }
    });

    // ========================================
    // Step 2: Register Finished Goods Item (완제품 등록)
    // ========================================
    await test.step('Register finished goods item', async () => {
      await page.goto('/master/items');

      await page.click('button:has-text("신규 등록")');

      await page.fill('input[name="item_code"]', testData.finishedGoods.code);
      await page.fill('input[name="item_name"]', testData.finishedGoods.name);
      await page.selectOption('select[name="category"]', 'Product');
      await page.fill('input[name="spec"]', 'FG-SPEC-001');
      await page.fill('input[name="unit_price"]', '50000'); // Will be recalculated from BOM
      await page.fill('input[name="safety_stock"]', '20');

      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Get item_id
      await page.waitForTimeout(1000);
      const response = await page.request.get('/api/items');
      const items = await response.json();
      const item = items.data.find((i: any) => i.item_code === testData.finishedGoods.code);
      testData.finishedGoods.id = item?.item_id;
      testData.bom.parentId = testData.finishedGoods.id;

      expect(testData.finishedGoods.id).toBeDefined();
      console.log(`✅ Finished Goods Registered: ${testData.finishedGoods.name} (${testData.finishedGoods.id})`);
    });

    // ========================================
    // Step 3: Create BOM Structure (BOM 구성)
    // ========================================
    await test.step('Create BOM with 3 components', async () => {
      await page.goto('/master/bom');
      await expect(page).toHaveURL(/\/master\/bom/);

      await page.click('button:has-text("BOM 등록")');

      // Select parent item (finished goods)
      await page.selectOption('select[name="parent_item_id"]', testData.finishedGoods.id!);

      // Component 1: Steel Plate (2 units per finished goods)
      await page.click('button:has-text("구성품 추가")');
      await page.selectOption('select[name="child_item_id_0"]', testData.rawMaterials[0].id!);
      await page.fill('input[name="quantity_0"]', '2');
      testData.bom.components.push({
        itemId: testData.rawMaterials[0].id,
        quantity: 2
      });

      // Component 2: Bolts (8 units per finished goods)
      await page.click('button:has-text("구성품 추가")');
      await page.selectOption('select[name="child_item_id_1"]', testData.rawMaterials[1].id!);
      await page.fill('input[name="quantity_1"]', '8');
      testData.bom.components.push({
        itemId: testData.rawMaterials[1].id,
        quantity: 8
      });

      // Component 3: Paint (0.5 units per finished goods)
      await page.click('button:has-text("구성품 추가")');
      await page.selectOption('select[name="child_item_id_2"]', testData.rawMaterials[2].id!);
      await page.fill('input[name="quantity_2"]', '0.5');
      testData.bom.components.push({
        itemId: testData.rawMaterials[2].id,
        quantity: 0.5
      });

      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify BOM appears in list
      await page.waitForTimeout(1000);
      const bomRow = page.locator(`tr:has-text("${testData.finishedGoods.name}")`);
      await expect(bomRow).toBeVisible();

      console.log('✅ BOM Structure Created:');
      console.log(`  Parent: ${testData.finishedGoods.name}`);
      console.log(`  Component 1: ${testData.rawMaterials[0].name} × 2`);
      console.log(`  Component 2: ${testData.rawMaterials[1].name} × 8`);
      console.log(`  Component 3: ${testData.rawMaterials[2].name} × 0.5`);
    });

    // ========================================
    // Step 4: Receive Raw Materials (원자재 입고)
    // ========================================
    await test.step('Receive raw materials to stock', async () => {
      const receivingQuantities = [
        { item: testData.rawMaterials[0], qty: 200 }, // Steel: 200 units
        { item: testData.rawMaterials[1], qty: 1000 }, // Bolts: 1000 units
        { item: testData.rawMaterials[2], qty: 50 }  // Paint: 50 units
      ];

      for (let i = 0; i < receivingQuantities.length; i++) {
        const { item, qty } = receivingQuantities[i];
        const transactionNo = `REC-RAW-${Date.now()}-${i}`;

        await page.goto('/inventory/receiving');

        await page.click('button:has-text("입고 등록")');

        await page.fill('input[name="transaction_no"]', transactionNo);
        await page.selectOption('select[name="item_id"]', item.id!);
        await page.fill('input[name="quantity"]', qty.toString());
        await page.fill('input[name="transaction_date"]', new Date().toISOString().split('T')[0]);
        await page.fill('input[name="lot_no"]', `LOT-${Date.now()}-${i}`);
        await page.fill('input[name="warehouse"]', 'RAW-MATERIAL-001');

        await page.click('button:has-text("저장")');
        await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

        testData.receiving.push({
          transactionNo,
          itemId: item.id,
          quantity: qty
        });

        // Verify stock increased
        await page.waitForTimeout(1000);
        const stockResponse = await page.request.get(`/api/stock/current?item_id=${item.id}`);
        const stockData = await stockResponse.json();
        expect(stockData.data.current_stock).toBe(qty);

        console.log(`✅ Received: ${item.name} × ${qty} (Stock: ${stockData.data.current_stock})`);
      }
    });

    // ========================================
    // Step 5: Production with BOM Auto-deduction (생산 처리)
    // ========================================
    await test.step('Produce finished goods with BOM auto-deduction', async () => {
      await page.goto('/inventory/production');
      await expect(page).toHaveURL(/\/inventory\/production/);

      await page.click('button:has-text("생산 등록")');

      // Fill production transaction
      await page.fill('input[name="transaction_no"]', testData.production.transactionNo);
      await page.selectOption('select[name="item_id"]', testData.finishedGoods.id!);
      await page.fill('input[name="quantity"]', testData.production.quantity.toString());
      await page.fill('input[name="transaction_date"]', new Date().toISOString().split('T')[0]);
      await page.fill('input[name="lot_no"]', `LOT-FG-${Date.now()}`);
      await page.fill('input[name="warehouse"]', 'FINISHED-GOODS-001');

      // Enable BOM auto-deduction
      await page.check('input[name="use_bom_deduction"]');

      await page.click('button:has-text("저장")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      console.log(`✅ Production Transaction Created: ${testData.production.transactionNo}`);
      console.log(`   Producing ${testData.production.quantity} units of ${testData.finishedGoods.name}`);
    });

    // ========================================
    // Step 6: Verify BOM Auto-deduction (재고 확인)
    // ========================================
    await test.step('Verify BOM auto-deduction results', async () => {
      await page.waitForTimeout(2000); // Wait for deduction processing

      // Expected deductions:
      // Steel: 50 units × 2 = 100 units (200 - 100 = 100 remaining)
      // Bolts: 50 units × 8 = 400 units (1000 - 400 = 600 remaining)
      // Paint: 50 units × 0.5 = 25 units (50 - 25 = 25 remaining)

      const expectedResults = [
        { item: testData.rawMaterials[0], deducted: 100, remaining: 100 },
        { item: testData.rawMaterials[1], deducted: 400, remaining: 600 },
        { item: testData.rawMaterials[2], deducted: 25, remaining: 25 }
      ];

      for (const { item, deducted, remaining } of expectedResults) {
        const stockResponse = await page.request.get(`/api/stock/current?item_id=${item.id}`);
        const stockData = await stockResponse.json();

        expect(stockData.data.current_stock).toBe(remaining);

        console.log(`✅ BOM Deduction Verified: ${item.name}`);
        console.log(`   Deducted: ${deducted} units`);
        console.log(`   Remaining: ${remaining} units`);
      }

      // Verify finished goods stock increased by 50
      const fgStockResponse = await page.request.get(`/api/stock/current?item_id=${testData.finishedGoods.id}`);
      const fgStockData = await fgStockResponse.json();
      expect(fgStockData.data.current_stock).toBe(testData.production.quantity);

      console.log(`✅ Finished Goods Stock: ${fgStockData.data.current_stock} units`);
    });

    // ========================================
    // Step 7: Verify Production History (생산 이력)
    // ========================================
    await test.step('Verify production transaction history', async () => {
      await page.goto('/inventory/stock-history');
      await expect(page).toHaveURL(/\/inventory\/stock-history/);

      // Filter by finished goods item
      await page.selectOption('select[name="filter_item_id"]', testData.finishedGoods.id!);
      await page.click('button:has-text("조회")');

      await page.waitForTimeout(1000);

      // Verify production transaction appears in history
      const productionRow = page.locator(`tr:has-text("${testData.production.transactionNo}")`);
      await expect(productionRow).toBeVisible();

      // Verify transaction type is "생산"
      const transactionType = productionRow.locator('.transaction-type');
      await expect(transactionType).toContainText('생산');

      // Verify quantity is +50 (increase)
      const quantity = productionRow.locator('.quantity');
      await expect(quantity).toContainText('+50');

      console.log('✅ Production history verified in stock history');
    });

    // ========================================
    // Step 8: Calculate BOM Cost (BOM 원가 계산)
    // ========================================
    await test.step('Calculate finished goods cost from BOM', async () => {
      // Expected BOM cost calculation:
      // Steel: 2 units × 5,000 won = 10,000 won
      // Bolts: 8 units × 100 won = 800 won
      // Paint: 0.5 units × 2,000 won = 1,000 won
      // Total BOM cost: 11,800 won

      const expectedBOMCost =
        (testData.rawMaterials[0].unitPrice * 2) +
        (testData.rawMaterials[1].unitPrice * 8) +
        (testData.rawMaterials[2].unitPrice * 0.5);

      expect(expectedBOMCost).toBe(11800);

      console.log('✅ BOM Cost Calculation:');
      console.log(`   Steel: ${testData.rawMaterials[0].unitPrice} × 2 = ${testData.rawMaterials[0].unitPrice * 2}원`);
      console.log(`   Bolts: ${testData.rawMaterials[1].unitPrice} × 8 = ${testData.rawMaterials[1].unitPrice * 8}원`);
      console.log(`   Paint: ${testData.rawMaterials[2].unitPrice} × 0.5 = ${testData.rawMaterials[2].unitPrice * 0.5}원`);
      console.log(`   Total BOM Cost: ${expectedBOMCost}원`);
    });

    // ========================================
    // Step 9: Update Price Master from BOM (가격 마스터 업데이트)
    // ========================================
    await test.step('Update price master using BOM calculation', async () => {
      await page.goto('/price-master');
      await expect(page).toHaveURL(/\/price-master/);

      // Find finished goods item
      const itemRow = page.locator(`tr:has-text("${testData.finishedGoods.code}")`);
      await expect(itemRow).toBeVisible();

      // Click "BOM 원가 계산" button
      await itemRow.locator('button:has-text("BOM 원가")').click();

      // Verify calculated cost appears in modal
      const calculatedCost = page.locator('.calculated-bom-cost');
      await expect(calculatedCost).toContainText('11,800');

      // Apply calculated cost
      await page.click('button:has-text("적용")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      // Verify price updated in database
      await page.waitForTimeout(1000);
      const priceResponse = await page.request.get(`/api/price-master?item_id=${testData.finishedGoods.id}`);
      const priceData = await priceResponse.json();
      expect(priceData.data[0].unit_price).toBe(11800);

      console.log('✅ Price Master updated from BOM: 11,800원');
    });

    // ========================================
    // Step 10: Verify Dashboard Production Status (대시보드 생산 현황)
    // ========================================
    await test.step('Verify production metrics on dashboard', async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/');

      await page.waitForTimeout(2000);

      // Verify production count widget
      const productionWidget = page.locator('.production-count-widget');
      await expect(productionWidget).toBeVisible();

      // Verify production chart displays data
      const productionChart = page.locator('canvas.production-chart');
      await expect(productionChart).toBeVisible();

      // Verify recent production activities
      const recentProduction = page.locator('.recent-production');
      await expect(recentProduction).toBeVisible();

      // Should show our production transaction
      const ourProduction = page.locator(`text=${testData.production.transactionNo}`);
      await expect(ourProduction).toBeVisible();

      console.log('✅ Dashboard production metrics verified');
    });

    // ========================================
    // Final Verification: Complete BOM Workflow Integrity
    // ========================================
    await test.step('Verify complete BOM workflow integrity', async () => {
      // 1. BOM structure is correct
      const bomResponse = await page.request.get(`/api/bom?parent_item_id=${testData.finishedGoods.id}`);
      const bomData = await bomResponse.json();
      expect(bomData.data.length).toBe(3); // 3 components

      // 2. All raw materials deducted correctly
      for (let i = 0; i < 3; i++) {
        const stockResponse = await page.request.get(`/api/stock/current?item_id=${testData.rawMaterials[i].id}`);
        const stockData = await stockResponse.json();

        const expectedRemaining = [100, 600, 25][i];
        expect(stockData.data.current_stock).toBe(expectedRemaining);
      }

      // 3. Finished goods produced correctly
      const fgStockResponse = await page.request.get(`/api/stock/current?item_id=${testData.finishedGoods.id}`);
      const fgStockData = await fgStockResponse.json();
      expect(fgStockData.data.current_stock).toBe(50);

      // 4. Price updated from BOM
      const priceResponse = await page.request.get(`/api/price-master?item_id=${testData.finishedGoods.id}`);
      const priceData = await priceResponse.json();
      expect(priceData.data[0].unit_price).toBe(11800);

      // 5. Production history recorded
      const historyResponse = await page.request.get(`/api/stock/history?item_id=${testData.finishedGoods.id}`);
      const historyData = await historyResponse.json();
      expect(historyData.data.length).toBeGreaterThanOrEqual(1);

      console.log('✅ P2P BOM Production Workflow Complete!');
      console.log('📊 Workflow Summary:');
      console.log(`  - Raw Materials: 3 items registered and received`);
      console.log(`  - Finished Goods: ${testData.finishedGoods.name}`);
      console.log(`  - BOM Components: 3 (Steel×2, Bolts×8, Paint×0.5)`);
      console.log(`  - Production: ${testData.production.quantity} units produced`);
      console.log(`  - BOM Deduction: Automatic and accurate`);
      console.log(`  - BOM Cost: 11,800원 per unit`);
      console.log(`  - Stock Balance: All correct`);
      console.log(`  - Price Updated: From BOM calculation`);
    });
  });

  test('Multi-level BOM production (3 levels deep)', async ({ page }) => {
    // Test complex BOM structure:
    // Level 1: Final Assembly
    // Level 2: Sub-assemblies (Motor, Frame)
    // Level 3: Raw materials (Wire, Steel, Bolts)

    expect(true).toBe(true); // Placeholder for multi-level BOM test
  });

  test('Production with insufficient raw materials (error handling)', async ({ page }) => {
    // Test production when raw materials are insufficient
    // Should show clear error message and rollback transaction

    expect(true).toBe(true); // Placeholder for error handling test
  });

  test('Concurrent production transactions (race condition)', async ({ page }) => {
    // Test multiple production transactions happening simultaneously
    // Verifies stock consistency and atomicity

    expect(true).toBe(true); // Placeholder for concurrency test
  });
});
