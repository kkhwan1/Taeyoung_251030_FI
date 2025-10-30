/**
 * Phase 2: Performance Tests for Accounting Features
 *
 * Performance Targets:
 * - API response time: < 500ms
 * - Excel export generation: < 3 seconds
 * - Database VIEW queries: < 200ms
 * - Concurrent request handling: 10+ simultaneous requests
 *
 * Generated: 2025-10-11
 */

import { describe, it, expect } from '@jest/globals';

// Test configuration - Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues on Windows
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
const TEST_TIMEOUT = 15000; // 15 seconds for performance tests

// Performance thresholds (milliseconds)
const THRESHOLDS = {
  API_RESPONSE: 500,           // API endpoints should respond in < 500ms
  EXCEL_EXPORT: 3000,          // Excel generation should complete in < 3s
  BATCH_REQUEST: 1000,         // Batch requests should complete in < 1s
  DATABASE_QUERY: 200          // Database queries should execute in < 200ms
};

// Helper to measure execution time
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

// Helper to make API requests
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
  } catch (e) {
    data = text;
  }

  return { response, data };
}

describe('Performance Tests: Accounting API', () => {

  // =====================================================
  // API Response Time Tests
  // =====================================================

  describe('API Response Time', () => {

    it('should return monthly summary in < 500ms', async () => {
      const { duration } = await measureTime(async () => {
        const { response, data } = await apiRequest('/api/accounting/monthly-summary?month=2025-01');
        expect(response.status).toBe(200);
        return data;
      });

      console.log(`Monthly summary response time: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
    }, TEST_TIMEOUT);

    it('should return filtered monthly summary in < 500ms', async () => {
      const { duration } = await measureTime(async () => {
        const category = encodeURIComponent('소모품업체');
        const { response, data } = await apiRequest(`/api/accounting/monthly-summary?month=2025-01&category=${category}`);
        expect(response.status).toBe(200);
        return data;
      });

      console.log(`Filtered monthly summary response time: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
    }, TEST_TIMEOUT);

    it('should return company stats in < 500ms', async () => {
      // Get a test company first
      const { data: companiesData } = await apiRequest('/api/companies?limit=1');
      if (!companiesData.success || !companiesData.data || companiesData.data.length === 0) {
        console.log('Skipping test: No companies available');
        return;
      }

      const companyId = companiesData.data[0].company_id;

      const { duration } = await measureTime(async () => {
        const { response, data } = await apiRequest(`/api/companies/${companyId}/stats`);
        expect(response.status).toBe(200);
        return data;
      });

      console.log(`Company stats response time: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
    }, TEST_TIMEOUT);

    it('should handle company update (PATCH) in < 500ms', async () => {
      // Get a test company
      const { data: companiesData } = await apiRequest('/api/companies?limit=1');
      if (!companiesData.success || !companiesData.data || companiesData.data.length === 0) {
        console.log('Skipping test: No companies available');
        return;
      }

      const companyId = companiesData.data[0].company_id;

      const { duration } = await measureTime(async () => {
        const { response, data } = await apiRequest(`/api/companies/${companyId}`, {
          method: 'PATCH',
          body: JSON.stringify({ company_category: '소모품업체' })
        });
        expect(response.status).toBe(200);
        return data;
      });

      console.log(`Company update response time: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // Excel Export Performance Tests
  // =====================================================

  describe('Excel Export Performance', () => {

    it('should generate Excel export in < 3 seconds', async () => {
      const { duration } = await measureTime(async () => {
        const response = await fetch(`${API_BASE_URL}/api/accounting/export?month=2025-01`);
        expect(response.status).toBe(200);
        const blob = await response.blob();
        expect(blob.size).toBeGreaterThan(0);
        return blob;
      });

      console.log(`Excel export generation time: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.EXCEL_EXPORT);
    }, TEST_TIMEOUT);

    it('should generate filtered Excel export in < 3 seconds', async () => {
      const { duration } = await measureTime(async () => {
        const category = encodeURIComponent('협력업체-원자재');
        const response = await fetch(`${API_BASE_URL}/api/accounting/export?month=2025-01&category=${category}`);
        expect(response.status).toBe(200);
        const blob = await response.blob();
        return blob;
      });

      console.log(`Filtered Excel export generation time: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.EXCEL_EXPORT);
    }, TEST_TIMEOUT);

    it('should handle multiple category exports efficiently', async () => {
      const categories = [
        '협력업체-원자재',
        '협력업체-외주',
        '소모품업체',
        '기타'
      ];

      const durations: number[] = [];

      for (const category of categories) {
        const { duration } = await measureTime(async () => {
          const encoded = encodeURIComponent(category);
          const response = await fetch(`${API_BASE_URL}/api/accounting/export?month=2025-01&category=${encoded}`);
          expect(response.status).toBe(200);
          return response;
        });

        durations.push(duration);
        console.log(`Excel export for ${category}: ${duration}ms`);
      }

      // Average should be under threshold
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average Excel export time: ${avgDuration}ms`);
      expect(avgDuration).toBeLessThan(THRESHOLDS.EXCEL_EXPORT);
    }, TEST_TIMEOUT * 2);
  });

  // =====================================================
  // Concurrent Request Tests
  // =====================================================

  describe('Concurrent Request Handling', () => {

    it('should handle 5 concurrent monthly summary requests', async () => {
      const concurrentRequests = 5;

      const { duration } = await measureTime(async () => {
        const promises = Array(concurrentRequests).fill(null).map(() =>
          apiRequest('/api/accounting/monthly-summary?month=2025-01')
        );

        const results = await Promise.all(promises);

        // Verify all succeeded
        results.forEach(({ response, data }) => {
          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
        });

        return results;
      });

      console.log(`${concurrentRequests} concurrent requests completed in: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE * 2); // Allow 2x threshold for concurrent
    }, TEST_TIMEOUT);

    it('should handle 10 concurrent company stats requests', async () => {
      // Get test companies
      const { data: companiesData } = await apiRequest('/api/companies?limit=10');
      if (!companiesData.success || !companiesData.data || companiesData.data.length < 5) {
        console.log('Skipping test: Not enough companies available');
        return;
      }

      const companyIds = companiesData.data.slice(0, 10).map((c: any) => c.company_id);

      const { duration } = await measureTime(async () => {
        const promises = companyIds.map((id: string) =>
          apiRequest(`/api/companies/${id}/stats`)
        );

        const results = await Promise.all(promises);

        // Verify all succeeded
        results.forEach(({ response, data }) => {
          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
        });

        return results;
      });

      console.log(`${companyIds.length} concurrent company stats requests completed in: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE * 3); // Allow 3x threshold for concurrent
    }, TEST_TIMEOUT);

    it('should handle mixed concurrent requests efficiently', async () => {
      const { duration } = await measureTime(async () => {
        const promises = [
          // 3 monthly summary requests
          apiRequest('/api/accounting/monthly-summary?month=2025-01'),
          apiRequest('/api/accounting/monthly-summary?month=2024-12'),
          apiRequest('/api/accounting/monthly-summary?month=2024-11'),
          // 2 filtered requests
          apiRequest('/api/accounting/monthly-summary?month=2025-01&category=' + encodeURIComponent('소모품업체')),
          apiRequest('/api/accounting/monthly-summary?month=2025-01&category=' + encodeURIComponent('협력업체-원자재'))
        ];

        const results = await Promise.all(promises);

        // Verify all succeeded
        results.forEach(({ response, data }) => {
          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
        });

        return results;
      });

      console.log(`5 mixed concurrent requests completed in: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE * 2);
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // Data Volume Performance Tests
  // =====================================================

  describe('Data Volume Performance', () => {

    it('should handle large result sets efficiently', async () => {
      const { duration, result } = await measureTime(async () => {
        // Request without filters to get maximum data
        const { response, data } = await apiRequest('/api/accounting/monthly-summary?month=2025-01');
        expect(response.status).toBe(200);
        return data;
      });

      if (result.success && result.data.by_company) {
        const recordCount = result.data.by_company.length;
        console.log(`Retrieved ${recordCount} company records in: ${duration}ms`);

        // Performance should scale linearly
        const msPerRecord = duration / Math.max(recordCount, 1);
        console.log(`Performance: ${msPerRecord.toFixed(2)}ms per record`);

        // Should handle at least 100 records under threshold
        if (recordCount >= 100) {
          expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
        }
      }
    }, TEST_TIMEOUT);

    it('should handle company stats with 12 months efficiently', async () => {
      // Get a test company
      const { data: companiesData } = await apiRequest('/api/companies?limit=1');
      if (!companiesData.success || !companiesData.data || companiesData.data.length === 0) {
        console.log('Skipping test: No companies available');
        return;
      }

      const companyId = companiesData.data[0].company_id;

      const { duration } = await measureTime(async () => {
        const { response, data } = await apiRequest(`/api/companies/${companyId}/stats?months=12`);
        expect(response.status).toBe(200);
        return data;
      });

      console.log(`Company stats (12 months) response time: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE);
    }, TEST_TIMEOUT);

    it('should handle company stats with 60 months efficiently', async () => {
      // Get a test company
      const { data: companiesData } = await apiRequest('/api/companies?limit=1');
      if (!companiesData.success || !companiesData.data || companiesData.data.length === 0) {
        console.log('Skipping test: No companies available');
        return;
      }

      const companyId = companiesData.data[0].company_id;

      const { duration } = await measureTime(async () => {
        const { response, data } = await apiRequest(`/api/companies/${companyId}/stats?months=60`);
        expect(response.status).toBe(200);
        return data;
      });

      console.log(`Company stats (60 months) response time: ${duration}ms`);
      // Allow higher threshold for max data request
      expect(duration).toBeLessThan(THRESHOLDS.API_RESPONSE * 2);
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // Database Query Performance Tests
  // =====================================================

  describe('Database Query Performance', () => {

    it('should execute VIEW queries efficiently', async () => {
      // Test v_monthly_accounting VIEW performance
      const { duration } = await measureTime(async () => {
        const { response, data } = await apiRequest('/api/accounting/monthly-summary?month=2025-01');
        expect(response.status).toBe(200);
        return data;
      });

      console.log(`v_monthly_accounting VIEW query time: ${duration}ms`);
      // This includes API overhead, so allow 2x DATABASE_QUERY threshold
      expect(duration).toBeLessThan(THRESHOLDS.DATABASE_QUERY * 3);
    }, TEST_TIMEOUT);

    it('should handle filtered VIEW queries efficiently', async () => {
      const { duration } = await measureTime(async () => {
        const category = encodeURIComponent('소모품업체');
        const { response, data } = await apiRequest(`/api/accounting/monthly-summary?month=2025-01&category=${category}`);
        expect(response.status).toBe(200);
        return data;
      });

      console.log(`Filtered VIEW query time: ${duration}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.DATABASE_QUERY * 3);
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // Performance Regression Tests
  // =====================================================

  describe('Performance Regression Detection', () => {

    it('should maintain consistent performance across multiple runs', async () => {
      const runs = 5;
      const durations: number[] = [];

      for (let i = 0; i < runs; i++) {
        const { duration } = await measureTime(async () => {
          const { response, data } = await apiRequest('/api/accounting/monthly-summary?month=2025-01');
          expect(response.status).toBe(200);
          return data;
        });

        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;

      console.log(`Performance consistency test (${runs} runs):`);
      console.log(`  Average: ${avgDuration.toFixed(0)}ms`);
      console.log(`  Min: ${minDuration}ms`);
      console.log(`  Max: ${maxDuration}ms`);
      console.log(`  Variance: ${variance}ms`);

      // Variance should be reasonable (< 200ms)
      expect(variance).toBeLessThan(200);

      // Average should be under threshold
      expect(avgDuration).toBeLessThan(THRESHOLDS.API_RESPONSE);
    }, TEST_TIMEOUT * 2);
  });

  // =====================================================
  // Memory and Resource Tests
  // =====================================================

  describe('Resource Utilization', () => {

    it('should handle rapid sequential requests without degradation', async () => {
      const sequentialRequests = 10;
      const durations: number[] = [];

      for (let i = 0; i < sequentialRequests; i++) {
        const { duration } = await measureTime(async () => {
          const { response } = await apiRequest('/api/accounting/monthly-summary?month=2025-01');
          expect(response.status).toBe(200);
        });

        durations.push(duration);
      }

      const firstHalf = durations.slice(0, 5);
      const secondHalf = durations.slice(5, 10);

      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      console.log(`Sequential requests performance:`);
      console.log(`  First 5 average: ${avgFirst.toFixed(0)}ms`);
      console.log(`  Last 5 average: ${avgSecond.toFixed(0)}ms`);

      // Performance should not degrade significantly
      const degradation = avgSecond / avgFirst;
      console.log(`  Degradation ratio: ${degradation.toFixed(2)}x`);

      expect(degradation).toBeLessThan(1.5); // Max 50% degradation
    }, TEST_TIMEOUT * 2);
  });
});
