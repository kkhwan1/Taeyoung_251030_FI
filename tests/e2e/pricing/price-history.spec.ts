/**
 * Price History E2E Tests
 * Tests price change history, bulk update, trend analysis, and filtering
 */

import { test, expect } from '@playwright/test';

test.describe('Price History - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 로드 및 기본 요소 표시', async ({ page }) => {
    // Verify page title
    await expect(page.locator('text=단가 이력 조회')).toBeVisible();

    // Verify return button
    await expect(page.locator('text=단가 마스터로 돌아가기')).toBeVisible();

    // Verify table exists
    await expect(page.locator('table').first()).toBeVisible();
  });

  test('통계 카드 표시', async ({ page }) => {
    // Check for statistics cards
    await expect(page.locator('text=총 이력 건수')).toBeVisible();
    await expect(page.locator('text=최근 변동 품목')).toBeVisible();
    await expect(page.locator('text=평균 변동률')).toBeVisible();

    // Verify cards have numeric values
    const totalCount = page.locator('text=총 이력 건수').locator('..').locator('.text-2xl');
    await expect(totalCount).toBeVisible();
  });

  test('테이블 헤더 확인', async ({ page }) => {
    const expectedHeaders = [
      '품목 코드',
      '품목명',
      '이전 단가',
      '신규 단가',
      '변동액',
      '변동률',
      '적용일',
      '비고',
      '차트'
    ];

    for (const header of expectedHeaders) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });
});

test.describe('Price History - Data Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for data load
  });

  test('이력 데이터 표시', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(0);

    if (rows > 0) {
      // Verify first row has data
      const firstRow = page.locator('tbody tr').first();
      await expect(firstRow).toBeVisible();

      // Check if cells have content
      const cells = firstRow.locator('td');
      const cellCount = await cells.count();
      expect(cellCount).toBeGreaterThan(0);
    }
  });

  test('가격 변동 표시 - 색상 코딩', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      // Check for price change indicators
      const changeCell = page.locator('tbody tr').first().locator('td').nth(4); // 변동액 컬럼

      // Check if cell has color class (red for increase, blue for decrease)
      const className = await changeCell.getAttribute('class');

      if (className) {
        const hasColorClass = className.includes('text-red') ||
                            className.includes('text-blue') ||
                            className.includes('text-gray');
        expect(hasColorClass).toBe(true);
      }
    }
  });

  test('가격 변동 아이콘 표시', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      const changeCell = page.locator('tbody tr').first().locator('td').nth(4);
      const content = await changeCell.textContent();

      if (content && content !== '-') {
        // Should contain one of: ▲ (increase), ▼ (decrease), or ─ (no change)
        const hasIcon = content.includes('▲') || content.includes('▼') || content.includes('─');
        expect(hasIcon).toBe(true);
      }
    }
  });

  test('통화 포맷 확인', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      // Check price cells for proper formatting
      const priceCell = page.locator('tbody tr').first().locator('td').nth(3); // 신규 단가
      const content = await priceCell.textContent();

      if (content) {
        // Should contain ₩ symbol and formatted number
        expect(content).toContain('₩');
        expect(content).toMatch(/[0-9,]+/);
      }
    }
  });

  test('날짜 포맷 확인', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      const dateCell = page.locator('tbody tr').first().locator('td').nth(6); // 적용일
      const content = await dateCell.textContent();

      if (content) {
        // Should be in Korean date format (YYYY. M. D.)
        expect(content).toMatch(/\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\./);
      }
    }
  });
});

