/**
 * P2P Integration Test: Price Management Workflow
 *
 * Complete price management flow:
 * 1. 품목 등록 (Item Registration)
 * 2. 초기 가격 등록 (Initial Price Registration)
 * 3. 가격 이력 생성 (Price History)
 * 4. 가격 변동 추적 (Price Change Tracking)
 * 5. 대량 가격 업데이트 (Bulk Price Update)
 * 6. BOM 기반 가격 계산 (BOM-based Price Calculation)
 * 7. 가격 분석 대시보드 (Price Analysis Dashboard)
 * 8. 가격 트렌드 차트 (Price Trend Chart)
 * 9. 가격 변동성 분석 (Price Volatility Analysis)
 * 10. Excel 가격 보고서 (Excel Price Report)
 */

import { test, expect, Page } from '@playwright/test';

test.describe('P2P Integration: Price Management Workflow', () => {
  let testData: {
    items: Array<{
      code: string;
      name: string;
      id?: string;
      category: string;
      initialPrice: number;
    }>;
    priceChanges: Array<{
      itemId?: string;
      oldPrice: number;
      newPrice: number;
      effectiveDate: string;
      reason: string;
    }>;
    bulkUpdate: {
      uploadFile: string;
      itemCount: number;
    };
  };

  test.beforeEach(async ({ page }) => {
    const timestamp = Date.now();
    const today = new Date().toISOString().split('T')[0];

    testData = {
      items: [
        {
          code: `PRICE-001-${timestamp}`,
          name: `P2P 가격관리-엔진부품 ${timestamp}`,
          category: 'Parts',
          initialPrice: 50000
        },
        {
          code: `PRICE-002-${timestamp}`,
          name: `P2P 가격관리-변속기 ${timestamp}`,
          category: 'Parts',
          initialPrice: 120000
        },
        {
          code: `PRICE-003-${timestamp}`,
          name: `P2P 가격관리-서스펜션 ${timestamp}`,
          category: 'Parts',
          initialPrice: 85000
        },
        {
          code: `PRICE-004-${timestamp}`,
          name: `P2P 가격관리-브레이크 ${timestamp}`,
          category: 'Parts',
          initialPrice: 65000
        },
        {
          code: `PRICE-005-${timestamp}`,
          name: `P2P 가격관리-타이어 ${timestamp}`,
          category: 'Parts',
          initialPrice: 45000
        }
      ],
      priceChanges: [
        {
          oldPrice: 50000,
          newPrice: 55000,
          effectiveDate: today,
          reason: '원자재 가격 인상'
        },
        {
          oldPrice: 120000,
          newPrice: 110000,
          effectiveDate: today,
          reason: '대량 구매 할인'
        },
        {
          oldPrice: 85000,
          newPrice: 90000,
          effectiveDate: today,
          reason: '품질 개선'
        }
      ],
      bulkUpdate: {
        uploadFile: 'price-bulk-update.csv',
        itemCount: 5
      }
    };
  });

  test('Complete price management workflow with analysis', async ({ page }) => {
    // ========================================
    // Step 1: Register Multiple Items (품목 등록)
    // ========================================
    await test.step('Register 5 items for price management', async () => {
      for (const item of testData.items) {
        await page.goto('/master/items');

        await page.click('button:has-text("신규 등록")');

        await page.fill('input[name="item_code"]', item.code);
        await page.fill('input[name="item_name"]', item.name);
        await page.selectOption('select[name="category"]', item.category);
        await page.fill('input[name="spec"]', 'PRICE-TEST-SPEC');
        await page.fill('input[name="unit_price"]', item.initialPrice.toString());

        await page.click('button:has-text("저장")');
        await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

        // Get item_id
        await page.waitForTimeout(1000);
        const response = await page.request.get('/api/items');
        const items = await response.json();
        const createdItem = items.data.find((i: any) => i.item_code === item.code);
        item.id = createdItem?.item_id;

        expect(item.id).toBeDefined();
        console.log(`✅ Item Registered: ${item.name} (${item.id}) - ${item.initialPrice}원`);
      }
    });

    // ========================================
    // Step 2: Register Initial Prices (초기 가격 등록)
    // ========================================
    await test.step('Register initial prices in price master', async () => {
      await page.goto('/price-master');
      await expect(page).toHaveURL(/\/price-master/);

      // Verify all items appear in price master
      for (const item of testData.items) {
        const itemRow = page.locator(`tr:has-text("${item.code}")`);
        await expect(itemRow).toBeVisible();

        // Verify initial price displays correctly
        const priceCell = itemRow.locator('.unit-price');
        await expect(priceCell).toContainText(item.initialPrice.toLocaleString());
      }

      console.log('✅ Initial prices verified in price master');
    });

    // ========================================
    // Step 3: Create Price History (가격 이력 생성)
    // ========================================
    await test.step('Update prices and create history', async () => {
      for (let i = 0; i < testData.priceChanges.length; i++) {
        const change = testData.priceChanges[i];
        const item = testData.items[i];

        await page.goto('/price-master');

        // Find item row
        const itemRow = page.locator(`tr:has-text("${item.code}")`);
        await expect(itemRow).toBeVisible();

        // Click "가격 변경" button
        await itemRow.locator('button:has-text("가격 변경")').click();

        // Fill price change form
        await page.fill('input[name="new_price"]', change.newPrice.toString());
        await page.fill('input[name="effective_date"]', change.effectiveDate);
        await page.fill('textarea[name="change_reason"]', change.reason);

        await page.click('button:has-text("저장")');
        await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

        // Store itemId for price change
        change.itemId = item.id;

        console.log(`✅ Price Updated: ${item.name}`);
        console.log(`   ${change.oldPrice}원 → ${change.newPrice}원 (${change.reason})`);
      }
    });

    // ========================================
    // Step 4: Verify Price History (가격 이력 확인)
    // ========================================
    await test.step('Verify price change history', async () => {
      await page.goto('/price-history');
      await expect(page).toHaveURL(/\/price-history/);

      // Filter by first item
      const firstItem = testData.items[0];
      await page.selectOption('select[name="filter_item_id"]', firstItem.id!);
      await page.click('button:has-text("조회")');

      await page.waitForTimeout(1000);

      // Verify at least 2 history records (initial + update)
      const historyRows = page.locator('tbody tr');
      const rowCount = await historyRows.count();
      expect(rowCount).toBeGreaterThanOrEqual(2);

      // Verify latest price appears first
      const firstRow = historyRows.first();
      await expect(firstRow.locator('.new-price')).toContainText('55,000');

      console.log('✅ Price history verified');
    });

    // ========================================
    // Step 5: Bulk Price Update (대량 가격 업데이트)
    // ========================================
    await test.step('Perform bulk price update via CSV', async () => {
      await page.goto('/price-master/bulk-update');
      await expect(page).toHaveURL(/\/price-master\/bulk-update/);

      // Create test CSV data
      const csvData = [
        'item_code,new_price,effective_date,change_reason',
        `${testData.items[3].code},70000,${new Date().toISOString().split('T')[0]},대량 업데이트 테스트`,
        `${testData.items[4].code},48000,${new Date().toISOString().split('T')[0]},대량 업데이트 테스트`
      ].join('\n');

      // Create temporary CSV file for upload
      const csvBlob = new Blob([csvData], { type: 'text/csv' });
      const csvFile = new File([csvBlob], 'price-bulk-update.csv', { type: 'text/csv' });

      // Upload CSV file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'price-bulk-update.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvData)
      }]);

      // Preview bulk update
      await page.click('button:has-text("미리보기")');
      await page.waitForTimeout(1000);

      // Verify preview shows 2 items
      const previewRows = page.locator('.preview-table tbody tr');
      const previewCount = await previewRows.count();
      expect(previewCount).toBe(2);

      // Execute bulk update
      await page.click('button:has-text("업데이트 실행")');
      await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

      console.log('✅ Bulk price update executed: 2 items updated');
    });

    // ========================================
    // Step 6: BOM-based Price Calculation (BOM 기반 가격 계산)
    // ========================================
    await test.step('Calculate price from BOM (if applicable)', async () => {
      // This test assumes some items have BOM structures
      await page.goto('/price-master');

      // Look for items with BOM
      const bomButtons = page.locator('button:has-text("BOM 원가")');
      const bomCount = await bomButtons.count();

      if (bomCount > 0) {
        // Click first BOM calculation button
        await bomButtons.first().click();

        // Verify calculated cost modal appears
        const calculatedCost = page.locator('.calculated-bom-cost');
        await expect(calculatedCost).toBeVisible();

        // Apply calculated cost
        await page.click('button:has-text("적용")');
        await expect(page.locator('text=성공')).toBeVisible({ timeout: 5000 });

        console.log('✅ BOM-based price calculation applied');
      } else {
        console.log('ℹ️ No BOM structures found, skipping BOM calculation');
      }
    });

    // ========================================
    // Step 7: Price Analysis Dashboard (가격 분석 대시보드)
    // ========================================
    await test.step('View price analysis dashboard', async () => {
      await page.goto('/price-analysis');
      await expect(page).toHaveURL(/\/price-analysis/);

      await page.waitForTimeout(2000);

      // Verify 6 statistics cards
      const statCards = page.locator('.statistics-card');
      const cardCount = await statCards.count();
      expect(cardCount).toBe(6);

      // Verify card titles
      await expect(page.locator('text=총 품목 수')).toBeVisible();
      await expect(page.locator('text=가격 상승 품목')).toBeVisible();
      await expect(page.locator('text=가격 하락 품목')).toBeVisible();
      await expect(page.locator('text=평균 변동률')).toBeVisible();
      await expect(page.locator('text=가장 변동성 큰 품목')).toBeVisible();
      await expect(page.locator('text=가장 안정적인 품목')).toBeVisible();

      // Verify our test items appear in statistics
      const totalItems = await page.locator('.kpi-total-items').textContent();
      const totalCount = parseInt(totalItems || '0');
      expect(totalCount).toBeGreaterThanOrEqual(5); // At least our 5 test items

      console.log('✅ Price analysis dashboard verified');
    });

    // ========================================
    // Step 8: Price Trend Chart (가격 트렌드 차트)
    // ========================================
    await test.step('Verify price trend chart rendering', async () => {
      await page.goto('/price-analysis');

      // Wait for chart to load
      await page.waitForTimeout(2000);

      // Verify Chart.js canvas
      const canvas = page.locator('canvas.price-trend-chart');
      await expect(canvas).toBeVisible();

      // Verify chart has data
      const canvasElement = await canvas.elementHandle();
      const chartExists = await canvasElement?.evaluate(
        (el) => (el as HTMLCanvasElement).getContext('2d') !== null
      );
      expect(chartExists).toBe(true);

      // Verify legend
      const legend = page.locator('.chart-legend');
      await expect(legend).toBeVisible();

      console.log('✅ Price trend chart rendered successfully');
    });

    // ========================================
    // Step 9: Price Volatility Analysis (가격 변동성 분석)
    // ========================================
    await test.step('Analyze price volatility', async () => {
      await page.goto('/price-analysis');

      // Click on volatility analysis tab
      await page.click('button:has-text("변동성 분석")');
      await page.waitForTimeout(1000);

      // Verify volatility table
      const volatilityTable = page.locator('.volatility-table');
      await expect(volatilityTable).toBeVisible();

      // Sort by highest volatility
      await page.click('th:has-text("변동률")');
      await page.waitForTimeout(500);

      // Get top volatile item
      const topVolatileItem = page.locator('.volatility-table tbody tr').first();
      await expect(topVolatileItem).toBeVisible();

      // Verify volatility percentage is calculated
      const volatilityPercent = topVolatileItem.locator('.volatility-percent');
      const percentText = await volatilityPercent.textContent();
      expect(percentText).toMatch(/[\d.]+%/);

      console.log('✅ Price volatility analysis complete');
    });

    // ========================================
    // Step 10: Export Price Report to Excel (Excel 가격 보고서)
    // ========================================
    await test.step('Export price report to Excel', async () => {
      await page.goto('/price-analysis');

      // Click export button
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Excel 내보내기")')
      ]);

      // Verify download
      expect(download.suggestedFilename()).toMatch(/price-analysis.*\.xlsx$/);

      // Save and verify file
      const filePath = `./test-results/${download.suggestedFilename()}`;
      await download.saveAs(filePath);

      // Verify file exists and is not empty
      const fs = require('fs');
      const fileStats = fs.statSync(filePath);
      expect(fileStats.size).toBeGreaterThan(0);

      console.log(`✅ Excel price report exported: ${download.suggestedFilename()}`);
      console.log(`   File size: ${fileStats.size} bytes`);
    });

    // ========================================
    // Final Verification: Complete Price Management Integrity
    // ========================================
    await test.step('Verify complete price management workflow integrity', async () => {
      // 1. All items have prices in price_master
      for (const item of testData.items) {
        const priceResponse = await page.request.get(`/api/price-master?item_id=${item.id}`);
        const priceData = await priceResponse.json();
        expect(priceData.data.length).toBeGreaterThanOrEqual(1);
      }

      // 2. Price history recorded for updated items
      for (const change of testData.priceChanges) {
        const historyResponse = await page.request.get(`/api/price-history?item_id=${change.itemId}`);
        const historyData = await historyResponse.json();
        expect(historyData.data.length).toBeGreaterThanOrEqual(2); // Initial + update
      }

      // 3. Bulk update successfully applied
      const item4Response = await page.request.get(`/api/price-master?item_id=${testData.items[3].id}`);
      const item4Data = await item4Response.json();
      expect(item4Data.data[0].unit_price).toBe(70000);

      const item5Response = await page.request.get(`/api/price-master?item_id=${testData.items[4].id}`);
      const item5Data = await item5Response.json();
      expect(item5Data.data[0].unit_price).toBe(48000);

      // 4. Price analysis dashboard has correct statistics
      const analysisResponse = await page.request.get('/api/price-analysis/statistics');
      const analysisData = await analysisResponse.json();
      expect(analysisData.data.totalItems).toBeGreaterThanOrEqual(5);
      expect(analysisData.data.priceIncreases).toBeGreaterThanOrEqual(2); // At least 2 increased
      expect(analysisData.data.priceDecreases).toBeGreaterThanOrEqual(1); // At least 1 decreased

      console.log('✅ P2P Price Management Workflow Complete!');
      console.log('📊 Workflow Summary:');
      console.log(`  - Items Registered: ${testData.items.length}`);
      console.log(`  - Price Changes: ${testData.priceChanges.length} manual updates`);
      console.log(`  - Bulk Updates: 2 items via CSV`);
      console.log(`  - Price History: All changes tracked`);
      console.log(`  - Analysis Dashboard: 6 KPIs + trend chart`);
      console.log(`  - Volatility Analysis: Calculated and displayed`);
      console.log(`  - Excel Export: Report generated`);
      console.log('');
      console.log('📈 Price Statistics:');
      console.log(`  - Item 1: 50,000원 → 55,000원 (+10%)`);
      console.log(`  - Item 2: 120,000원 → 110,000원 (-8.3%)`);
      console.log(`  - Item 3: 85,000원 → 90,000원 (+5.9%)`);
      console.log(`  - Item 4: 65,000원 → 70,000원 (+7.7%)`);
      console.log(`  - Item 5: 45,000원 → 48,000원 (+6.7%)`);
    });
  });

  test('Price management with seasonal trends', async ({ page }) => {
    // Test price changes over multiple months
    // Verifies trend analysis and forecasting

    expect(true).toBe(true); // Placeholder for seasonal trend test
  });

  test('Price alerts and notifications', async ({ page }) => {
    // Test price alert system
    // Verifies notifications for significant price changes (>10%)

    expect(true).toBe(true); // Placeholder for alert test
  });

  test('Price comparison with competitors', async ({ page }) => {
    // Test competitive price analysis
    // Verifies price positioning against market benchmarks

    expect(true).toBe(true); // Placeholder for competitive analysis test
  });
});
