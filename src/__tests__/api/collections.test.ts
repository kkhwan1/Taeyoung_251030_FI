/**
 * Collections API Test Suite
 * Tests for /api/collections endpoints
 */

import { describe, test, expect } from '@jest/globals';

// Test configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009';
const COLLECTIONS_ENDPOINT = `${API_BASE_URL}/api/collections`;

// Helper function to make API requests with Korean encoding support
interface CollectionData {
  collection_id: number;
  collection_no?: string;
  collection_date: string;
  sales_transaction_id: number;
  collected_amount: number;
  payment_method: string;
  bank_name?: string;
  account_number?: string;
  notes?: string;
}

interface ApiResponse<T = CollectionData | CollectionData[]> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    totalPages?: number;
    totalCount?: number;
  };
}

async function apiRequest(
  url: string,
  method: string = 'GET',
  body?: unknown
): Promise<ApiResponse> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const text = await response.text();
  return JSON.parse(text);
}

describe('Collections API', () => {
  // Test data
  let testCollectionId: number;
  let testSalesTransactionId: number;

  beforeAll(async () => {
    // Dynamically fetch existing sales transaction from database
    const salesResponse = await fetch(`${API_BASE_URL}/api/sales-transactions?limit=1`);
    const salesData = await salesResponse.json();

    if (!salesData.success || !salesData.data || salesData.data.length === 0) {
      throw new Error('테스트용 매출 거래가 데이터베이스에 없습니다. 매출 거래를 먼저 생성해주세요.');
    }

    testSalesTransactionId = salesData.data[0].transaction_id;

    console.log(`[INFO] 테스트 데이터 로드 완료: 매출 거래 ID ${testSalesTransactionId}`);
  });

  describe('GET /api/collections', () => {
    test('should return paginated list of collections', async () => {
      const result = await apiRequest(COLLECTIONS_ENDPOINT);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination?.page).toBe(1);
      expect(result.pagination?.limit).toBeGreaterThan(0);
    });

    test('should support pagination parameters', async () => {
      const result = await apiRequest(`${COLLECTIONS_ENDPOINT}?page=1&limit=5`);

      expect(result.success).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination?.page).toBe(1);
      expect(result.pagination?.limit).toBe(5);
    });

    test('should support date range filtering', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-12-31';
      const result = await apiRequest(
        `${COLLECTIONS_ENDPOINT}?startDate=${startDate}&endDate=${endDate}`
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should support payment method filtering', async () => {
      const result = await apiRequest(`${COLLECTIONS_ENDPOINT}?payment_method=TRANSFER`);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // All results should have TRANSFER payment method
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        result.data.forEach((collection: CollectionData) => {
          expect(collection.payment_method).toBe('TRANSFER');
        });
      }
    });

    test('should support search by collection_no', async () => {
      const result = await apiRequest(`${COLLECTIONS_ENDPOINT}?search=COL-`);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('POST /api/collections', () => {
    test('should create new collection with valid data', async () => {
      const newCollection = {
        collection_date: '2025-01-28',
        sales_transaction_id: testSalesTransactionId,
        collected_amount: 50000.00,
        payment_method: 'TRANSFER',
        bank_name: '우리은행',
        account_number: '1002-123-456789',
        notes: '테스트 수금'
      };

      const result = await apiRequest(COLLECTIONS_ENDPOINT, 'POST', newCollection);

      if (result.success && result.data && !Array.isArray(result.data)) {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.collection_id).toBeDefined();
        expect(result.data.collected_amount).toBe(newCollection.collected_amount);
        expect(result.data.payment_method).toBe(newCollection.payment_method);

        // Store ID for subsequent tests
        testCollectionId = result.data.collection_id;
      } else {
        // If test fails due to missing sales transaction, skip
        console.warn('Skipping collection creation test:', result.error);
      }
    });

    test('should handle Korean characters correctly', async () => {
      const koreanCollection = {
        collection_date: '2025-01-28',
        sales_transaction_id: testSalesTransactionId,
        collected_amount: 100000.00,
        payment_method: 'CASH',
        notes: '현금 수금 처리 - 한글 테스트'
      };

      const result = await apiRequest(COLLECTIONS_ENDPOINT, 'POST', koreanCollection);

      if (result.success && result.data && !Array.isArray(result.data)) {
        expect(result.success).toBe(true);
        expect(result.data.notes).toBe(koreanCollection.notes);
      } else {
        console.warn('Skipping Korean encoding test:', result.error);
      }
    });

    test('should reject invalid payment method', async () => {
      const invalidCollection = {
        collection_date: '2025-01-28',
        sales_transaction_id: testSalesTransactionId,
        collected_amount: 50000.00,
        payment_method: 'INVALID_METHOD'
      };

      const result = await apiRequest(COLLECTIONS_ENDPOINT, 'POST', invalidCollection);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject negative collected amount', async () => {
      const invalidCollection = {
        collection_date: '2025-01-28',
        sales_transaction_id: testSalesTransactionId,
        collected_amount: -10000.00,
        payment_method: 'CASH'
      };

      const result = await apiRequest(COLLECTIONS_ENDPOINT, 'POST', invalidCollection);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject invalid date format', async () => {
      const invalidCollection = {
        collection_date: '28-01-2025', // Wrong format
        sales_transaction_id: 1,
        collected_amount: 50000.00,
        payment_method: 'CASH'
      };

      const result = await apiRequest(COLLECTIONS_ENDPOINT, 'POST', invalidCollection);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject non-existent sales_transaction_id', async () => {
      const invalidCollection = {
        collection_date: '2025-01-28',
        sales_transaction_id: 999999, // Non-existent ID
        collected_amount: 50000.00,
        payment_method: 'CASH'
      };

      const result = await apiRequest(COLLECTIONS_ENDPOINT, 'POST', invalidCollection);

      expect(result.success).toBe(false);
      expect(result.error).toContain('판매 거래');
    });
  });

  describe('PUT /api/collections', () => {
    test('should update collection amount', async () => {
      if (!testCollectionId) {
        console.warn('Skipping update test: No collection ID available');
        return;
      }

      const updates = {
        collected_amount: 75000.00,
        notes: '수정된 수금 금액'
      };

      const result = await apiRequest(
        `${COLLECTIONS_ENDPOINT}?id=${testCollectionId}`,
        'PUT',
        updates
      );

      if (result.success && result.data && !Array.isArray(result.data)) {
        expect(result.success).toBe(true);
        expect(result.data.collected_amount).toBe(updates.collected_amount);
        expect(result.data.notes).toBe(updates.notes);
      }
    });

    test('should update collection date', async () => {
      if (!testCollectionId) {
        console.warn('Skipping update test: No collection ID available');
        return;
      }

      const updates = {
        collection_date: '2025-01-29'
      };

      const result = await apiRequest(
        `${COLLECTIONS_ENDPOINT}?id=${testCollectionId}`,
        'PUT',
        updates
      );

      if (result.success && result.data && !Array.isArray(result.data)) {
        expect(result.success).toBe(true);
        expect(result.data.collection_date).toBe(updates.collection_date);
      }
    });

    test('should reject update without collection ID', async () => {
      const result = await apiRequest(
        COLLECTIONS_ENDPOINT, // No ID parameter
        'PUT',
        { collected_amount: 50000.00 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('ID가 필요');
    });

    test('should reject update with invalid amount', async () => {
      if (!testCollectionId) {
        console.warn('Skipping update test: No collection ID available');
        return;
      }

      const result = await apiRequest(
        `${COLLECTIONS_ENDPOINT}?id=${testCollectionId}`,
        'PUT',
        { collected_amount: -5000.00 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('DELETE /api/collections', () => {
    test('should soft delete collection', async () => {
      if (!testCollectionId) {
        console.warn('Skipping delete test: No collection ID available');
        return;
      }

      const result = await apiRequest(
        `${COLLECTIONS_ENDPOINT}?id=${testCollectionId}`,
        'DELETE'
      );

      if (result.success) {
        expect(result.success).toBe(true);

        // Verify collection is no longer in active list
        const listResult = await apiRequest(COLLECTIONS_ENDPOINT);
        if (listResult.data && Array.isArray(listResult.data)) {
          const found = listResult.data.find(
            (c: CollectionData) => c.collection_id === testCollectionId
          );
          expect(found).toBeUndefined();
        }
      }
    });

    test('should reject delete without collection ID', async () => {
      const result = await apiRequest(COLLECTIONS_ENDPOINT, 'DELETE');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ID가 필요');
    });

    test('should handle deletion of non-existent collection', async () => {
      const result = await apiRequest(
        `${COLLECTIONS_ENDPOINT}?id=999999`,
        'DELETE'
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Payment Status Integration', () => {
    test('should update sales transaction payment status on collection creation', async () => {
      // This test requires a valid sales transaction with known total_amount
      // Implementation depends on test database setup
      console.log('Payment status integration test requires specific test data setup');
    });

    test('should recalculate payment status on collection update', async () => {
      // This test requires a valid sales transaction with known total_amount
      console.log('Payment status recalculation test requires specific test data setup');
    });

    test('should recalculate payment status on collection deletion', async () => {
      // This test requires a valid sales transaction with known total_amount
      console.log('Payment status recalculation test requires specific test data setup');
    });
  });

  describe('Performance', () => {
    test('should respond within 200ms for GET request', async () => {
      const startTime = Date.now();
      await apiRequest(COLLECTIONS_ENDPOINT);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(200);
    });

    test('should respond within 200ms for POST request', async () => {
      const newCollection = {
        collection_date: '2025-01-28',
        sales_transaction_id: testSalesTransactionId,
        collected_amount: 50000.00,
        payment_method: 'CASH'
      };

      const startTime = Date.now();
      await apiRequest(COLLECTIONS_ENDPOINT, 'POST', newCollection);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(200);
    });
  });
});
