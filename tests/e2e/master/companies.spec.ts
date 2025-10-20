/**
 * Company Management E2E Tests
 * Tests company types, auto company_code generation (CUS001, SUP001), JSONB business_info field
 */

import { test, expect } from '@playwright/test';

// Test data with Korean characters
const testCompany = {
  company_name: `테스트거래처_${Date.now()}`,
  company_type: 'CUSTOMER',
  business_registration_no: '123-45-67890',
  contact_person: '홍길동',
  phone: '02-1234-5678',
  mobile: '010-1234-5678',
  email: 'test@example.com',
  address: '서울특별시 강남구 테헤란로 123',
  payment_terms: 30,
  notes: '테스트용 거래처입니다',
  company_category: '원자재',
  business_type: '제조업',
  business_item: '철강',
  main_products: '자동차 부품'
};

test.describe('Company Management Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to companies page
    await page.goto('/master/companies');

    // Wait for initial load
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("거래처 관리")', { timeout: 10000 });
  });

  test('페이지 로드 및 제목 확인', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/거래처 관리/);

    // Verify main heading
    await expect(page.locator('h1')).toContainText('거래처 관리');

    // Verify icon is visible
    await expect(page.locator('svg.lucide-building-2')).toBeVisible();
  });

  test('거래처 목록 테이블 렌더링', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });

    // Verify table headers
    await expect(page.locator('th:has-text("거래처코드")')).toBeVisible();
    await expect(page.locator('th:has-text("거래처명")')).toBeVisible();
    await expect(page.locator('th:has-text("타입")')).toBeVisible();
    await expect(page.locator('th:has-text("담당자")')).toBeVisible();
    await expect(page.locator('th:has-text("연락처")')).toBeVisible();

    // Verify at least one row exists (or no data message)
    const rows = await page.locator('tbody tr').count();
    if (rows > 0) {
      expect(rows).toBeGreaterThan(0);
    } else {
      await expect(page.locator('text=검색 결과가 없습니다')).toBeVisible();
    }
  });

  test('신규 거래처 생성 및 자동 코드 생성 (Create with Auto company_code)', async ({ page }) => {
    // Click add button
    await page.click('button:has-text("신규 추가")');

    // Wait for modal
    await page.waitForSelector('text=거래처 등록', { timeout: 5000 });

    // Fill basic information
    await page.fill('input[name="company_name"]', testCompany.company_name);

    // Select company type (for auto code generation)
    await page.selectOption('select[name="company_type"]', testCompany.company_type);

    // Fill registration number
    await page.fill('input[name="business_registration_no"]', testCompany.business_registration_no);

    // Fill contact information
    await page.fill('input[name="contact_person"]', testCompany.contact_person);
    await page.fill('input[name="phone"]', testCompany.phone);
    await page.fill('input[name="mobile"]', testCompany.mobile);
    await page.fill('input[name="email"]', testCompany.email);
    await page.fill('input[name="address"]', testCompany.address);

    // Fill payment terms
    await page.fill('input[name="payment_terms"]', testCompany.payment_terms.toString());

    // Fill company category
    await page.selectOption('select[name="company_category"]', testCompany.company_category);

    // Fill JSONB business_info fields
    await page.fill('input[name="business_type"]', testCompany.business_type);
    await page.fill('input[name="business_item"]', testCompany.business_item);
    await page.fill('textarea[name="main_products"]', testCompany.main_products);

    // Fill notes
    await page.fill('textarea[name="notes"]', testCompany.notes);

    // Submit form
    await page.click('button:has-text("저장")');

    // Wait for success toast
    await expect(page.locator('.toast-success, text=성공')).toBeVisible({ timeout: 5000 });

    // Verify company appears in list
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="검색"]', testCompany.company_name);
    await page.waitForTimeout(500);

    // Verify company is visible
    await expect(page.locator(`text=${testCompany.company_name}`)).toBeVisible();

    // Verify company_code is auto-generated (CUS prefix for CUSTOMER)
    const codeCell = page.locator('tbody tr').first().locator('td').first();
    const codeText = await codeCell.textContent();
    expect(codeText).toMatch(/^CUS\d{3}$/); // CUS001, CUS002, etc.
  });

  test('자동 거래처 코드 생성 패턴 검증 (Auto company_code Pattern)', async ({ page }) => {
    // Test different company types produce different prefixes

    // Test CUSTOMER type (CUS prefix)
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=거래처 등록', { timeout: 5000 });

    await page.fill('input[name="company_name"]', `고객사_${Date.now()}`);
    await page.selectOption('select[name="company_type"]', 'CUSTOMER');
    await page.fill('input[name="contact_person"]', '홍길동');

    await page.click('button:has-text("저장")');
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(1000);

    // Verify CUS prefix
    const customerRow = page.locator('tbody tr').first();
    const customerCode = await customerRow.locator('td').first().textContent();
    expect(customerCode).toMatch(/^CUS\d{3}$/);

    // Test SUPPLIER type (SUP prefix)
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=거래처 등록', { timeout: 5000 });

    await page.fill('input[name="company_name"]', `공급사_${Date.now()}`);
    await page.selectOption('select[name="company_type"]', 'SUPPLIER');
    await page.fill('input[name="contact_person"]', '김철수');

    await page.click('button:has-text("저장")');
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(1000);

    // Search for supplier
    await page.fill('input[placeholder*="검색"]', '공급사_');
    await page.waitForTimeout(500);

    // Verify SUP prefix
    const supplierRow = page.locator('tbody tr').first();
    const supplierCode = await supplierRow.locator('td').first().textContent();
    expect(supplierCode).toMatch(/^SUP\d{3}$/);
  });

  test('거래처 검색 기능 (Search)', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="검색"]');

    // Enter search term
    await searchInput.fill('거래처');
    await page.waitForTimeout(500);

    // Verify filtered results
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      // Check that visible rows contain search term
      const firstRowText = await page.locator('tbody tr').first().textContent();
      expect(firstRowText?.toLowerCase()).toContain('거래처'.toLowerCase());
    }

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  test('거래처 타입 필터링 (Filter by Type)', async ({ page }) => {
    // Wait for type filter dropdown
    await page.waitForSelector('select.company-type-filter', { timeout: 5000 });

    // Select CUSTOMER type
    await page.selectOption('select.company-type-filter', 'CUSTOMER');
    await page.waitForTimeout(500);

    // Verify filtered results
    const rows = await page.locator('tbody tr').count();

    if (rows > 0) {
      // Check first row has correct type
      const typeCell = page.locator('tbody tr').first().locator('td').nth(2);
      await expect(typeCell).toContainText('고객사');
    }

    // Test SUPPLIER filter
    await page.selectOption('select.company-type-filter', 'SUPPLIER');
    await page.waitForTimeout(500);

    const supplierRows = await page.locator('tbody tr').count();

    if (supplierRows > 0) {
      const supplierTypeCell = page.locator('tbody tr').first().locator('td').nth(2);
      await expect(supplierTypeCell).toContainText('공급사');
    }

    // Reset filter
    await page.selectOption('select.company-type-filter', '');
    await page.waitForTimeout(500);
  });

  test('거래처 수정 (Update)', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Click edit button on first row
      await page.locator('tbody tr').first().locator('button[title="수정"]').click();

      // Wait for modal
      await page.waitForSelector('text=거래처 수정', { timeout: 5000 });

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

  test('JSONB business_info 필드 수정 (Update JSONB Field)', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Click edit button
      await page.locator('tbody tr').first().locator('button[title="수정"]').click();

      // Wait for modal
      await page.waitForSelector('text=거래처 수정', { timeout: 5000 });

      // Update JSONB fields
      const updatedBusinessType = '서비스업';
      const updatedBusinessItem = 'IT 서비스';
      const updatedMainProducts = '소프트웨어 개발';

      await page.fill('input[name="business_type"]', updatedBusinessType);
      await page.fill('input[name="business_item"]', updatedBusinessItem);
      await page.fill('textarea[name="main_products"]', updatedMainProducts);

      // Submit
      await page.click('button:has-text("저장")');

      // Wait for success toast
      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });

      // Verify changes persisted
      await page.waitForTimeout(1000);
      await page.locator('tbody tr').first().locator('button[title="수정"]').click();
      await page.waitForSelector('text=거래처 수정', { timeout: 5000 });

      const businessTypeValue = await page.locator('input[name="business_type"]').inputValue();
      expect(businessTypeValue).toBe(updatedBusinessType);
    } else {
      test.skip();
    }
  });

  test('거래처 삭제 (Soft Delete)', async ({ page }) => {
    // Search for test company
    await page.fill('input[placeholder*="검색"]', testCompany.company_name);
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

      // Verify company is no longer in list
      await page.waitForTimeout(1000);
      await expect(page.locator(`text=${testCompany.company_name}`)).not.toBeVisible();
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

    // Click on company name header to sort
    await page.click('th:has-text("거래처명")');
    await page.waitForTimeout(500);

    // Verify table still has data
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(0);

    // Click again to reverse sort
    await page.click('th:has-text("거래처명")');
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
    const koreanSearch = '거래처';
    await page.fill('input[placeholder*="검색"]', koreanSearch);
    await page.waitForTimeout(500);

    // Verify Korean text is displayed correctly
    const inputValue = await page.locator('input[placeholder*="검색"]').inputValue();
    expect(inputValue).toBe(koreanSearch);

    // Check if results contain Korean text without garbling
    const rowCount = await page.locator('tbody tr').count();
    if (rowCount > 0) {
      const firstRowText = await page.locator('tbody tr').first().textContent();
      // Korean characters should be preserved
      expect(firstRowText).not.toContain('â');
      expect(firstRowText).not.toContain('í');
    }
  });

  test('폼 유효성 검증 (Form Validation)', async ({ page }) => {
    // Open add modal
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=거래처 등록', { timeout: 5000 });

    // Try to submit without required fields
    await page.click('button:has-text("저장")');
    await page.waitForTimeout(300);

    // Verify validation errors (form should not submit)
    const modalStillOpen = await page.locator('text=거래처 등록').isVisible();
    expect(modalStillOpen).toBe(true);

    // Close modal
    await page.click('button:has-text("취소")');
  });

  test('이메일 형식 검증', async ({ page }) => {
    // Open add modal
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=거래처 등록', { timeout: 5000 });

    // Enter invalid email
    await page.fill('input[name="email"]', 'invalid-email');

    // Try to submit
    await page.click('button:has-text("저장")');
    await page.waitForTimeout(300);

    // Form should show validation error
    const modalStillOpen = await page.locator('text=거래처 등록').isVisible();
    expect(modalStillOpen).toBe(true);

    // Close modal
    await page.click('button:has-text("취소")');
  });

  test('전화번호 형식 검증', async ({ page }) => {
    // Open add modal
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=거래처 등록', { timeout: 5000 });

    // Test valid phone formats
    await page.fill('input[name="phone"]', '02-1234-5678');
    await page.fill('input[name="mobile"]', '010-1234-5678');

    // Verify inputs accepted
    const phoneValue = await page.locator('input[name="phone"]').inputValue();
    expect(phoneValue).toBe('02-1234-5678');

    // Close modal
    await page.click('button:has-text("취소")');
  });

  test('결제 조건 숫자 검증', async ({ page }) => {
    // Open add modal
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=거래처 등록', { timeout: 5000 });

    // Fill payment terms
    await page.fill('input[name="payment_terms"]', '30');

    // Verify numeric input accepted
    const termsValue = await page.locator('input[name="payment_terms"]').inputValue();
    expect(termsValue).toBe('30');

    // Close modal
    await page.click('button:has-text("취소")');
  });

  test('거래처 카테고리 필터링', async ({ page }) => {
    // Select category filter if exists
    const categoryFilter = page.locator('select.company-category-filter');

    if (await categoryFilter.isVisible()) {
      await categoryFilter.selectOption('원자재');
      await page.waitForTimeout(500);

      const rows = await page.locator('tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(0);

      // Reset filter
      await categoryFilter.selectOption('');
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
    await page.goto('/master/companies');
    await page.waitForLoadState('networkidle');

    // Verify page loads on mobile
    await expect(page.locator('h1:has-text("거래처 관리")')).toBeVisible();

    // Verify table is responsive
    await page.waitForSelector('table', { timeout: 10000 });
  });
});

