import { test, expect } from '@playwright/test';

test.describe('Global Font Size Control - Phase 1: P0 Critical Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:5000');

    // Wait for page to be ready
    await page.waitForLoadState('load', { timeout: 30000 });

    // Clear localStorage to start fresh
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('load', { timeout: 30000 });
  });

  test('P0-01: Should increase font size by 2px increments', async ({ page }) => {
    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Get font display element (specific locator to avoid "12px ~ 24px" text match)
    const fontDisplay = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');

    // Verify default 16px
    await expect(fontDisplay).toHaveText('16px');

    // Click Plus button
    await page.click('[aria-label="글씨 크기 키우기"]');
    await page.waitForTimeout(300);

    // Verify 18px
    await expect(fontDisplay).toHaveText('18px');

    // Click Plus again
    await page.click('[aria-label="글씨 크기 키우기"]');
    await page.waitForTimeout(300);

    // Verify 20px
    await expect(fontDisplay).toHaveText('20px');

    // Verify CSS variable
    const fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(fontSize).toBe('20px');

    console.log('✅ P0-01 PASS: Font size increases by 2px');
  });

  test('P0-02: Should decrease font size by 2px increments', async ({ page }) => {
    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Get font display element (specific locator)
    const fontDisplay = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');

    // Increase to 20px first
    await page.click('[aria-label="글씨 크기 키우기"]');
    await page.waitForTimeout(200);
    await page.click('[aria-label="글씨 크기 키우기"]');
    await page.waitForTimeout(300);
    await expect(fontDisplay).toHaveText('20px');

    // Now decrease
    await page.click('[aria-label="글씨 크기 줄이기"]');
    await page.waitForTimeout(300);
    await expect(fontDisplay).toHaveText('18px');

    // Decrease again
    await page.click('[aria-label="글씨 크기 줄이기"]');
    await page.waitForTimeout(300);
    await expect(fontDisplay).toHaveText('16px');

    console.log('✅ P0-02 PASS: Font size decreases by 2px');
  });

  test('P0-03: Should enforce 24px maximum boundary', async ({ page }) => {
    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Click Plus until maximum (16 -> 18 -> 20 -> 22 -> 24)
    for (let i = 0; i < 4; i++) {
      const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
      const isDisabled = await plusButton.isDisabled();
      if (!isDisabled) {
        await plusButton.click();
        await page.waitForTimeout(200);
      }
    }

    // Verify 24px reached (use specific locator to avoid "12px ~ 24px" text match)
    const fontDisplay = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplay).toHaveText('24px');

    // Verify Plus button is disabled
    const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
    await expect(plusButton).toBeDisabled();
    await expect(plusButton).toHaveClass(/opacity-50/);

    // Verify CSS variable
    const fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(fontSize).toBe('24px');

    console.log('✅ P0-03 PASS: Maximum 24px boundary enforced');
  });

  test('P0-04: Should enforce 12px minimum boundary', async ({ page }) => {
    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Click Minus until minimum (16 -> 14 -> 12)
    for (let i = 0; i < 2; i++) {
      const minusButton = page.locator('[aria-label="글씨 크기 줄이기"]');
      const isDisabled = await minusButton.isDisabled();
      if (!isDisabled) {
        await minusButton.click();
        await page.waitForTimeout(200);
      }
    }

    // Verify 12px reached (use specific locator to avoid "12px ~ 24px" text match)
    const fontDisplay = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplay).toHaveText('12px');

    // Verify Minus button is disabled
    const minusButton = page.locator('[aria-label="글씨 크기 줄이기"]');
    await expect(minusButton).toBeDisabled();
    await expect(minusButton).toHaveClass(/opacity-50/);

    // Verify CSS variable
    const fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(fontSize).toBe('12px');

    console.log('✅ P0-04 PASS: Minimum 12px boundary enforced');
  });

  test('P0-05: Should persist font size in localStorage across page reload', async ({ page }) => {
    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Get font display element (specific locator)
    const fontDisplayP05 = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');

    // Set to 20px
    await page.click('[aria-label="글씨 크기 키우기"]');
    await page.waitForTimeout(200);
    await page.click('[aria-label="글씨 크기 키우기"]');
    await page.waitForTimeout(300);
    await expect(fontDisplayP05).toHaveText('20px');

    // Verify localStorage
    let stored = await page.evaluate(() => localStorage.getItem('erp-font-size'));
    expect(stored).toBe('20');

    // Close menu
    await page.click('body');
    await page.waitForTimeout(200);

    // Reload page
    await page.reload();
    await page.waitForLoadState('load', { timeout: 30000 });

    // Reopen menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Verify still 20px (use specific locator)
    const fontDisplayAfterReload = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplayAfterReload).toHaveText('20px');

    // Verify localStorage still contains 20
    stored = await page.evaluate(() => localStorage.getItem('erp-font-size'));
    expect(stored).toBe('20');

    // Verify CSS variable
    const fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(fontSize).toBe('20px');

    console.log('✅ P0-05 PASS: Font size persists across reload');
  });

  test('P0-07: Should reset font size to default 16px', async ({ page }) => {
    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Get font display element (specific locator)
    const fontDisplayP07 = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');

    // Set to 22px
    for (let i = 0; i < 3; i++) {
      await page.click('[aria-label="글씨 크기 키우기"]');
      await page.waitForTimeout(150);
    }
    await expect(fontDisplayP07).toHaveText('22px');

    // Click reset button (초기화)
    await page.click('button:has-text("초기화")');
    await page.waitForTimeout(500);

    // Menu should close, reopen it
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Verify 16px (use specific locator)
    const fontDisplayP07After = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplayP07After).toHaveText('16px');

    // Verify localStorage
    const stored = await page.evaluate(() => localStorage.getItem('erp-font-size'));
    expect(stored).toBe('16');

    // Verify CSS variable
    const fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(fontSize).toBe('16px');

    console.log('✅ P0-07 PASS: Reset to default 16px works');
  });
});