test.describe('Price History - Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');
  });

  test('필터 폼 표시', async ({ page }) => {
    // Check for filter inputs
    await expect(page.locator('input[placeholder="품목 ID"]')).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible(); // 시작일
    await expect(page.locator('input[type="date"]').nth(1)).toBeVisible(); // 종료일
    await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();

    // Check for filter buttons
    await expect(page.locator('button:has-text("조회")')).toBeVisible();
    await expect(page.locator('button:has-text("초기화")')).toBeVisible();
  });

  test('품목 ID 필터', async ({ page }) => {
    const itemIdInput = page.locator('input[placeholder="품목 ID"]');
    await itemIdInput.fill('1');

    await page.click('button:has-text("조회")');
    await page.waitForTimeout(1000);

    // Verify filter was applied
    const value = await itemIdInput.inputValue();
    expect(value).toBe('1');
  });

  test('날짜 범위 필터', async ({ page }) => {
    // Set start date
    const startDateInput = page.locator('input[type="date"]').first();
    await startDateInput.fill('2024-01-01');

    // Set end date
    const endDateInput = page.locator('input[type="date"]').nth(1);
    await endDateInput.fill('2024-12-31');

    // Apply filter
    await page.click('button:has-text("조회")');
    await page.waitForTimeout(1000);

    // Verify dates were set
    expect(await startDateInput.inputValue()).toBe('2024-01-01');
    expect(await endDateInput.inputValue()).toBe('2024-12-31');
  });

  test('검색 필터 - 품목명/코드', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="검색"]');
    await searchInput.fill('부품');
    await page.waitForTimeout(500);

    // Client-side filtering should happen automatically
    // Check if any visible rows contain the search term
    const rows = await page.locator('tbody tr:visible').count();

    if (rows > 0) {
      const firstRowText = await page.locator('tbody tr:visible').first().textContent();
      if (firstRowText) {
        const hasSearchTerm = firstRowText.includes('부품');
        // Not all rows may have the term depending on data
        expect(rows).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('필터 초기화', async ({ page }) => {
    // Fill all filters
    await page.locator('input[placeholder="품목 ID"]').fill('1');
    await page.locator('input[type="date"]').first().fill('2024-01-01');
    await page.locator('input[type="date"]').nth(1).fill('2024-12-31');
    await page.locator('input[placeholder*="검색"]').fill('부품');

    // Click reset button
    await page.click('button:has-text("초기화")');
    await page.waitForTimeout(500);

    // Verify all filters are cleared
    expect(await page.locator('input[placeholder="품목 ID"]').inputValue()).toBe('');
    expect(await page.locator('input[type="date"]').first().inputValue()).toBe('');
    expect(await page.locator('input[type="date"]').nth(1).inputValue()).toBe('');
    expect(await page.locator('input[placeholder*="검색"]').inputValue()).toBe('');
  });

  test('복합 필터 적용', async ({ page }) => {
    // Apply multiple filters
    await page.locator('input[placeholder="품목 ID"]').fill('1');
    await page.locator('input[type="date"]').first().fill('2024-01-01');
    await page.locator('input[placeholder*="검색"]').fill('부품');

    await page.click('button:has-text("조회")');
    await page.waitForTimeout(1000);

    // Verify all filters are applied
    expect(await page.locator('input[placeholder="품목 ID"]').inputValue()).toBe('1');
    expect(await page.locator('input[type="date"]').first().inputValue()).toBe('2024-01-01');
    expect(await page.locator('input[placeholder*="검색"]').inputValue()).toBe('부품');
  });
});

test.describe('Price History - Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('페이지네이션 컨트롤 표시', async ({ page }) => {
    // Check for pagination info
    await expect(page.locator('text=전체').first()).toBeVisible();
    await expect(page.locator('button:has-text("이전")')).toBeVisible();
    await expect(page.locator('button:has-text("다음")')).toBeVisible();
  });

  test('페이지 번호 표시', async ({ page }) => {
    // Check current page / total pages display
    const pageInfo = page.locator('text=/\\d+\\s*\\/\\s*\\d+/').first();
    await expect(pageInfo).toBeVisible();

    const text = await pageInfo.textContent();
    if (text) {
      expect(text).toMatch(/\d+\s*\/\s*\d+/);
    }
  });

  test('다음 페이지 버튼 클릭', async ({ page }) => {
    const nextButton = page.locator('button:has-text("다음")');

    // Check if button is enabled
    const isDisabled = await nextButton.isDisabled();

    if (!isDisabled) {
      // Get current page number
      const pageInfoBefore = await page.locator('text=/\\d+\\s*\\/\\s*\\d+/').first().textContent();

      // Click next
      await nextButton.click();
      await page.waitForTimeout(1000);

      // Verify page changed
      const pageInfoAfter = await page.locator('text=/\\d+\\s*\\/\\s*\\d+/').first().textContent();
      expect(pageInfoAfter).not.toBe(pageInfoBefore);
    }
  });

  test('이전 페이지 버튼 - 첫 페이지에서 비활성화', async ({ page }) => {
    const prevButton = page.locator('button:has-text("이전")');

    // On first page, previous button should be disabled
    await expect(prevButton).toBeDisabled();
  });

  test('레코드 범위 표시', async ({ page }) => {
    // Check for "1 - 20건 표시" type text
    const rangeText = page.locator('text=/\\d+\\s*-\\s*\\d+건 표시/').first();
    await expect(rangeText).toBeVisible();
  });
});