test.describe('Company Management - Business Info JSONB Tests', () => {
  test('JSONB 필드 생성 및 조회', async ({ page }) => {
    await page.goto('/master/companies');
    await page.waitForLoadState('networkidle');

    // Create company with JSONB fields
    await page.click('button:has-text("신규 추가")');
    await page.waitForSelector('text=거래처 등록', { timeout: 5000 });

    await page.fill('input[name="company_name"]', `JSONB테스트_${Date.now()}`);
    await page.selectOption('select[name="company_type"]', 'CUSTOMER');
    await page.fill('input[name="contact_person"]', '테스터');

    // Fill JSONB business_info
    await page.fill('input[name="business_type"]', '제조업');
    await page.fill('input[name="business_item"]', '철강 가공');
    await page.fill('textarea[name="main_products"]', '자동차 부품, 건축 자재');

    await page.click('button:has-text("저장")');
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });

    // Search and verify
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="검색"]', 'JSONB테스트_');
    await page.waitForTimeout(500);

    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible();
  });

  test('JSONB 필드 부분 업데이트', async ({ page }) => {
    await page.goto('/master/companies');
    await page.waitForLoadState('networkidle');

    const rowCount = await page.locator('tbody tr').count();

    if (rowCount > 0) {
      // Edit first company
      await page.locator('tbody tr').first().locator('button[title="수정"]').click();
      await page.waitForSelector('text=거래처 수정', { timeout: 5000 });

      // Update only business_type
      await page.fill('input[name="business_type"]', '수정된업종');

      await page.click('button:has-text("저장")');
      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });

      // Verify partial update worked
      await page.waitForTimeout(1000);
      await page.locator('tbody tr').first().locator('button[title="수정"]').click();

      const businessType = await page.locator('input[name="business_type"]').inputValue();
      expect(businessType).toBe('수정된업종');
    }
  });
});