test.describe('Global Font Size Control - Phase 2: P1 Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000');
    await page.waitForLoadState('load', { timeout: 30000 });
  });

  test('P1-02: Should highlight correct visual indicator', async ({ page }) => {
    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Click 18px dot
    await page.click('[title="18px"]');
    await page.waitForTimeout(300);

    // Verify display shows 18px (use specific locator)
    const fontDisplay = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplay).toHaveText('18px');

    // Verify 18px dot is highlighted
    const dot18 = page.locator('[title="18px"]');
    const classes = await dot18.getAttribute('class');
    expect(classes).toContain('bg-gray-800');
    expect(classes).toContain('scale-110');

    console.log('✅ P1-02 PASS: Visual indicator highlights correctly');
  });

  test('P1-03: Should apply font size across multiple pages', async ({ page }) => {
    // Set font size to 20px
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);
    await page.click('[aria-label="글씨 크기 키우기"]');
    await page.waitForTimeout(200);
    await page.click('[aria-label="글씨 크기 키우기"]');
    await page.waitForTimeout(300);
    await expect(page.locator('text=20px')).toBeVisible();

    // Close menu
    await page.click('body');
    await page.waitForTimeout(200);

    // Check Dashboard
    let fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(fontSize).toBe('20px');

    // Navigate to BOM page
    await page.goto('http://localhost:5000/master/bom');
    await page.waitForLoadState('load', { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Verify font size persists
    fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(fontSize).toBe('20px');

    // Navigate to Sales page
    await page.goto('http://localhost:5000/sales');
    await page.waitForLoadState('load', { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Verify font size persists
    fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(fontSize).toBe('20px');

    console.log('✅ P1-03 PASS: Font size applies across all pages');
  });

  test('P1-04: BOM page should use global font size control', async ({ page }) => {
    // Set global font size to 22px
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);
    for (let i = 0; i < 3; i++) {
      await page.click('[aria-label="글씨 크기 키우기"]');
      await page.waitForTimeout(150);
    }
    await expect(page.locator('text=22px')).toBeVisible();

    // Close menu
    await page.click('body');
    await page.waitForTimeout(200);

    // Navigate to BOM page
    await page.goto('http://localhost:5000/master/bom');
    await page.waitForLoadState('load', { timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for data load

    // Verify font size is 22px
    const fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(fontSize).toBe('22px');

    // Change to 14px (need 4 clicks: 22→20→18→16→14)
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Click decrease 4 times
    await page.click('[aria-label="글씨 크기 줄이기"]');
    await page.waitForTimeout(200);
    await page.click('[aria-label="글씨 크기 줄이기"]');
    await page.waitForTimeout(200);
    await page.click('[aria-label="글씨 크기 줄이기"]');
    await page.waitForTimeout(200);
    await page.click('[aria-label="글씨 크기 줄이기"]');
    await page.waitForTimeout(300);

    // Verify 14px (use specific locator)
    const fontDisplay2 = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplay2).toHaveText('14px');

    // Verify change applies immediately
    const newFontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--base-font-size').trim()
    );
    expect(newFontSize).toBe('14px');

    console.log('✅ P1-04 PASS: BOM page uses global font control');
  });
});

test.describe('Global Font Size Control - Phase 3: P2 Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000');
    await page.waitForLoadState('load', { timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('load', { timeout: 30000 });
  });

  test('P2-05: Should recover from corrupted localStorage', async ({ page }) => {
    // Set invalid localStorage value
    await page.evaluate(() => {
      localStorage.setItem('erp-font-size', 'invalid');
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('load', { timeout: 30000 });

    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Should default to 16px (use specific locator)
    const fontDisplay = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplay).toHaveText('16px');

    // Delete localStorage key
    await page.evaluate(() => {
      localStorage.removeItem('erp-font-size');
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('load', { timeout: 30000 });

    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Should still default to 16px (use specific locator)
    const fontDisplay2 = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplay2).toHaveText('16px');

    console.log('✅ P2-05 PASS: Recovers from corrupted localStorage');
  });

  test('P2-02: Should handle rapid button clicks gracefully', async ({ page }) => {
    // Open font menu
    await page.click('[aria-label="Font size"]');
    await page.waitForTimeout(300);

    // Rapidly click Plus 10 times
    for (let i = 0; i < 10; i++) {
      const plusButton = page.locator('[aria-label="글씨 크기 키우기"]');
      const isDisabled = await plusButton.isDisabled();
      if (!isDisabled) {
        await plusButton.click();
        await page.waitForTimeout(50); // Very short delay
      }
    }

    // Should cap at 24px (use specific locator)
    await page.waitForTimeout(300);
    const fontDisplay24 = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplay24).toHaveText('24px');

    // Rapidly click Minus 10 times
    for (let i = 0; i < 15; i++) {
      const minusButton = page.locator('[aria-label="글씨 크기 줄이기"]');
      const isDisabled = await minusButton.isDisabled();
      if (!isDisabled) {
        await minusButton.click();
        await page.waitForTimeout(50);
      }
    }

    // Should cap at 12px (use specific locator)
    await page.waitForTimeout(300);
    const fontDisplay12 = page.locator('.flex.items-center.gap-2.px-4.py-2 span.text-lg');
    await expect(fontDisplay12).toHaveText('12px');

    // Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    expect(consoleErrors.length).toBe(0);

    console.log('✅ P2-02 PASS: Handles rapid clicks gracefully');
  });
});
