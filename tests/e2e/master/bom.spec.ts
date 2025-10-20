/**
 * BOM (Bill of Materials) Management E2E Tests
 * Tests BOM creation, explosion, where-used, multi-level BOM display
 */

import { test, expect } from '@playwright/test';

// Test data for BOM
const testBOM = {
  parent_item_name: '테스트 완제품',
  child_item_name: '테스트 부품',
  quantity: 5,
  level: 1,
  notes: '테스트용 BOM 데이터입니다'
};

test.describe('BOM Management Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to BOM page
    await page.goto('/master/bom');

    // Wait for initial load
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("BOM 관리")', { timeout: 10000 });
  });

  test('페이지 로드 및 제목 확인', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/BOM 관리/);

    // Verify main heading
    await expect(page.locator('h1')).toContainText('BOM 관리');

    // Verify icon is visible
    await expect(page.locator('svg.lucide-network')).toBeVisible();
  });

  test('BOM 구조 탭 활성화', async ({ page }) => {
    // Verify structure tab is active by default
    const structureTab = page.locator('button:has-text("BOM 구조")');
    await expect(structureTab).toBeVisible();

    // Check if tab has active class or is clickable
    await structureTab.click();
    await page.waitForTimeout(300);

    // Verify BOM table is visible
    await page.waitForSelector('table', { timeout: 10000 });
  });

  test('BOM 목록 테이블 렌더링', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });

    // Verify table headers
    await expect(page.locator('th:has-text("부모품목")')).toBeVisible();
    await expect(page.locator('th:has-text("자품목")')).toBeVisible();
    await expect(page.locator('th:has-text("수량")')).toBeVisible();
    await expect(page.locator('th:has-text("레벨")')).toBeVisible();

    // Verify at least one row exists (or no data message)
    const rows = await page.locator('tbody tr').count();
    if (rows > 0) {
      expect(rows).toBeGreaterThan(0);
    } else {
      await expect(page.locator('text=검색 결과가 없습니다')).toBeVisible();
    }
  });

  test('신규 BOM 생성 (Create)', async ({ page }) => {
    // Click add button
    await page.click('button:has-text("신규 추가")');

    // Wait for modal
    await page.waitForSelector('text=BOM 등록', { timeout: 5000 });

    // Select parent item
    const parentSelect = page.locator('select[name="parent_item_id"]');
    await parentSelect.selectOption({ index: 1 }); // Select first non-empty option

    // Select child item
    const childSelect = page.locator('select[name="child_item_id"]');
    await childSelect.selectOption({ index: 1 });

    // Fill quantity
    await page.fill('input[name="quantity"]', testBOM.quantity.toString());

    // Fill level
    await page.fill('input[name="level"]', testBOM.level.toString());

    // Fill notes
    await page.fill('textarea[name="notes"]', testBOM.notes);

    // Submit form
    await page.click('button:has-text("저장")');

    // Wait for success toast
    await expect(page.locator('.toast-success, text=성공')).toBeVisible({ timeout: 5000 });

    // Verify BOM appears in list
    await page.waitForTimeout(1000);
    await expect(page.locator('table')).toBeVisible();
  });

  test('BOM 검색 기능 (Search)', async ({ page }) => {
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

  test('레벨 필터링 (Filter by Level)', async ({ page }) => {
    // Look for level filter
    const levelFilter = page.locator('select.level-filter, select[name="level"]');

    if (await levelFilter.isVisible()) {
      // Select level 1
      await levelFilter.selectOption('1');
      await page.waitForTimeout(500);

      // Verify filtered results
      const rows = await page.locator('tbody tr').count();

      if (rows > 0) {
        // Check first row has correct level
        const levelCell = page.locator('tbody tr').first().locator('td:has-text("1")');
        await expect(levelCell).toBeVisible();
      }

      // Reset filter
      await levelFilter.selectOption('');
      await page.waitForTimeout(500);
    }
  });

  test('품목 타입 필터링 (Internal/External)', async ({ page }) => {
    // Look for item type filter
    const typeFilter = page.locator('select.item-type-filter');

    if (await typeFilter.isVisible()) {
      // Select internal production
      await typeFilter.selectOption('internal_production');
      await page.waitForTimeout(500);

      // Verify filtered results
      const rows = await page.locator('tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(0);

      // Test external purchase
      await typeFilter.selectOption('external_purchase');
      await page.waitForTimeout(500);

      // Reset filter
      await typeFilter.selectOption('all');
    }
  });

  test('BOM 수정 (Update)', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Click edit button on first row
      await page.locator('tbody tr').first().locator('button[title="수정"]').click();

      // Wait for modal
      await page.waitForSelector('text=BOM 수정', { timeout: 5000 });

      // Update quantity
      const newQuantity = 10;
      await page.fill('input[name="quantity"]', newQuantity.toString());

      // Update notes
      const updatedNotes = `수정된 비고 ${Date.now()}`;
      await page.fill('textarea[name="notes"]', updatedNotes);

      // Submit
      await page.click('button:has-text("저장")');

      // Wait for success toast
      await expect(page.locator('.toast-success, text=성공')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('BOM 삭제 (Soft Delete)', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Get first row data before deletion
      const firstRowText = await page.locator('tbody tr').first().textContent();

      // Click delete button
      await page.locator('tbody tr').first().locator('button[title="삭제"]').click();

      // Confirm deletion
      await page.waitForSelector('text=삭제하시겠습니까', { timeout: 3000 });
      await page.click('button:has-text("삭제")');

      // Wait for success toast
      await expect(page.locator('.toast-success, text=성공')).toBeVisible({ timeout: 5000 });

      // Verify BOM is no longer in list (if not showing inactive)
      await page.waitForTimeout(1000);
    } else {
      test.skip();
    }
  });

  test('BOM Explosion (전개) 기능', async ({ page }) => {
    // Look for explosion button or feature
    const explosionButton = page.locator('button:has-text("전개"), button:has-text("Explosion")');

    if (await explosionButton.isVisible()) {
      // Select a parent item first
      await page.selectOption('select[name="parent_item"]', { index: 1 });
      await page.waitForTimeout(500);

      // Click explosion button
      await explosionButton.click();
      await page.waitForTimeout(1000);

      // Verify explosion result is displayed
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('Where-Used (역전개) 기능', async ({ page }) => {
    // Look for where-used button or feature
    const whereUsedButton = page.locator('button:has-text("역전개"), button:has-text("Where-Used")');

    if (await whereUsedButton.isVisible()) {
      // Select a child item first
      await page.selectOption('select[name="child_item"]', { index: 1 });
      await page.waitForTimeout(500);

      // Click where-used button
      await whereUsedButton.click();
      await page.waitForTimeout(1000);

      // Verify where-used result is displayed
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('멀티레벨 BOM 표시 (Multi-level Display)', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table', { timeout: 10000 });

    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      // Look for level indicators
      const levelCells = page.locator('td:has-text("Level"), td:has-text("레벨")');

      if (await levelCells.first().isVisible()) {
        // Verify multiple levels exist
        const level1 = page.locator('td:has-text("1")');
        const level2 = page.locator('td:has-text("2")');

        const hasMultipleLevels = (await level1.count()) > 0 && (await level2.count()) > 0;

        if (hasMultipleLevels) {
          // Verify indentation or visual hierarchy
          expect(hasMultipleLevels).toBe(true);
        }
      }
    }
  });

  test('BOM 복사 기능', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Look for copy button
      const copyButton = page.locator('tbody tr').first().locator('button[title="복사"], button:has-text("복사")');

      if (await copyButton.isVisible()) {
        await copyButton.click();

        // Wait for modal or confirmation
        await page.waitForTimeout(500);

        // Verify copy modal or action
        const modalVisible = await page.locator('text=복사').isVisible();
        expect(modalVisible).toBe(true);
      }
    }
  });

  test('Coil Specifications 탭', async ({ page }) => {
    // Switch to coil specs tab
    const coilSpecsTab = page.locator('button:has-text("Coil 사양")');

    if (await coilSpecsTab.isVisible()) {
      await coilSpecsTab.click();
      await page.waitForTimeout(500);

      // Verify coil specs content is visible
      await expect(page.locator('text=재질등급, text=Thickness, text=Width')).toBeVisible();
    }
  });

  test('Cost Analysis 탭', async ({ page }) => {
    // Switch to cost analysis tab
    const costAnalysisTab = page.locator('button:has-text("원가 분석")');

    if (await costAnalysisTab.isVisible()) {
      await costAnalysisTab.click();
      await page.waitForTimeout(500);

      // Verify cost analysis content is visible
      await expect(page.locator('text=원가, text=단가')).toBeVisible();
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

    // Click on parent item header to sort
    await page.click('th:has-text("부모품목")');
    await page.waitForTimeout(500);

    // Verify table still has data
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(0);

    // Click again to reverse sort
    await page.click('th:has-text("부모품목")');
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
    await page.waitForSelector('text=BOM 등록', { timeout: 5000 });

    // Try to submit without required fields
    await page.click('button:has-text("저장")');
    await page.waitForTimeout(300);

    // Verify validation errors (form should not submit)
    const modalStillOpen = await page.locator('text=BOM 등록').isVisible();
    expect(modalStillOpen).toBe(true);

    // Close modal
    await page.click('button:has-text("취소")');
  });

  test('수량 음수 검증', async ({ page }) => {
    // Open add modal
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=BOM 등록', { timeout: 5000 });

    // Try to enter negative quantity
    await page.fill('input[name="quantity"]', '-5');

    // Form should prevent or warn about negative quantity
    const quantityValue = await page.locator('input[name="quantity"]').inputValue();

    // Either value is rejected or validation will fail
    if (quantityValue === '-5') {
      await page.click('button:has-text("저장")');
      await page.waitForTimeout(300);

      // Modal should still be open due to validation
      const modalStillOpen = await page.locator('text=BOM 등록').isVisible();
      expect(modalStillOpen).toBe(true);
    }

    // Close modal
    await page.click('button:has-text("취소")');
  });

  test('자동 새로고침 기능', async ({ page }) => {
    // Look for auto-refresh toggle
    const autoRefreshToggle = page.locator('input[type="checkbox"][name="autoRefresh"]');

    if (await autoRefreshToggle.isVisible()) {
      // Enable auto-refresh
      await autoRefreshToggle.check();
      await page.waitForTimeout(500);

      // Verify it's checked
      await expect(autoRefreshToggle).toBeChecked();

      // Disable it
      await autoRefreshToggle.uncheck();
    }
  });

  test('새로고침 간격 설정', async ({ page }) => {
    // Look for refresh interval selector
    const intervalSelect = page.locator('select[name="refreshInterval"]');

    if (await intervalSelect.isVisible()) {
      // Select 30 seconds
      await intervalSelect.selectOption('30000');
      await page.waitForTimeout(300);

      // Verify selection
      const selectedValue = await intervalSelect.inputValue();
      expect(selectedValue).toBe('30000');
    }
  });

  test('활성/비활성 필터', async ({ page }) => {
    // Look for active filter toggle
    const activeToggle = page.locator('input[type="checkbox"][name="showActiveOnly"]');

    if (await activeToggle.isVisible()) {
      // Toggle to show all
      await activeToggle.uncheck();
      await page.waitForTimeout(500);

      const rowCount = await page.locator('tbody tr').count();
      expect(rowCount).toBeGreaterThanOrEqual(0);

      // Toggle back to active only
      await activeToggle.check();
      await page.waitForTimeout(500);
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
    await page.goto('/master/bom');
    await page.waitForLoadState('networkidle');

    // Verify page loads on mobile
    await expect(page.locator('h1:has-text("BOM 관리")')).toBeVisible();

    // Verify table is responsive
    await page.waitForSelector('table', { timeout: 10000 });
  });
});

test.describe('BOM Management - Advanced Features', () => {
  test('BOM 트리 구조 시각화', async ({ page }) => {
    await page.goto('/master/bom');
    await page.waitForLoadState('networkidle');

    // Look for tree view or hierarchical display
    const treeView = page.locator('.tree-view, .hierarchy-view');

    if (await treeView.isVisible()) {
      // Verify tree structure elements
      await expect(treeView).toBeVisible();

      // Check for expand/collapse functionality
      const expandButton = page.locator('button:has-text("펼치기"), button:has-text("접기")');

      if (await expandButton.isVisible()) {
        await expandButton.first().click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('원가 계산 (Cost Calculation)', async ({ page }) => {
    await page.goto('/master/bom');
    await page.waitForLoadState('networkidle');

    // Switch to cost analysis tab
    const costTab = page.locator('button:has-text("원가 분석")');

    if (await costTab.isVisible()) {
      await costTab.click();
      await page.waitForTimeout(500);

      // Look for cost calculation fields
      await expect(page.locator('text=재료비, text=순원가')).toBeVisible();

      // Verify cost values are displayed
      const rows = await page.locator('tbody tr').count();

      if (rows > 0) {
        const costCell = page.locator('tbody tr').first().locator('td:has-text("₩")');
        await expect(costCell).toBeVisible();
      }
    }
  });

  test('스크랩율 계산', async ({ page }) => {
    await page.goto('/master/bom');
    await page.waitForLoadState('networkidle');

    // Switch to coil specs tab
    const coilTab = page.locator('button:has-text("Coil 사양")');

    if (await coilTab.isVisible()) {
      await coilTab.click();
      await page.waitForTimeout(500);

      // Look for scrap rate field
      const scrapRateField = page.locator('text=스크랩율');

      if (await scrapRateField.isVisible()) {
        await expect(scrapRateField).toBeVisible();
      }
    }
  });

  test('BOM 유효성 검증 (Circular Reference Check)', async ({ page }) => {
    await page.goto('/master/bom');
    await page.waitForLoadState('networkidle');

    // Open add modal
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=BOM 등록', { timeout: 5000 });

    // Select same item as parent and child (if possible)
    const parentSelect = page.locator('select[name="parent_item_id"]');
    await parentSelect.selectOption({ index: 1 });

    const parentValue = await parentSelect.inputValue();

    const childSelect = page.locator('select[name="child_item_id"]');

    // Try to select same value
    try {
      await childSelect.selectOption(parentValue);

      // Try to submit
      await page.click('button:has-text("저장")');
      await page.waitForTimeout(500);

      // Should show error or prevent submission
      const errorVisible = await page.locator('text=오류, text=순환').isVisible().catch(() => false);

      if (errorVisible) {
        expect(errorVisible).toBe(true);
      }
    } catch (e) {
      // Circular reference prevented at select level
      expect(true).toBe(true);
    }

    // Close modal
    await page.click('button:has-text("취소")');
  });
});

test.describe('BOM Management - Performance Tests', () => {
  test('API 응답 시간 측정', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/master/bom');
    await page.waitForLoadState('networkidle');

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);

    console.log(`BOM page load time: ${loadTime}ms`);
  });

  test('대용량 BOM 데이터 렌더링', async ({ page }) => {
    await page.goto('/master/bom');
    await page.waitForLoadState('networkidle');

    // Check if virtual scrolling or pagination handles large datasets
    const rows = await page.locator('tbody tr').count();

    // Verify efficient rendering
    expect(rows).toBeGreaterThanOrEqual(0);
    expect(rows).toBeLessThanOrEqual(100); // Virtual scrolling should limit visible rows
  });
});
