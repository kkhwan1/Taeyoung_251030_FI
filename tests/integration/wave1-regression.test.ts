import { describe, it, expect, beforeAll } from '@jest/globals';

describe('Wave 1 Regression Tests', () => {
  const BASE_URL = 'http://localhost:5000';
  const createdIds: Record<string, number> = {};

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  describe('CRUD Operations Still Work', () => {
    it('should create item successfully', async () => {
      const testItem = {
        item_name: 'Regression Test Item_' + Date.now(),
        item_code: 'REG' + Date.now(),
        unit: 'EA',
        current_stock: 100,
        safety_stock: 10,
        is_active: true
      };

      const response = await fetch(`${BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(testItem)
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('item_id');
      expect(data.data.item_name).toBe(testItem.item_name);

      createdIds.item = data.data.item_id;

      console.log('✓ CREATE operation successful:', {
        item_id: data.data.item_id,
        item_name: data.data.item_name
      });
    });

    it('should read items successfully', async () => {
      const response = await fetch(`${BASE_URL}/api/items`);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);

      console.log('✓ READ operation successful:', {
        count: data.data.length,
        hasPagination: !!data.pagination
      });
    });

    it('should read single item successfully', async () => {
      if (!createdIds.item) {
        console.log('⚠ Skipping - no item created');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/items/${createdIds.item}`);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_id).toBe(createdIds.item);

      console.log('✓ READ single item successful');
    });

    it('should update item successfully', async () => {
      if (!createdIds.item) {
        console.log('⚠ Skipping - no item created');
        return;
      }

      const updateData = {
        item_name: 'Updated Regression Test_' + Date.now(),
        current_stock: 200
      };

      const response = await fetch(`${BASE_URL}/api/items/${createdIds.item}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_name).toBe(updateData.item_name);
      expect(data.data.current_stock).toBe(updateData.current_stock);

      console.log('✓ UPDATE operation successful');
    });

    it('should delete item successfully (soft delete)', async () => {
      if (!createdIds.item) {
        console.log('⚠ Skipping - no item created');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/items/${createdIds.item}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      expect(data.success).toBe(true);

      console.log('✓ DELETE operation successful (soft delete)');
    });
  });

  describe('Korean Encoding Preserved', () => {
    let koreanItemId: number;

    it('should handle Korean in CREATE operation', async () => {
      const koreanData = {
        item_name: '한글테스트부품_' + Date.now(),
        item_code: 'KOR' + Date.now(),
        spec: '규격명세서',
        unit: '개',
        current_stock: 50,
        safety_stock: 5,
        is_active: true
      };

      const response = await fetch(`${BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(koreanData)
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_name).toBe(koreanData.item_name);
      expect(data.data.spec).toBe(koreanData.spec);
      expect(data.data.unit).toBe(koreanData.unit);

      koreanItemId = data.data.item_id;

      console.log('✓ Korean CREATE:', {
        item_name: data.data.item_name,
        spec: data.data.spec,
        unit: data.data.unit,
        encoded_correctly: data.data.item_name === koreanData.item_name
      });
    });

    it('should handle Korean in READ operation', async () => {
      if (!koreanItemId) {
        console.log('⚠ Skipping - no Korean item created');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/items/${koreanItemId}`);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_name).toContain('한글테스트부품');
      expect(data.data.spec).toBe('규격명세서');

      console.log('✓ Korean READ preserved');
    });

    it('should handle Korean in UPDATE operation', async () => {
      if (!koreanItemId) {
        console.log('⚠ Skipping - no Korean item created');
        return;
      }

      const updateData = {
        item_name: '수정된한글부품_' + Date.now(),
        spec: '변경된규격'
      };

      const response = await fetch(`${BASE_URL}/api/items/${koreanItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.item_name).toBe(updateData.item_name);
      expect(data.data.spec).toBe(updateData.spec);

      console.log('✓ Korean UPDATE preserved');
    });

    it('should cleanup Korean test item', async () => {
      if (!koreanItemId) {
        console.log('⚠ No Korean item to cleanup');
        return;
      }

      await fetch(`${BASE_URL}/api/items/${koreanItemId}`, {
        method: 'DELETE'
      });

      console.log('✓ Korean test item cleaned up');
    });
  });

  describe('Companies API Regression', () => {
    let companyId: number;

    it('should create company with Korean data', async () => {
      const companyData = {
        company_name: '테스트회사_' + Date.now(),
        company_code: 'COMP' + Date.now(),
        company_type: '고객사',
        business_registration_number: '123-45-67890',
        ceo_name: '김대표',
        address: '서울시 강남구',
        phone_number: '02-1234-5678'
      };

      const response = await fetch(`${BASE_URL}/api/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(companyData)
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.company_name).toBe(companyData.company_name);
      expect(data.data.ceo_name).toBe(companyData.ceo_name);

      companyId = data.data.company_id;

      console.log('✓ Company CREATE with Korean successful');
    });

    it('should read companies', async () => {
      const response = await fetch(`${BASE_URL}/api/companies`);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      console.log('✓ Companies READ successful');
    });

    it('should cleanup company', async () => {
      if (!companyId) {
        return;
      }

      await fetch(`${BASE_URL}/api/companies/${companyId}`, {
        method: 'DELETE'
      });

      console.log('✓ Company cleaned up');
    });
  });

  describe('API Response Times', () => {
    it('should respond to items API within 2 seconds', async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/api/items`);
      const duration = Date.now() - start;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(2000);

      console.log('✓ Items API response time:', duration + 'ms');
    });

    it('should respond to companies API within 2 seconds', async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/api/companies`);
      const duration = Date.now() - start;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(2000);

      console.log('✓ Companies API response time:', duration + 'ms');
    });

    it('should respond to sales API within 2 seconds', async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/api/sales-transactions`);
      const duration = Date.now() - start;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(2000);

      console.log('✓ Sales API response time:', duration + 'ms');
    });
  });

  describe('Error Handling Regression', () => {
    it('should handle invalid ID gracefully', async () => {
      const response = await fetch(`${BASE_URL}/api/items/invalid-id`);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();

      console.log('✓ Invalid ID handled gracefully');
    });

    it('should handle missing required fields', async () => {
      const invalidItem = {
        // Missing item_name
        item_code: 'INVALID'
      };

      const response = await fetch(`${BASE_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidItem)
      });

      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();

      console.log('✓ Missing fields handled gracefully');
    });

    it('should handle non-existent resource', async () => {
      const response = await fetch(`${BASE_URL}/api/items/999999`);
      const data = await response.json();

      expect(data.success).toBe(false);

      console.log('✓ Non-existent resource handled gracefully');
    });
  });

  describe('Lazy Loading Regression', () => {
    it('should load pages with lazy components', async () => {
      const pages = [
        '/master/items',
        '/master/companies',
        '/sales',
        '/purchases'
      ];

      for (const page of pages) {
        const response = await fetch(`${BASE_URL}${page}`);
        expect(response.ok).toBe(true);
      }

      console.log('✓ All lazy-loaded pages accessible');
    }, 30000);
  });

  describe('Pagination Regression', () => {
    it('should support pagination parameters', async () => {
      const response = await fetch(`${BASE_URL}/api/items?page=1&limit=5`);
      const data = await response.json();

      expect(data.success).toBe(true);

      if (data.pagination) {
        expect(data.pagination.page).toBe(1);
        expect(data.pagination.limit).toBe(5);
        console.log('✓ Pagination working:', data.pagination);
      } else {
        console.log('⚠ Pagination not implemented');
      }
    });
  });
});