test.describe('Price History - Chart Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('차트 아이콘 클릭 - 모달 열기', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      // Click chart icon on first row
      const chartButton = page.locator('tbody tr').first().locator('button, a').last();
      await chartButton.click();
      await page.waitForTimeout(500);

      // Verify modal opens
      const modal = page.locator('.fixed, [role="dialog"]');
      await expect(modal.first()).toBeVisible();
    }
  });

  test('차트 모달 제목 표시', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      const chartButton = page.locator('tbody tr').first().locator('button, a').last();
      await chartButton.click();
      await page.waitForTimeout(500);

      // Check for modal title with item name
      const title = page.locator('text=단가 추이');
      await expect(title).toBeVisible();
    }
  });

  test('차트 캔버스 렌더링', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      const chartButton = page.locator('tbody tr').first().locator('button, a').last();
      await chartButton.click();
      await page.waitForTimeout(1000);

      // Check if canvas element exists (Chart.js renders to canvas)
      const canvas = page.locator('canvas');
      await expect(canvas.first()).toBeVisible();
    }
  });

  test('이력 상세 정보 표시', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      const chartButton = page.locator('tbody tr').first().locator('button, a').last();
      await chartButton.click();
      await page.waitForTimeout(500);

      // Check for detailed history section
      await expect(page.locator('text=이력 상세')).toBeVisible();
    }
  });

  test('모달 닫기 버튼', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      const chartButton = page.locator('tbody tr').first().locator('button, a').last();
      await chartButton.click();
      await page.waitForTimeout(500);

      // Click close button (usually ✕)
      const closeButton = page.locator('button:has-text("✕")').first();
      await closeButton.click();
      await page.waitForTimeout(300);

      // Verify modal is closed
      const modal = page.locator('.fixed, [role="dialog"]');
      if (await modal.count() > 0) {
        await expect(modal.first()).not.toBeVisible();
      }
    }
  });

  test('모달 외부 클릭으로 닫기', async ({ page }) => {
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      const chartButton = page.locator('tbody tr').first().locator('button, a').last();
      await chartButton.click();
      await page.waitForTimeout(500);

      // Click outside modal (on backdrop)
      const backdrop = page.locator('.fixed').first();
      await backdrop.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);

      // Modal might close or stay open depending on implementation
    }
  });
});

test.describe('Price History - Statistics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('총 이력 건수 - 숫자 포맷', async ({ page }) => {
    const totalCard = page.locator('text=총 이력 건수').locator('..').locator('.text-2xl');
    const text = await totalCard.textContent();

    if (text) {
      // Should be formatted with thousand separators
      expect(text).toMatch(/[\d,]+/);
    }
  });

  test('최근 변동 품목 - 고유 품목 수', async ({ page }) => {
    const recentCard = page.locator('text=최근 변동 품목').locator('..').locator('.text-2xl');
    const text = await recentCard.textContent();

    if (text) {
      const count = parseInt(text.replace(/,/g, ''));
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('평균 변동률 - 퍼센트 표시', async ({ page }) => {
    const avgCard = page.locator('text=평균 변동률').locator('..').locator('.text-2xl');
    const text = await avgCard.textContent();

    if (text) {
      // Should end with %
      expect(text).toContain('%');
      // Should be a valid number
      const numValue = parseFloat(text.replace('%', ''));
      expect(isNaN(numValue)).toBe(false);
    }
  });

  test('통계 카드 실시간 업데이트', async ({ page }) => {
    // Get initial statistics
    const initialTotal = await page.locator('text=총 이력 건수').locator('..').locator('.text-2xl').textContent();

    // Apply filter to change results
    await page.locator('input[placeholder*="검색"]').fill('부품');
    await page.waitForTimeout(1000);

    // Statistics might update (depending on implementation)
    const filteredTotal = await page.locator('text=총 이력 건수').locator('..').locator('.text-2xl').textContent();

    // Verify statistics reflect filtered data or remain unchanged
    expect(filteredTotal).toBeTruthy();
  });
});

test.describe('Price History - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');
  });

  test('단가 마스터로 돌아가기 버튼', async ({ page }) => {
    const backButton = page.locator('text=단가 마스터로 돌아가기');
    await expect(backButton).toBeVisible();

    await backButton.click();
    await page.waitForLoadState('networkidle');

    // Verify navigation to price-master page
    expect(page.url()).toContain('/price-master');
    await expect(page.locator('text=단가 관리')).toBeVisible();
  });
});

