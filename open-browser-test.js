// Simple script to open browser with Playwright for manual testing
const { chromium } = require('@playwright/test');

async function openBrowser() {
  console.log('Opening browser...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  console.log('Navigating to inventory page...');
  await page.goto('http://localhost:5000/inventory?tab=production');

  console.log('Page loaded. Waiting for user to test...');
  console.log('Press Ctrl+C to close when done.');

  // Keep browser open
  await page.waitForTimeout(300000); // 5 minutes
}

openBrowser().catch(console.error);
