/**
 * Phase 2: Korean Character Encoding Tests
 *
 * Test Coverage:
 * - Korean text in API request body (POST/PATCH)
 * - Korean text in URL query parameters
 * - Korean text in database round-trip
 * - JSONB field Korean text handling
 * - Excel export Korean headers
 *
 * Critical Pattern: request.text() + JSON.parse() for proper UTF-8 encoding
 *
 * Generated: 2025-10-11
 */

import { describe, it, expect } from '@jest/globals';

// Test configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009';
const TEST_TIMEOUT = 10000;

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
  } catch (e) {
    data = text;
  }

  return { response, data };
}

describe('Korean Character Encoding Tests', () => {

  // =====================================================
  // Request Body Encoding Tests
  // =====================================================

  describe('API Request Body Encoding', () => {

    it('should preserve Korean in POST company name', async () => {
      const koreanText = '태창정밀자동차부품(주)';
      const testData = {
        company_code: `TEST-${Date.now()}`,
        company_name: koreanText,
        company_type: '공급사'
      };

      const { response, data } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(testData)
      });

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.company_name).toBe(koreanText);

      // Cleanup
      if (data.success) {
        await apiRequest(`/api/companies/${data.data.company_id}`, { method: 'DELETE' });
      }
    }, TEST_TIMEOUT);

    it('should preserve Korean in PATCH company_category', async () => {
      // Create test company first
      const createData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '테스트회사',
        company_type: '공급사'
      };

      const { data: createResult } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      if (!createResult.success) {
        console.log('Failed to create test company');
        return;
      }

      const companyId = createResult.data.company_id;

      // Test PATCH with Korean category
      const koreanCategory = '협력업체-원자재';
      const { response, data } = await apiRequest(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ company_category: koreanCategory })
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.company_category).toBe(koreanCategory);

      // Cleanup
      await apiRequest(`/api/companies/${companyId}`, { method: 'DELETE' });
    }, TEST_TIMEOUT);

    it('should preserve Korean in business_info JSONB field', async () => {
      // Create test company
      const createData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '테스트회사',
        company_type: '공급사'
      };

      const { data: createResult } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      if (!createResult.success) {
        console.log('Failed to create test company');
        return;
      }

      const companyId = createResult.data.company_id;

      // Test PATCH with Korean business_info
      const koreanBusinessInfo = {
        business_type: '제조업',
        business_item: '자동차부품 제조',
        main_products: '엔진부품, 변속기부품, 구동계부품'
      };

      const { response, data } = await apiRequest(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ business_info: koreanBusinessInfo })
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.business_info.business_type).toBe(koreanBusinessInfo.business_type);
      expect(data.data.business_info.business_item).toBe(koreanBusinessInfo.business_item);
      expect(data.data.business_info.main_products).toBe(koreanBusinessInfo.main_products);

      // Cleanup
      await apiRequest(`/api/companies/${companyId}`, { method: 'DELETE' });
    }, TEST_TIMEOUT);

    it('should handle multiple Korean sentences in business_info', async () => {
      // Create test company
      const createData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '테스트회사',
        company_type: '공급사'
      };

      const { data: createResult } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      if (!createResult.success) return;

      const companyId = createResult.data.company_id;

      // Test with complex Korean text
      const complexText = {
        business_type: '제조업 및 도매업',
        business_item: '자동차 부품 제조 및 판매',
        main_products: '엔진 관련 부품: 피스톤, 실린더 헤드, 밸브\n구동계 부품: 변속기, 클러치, 드라이브 샤프트'
      };

      const { response, data } = await apiRequest(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ business_info: complexText })
      });

      expect(response.status).toBe(200);
      expect(data.data.business_info.main_products).toBe(complexText.main_products);

      // Cleanup
      await apiRequest(`/api/companies/${companyId}`, { method: 'DELETE' });
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // URL Query Parameter Encoding Tests
  // =====================================================

  describe('URL Query Parameter Encoding', () => {

    it('should handle Korean category in monthly-summary query', async () => {
      const categories = [
        '협력업체-원자재',
        '협력업체-외주',
        '소모품업체',
        '기타'
      ];

      for (const category of categories) {
        const encoded = encodeURIComponent(category);
        const { response, data } = await apiRequest(`/api/accounting/monthly-summary?month=2025-01&category=${encoded}`);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify Korean preserved in filter
        if (data.data.by_company && data.data.by_company.length > 0) {
          data.data.by_company.forEach((company: any) => {
            expect(company.company_category).toBe(category);
          });
        }
      }
    }, TEST_TIMEOUT * 2);

    it('should handle Korean category in export query', async () => {
      const category = '소모품업체';
      const encoded = encodeURIComponent(category);
      const response = await fetch(`${API_BASE_URL}/api/accounting/export?month=2025-01&category=${encoded}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-disposition')).toContain(category);
    }, TEST_TIMEOUT);

    it('should handle special characters in Korean text', async () => {
      const categoryWithHyphen = '협력업체-원자재';
      const encoded = encodeURIComponent(categoryWithHyphen);
      const { response, data } = await apiRequest(`/api/accounting/monthly-summary?month=2025-01&category=${encoded}`);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // Database Round-Trip Tests
  // =====================================================

  describe('Database Round-Trip Encoding', () => {

    it('should preserve Korean through full CRUD cycle', async () => {
      const testData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '태창정밀자동차부품(주)',
        company_type: '공급사',
        company_category: '협력업체-원자재',
        business_info: {
          business_type: '제조업',
          business_item: '자동차부품',
          main_products: '엔진부품, 변속기부품'
        },
        representative: '홍길동',
        address: '경기도 화성시 우정읍 화성로 123'
      };

      // CREATE
      const { data: createResult } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(testData)
      });

      expect(createResult.success).toBe(true);
      const companyId = createResult.data.company_id;

      // READ
      const { data: readResult } = await apiRequest(`/api/companies/${companyId}`);
      expect(readResult.success).toBe(true);
      expect(readResult.data.company_name).toBe(testData.company_name);
      expect(readResult.data.company_category).toBe(testData.company_category);
      expect(readResult.data.business_info.business_type).toBe(testData.business_info.business_type);
      expect(readResult.data.representative).toBe(testData.representative);
      expect(readResult.data.address).toBe(testData.address);

      // UPDATE
      const updateData = {
        company_name: '태창정밀(주)',
        company_category: '협력업체-외주',
        business_info: {
          business_type: '제조 및 도매업',
          business_item: '금형가공',
          main_products: '프레스금형, 사출금형'
        }
      };

      const { data: updateResult } = await apiRequest(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.company_name).toBe(updateData.company_name);
      expect(updateResult.data.company_category).toBe(updateData.company_category);

      // DELETE (cleanup)
      const { data: deleteResult } = await apiRequest(`/api/companies/${companyId}`, {
        method: 'DELETE'
      });

      expect(deleteResult.success).toBe(true);
    }, TEST_TIMEOUT * 2);

    it('should preserve Korean in JSONB nested structures', async () => {
      const createData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '테스트회사',
        company_type: '공급사',
        business_info: {
          business_type: '복합업종: 제조업, 도매업, 서비스업',
          business_item: '다양한 자동차 부품',
          main_products: '1차 부품: 엔진, 변속기\n2차 부품: 브레이크, 서스펜션\n3차 부품: 기타 소모품'
        }
      };

      const { data: createResult } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      expect(createResult.success).toBe(true);
      const companyId = createResult.data.company_id;

      // Verify immediate read
      const { data: readResult } = await apiRequest(`/api/companies/${companyId}`);
      expect(readResult.data.business_info.business_type).toBe(createData.business_info.business_type);
      expect(readResult.data.business_info.main_products).toBe(createData.business_info.main_products);

      // Cleanup
      await apiRequest(`/api/companies/${companyId}`, { method: 'DELETE' });
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // Edge Cases and Special Scenarios
  // =====================================================

  describe('Edge Cases', () => {

    it('should handle empty Korean strings', async () => {
      const createData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '테스트회사',
        company_type: '공급사',
        business_info: {
          business_type: '',
          business_item: '',
          main_products: ''
        }
      };

      const { data: result } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      if (result.success) {
        expect(result.data.business_info.business_type).toBe('');
        await apiRequest(`/api/companies/${result.data.company_id}`, { method: 'DELETE' });
      }
    }, TEST_TIMEOUT);

    it('should handle Korean text with mixed English', async () => {
      const createData = {
        company_code: `TEST-${Date.now()}`,
        company_name: 'ABC자동차부품(주)',
        company_type: '공급사',
        business_info: {
          business_type: 'Manufacturing (제조업)',
          business_item: 'Auto Parts 자동차부품',
          main_products: 'Engine Parts (엔진부품), Transmission (변속기)'
        }
      };

      const { data: result } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      expect(result.success).toBe(true);
      expect(result.data.company_name).toBe(createData.company_name);
      expect(result.data.business_info.business_type).toBe(createData.business_info.business_type);

      // Cleanup
      if (result.success) {
        await apiRequest(`/api/companies/${result.data.company_id}`, { method: 'DELETE' });
      }
    }, TEST_TIMEOUT);

    it('should handle Korean text with numbers and symbols', async () => {
      const createData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '테스트회사',
        company_type: '공급사',
        business_info: {
          business_type: '제조업 (ISO 9001:2015)',
          business_item: '자동차부품 #A123',
          main_products: '엔진부품 (50%), 변속기부품 (30%), 기타 (20%)'
        }
      };

      const { data: result } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      expect(result.success).toBe(true);
      expect(result.data.business_info.main_products).toBe(createData.business_info.main_products);

      // Cleanup
      if (result.success) {
        await apiRequest(`/api/companies/${result.data.company_id}`, { method: 'DELETE' });
      }
    }, TEST_TIMEOUT);

    it('should handle maximum length Korean text', async () => {
      const createData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '테스트회사',
        company_type: '공급사',
        business_info: {
          business_type: '제조업',
          business_item: '자동차부품',
          main_products: '엔진부품'.repeat(50) // Long Korean text
        }
      };

      const { data: result } = await apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      // Should either succeed or fail gracefully with validation error
      if (result.success) {
        expect(result.data.business_info.main_products).toBe(createData.business_info.main_products);
        await apiRequest(`/api/companies/${result.data.company_id}`, { method: 'DELETE' });
      } else {
        expect(result.error).toBeDefined();
      }
    }, TEST_TIMEOUT);
  });

  // =====================================================
  // Content-Type Header Tests
  // =====================================================

  describe('Content-Type Header Validation', () => {

    it('should work with charset=utf-8 in Content-Type', async () => {
      const testData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '테스트회사',
        company_type: '공급사'
      };

      const { response, data } = await apiRequest('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(testData)
      });

      expect(response.status).toBe(201);
      expect(data.data.company_name).toBe(testData.company_name);

      // Cleanup
      if (data.success) {
        await apiRequest(`/api/companies/${data.data.company_id}`, { method: 'DELETE' });
      }
    }, TEST_TIMEOUT);

    it('should work without explicit charset (defaults to UTF-8)', async () => {
      const testData = {
        company_code: `TEST-${Date.now()}`,
        company_name: '테스트회사',
        company_type: '공급사'
      };

      const { response, data } = await apiRequest('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });

      expect(response.status).toBe(201);
      expect(data.data.company_name).toBe(testData.company_name);

      // Cleanup
      if (data.success) {
        await apiRequest(`/api/companies/${data.data.company_id}`, { method: 'DELETE' });
      }
    }, TEST_TIMEOUT);
  });
});
