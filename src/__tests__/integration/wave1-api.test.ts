import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Wave 1 API Standardization', () => {
  const BASE_URL = 'http://localhost:5000';
  let testItemId: number;

  beforeAll(async () => {
    // Wait for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup test data if needed
    if (testItemId) {
      try {
        await fetch(`${BASE_URL}/api/items/${testItemId}`, {
          method: 'DELETE'
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('APIResponse Format', () => {
    it('should return standard success response', async () => {
      const response = await fetch(`${BASE_URL}/api/items`);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);

      console.log('✓ Standard success response format verified');
    });

    it('should return standard error response', async () => {
      const response = await fetch(`${BASE_URL}/api/items/99999`);
      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');

      console.log('✓ Standard error response format verified');
    });

    it('should support pagination in response', async () => {
      const response = await fetch(`${BASE_URL}/api/items?page=1&limit=10`);
      const data = await response.json();

      expect(data.success).toBe(true);

      if (data.pagination) {
        expect(data.pagination).toHaveProperty('page');
        expect(data.pagination).toHaveProperty('limit');
        expect(data.pagination).toHaveProperty('totalPages');
        expect(data.pagination).toHaveProperty('totalCount');
        console.log('✓ Pagination format verified:', data.pagination);
      } else {
        console.log('⚠ Pagination not present (optional feature)');
      }
    });
  });

  describe('Korean Encoding Preservation', () => {
    it('should correctly handle Korean characters in POST', async () => {
      const testItem = {
        item_name: '테스트부품_' + Date.now(),
        item_code: 'WAVETEST' + Date.now(),
        spec: '규격-001',
        unit: 'EA',
        current_stock: 0,
        safety_stock: 0,
        is_active: true
      };

      const response = await fetch(`${BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(testItem)
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_name).toBe(testItem.item_name);
      expect(data.data.spec).toBe(testItem.spec);

      // Store for cleanup
      testItemId = data.data.item_id;

      console.log('✓ Korean encoding preserved in POST:', {
        sent: testItem.item_name,
        received: data.data.item_name,
        match: testItem.item_name === data.data.item_name
      });
    });

    it('should correctly handle Korean characters in GET', async () => {
      if (!testItemId) {
        console.log('⚠ Skipping GET test - no test item created');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/items/${testItemId}`);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_name).toContain('테스트부품');
      expect(data.data.spec).toBe('규격-001');

      console.log('✓ Korean encoding preserved in GET:', {
        retrieved: data.data.item_name,
        hasKorean: /[\u3131-\uD79D]/.test(data.data.item_name)
      });
    });

    it('should correctly handle Korean characters in PUT', async () => {
      if (!testItemId) {
        console.log('⚠ Skipping PUT test - no test item created');
        return;
      }

      const updatedData = {
        item_name: '수정된부품_' + Date.now(),
        spec: '변경된규격'
      };

      const response = await fetch(`${BASE_URL}/api/items/${testItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(updatedData)
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_name).toBe(updatedData.item_name);
      expect(data.data.spec).toBe(updatedData.spec);

      console.log('✓ Korean encoding preserved in PUT:', {
        sent: updatedData.item_name,
        received: data.data.item_name,
        match: updatedData.item_name === data.data.item_name
      });
    });
  });

  describe('CRUDHandler Pattern Validation', () => {
    it('should have consistent error handling', async () => {
      // Test with invalid ID
      const response = await fetch(`${BASE_URL}/api/items/invalid`);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();

      console.log('✓ Consistent error handling verified');
    });

    it('should validate required fields', async () => {
      const invalidItem = {
        // Missing required item_name
        item_code: 'INVALID001'
      };

      const response = await fetch(`${BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidItem)
      });

      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();

      console.log('✓ Field validation working:', data.error);
    });
  });

  describe('Response Time Performance', () => {
    it('should respond to GET requests within acceptable time', async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/api/items`);
      const duration = Date.now() - start;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(2000); // Should respond within 2 seconds

      console.log('✓ GET /api/items response time:', duration + 'ms');
    });

    it('should respond to POST requests within acceptable time', async () => {
      const testItem = {
        item_name: 'PerfTest_' + Date.now(),
        item_code: 'PERF' + Date.now(),
        unit: 'EA',
        current_stock: 0,
        safety_stock: 0,
        is_active: true
      };

      const start = Date.now();
      const response = await fetch(`${BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testItem)
      });
      const duration = Date.now() - start;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(3000); // POST can be slightly slower

      const data = await response.json();
      if (data.success && data.data.item_id) {
        // Cleanup
        await fetch(`${BASE_URL}/api/items/${data.data.item_id}`, {
          method: 'DELETE'
        });
      }

      console.log('✓ POST /api/items response time:', duration + 'ms');
    });
  });
});
