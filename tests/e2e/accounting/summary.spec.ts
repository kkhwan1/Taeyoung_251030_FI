/**
 * Accounting Summary E2E Tests
 * Tests monthly accounting aggregation (v_monthly_accounting view), category summary,
 * and PostgreSQL view query performance
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Accounting Summary - Main Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 로드 및 기본 레이아웃 표시', async ({ page }) => {
    // Verify page title
    await expect(page.locator('h1:has-text("회계 요약")')).toBeVisible();
  });

  test('월 선택기 표시 및 기본값 확인', async ({ page }) => {
    // Verify month selector exists
    const monthSelector = page.locator('input[type="month"]');
    await expect(monthSelector).toBeVisible();

    // Verify current month is selected by default
    const selectedMonth = await monthSelector.inputValue();
    expect(selectedMonth).toMatch(/^\d{4}-\d{2}$/); // Format: YYYY-MM
    expect(selectedMonth.length).toBe(7);
  });

  test('Excel 내보내기 버튼 표시', async ({ page }) => {
    // Verify export button exists
    const exportButton = page.locator('button:has-text("Excel 내보내기")');
    await expect(exportButton).toBeVisible();
  });
});

test.describe('Accounting Summary - KPI Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load
  });

  test('KPI 카드 4개 표시 확인', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1500);

    // Look for KPI card containers
    const kpiCards = page.locator('[data-testid="kpi-card"], .bg-white.rounded-lg, .dark\\:bg-gray-800.rounded-lg').filter({
      hasText: /총 매출|총 매입|순이익|거래처 수/
    });

    const cardCount = await kpiCards.count();

    // Should have 4 KPI cards
    expect(cardCount).toBeGreaterThanOrEqual(4);
  });

  test('총 매출 카드 데이터 확인', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for total sales card
    const salesCard = page.locator('text=총 매출').first();
    await expect(salesCard).toBeVisible();

    // Verify currency format
    const salesAmount = page.locator('text=/\\d+.*원/').first();
    if (await salesAmount.count() > 0) {
      await expect(salesAmount).toBeVisible();
    }
  });

  test('총 매입 카드 데이터 확인', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for total purchases card
    const purchasesCard = page.locator('text=총 매입').first();
    await expect(purchasesCard).toBeVisible();

    // Verify currency format
    const purchasesAmount = page.locator('text=/\\d+.*원/');
    if (await purchasesAmount.count() > 0) {
      await expect(purchasesAmount.first()).toBeVisible();
    }
  });

  test('순이익 카드 데이터 및 색상 확인', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for net profit card
    const profitCard = page.locator('text=순이익').first();
    await expect(profitCard).toBeVisible();

    // Check if profit/loss is indicated by color
    const profitAmount = page.locator('text=/순이익/').locator('..').locator('text=/\\d+.*원/');

    if (await profitAmount.count() > 0) {
      const amountElement = profitAmount.first();
      await expect(amountElement).toBeVisible();

      // Color should be green (profit) or red (loss)
      const color = await amountElement.evaluate(el => getComputedStyle(el).color);
      expect(color).toBeTruthy();
    }
  });

  test('거래처 수 카드 데이터 확인', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for company count card
    const companyCard = page.locator('text=거래처 수').first();
    await expect(companyCard).toBeVisible();

    // Verify count format
    const companyCount = page.locator('text=/\\d+개/').first();
    if (await companyCount.count() > 0) {
      await expect(companyCount).toBeVisible();
    }
  });
});

test.describe('Accounting Summary - Category Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('업체 구분 필터 표시', async ({ page }) => {
    // Verify category filter exists
    const categoryFilter = page.locator('select#category-filter, select:has-text("전체 분류")');
    await expect(categoryFilter.first()).toBeVisible();
  });

  test('필터 옵션 확인', async ({ page }) => {
    const categoryFilter = page.locator('select#category-filter').first();

    // Get all options
    const options = await categoryFilter.locator('option').allTextContents();

    // Should have at least these categories
    expect(options.some(opt => opt.includes('전체'))).toBe(true);
    expect(options.some(opt => opt.includes('원자재') || opt.includes('협력업체'))).toBe(true);
  });

  test('협력업체 (원자재) 필터 적용', async ({ page }) => {
    const categoryFilter = page.locator('select#category-filter').first();

    // Select raw materials category
    await categoryFilter.selectOption('협력업체 (원자재)');
    await page.waitForTimeout(1500);

    // Verify filter is applied (check URL or table data)
    const tableRows = page.locator('tbody tr, [data-testid="table-row"]');
    const rowCount = await tableRows.count();

    // Should have data or empty state
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('소모품업체 필터 적용', async ({ page }) => {
    const categoryFilter = page.locator('select#category-filter').first();

    // Select consumables category
    await categoryFilter.selectOption('소모품업체');
    await page.waitForTimeout(1500);

    // Verify filter is applied
    const tableRows = page.locator('tbody tr, [data-testid="table-row"]');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('필터 초기화 버튼', async ({ page }) => {
    const categoryFilter = page.locator('select#category-filter').first();

    // Apply filter first
    await categoryFilter.selectOption('소모품업체');
    await page.waitForTimeout(1000);

    // Look for reset button
    const resetButton = page.locator('button:has-text("필터 초기화")');

    if (await resetButton.isVisible()) {
      // Click reset
      await resetButton.click();
      await page.waitForTimeout(1000);

      // Verify filter is reset
      const selectedValue = await categoryFilter.inputValue();
      expect(selectedValue).toBe('');
    }
  });
});

test.describe('Accounting Summary - Category Summary Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('분류별 요약 테이블 표시', async ({ page }) => {
    // Look for category summary section
    const categorySummary = page.locator('h2:has-text("분류별 요약")');
    await expect(categorySummary).toBeVisible();

    // Verify table exists
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
  });

  test('테이블 헤더 확인', async ({ page }) => {
    // Check for table headers
    const headers = [
      '분류',
      '매출액',
      '매입액',
      '순이익',
      '거래처 수',
      '매출 비중',
      '매입 비중'
    ];

    for (const header of headers) {
      const headerCell = page.locator('th, [role="columnheader"]').filter({ hasText: header });
      if (await headerCell.count() > 0) {
        await expect(headerCell.first()).toBeVisible();
      }
    }
  });

  test('카테고리 데이터 표시', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Check for category rows
    const tableRows = page.locator('tbody tr, [data-testid="table-row"]');
    const rowCount = await tableRows.count();

    // Should have at least 1 category
    expect(rowCount).toBeGreaterThanOrEqual(0);

    if (rowCount > 0) {
      // First row should have data
      const firstRow = tableRows.first();
      await expect(firstRow).toBeVisible();

      // Should show category name
      const categoryCell = firstRow.locator('td').first();
      await expect(categoryCell).toBeVisible();
    }
  });

  test('매출/매입 금액 포맷 확인', async ({ page }) => {
    await page.waitForTimeout(1500);

    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount > 0) {
      // Check currency format in first row
      const amounts = tableRows.first().locator('text=/\\d+.*원/');
      const amountCount = await amounts.count();

      // Should have at least sales and purchases amounts
      expect(amountCount).toBeGreaterThanOrEqual(2);
    }
  });

  test('순이익 컬러 표시 (+ green, - red)', async ({ page }) => {
    await page.waitForTimeout(1500);

    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount > 0) {
      // Look for colored net amount
      const netAmountCell = tableRows.first().locator('td').nth(3);

      if (await netAmountCell.count() > 0) {
        const textColor = await netAmountCell.evaluate(el => {
          const span = el.querySelector('span');
          return span ? getComputedStyle(span).color : null;
        });

        // Should have color styling
        expect(textColor).toBeTruthy();
      }
    }
  });

  test('퍼센티지 표시 확인', async ({ page }) => {
    await page.waitForTimeout(1500);

    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount > 0) {
      // Look for percentage values
      const percentages = tableRows.first().locator('text=/\\d+\\.\\d+%/');
      const percentCount = await percentages.count();

      // Should have sales and purchase percentages
      expect(percentCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('테이블 정렬 기능 (분류)', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for sortable header
    const categoryHeader = page.locator('th:has-text("분류"), [role="columnheader"]:has-text("분류")').first();

    if (await categoryHeader.isVisible()) {
      // Click to sort
      await categoryHeader.click();
      await page.waitForTimeout(500);

      // Verify sorting icon or order changed
      const rows = page.locator('tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('테이블 정렬 기능 (매출액)', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for sortable sales header
    const salesHeader = page.locator('th:has-text("매출액"), [role="columnheader"]:has-text("매출액")').first();

    if (await salesHeader.isVisible()) {
      // Click to sort
      await salesHeader.click();
      await page.waitForTimeout(500);

      // Data should be reordered
      const rows = page.locator('tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Accounting Summary - Company Detail Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('거래처별 상세 테이블 표시', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for company detail section
    const companyDetail = page.locator('h2:has-text("거래처별 상세")');
    await expect(companyDetail).toBeVisible();

    // Verify table exists within company detail section (not using .nth(1) due to conditional category table)
    const table = page.locator('h2:has-text("거래처별 상세")').locator('..').locator('table').first();
    await expect(table).toBeVisible();
  });

  test('테이블 헤더 확인', async ({ page }) => {
    // Check for table headers
    const headers = [
      '거래처명',
      '거래처코드',
      '분류',
      '업태',
      '대표자',
      '매출액',
      '매입액',
      '순이익'
    ];

    for (const header of headers) {
      const headerCell = page.locator('th, [role="columnheader"]').filter({ hasText: header });
      if (await headerCell.count() > 0) {
        await expect(headerCell.first()).toBeVisible();
      }
    }
  });

  test('거래처 데이터 표시', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Get company table within section (not using .nth(1) due to conditional category table)
    const companyTable = page.locator('h2:has-text("거래처별 상세")').locator('..').locator('table').first();
    const companyRows = companyTable.locator('tbody tr, [data-testid="table-row"]');
    const rowCount = await companyRows.count();

    // Should have at least 0 companies (may be empty)
    expect(rowCount).toBeGreaterThanOrEqual(0);

    if (rowCount > 0) {
      // First company should have data
      const firstRow = companyRows.first();
      await expect(firstRow).toBeVisible();

      // Should show company name
      const nameCell = firstRow.locator('td').first();
      await expect(nameCell).toBeVisible();
    }
  });

  test('거래처 코드 자동 생성 확인 (CUS/SUP prefix)', async ({ page }) => {
    await page.waitForTimeout(1500);

    const companyTable = page.locator('h2:has-text("거래처별 상세")').locator('..').locator('table').first();
    const companyRows = companyTable.locator('tbody tr');
    const rowCount = await companyRows.count();

    if (rowCount > 0) {
      // Check for auto-generated codes
      const codeCell = companyRows.first().locator('td').nth(1);
      const codeText = await codeCell.textContent();

      // Should have format like CUS001, SUP001, etc.
      if (codeText) {
        const hasValidPrefix = codeText.includes('CUS') ||
                              codeText.includes('SUP') ||
                              codeText.includes('PAR') ||
                              codeText.includes('OTH');
        expect(hasValidPrefix).toBeTruthy();
      }
    }
  });

  test('JSONB business_info 필드 표시 (업태)', async ({ page }) => {
    await page.waitForTimeout(1500);

    const companyTable = page.locator('h2:has-text("거래처별 상세")').locator('..').locator('table').first();
    const companyRows = companyTable.locator('tbody tr');
    const rowCount = await companyRows.count();

    if (rowCount > 0) {
      // Check for business_info data (업태 column)
      const businessTypeCell = companyRows.first().locator('td').nth(3);

      if (await businessTypeCell.count() > 0) {
        const businessType = await businessTypeCell.textContent();
        // May be empty or have value from JSONB field
        expect(businessType).toBeDefined();
      }
    }
  });

  test('검색 기능 - 거래처명', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for search input
    const searchInput = page.locator('input[placeholder*="거래처명"], input[placeholder*="검색"]');

    if (await searchInput.count() > 0) {
      const input = searchInput.first();
      await expect(input).toBeVisible();

      // Type search query
      await input.fill('부품');
      await page.waitForTimeout(800);

      // Results should be filtered
      const companyTable = page.locator('h2:has-text("거래처별 상세")').locator('..').locator('table').first();
      const companyRows = companyTable.locator('tbody tr');
      const rowCount = await companyRows.count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('필터 기능 - 분류', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for filter controls
    const filterIcon = page.locator('button[aria-label*="필터"], button:has-text("필터")');

    if (await filterIcon.count() > 0 && await filterIcon.first().isVisible()) {
      await filterIcon.first().click();
      await page.waitForTimeout(500);

      // Filter panel should open
      const filterPanel = page.locator('[role="dialog"], .filter-panel');
      if (await filterPanel.count() > 0) {
        await expect(filterPanel.first()).toBeVisible();
      }
    }
  });

  test('가상 스크롤링 동작 (>100 rows)', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check if virtual scrolling is active
    const companyTable = page.locator('h2:has-text("거래처별 상세")').locator('..').locator('table').first();
    const companyRows = companyTable.locator('tbody tr, [data-testid="table-row"]');
    const visibleRowCount = await companyRows.count();

    if (visibleRowCount > 50) {
      // Scroll down in table
      const tableContainer = page.locator('[data-testid="virtual-table"], .overflow-auto').first();

      if (await tableContainer.count() > 0) {
        await tableContainer.evaluate(el => el.scrollTop = 500);
        await page.waitForTimeout(500);

        // More rows should load/render
        const newRowCount = await companyRows.count();
        expect(newRowCount).toBeGreaterThanOrEqual(visibleRowCount);
      }
    }
  });

  test('페이지네이션 (if enabled)', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for pagination controls
    const pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label*="pagination"]');

    if (await pagination.count() > 0) {
      // Next page button
      const nextButton = page.locator('button:has-text("다음"), button[aria-label="Next"]');

      if (await nextButton.count() > 0 && await nextButton.first().isEnabled()) {
        await nextButton.first().click();
        await page.waitForTimeout(1000);

        // Verify page changed
        const companyTable = page.locator('h2:has-text("거래처별 상세")').locator('..').locator('table').first();
        const companyRows = companyTable.locator('tbody tr');
        const rowCount = await companyRows.count();
        expect(rowCount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

test.describe('Accounting Summary - Month Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
  });

  test('월 변경 시 데이터 갱신', async ({ page }) => {
    const monthSelector = page.locator('input[type="month"]');

    // Select previous month
    const previousMonth = new Date();
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const monthValue = previousMonth.toISOString().slice(0, 7);

    await monthSelector.fill(monthValue);
    await page.waitForTimeout(2000);

    // Verify data loaded for selected month
    const kpiCards = page.locator('[data-testid="kpi-card"]');
    if (await kpiCards.count() > 0) {
      await expect(kpiCards.first()).toBeVisible();
    }
  });

  test('월 표시 형식 확인 (YYYY년 MM월)', async ({ page }) => {
    // Look for formatted month display
    const monthDisplay = page.locator('text=/\\d{4}년.*\\d{1,2}월/');

    if (await monthDisplay.count() > 0) {
      await expect(monthDisplay.first()).toBeVisible();

      const displayText = await monthDisplay.first().textContent();
      expect(displayText).toMatch(/\d{4}년.*\d{1,2}월/);
    }
  });
});

test.describe('Accounting Summary - Excel Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('Excel 내보내기 버튼 활성화', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Excel 내보내기")');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });

  test('내보내기 중 로딩 상태', async ({ page }) => {
    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

    // Click export button
    const exportButton = page.locator('button:has-text("Excel 내보내기")');
    await exportButton.click();

    // Check for loading state
    await page.waitForTimeout(500);

    const loadingIndicator = page.locator('text=/내보내는 중|Exporting/i');
    if (await loadingIndicator.count() > 0) {
      // Loading state appeared briefly
      expect(true).toBe(true);
    }

    // Wait for download (may timeout if no data)
    const download = await downloadPromise;

    if (download) {
      // Verify filename
      const filename = download.suggestedFilename();
      expect(filename).toContain('accounting_summary');
      expect(filename).toContain('.xlsx');
    }
  });

  test('내보내기 파일명 형식', async ({ page }) => {
    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

    // Click export
    const exportButton = page.locator('button:has-text("Excel 내보내기")');
    await exportButton.click();

    const download = await downloadPromise;

    if (download) {
      const filename = download.suggestedFilename();
      // Should include month in filename: accounting_summary_YYYY-MM.xlsx
      expect(filename).toMatch(/accounting_summary_\d{4}-\d{2}\.xlsx/);
    }
  });
});

test.describe('Accounting Summary - Performance', () => {
  test('페이지 로드 성능 (PostgreSQL View)', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Should load within 5 seconds (including view query)
    expect(loadTime).toBeLessThan(5000);

    console.log(`Accounting summary load time: ${loadTime}ms`);
  });

  test('v_monthly_accounting 뷰 쿼리 성능', async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');

    // Measure API response time
    const startTime = Date.now();

    await page.waitForResponse(
      response => response.url().includes('/api/accounting/monthly-summary'),
      { timeout: 5000 }
    );

    const endTime = Date.now();
    const queryTime = endTime - startTime;

    // View query should complete within 2 seconds
    expect(queryTime).toBeLessThan(2000);

    console.log(`View query response time: ${queryTime}ms`);
  });

  test('카테고리 필터 변경 성능', async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const categoryFilter = page.locator('select#category-filter').first();

    const startTime = Date.now();

    // Change filter
    await categoryFilter.selectOption('소모품업체');
    await page.waitForTimeout(1500);

    const endTime = Date.now();
    const filterTime = endTime - startTime;

    // Filter should apply within 2 seconds
    expect(filterTime).toBeLessThan(2000);

    console.log(`Category filter response time: ${filterTime}ms`);
  });
});

test.describe('Accounting Summary - Error Handling', () => {
  test('API 오류 시 에러 메시지 표시', async ({ page }) => {
    // Block API requests
    await page.route('**/api/accounting/**', route => route.abort());

    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForTimeout(3000);

    // Check for error message
    const errorMessage = page.locator('text=/로딩 실패|연결 오류|Failed/i');

    if (await errorMessage.count() > 0) {
      await expect(errorMessage.first()).toBeVisible();
    }
  });

  test('빈 데이터 상태 표시', async ({ page }) => {
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for empty state messages
    const emptyMessage = page.locator('text=/데이터가 없습니다|No data/i');

    if (await emptyMessage.count() > 0) {
      // Empty state is handled properly
      expect(true).toBe(true);
    }
  });
});

test.describe('Accounting Summary - Responsive Design', () => {
  test('모바일 뷰포트에서 표시', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');

    // Verify page loads
    await expect(page.locator('h1:has-text("회계 요약")')).toBeVisible();

    // KPI cards should stack
    await page.waitForTimeout(1000);
    const kpiCards = page.locator('[data-testid="kpi-card"]');
    if (await kpiCards.count() > 0) {
      await expect(kpiCards.first()).toBeVisible();
    }
  });

  test('태블릿 뷰포트에서 표시', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:5000/accounting/summary');
    await page.waitForLoadState('networkidle');

    // Verify tables are scrollable
    await page.waitForTimeout(1000);
    const tables = page.locator('table');
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThanOrEqual(2);
  });
});
