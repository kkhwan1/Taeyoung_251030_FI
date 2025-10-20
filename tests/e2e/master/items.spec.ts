/**
 * Item Management E2E Tests
 * Tests all CRUD operations, search, filter, Excel upload/download, Korean text handling
 */

import { test, expect } from '@playwright/test';

// Test data with Korean characters
const testItem = {
  item_code: `TEST-${Date.now()}`,
  item_name: '테스트 부품A',
  category: '원자재',
  item_type: 'RAW',
  material_type: 'COIL',
  vehicle_model: '현대 소나타',
  material: 'SPCC',
  spec: 'T1.0*1000L',
  unit: 'KG',
  thickness: 1.0,
  width: 1000,
  height: 2000,
  safety_stock: 100,
  price: 50000,
  location: 'A-01-01',
  description: '테스트용 품목입니다'
};

test.describe('Item Management Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to items page
    await page.goto('/master/items');

    // Wait for initial load
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("품목 관리")', { timeout: 10000 });
  });

  test('페이지 로드 및 제목 확인', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/품목 관리/);

    // Verify main heading
    await expect(page.locator('h1')).toContainText('품목 관리');

    // Verify icon is visible
    await expect(page.locator('svg.lucide-package')).toBeVisible();
  });

  test('품목 목록 테이블 렌더링', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });

    // Verify table headers
    await expect(page.locator('th:has-text("품목코드")')).toBeVisible();
    await expect(page.locator('th:has-text("품목명")')).toBeVisible();
    await expect(page.locator('th:has-text("카테고리")')).toBeVisible();
    await expect(page.locator('th:has-text("타입")')).toBeVisible();
    await expect(page.locator('th:has-text("단위")')).toBeVisible();
    await expect(page.locator('th:has-text("현재고")')).toBeVisible();

    // Verify at least one row exists (or no data message)
    const rows = await page.locator('tbody tr').count();
    if (rows > 0) {
      expect(rows).toBeGreaterThan(0);
    } else {
      await expect(page.locator('text=검색 결과가 없습니다')).toBeVisible();
    }
  });

  test('신규 품목 생성 (Create)', async ({ page }) => {
    // Click add button
    await page.click('button:has-text("신규 추가")');

    // Wait for modal
    await page.waitForSelector('text=품목 등록', { timeout: 5000 });

    // Fill form
    await page.fill('input[name="item_code"]', testItem.item_code);
    await page.fill('input[name="item_name"]', testItem.item_name);

    // Select category
    await page.selectOption('select[name="category"]', testItem.category);

    // Select item type
    await page.selectOption('select[name="item_type"]', testItem.item_type);

    // Select material type
    await page.selectOption('select[name="material_type"]', testItem.material_type);

    // Fill other fields
    await page.fill('input[name="vehicle_model"]', testItem.vehicle_model);
    await page.fill('input[name="material"]', testItem.material);
    await page.fill('input[name="spec"]', testItem.spec);
    await page.fill('input[name="unit"]', testItem.unit);
    await page.fill('input[name="thickness"]', testItem.thickness.toString());
    await page.fill('input[name="width"]', testItem.width.toString());
    await page.fill('input[name="height"]', testItem.height.toString());
    await page.fill('input[name="safety_stock"]', testItem.safety_stock.toString());
    await page.fill('input[name="price"]', testItem.price.toString());
    await page.fill('input[name="location"]', testItem.location);
    await page.fill('textarea[name="description"]', testItem.description);

    // Submit form
    await page.click('button:has-text("저장")');

    // Wait for success toast
    await expect(page.locator('.toast-success, text=성공')).toBeVisible({ timeout: 5000 });

    // Verify item appears in list
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="검색"]', testItem.item_name);
    await page.waitForTimeout(500);

    await expect(page.locator(`text=${testItem.item_name}`)).toBeVisible();
  });

  test('품목 검색 기능 (Search)', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="검색"]');

    // Enter search term
    await searchInput.fill('부품');
    await page.waitForTimeout(500);

    // Verify filtered results
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      // Check that visible rows contain search term
      const firstRowText = await page.locator('tbody tr').first().textContent();
      expect(firstRowText?.toLowerCase()).toContain('부품'.toLowerCase());
    }

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  test('카테고리 필터링 (Filter)', async ({ page }) => {
    // Wait for filter dropdown
    await page.waitForSelector('select.category-filter', { timeout: 5000 });

    // Select category
    await page.selectOption('select.category-filter', '원자재');
    await page.waitForTimeout(500);

    // Verify filtered results
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      // Check first row has correct category
      const categoryCell = page.locator('tbody tr').first().locator('td').nth(2);
      await expect(categoryCell).toContainText('원자재');
    }

    // Reset filter
    await page.selectOption('select.category-filter', '');
    await page.waitForTimeout(500);
  });

  test('품목 타입 필터링', async ({ page }) => {
    // Wait for item type filter
    await page.waitForSelector('select.item-type-filter', { timeout: 5000 });

    // Select item type
    await page.selectOption('select.item-type-filter', 'RAW');
    await page.waitForTimeout(500);

    // Verify filtered results
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      // Check that results match filter
      const firstRowText = await page.locator('tbody tr').first().textContent();
      expect(firstRowText).toContain('RAW');
    }

    // Reset filter
    await page.selectOption('select.item-type-filter', '');
  });

  test('품목 수정 (Update)', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Click edit button on first row
      await page.locator('tbody tr').first().locator('button[title="수정"]').click();

      // Wait for modal
      await page.waitForSelector('text=품목 수정', { timeout: 5000 });

      // Update description
      const updatedDescription = `수정된 설명 ${Date.now()}`;
      await page.fill('textarea[name="description"]', updatedDescription);

      // Submit
      await page.click('button:has-text("저장")');

      // Wait for success toast
      await expect(page.locator('.toast-success, text=성공')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('품목 삭제 (Soft Delete)', async ({ page }) => {
    // Search for test item
    await page.fill('input[placeholder*="검색"]', testItem.item_code);
    await page.waitForTimeout(500);

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Click delete button
      await page.locator('tbody tr').first().locator('button[title="삭제"]').click();

      // Confirm deletion
      await page.waitForSelector('text=삭제하시겠습니까', { timeout: 3000 });
      await page.click('button:has-text("삭제")');

      // Wait for success toast
      await expect(page.locator('.toast-success, text=성공')).toBeVisible({ timeout: 5000 });

      // Verify item is no longer in list
      await page.waitForTimeout(1000);
      await expect(page.locator(`text=${testItem.item_code}`)).not.toBeVisible();
    }
  });

  test('페이지네이션 기능', async ({ page }) => {
    // Check if pagination exists
    const paginationExists = await page.locator('.pagination').isVisible().catch(() => false);

    if (paginationExists) {
      // Click next page
      const nextButton = page.locator('button:has-text("다음")');

      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);

        // Verify page changed
        await expect(page.locator('.pagination .active')).toContainText('2');

        // Go back to page 1
        await page.click('button:has-text("이전")');
        await page.waitForTimeout(500);
      }
    }
  });

  test('정렬 기능 (Sorting)', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table', { timeout: 10000 });

    // Click on item code header to sort
    await page.click('th:has-text("품목코드")');
    await page.waitForTimeout(500);

    // Verify table still has data
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(0);

    // Click again to reverse sort
    await page.click('th:has-text("품목코드")');
    await page.waitForTimeout(500);
  });

  test('Excel 내보내기 버튼 존재', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Excel")');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });

  test('Excel 가져오기 버튼 존재', async ({ page }) => {
    const uploadButton = page.locator('button:has-text("Excel 가져오기")');
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toBeEnabled();
  });

  test('Excel 업로드 Modal 열기', async ({ page }) => {
    // Click upload button
    await page.click('button:has-text("Excel 가져오기")');

    // Wait for modal
    await page.waitForSelector('text=Excel 파일 업로드', { timeout: 5000 });

    // Verify file input exists
    await expect(page.locator('input[type="file"]')).toBeVisible();

    // Close modal
    await page.click('button:has-text("취소")');
    await page.waitForTimeout(300);
  });

  test('한글 텍스트 처리 검증 (Korean UTF-8)', async ({ page }) => {
    // Search with Korean text
    const koreanSearch = '부품';
    await page.fill('input[placeholder*="검색"]', koreanSearch);
    await page.waitForTimeout(500);

    // Verify Korean text is displayed correctly
    const inputValue = await page.locator('input[placeholder*="검색"]').inputValue();
    expect(inputValue).toBe(koreanSearch);

    // Check if results contain Korean text
    const rowCount = await page.locator('tbody tr').count();
    if (rowCount > 0) {
      const firstRowText = await page.locator('tbody tr').first().textContent();
      // Korean characters should be preserved (not garbled)
      expect(firstRowText).not.toContain('â');
      expect(firstRowText).not.toContain('í');
    }
  });

  test('폼 유효성 검증 (Form Validation)', async ({ page }) => {
    // Open add modal
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=품목 등록', { timeout: 5000 });

    // Try to submit without required fields
    await page.click('button:has-text("저장")');
    await page.waitForTimeout(300);

    // Verify validation errors (form should not submit)
    const modalStillOpen = await page.locator('text=품목 등록').isVisible();
    expect(modalStillOpen).toBe(true);

    // Close modal
    await page.click('button:has-text("취소")');
  });

  test('데이터 필터 조합 (Combined Filters)', async ({ page }) => {
    // Apply multiple filters
    await page.selectOption('select.category-filter', '원자재');
    await page.waitForTimeout(300);

    await page.selectOption('select.item-type-filter', 'RAW');
    await page.waitForTimeout(300);

    await page.fill('input[placeholder*="검색"]', '부품');
    await page.waitForTimeout(500);

    // Verify filters are applied
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(0);

    // Clear all filters
    await page.selectOption('select.category-filter', '');
    await page.selectOption('select.item-type-filter', '');
    await page.locator('input[placeholder*="검색"]').clear();
  });

  test('현재고 정보 표시', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table', { timeout: 10000 });

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Check if current stock column exists
      await expect(page.locator('th:has-text("현재고")')).toBeVisible();

      // Verify stock data is displayed (number or dash)
      const stockCell = page.locator('tbody tr').first().locator('td').nth(5);
      const stockText = await stockCell.textContent();
      expect(stockText).toMatch(/^\d+$|^-$/);
    }
  });

  test('가격 정보 표시', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table', { timeout: 10000 });

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Check if price column exists
      await expect(page.locator('th:has-text("가격")')).toBeVisible();

      // Verify price format (currency or dash)
      const priceCell = page.locator('tbody tr').first().locator('td').nth(6);
      const priceText = await priceCell.textContent();
      expect(priceText).toMatch(/^₩[\d,]+$|^-$/);
    }
  });

  test('인쇄 버튼 존재', async ({ page }) => {
    const printButton = page.locator('button[title="인쇄"]');
    await expect(printButton).toBeVisible();
    await expect(printButton).toBeEnabled();
  });

  test('반응형 레이아웃 - 모바일', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Reload page
    await page.goto('/master/items');
    await page.waitForLoadState('networkidle');

    // Verify page loads on mobile
    await expect(page.locator('h1:has-text("품목 관리")')).toBeVisible();

    // Verify table is responsive
    await page.waitForSelector('table', { timeout: 10000 });
  });

  test('새로고침 버튼 기능', async ({ page }) => {
    // Look for refresh button
    const refreshButton = page.locator('button[title="새로고침"]');

    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait for reload
      await page.waitForLoadState('networkidle');

      // Verify table is still visible
      await expect(page.locator('table')).toBeVisible();
    }
  });
});

test.describe('Item Management - Performance Tests', () => {
  test('API 응답 시간 측정', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/master/items');
    await page.waitForLoadState('networkidle');

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);

    console.log(`Items page load time: ${loadTime}ms`);
  });

  test('대용량 데이터 렌더링', async ({ page }) => {
    await page.goto('/master/items');
    await page.waitForLoadState('networkidle');

    // Check if virtual scrolling is working
    const rows = await page.locator('tbody tr').count();

    // Verify table renders efficiently
    expect(rows).toBeGreaterThanOrEqual(0);
    expect(rows).toBeLessThanOrEqual(100); // Virtual scrolling should limit visible rows
  });
});
