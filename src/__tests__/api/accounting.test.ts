/**
 * Phase 2: Comprehensive API Endpoint Tests for Accounting Features
 *
 * Test Coverage:
 * - API #1: GET /api/accounting/monthly-summary
 * - API #2: GET /api/companies/[id]/stats
 * - API #3: PATCH /api/companies/[id]
 * - API #4: GET /api/accounting/export
 *
 * Generated: 2025-10-11
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

// Test configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009';
const TEST_TIMEOUT = 10000; // 10 seconds per test

// Helper function to make API requests
async function apiRequest(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...options?.headers
    }
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    // Response might not be JSON (e.g., Excel file)
    data = text;
  }

  return { response, data };
}

// Helper to encode Korean text for URL parameters
function encodeKorean(text: string): string {
  return encodeURIComponent(text);
}

// Test data - we'll use real data from database
let testCompanyId: string | null = null;
const testMonth = '2025-01';

describe('Phase 2 Accounting API Tests', () => {

  // =====================================================
  // API #1: GET /api/accounting/monthly-summary
  // =====================================================

  describe('GET /api/accounting/monthly-summary', () => {

    it('should return monthly summary with valid month parameter', async () => {
      const { response, data } = await apiRequest(`/api/accounting/monthly-summary?month=${testMonth}`);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data).toHaveProperty('month');
      expect(data.data).toHaveProperty('summary');
      expect(data.data).toHaveProperty('by_category');
      expect(data.data).toHaveProperty('by_company');

      // Verify summary structure
      expect(data.data.summary).toHaveProperty('total_sales');
      expect(data.data.summary).toHaveProperty('total_purchases');
      expect(data.data.summary).toHaveProperty('net_amount');
      expect(data.data.summary).toHaveProperty('company_count');
      expect(data.data.summary).toHaveProperty('categories');

      // Verify data types
      expect(typeof data.data.summary.total_sales).toBe('number');
      expect(typeof data.data.summary.total_purchases).toBe('number');
      expect(typeof data.data.summary.net_amount).toBe('number');
      expect(typeof data.data.summary.company_count).toBe('number');
      expect(Array.isArray(data.data.by_category)).toBe(true);
      expect(Array.isArray(data.data.by_company)).toBe(true);
    }, TEST_TIMEOUT);

    it('should use current month when month parameter not provided', async () => {
      const { response, data } = await apiRequest('/api/accounting/monthly-summary');

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.month).toMatch(/^\d{4}-\d{2}$/);
    }, TEST_TIMEOUT);

    it('should filter by category when provided', async () => {
      const category = '소모품업체';
      const encoded = encodeKorean(category);
      const { response, data } = await apiRequest(`/api/accounting/monthly-summary?month=${testMonth}&category=${encoded}`);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify all companies in result have matching category
      if (data.data.by_company && data.data.by_company.length > 0) {
        data.data.by_company.forEach((company: { company_category: string }) => {
          expect(company.company_category).toBe(category);
        });
      }
    }, TEST_TIMEOUT);

    it('should handle invalid month format with 400 error', async () => {
      const { response, data } = await apiRequest('/api/accounting/monthly-summary?month=invalid');

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('월 형식이 올바르지 않습니다');
    }, TEST_TIMEOUT);

    it('should handle Korean characters in category parameter', async () => {
      const categories = [
        '협력업체-원자재',
        '협력업체-외주',
        '소모품업체',
        '기타'
      ];

      for (const category of categories) {
        const encoded = encodeKorean(category);
        const { response, data } = await apiRequest(`/api/accounting/monthly-summary?month=${testMonth}&category=${encoded}`);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      }
    }, TEST_TIMEOUT * 2);

    it('should calculate correct totals and aggregations', async () => {
      const { data } = await apiRequest(`/api/accounting/monthly-summary?month=${testMonth}`);

      if (data.success && data.data.by_company && data.data.by_company.length > 0) {
        // Calculate expected totals from company data
        const expectedSales = data.data.by_company.reduce((sum: number, company: { sales_amount?: number }) =>
          sum + (company.sales_amount || 0), 0);
        const expectedPurchases = data.data.by_company.reduce((sum: number, company: { purchase_amount?: number }) =>
          sum + (company.purchase_amount || 0), 0);

        // Allow for small rounding differences
        expect(Math.abs(data.data.summary.total_sales - expectedSales)).toBeLessThan(1);
        expect(Math.abs(data.data.summary.total_purchases - expectedPurchases)).toBeLessThan(1);
      }
    }, TEST_TIMEOUT);

    it('should return category summary with percentages', async () => {
      const { data } = await apiRequest(`/api/accounting/monthly-summary?month=${testMonth}`);

      if (data.success && data.data.by_category && data.data.by_category.length > 0) {
        data.data.by_category.forEach((category: { sales_percentage: number; purchase_percentage: number }) => {
          expect(category).toHaveProperty('sales_percentage');
          expect(category).toHaveProperty('purchase_percentage');
          expect(typeof category.sales_percentage).toBe('number');
          expect(typeof category.purchase_percentage).toBe('number');
        });
      }
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // API #2: GET /api/companies/[id]/stats
  // =====================================================

  describe('GET /api/companies/[id]/stats', () => {

    beforeAll(async () => {
      // Get a test company ID from the database
      const { data } = await apiRequest('/api/companies?limit=1');
      if (data.success && data.data && data.data.length > 0) {
        testCompanyId = data.data[0].company_id;
      }
    });

    it('should return company stats with default 12 months', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      const { response, data } = await apiRequest(`/api/companies/${testCompanyId}/stats`);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('company');
      expect(data.data).toHaveProperty('monthly_data');
      expect(data.data).toHaveProperty('summary');

      // Verify company info
      expect(data.data.company).toHaveProperty('company_id');
      expect(data.data.company).toHaveProperty('company_name');
      expect(data.data.company).toHaveProperty('company_category');
      expect(data.data.company).toHaveProperty('business_info');

      // Verify summary stats
      expect(data.data.summary).toHaveProperty('total_sales');
      expect(data.data.summary).toHaveProperty('total_purchases');
      expect(data.data.summary).toHaveProperty('net_amount');
      expect(data.data.summary).toHaveProperty('average_monthly_sales');
      expect(data.data.summary).toHaveProperty('average_monthly_purchases');
    }, TEST_TIMEOUT);

    it('should respect months parameter', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      const months = 6;
      const { response, data } = await apiRequest(`/api/companies/${testCompanyId}/stats?months=${months}`);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify that we get at most 6 months of data
      if (data.data.monthly_data) {
        expect(data.data.monthly_data.length).toBeLessThanOrEqual(months);
      }
    }, TEST_TIMEOUT);

    it('should validate months parameter range (1-60)', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      // Test invalid value too low
      const { response: response1, data: data1 } = await apiRequest(`/api/companies/${testCompanyId}/stats?months=0`);
      expect(response1.status).toBe(400);
      expect(data1.success).toBe(false);

      // Test invalid value too high
      const { response: response2, data: data2 } = await apiRequest(`/api/companies/${testCompanyId}/stats?months=61`);
      expect(response2.status).toBe(400);
      expect(data2.success).toBe(false);
    }, TEST_TIMEOUT);

    it('should handle non-existent company ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { response, data } = await apiRequest(`/api/companies/${fakeId}/stats`);

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    }, TEST_TIMEOUT);

    it('should calculate statistics correctly', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      const { data } = await apiRequest(`/api/companies/${testCompanyId}/stats`);

      if (data.success && data.data.monthly_data && data.data.monthly_data.length > 0) {
        const monthlyData = data.data.monthly_data;
        const summary = data.data.summary;

        // Verify total_sales calculation
        const expectedTotalSales = monthlyData.reduce((sum: number, month: { sales_amount?: number }) =>
          sum + (month.sales_amount || 0), 0);
        expect(Math.abs(summary.total_sales - expectedTotalSales)).toBeLessThan(1);

        // Verify average_monthly_sales calculation
        const expectedAvgSales = expectedTotalSales / monthlyData.length;
        expect(Math.abs(summary.average_monthly_sales - expectedAvgSales)).toBeLessThan(1);
      }
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // API #3: PATCH /api/companies/[id]
  // =====================================================

  describe('PATCH /api/companies/[id]', () => {

    it('should update company with valid Phase 2 fields', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      const updateData = {
        company_category: '소모품업체',
        business_info: {
          business_type: '제조업',
          business_item: '자동차부품',
          main_products: '엔진부품'
        }
      };

      const { response, data } = await apiRequest(`/api/companies/${testCompanyId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.company_category).toBe(updateData.company_category);
      expect(data.data.business_info).toBeDefined();
    }, TEST_TIMEOUT);

    it('should reject invalid company_category', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      const updateData = {
        company_category: 'INVALID_CATEGORY'
      };

      const { response, data } = await apiRequest(`/api/companies/${testCompanyId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('유효하지 않은 업체 구분');
    }, TEST_TIMEOUT);

    it('should accept all valid company categories', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      const validCategories = [
        '협력업체-원자재',
        '협력업체-외주',
        '소모품업체',
        '기타'
      ];

      for (const category of validCategories) {
        const { response, data } = await apiRequest(`/api/companies/${testCompanyId}`, {
          method: 'PATCH',
          body: JSON.stringify({ company_category: category })
        });

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      }
    }, TEST_TIMEOUT * 2);

    it('should validate business_info structure', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      // Test invalid type (not object)
      const { response: r1 } = await apiRequest(`/api/companies/${testCompanyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ business_info: 'invalid' })
      });
      expect(r1.status).toBe(400);

      // Test with extra fields
      const { response: r2 } = await apiRequest(`/api/companies/${testCompanyId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          business_info: {
            business_type: '제조업',
            invalid_field: 'test'
          }
        })
      });
      expect(r2.status).toBe(400);
    }, TEST_TIMEOUT);

    it('should preserve Korean characters in business_info', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      const koreanData = {
        business_info: {
          business_type: '제조업',
          business_item: '자동차부품',
          main_products: '엔진부품, 변속기부품, 구동계부품'
        }
      };

      const { response, data } = await apiRequest(`/api/companies/${testCompanyId}`, {
        method: 'PATCH',
        body: JSON.stringify(koreanData)
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.business_info.business_type).toBe(koreanData.business_info.business_type);
      expect(data.data.business_info.business_item).toBe(koreanData.business_info.business_item);
      expect(data.data.business_info.main_products).toBe(koreanData.business_info.main_products);
    }, TEST_TIMEOUT);

    it('should handle non-existent company ID with 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { response, data } = await apiRequest(`/api/companies/${fakeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ company_category: '소모품업체' })
      });

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // API #4: GET /api/accounting/export
  // =====================================================

  describe('GET /api/accounting/export', () => {

    it('should return Excel file with valid parameters', async () => {
      const response = await fetch(`${API_BASE_URL}/api/accounting/export?month=${testMonth}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('spreadsheetml');
      expect(response.headers.get('content-disposition')).toContain('attachment');

      const blob = await response.blob();
      expect(blob.size).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should include category in filename when filtered', async () => {
      const category = encodeKorean('소모품업체');
      const response = await fetch(`${API_BASE_URL}/api/accounting/export?month=${testMonth}&category=${category}`);

      expect(response.status).toBe(200);

      const contentDisposition = response.headers.get('content-disposition');
      expect(contentDisposition).toBeTruthy();
      expect(contentDisposition).toContain('소모품업체');
    }, TEST_TIMEOUT);

    it('should use current month when not provided', async () => {
      const response = await fetch(`${API_BASE_URL}/api/accounting/export`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('spreadsheetml');
    }, TEST_TIMEOUT);

    it('should handle all valid categories in export', async () => {
      const categories = [
        '협력업체-원자재',
        '협력업체-외주',
        '소모품업체',
        '기타'
      ];

      for (const category of categories) {
        const encoded = encodeKorean(category);
        const response = await fetch(`${API_BASE_URL}/api/accounting/export?month=${testMonth}&category=${encoded}`);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('spreadsheetml');
      }
    }, TEST_TIMEOUT * 2);
  });

  // =====================================================
  // Integration Tests
  // =====================================================

  describe('Integration Tests', () => {

    it('should maintain data consistency across endpoints', async () => {
      // Get monthly summary
      const { data: summaryData } = await apiRequest(`/api/accounting/monthly-summary?month=${testMonth}`);

      if (!summaryData.success || !summaryData.data.by_company || summaryData.data.by_company.length === 0) {
        console.log('Skipping test: No company data available');
        return;
      }

      // Pick first company
      const firstCompany = summaryData.data.by_company[0];

      // Get company stats
      const { data: statsData } = await apiRequest(`/api/companies/${firstCompany.company_id}/stats`);

      expect(statsData.success).toBe(true);
      expect(statsData.data.company.company_id).toBe(firstCompany.company_id);
      expect(statsData.data.company.company_name).toBe(firstCompany.company_name);
      expect(statsData.data.company.company_category).toBe(firstCompany.company_category);
    }, TEST_TIMEOUT);

    it('should reflect updates immediately after PATCH', async () => {
      if (!testCompanyId) {
        console.log('Skipping test: No test company available');
        return;
      }

      const newCategory = '협력업체-외주';

      // Update company
      await apiRequest(`/api/companies/${testCompanyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ company_category: newCategory })
      });

      // Get company stats to verify
      const { data: statsData } = await apiRequest(`/api/companies/${testCompanyId}/stats`);

      expect(statsData.success).toBe(true);
      expect(statsData.data.company.company_category).toBe(newCategory);
    }, TEST_TIMEOUT);
  });
});