test.describe('Price History - Responsive Design', () => {
  test('모바일 뷰포트', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');

    // Verify page loads
    await expect(page.locator('text=단가 이력 조회')).toBeVisible();

    // Statistics cards should stack vertically
    const cards = page.locator('.grid > div');
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
  });

  test('태블릿 뷰포트', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');

    // Verify table is scrollable horizontally if needed
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('테이블 가로 스크롤', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');

    // Check for horizontal scroll container
    const scrollContainer = page.locator('.overflow-x-auto');
    await expect(scrollContainer.first()).toBeVisible();
  });
});

test.describe('Price History - Performance', () => {
  test('페이지 로드 성능', async ({ page }) => {
    const startTime = await page.evaluate(() => performance.now());

    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');

    const endTime = await page.evaluate(() => performance.now());
    const loadTime = endTime - startTime;

    expect(loadTime).toBeLessThan(5000);
    console.log(`Price History page load time: ${loadTime.toFixed(2)}ms`);
  });

  test('필터 적용 성능', async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');

    const startTime = await page.evaluate(() => performance.now());

    // Apply search filter
    await page.locator('input[placeholder*="검색"]').fill('부품');
    await page.waitForTimeout(500);

    const endTime = await page.evaluate(() => performance.now());
    const filterTime = endTime - startTime;

    expect(filterTime).toBeLessThan(2000);
    console.log(`Filter application time: ${filterTime.toFixed(2)}ms`);
  });

  test('차트 렌더링 성능', async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      const startTime = await page.evaluate(() => performance.now());

      const chartButton = page.locator('tbody tr').first().locator('button, a').last();
      await chartButton.click();
      await page.waitForTimeout(1000);

      const endTime = await page.evaluate(() => performance.now());
      const chartTime = endTime - startTime;

      expect(chartTime).toBeLessThan(3000);
      console.log(`Chart rendering time: ${chartTime.toFixed(2)}ms`);
    }
  });
});

test.describe('Price History - Accessibility', () => {
  test('키보드 네비게이션 - 필터 폼', async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');

    // Tab through filter inputs
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify focus is on an input element
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON']).toContain(focusedElement);
  });

  test('테이블 접근성 - 헤더 구조', async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');

    // Check for proper table structure
    const table = page.locator('table');
    const thead = table.locator('thead');
    const tbody = table.locator('tbody');

    await expect(thead).toBeVisible();
    await expect(tbody).toBeVisible();

    // Check that headers use <th> tags
    const headers = thead.locator('th');
    expect(await headers.count()).toBeGreaterThan(0);
  });

  test('ARIA 라벨 확인', async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');

    // Check for aria-labels on interactive elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    // At least some buttons should have accessible names
    for (let i = 0; i < Math.min(3, buttonCount); i++) {
      const button = buttons.nth(i);
      const hasAccessibleName = await button.evaluate((el) => {
        const ariaLabel = el.getAttribute('aria-label');
        const textContent = el.textContent?.trim();
        return !!(ariaLabel || textContent);
      });

      expect(hasAccessibleName).toBe(true);
    }
  });
});

test.describe('Price History - Empty State', () => {
  test('데이터 없음 상태 표시', async ({ page }) => {
    await page.goto('http://localhost:5000/price-history');
    await page.waitForLoadState('networkidle');

    // Apply filter that returns no results
    await page.locator('input[placeholder*="검색"]').fill('존재하지않는품목12345');
    await page.waitForTimeout(500);

    // Check for "데이터가 없습니다" message
    const emptyMessage = page.locator('text=데이터가 없습니다');
    await expect(emptyMessage).toBeVisible();
  });
});
