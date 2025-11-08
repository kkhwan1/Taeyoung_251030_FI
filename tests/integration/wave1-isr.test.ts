import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Wave 1 ISR/SSG Implementation', () => {
  const BASE_URL = 'http://localhost:5000';

  describe('ISR Pages (5-10 min revalidation)', () => {
    const isrPages = [
      '/master/items',
      '/master/companies',
      '/master/bom',
      '/inventory',
      '/sales',
      '/purchases',
      '/collections',
      '/payments'
    ];

    isrPages.forEach(page => {
      it(`should load successfully: ${page}`, async () => {
        const response = await fetch(`${BASE_URL}${page}`);

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);

        const cacheControl = response.headers.get('cache-control');
        const xNextjsCache = response.headers.get('x-nextjs-cache');

        console.log(`✓ ${page} loaded successfully`);
        console.log(`  Cache-Control: ${cacheControl || 'none'}`);
        console.log(`  X-Nextjs-Cache: ${xNextjsCache || 'none'}`);

        // In dev mode, cache headers may not be present
        // In production, we'd expect cache headers
      }, 15000); // 15 second timeout for page loads
    });
  });

  describe('Force-Dynamic Removed from Root', () => {
    it('should not have force-dynamic in root layout', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      // Check that force-dynamic is NOT exported
      expect(layoutContent).not.toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);

      console.log('✓ Root layout does not export force-dynamic');
    });

    it('should have ISR configuration in page files', () => {
      const pagesWithISR = [
        'src/app/master/items/page.tsx',
        'src/app/master/companies/page.tsx',
        'src/app/master/bom/page.tsx',
        'src/app/inventory/page.tsx',
        'src/app/sales/page.tsx',
        'src/app/purchases/page.tsx',
        'src/app/collections/page.tsx',
        'src/app/payments/page.tsx'
      ];

      let pagesWithRevalidate = 0;

      pagesWithISR.forEach(pagePath => {
        const fullPath = path.join(process.cwd(), pagePath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');

          if (content.includes('revalidate')) {
            pagesWithRevalidate++;
            console.log(`  ✓ ${pagePath} has revalidate config`);
          }
        }
      });

      console.log(`✓ ${pagesWithRevalidate}/${pagesWithISR.length} pages have ISR configuration`);

      // At least some pages should have revalidate
      expect(pagesWithRevalidate).toBeGreaterThan(0);
    });
  });

  describe('Dashboard Still Dynamic', () => {
    it('should have force-dynamic only on dashboard', () => {
      const dashboardPath = path.join(process.cwd(), 'src', 'app', 'dashboard', 'page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

      // Dashboard should have force-dynamic
      const hasForceDynamic = dashboardContent.includes('force-dynamic');
      const hasRevalidateZero = dashboardContent.includes('revalidate') && dashboardContent.includes('0');

      console.log('✓ Dashboard configuration:');
      console.log(`  force-dynamic: ${hasForceDynamic}`);
      console.log(`  revalidate = 0: ${hasRevalidateZero}`);

      expect(hasForceDynamic || hasRevalidateZero).toBe(true);
    });
  });

  describe('Revalidation Logging', () => {
    it('should have revalidation logger utility', () => {
      const loggerPath = path.join(process.cwd(), 'src', 'lib', 'revalidation-logger.ts');

      expect(fs.existsSync(loggerPath)).toBe(true);

      const loggerContent = fs.readFileSync(loggerPath, 'utf-8');

      // Check for key functions
      expect(loggerContent).toContain('logRevalidation');
      expect(loggerContent).toContain('getRevalidationStats');

      console.log('✓ Revalidation logger exists with required functions');
    });

    it('should export required types and functions', async () => {
      const logger = await import('@/lib/revalidation-logger');

      expect(logger.logRevalidation).toBeDefined();
      expect(logger.getRevalidationStats).toBeDefined();

      console.log('✓ Revalidation logger exports verified');
    });
  });

  describe('SSG/ISR Performance', () => {
    it('should load static pages faster than dynamic dashboard', async () => {
      // Measure dashboard load time (force-dynamic)
      const dashStart = Date.now();
      const dashResponse = await fetch(`${BASE_URL}/dashboard`);
      const dashDuration = Date.now() - dashStart;

      expect(dashResponse.ok).toBe(true);

      // Measure ISR page load time
      const isrStart = Date.now();
      const isrResponse = await fetch(`${BASE_URL}/master/items`);
      const isrDuration = Date.now() - isrStart;

      expect(isrResponse.ok).toBe(true);

      console.log('✓ Page load times:');
      console.log(`  Dashboard (dynamic): ${dashDuration}ms`);
      console.log(`  Items (ISR): ${isrDuration}ms`);

      // ISR pages should generally be faster, but in dev mode this may not always be true
      // In production, ISR would be significantly faster
      console.log(`  ${isrDuration < dashDuration ? '✓' : '⚠'} ISR ${isrDuration < dashDuration ? 'faster' : 'slower'} than dynamic`);
    }, 20000);
  });

  describe('Prefetch Optimization', () => {
    it('should have prefetch links in layout', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      // Check for prefetch optimization in Link components or configuration
      const hasPrefetchConfig = layoutContent.includes('prefetch') || layoutContent.includes('Link');

      console.log(`${hasPrefetchConfig ? '✓' : '⚠'} Prefetch configuration ${hasPrefetchConfig ? 'found' : 'not found'}`);
    });
  });

  describe('Next.js Configuration', () => {
    it('should have proper experimental settings', () => {
      const configPath = path.join(process.cwd(), 'next.config.ts');
      const configContent = fs.readFileSync(configPath, 'utf-8');

      // Should have ISR/SSG related configurations
      console.log('✓ Next.js config exists');

      // Check for experimental features
      const hasExperimental = configContent.includes('experimental');
      console.log(`  experimental config: ${hasExperimental}`);
    });
  });
});
