/**
 * Portal Authentication E2E Tests
 *
 * Tests login flow, session management, and RLS validation
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Test credentials (must match database)
const CUSTOMER_CREDENTIALS = {
  username: '김철수_고객사',
  password: 'password123',
  role: 'CUSTOMER',
};

const SUPPLIER_CREDENTIALS = {
  username: '이영희_공급사',
  password: 'password123',
  role: 'SUPPLIER',
};

test.describe('Portal Authentication System', () => {
  test.beforeEach(async ({ page }) => {
    // Start at login page
    await page.goto(`${BASE_URL}/portal/login`);
  });

  test('should display login page correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/태창 ERP 거래처 포털/);

    // Check form elements
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check Korean text
    await expect(page.locator('h1')).toContainText('태창 ERP 거래처 포털');
  });

  test('should show error for empty credentials', async ({ page }) => {
    // Click submit without filling form
    await page.click('button[type="submit"]');

    // Should show validation error (browser native or custom)
    const usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toBeFocused();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill invalid credentials
    await page.fill('input[name="username"]', 'invalid_user');
    await page.fill('input[name="password"]', 'wrong_password');
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('text=아이디 또는 비밀번호가 올바르지 않습니다', {
      timeout: 5000,
    });

    // Should still be on login page
    await expect(page).toHaveURL(`${BASE_URL}/portal/login`);
  });

  test('should login successfully with customer credentials', async ({ page }) => {
    // Fill customer credentials
    await page.fill('input[name="username"]', CUSTOMER_CREDENTIALS.username);
    await page.fill('input[name="password"]', CUSTOMER_CREDENTIALS.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(`${BASE_URL}/portal/dashboard`, {
      timeout: 10000,
    });

    // Check dashboard elements
    await expect(page.locator('h1')).toContainText('태창 ERP 거래처 포털');
    await expect(page.locator('text=환영합니다')).toBeVisible();
    await expect(page.locator('text=고객사')).toBeVisible();
  });

  test('should login successfully with supplier credentials', async ({ page }) => {
    // Fill supplier credentials
    await page.fill('input[name="username"]', SUPPLIER_CREDENTIALS.username);
    await page.fill('input[name="password"]', SUPPLIER_CREDENTIALS.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(`${BASE_URL}/portal/dashboard`, {
      timeout: 10000,
    });

    // Check dashboard elements
    await expect(page.locator('h1')).toContainText('태창 ERP 거래처 포털');
    await expect(page.locator('text=환영합니다')).toBeVisible();
    await expect(page.locator('text=공급사')).toBeVisible();
  });

  test('should handle Korean username correctly', async ({ page }) => {
    // Test UTF-8 encoding for Korean characters
    await page.fill('input[name="username"]', '김철수_고객사');
    await page.fill('input[name="password"]', CUSTOMER_CREDENTIALS.password);

    // Submit and verify no encoding errors
    await page.click('button[type="submit"]');

    await page.waitForURL(`${BASE_URL}/portal/dashboard`, {
      timeout: 10000,
    });

    // Korean text should display correctly (not garbled)
    const companyText = await page.locator('text=현대자동차').textContent();
    expect(companyText).not.toContain('ë¶€'); // No UTF-8 corruption
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.fill('input[name="username"]', CUSTOMER_CREDENTIALS.username);
    await page.fill('input[name="password"]', CUSTOMER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/portal/dashboard`);

    // Click logout button
    await page.click('button:has-text("로그아웃")');

    // Should redirect to login page
    await page.waitForURL(`${BASE_URL}/portal/login`, {
      timeout: 5000,
    });

    // Try to access dashboard without login
    await page.goto(`${BASE_URL}/portal/dashboard`);

    // Should redirect back to login
    await page.waitForURL(`${BASE_URL}/portal/login`, {
      timeout: 5000,
    });
  });

  test('should enforce rate limiting after 5 failed attempts', async ({ page }) => {
    // Try 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="username"]', 'test_user');
      await page.fill('input[name="password"]', 'wrong_password');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // 6th attempt should show rate limit error
    await page.fill('input[name="username"]', 'test_user');
    await page.fill('input[name="password"]', 'wrong_password');
    await page.click('button[type="submit"]');

    // Wait for rate limit message
    await page.waitForSelector('text=로그인 시도 횟수가 초과', {
      timeout: 5000,
    });
  });
});

test.describe('Portal Data Access & RLS', () => {
  test('customer should only see their own sales transactions', async ({ page }) => {
    // Login as customer
    await page.goto(`${BASE_URL}/portal/login`);
    await page.fill('input[name="username"]', CUSTOMER_CREDENTIALS.username);
    await page.fill('input[name="password"]', CUSTOMER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/portal/dashboard`);

    // Navigate to transactions
    await page.click('text=거래 내역');
    await page.waitForURL(`${BASE_URL}/portal/transactions`);

    // Check that transactions are displayed
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify headers show customer-specific labels
    await expect(page.locator('th:has-text("거래일자")')).toBeVisible();

    // TODO: Verify transactions belong to this customer only (requires test data)
  });

  test('supplier should only see their own purchases', async ({ page }) => {
    // Login as supplier
    await page.goto(`${BASE_URL}/portal/login`);
    await page.fill('input[name="username"]', SUPPLIER_CREDENTIALS.username);
    await page.fill('input[name="password"]', SUPPLIER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/portal/dashboard`);

    // Navigate to transactions
    await page.click('text=거래 내역');
    await page.waitForURL(`${BASE_URL}/portal/transactions`);

    // Check that transactions are displayed
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify headers show supplier-specific labels
    await expect(page.locator('th:has-text("주문일자")')).toBeVisible();

    // TODO: Verify purchases belong to this supplier only (requires test data)
  });

  test('should allow all authenticated users to view items', async ({ page }) => {
    // Login as customer
    await page.goto(`${BASE_URL}/portal/login`);
    await page.fill('input[name="username"]', CUSTOMER_CREDENTIALS.username);
    await page.fill('input[name="password"]', CUSTOMER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/portal/dashboard`);

    // Navigate to items
    await page.click('text=품목 정보');
    await page.waitForURL(`${BASE_URL}/portal/items`);

    // Check that items list is displayed
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify item table headers
    await expect(page.locator('th:has-text("품목코드")')).toBeVisible();
    await expect(page.locator('th:has-text("품목명")')).toBeVisible();
  });

  test('should handle search functionality in items page', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/portal/login`);
    await page.fill('input[name="username"]', CUSTOMER_CREDENTIALS.username);
    await page.fill('input[name="password"]', CUSTOMER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/portal/dashboard`);

    // Navigate to items
    await page.click('text=품목 정보');
    await page.waitForURL(`${BASE_URL}/portal/items`);

    // Test search
    const searchInput = page.locator('input[placeholder*="검색"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('부품');
    await page.click('button:has-text("검색")');

    // Wait for results
    await page.waitForTimeout(1000);

    // Should still show table
    await expect(page.locator('table')).toBeVisible();
  });
});

test.describe('Portal Session Management', () => {
  test('should maintain session across page navigation', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/portal/login`);
    await page.fill('input[name="username"]', CUSTOMER_CREDENTIALS.username);
    await page.fill('input[name="password"]', CUSTOMER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/portal/dashboard`);

    // Navigate to transactions
    await page.click('text=거래 내역');
    await page.waitForURL(`${BASE_URL}/portal/transactions`);

    // Navigate back to dashboard
    await page.click('text=대시보드');
    await page.waitForURL(`${BASE_URL}/portal/dashboard`);

    // Should still be authenticated
    await expect(page.locator('text=환영합니다')).toBeVisible();
  });

  test('should redirect to login if session expired or invalid', async ({ page }) => {
    // Try to access protected page directly without login
    await page.goto(`${BASE_URL}/portal/dashboard`);

    // Should redirect to login
    await page.waitForURL(`${BASE_URL}/portal/login`, {
      timeout: 10000,
    });
  });
});
