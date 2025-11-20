/**
 * Phase 3-A: API Unit Tests for Batch Production Registration
 *
 * Test Coverage:
 * 1. Successful batch submission with multiple items
 * 2. Validation errors (missing fields, empty items array)
 * 3. Item validation errors (invalid items, inactive items)
 * 4. BOM stock shortage scenarios
 * 5. Transaction rollback scenarios
 * 6. Edge cases (large batches, special characters in Korean)
 * 7. Error handling (Supabase errors, JSON parse errors)
 *
 * Target Coverage: 95%+
 */

import { POST } from '@/app/api/inventory/production/batch/route';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

// Mock logger and metrics
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('@/lib/metrics', () => ({
  metricsCollector: {
    trackRequest: jest.fn()
  }
}));

describe('POST /api/inventory/production/batch', () => {
  let mockFrom: jest.Mock;
  let mockSelect: jest.Mock;
  let mockInsert: jest.Mock;
  let mockInsertSelect: jest.Mock;
  let mockIn: jest.Mock;
  let mockEq: jest.Mock;
  let mockEqChainableResult: any; // Expose for test configuration

  beforeEach(() => {
    // Create chainable mocks
    // The chain is: from() → select() → in() → Promise<{data, error}>
    //           or: from() → insert() → select() → Promise<{data, error}>
    //           or: from() → select() → eq() → eq() → Promise<{data, error}> (BOM queries)

    mockIn = jest.fn();

    // mockEq needs to support:
    // - Single .eq(): await .eq('field', value) → Promise<{data, error}>
    // - Chained .eq(): await .eq('field1', value1).eq('field2', value2) → Promise<{data, error}>
    //
    // Solution: mockEqChainableResult is a THENABLE object that:
    // 1. Has a .then() method (making it awaitable via Promise protocol)
    // 2. Has an .eq property for chaining
    // 3. Has a .mockResolvedValueOnce() method for configuration
    // 4. Uses a queue to store configured responses

    const mockResponseQueue: any[] = [];

    mockEqChainableResult = {
      then(onFulfilled: any) {
        const response = mockResponseQueue.shift() || { data: null, error: null };
        return Promise.resolve(response).then(onFulfilled);
      },
      eq: null as any, // Will be set below
      mockResolvedValueOnce(value: any) {
        mockResponseQueue.push(value);
        return this;
      }
    };

    // mockEqChain is called for the SECOND .eq() in a chain
    // It returns the same mockEqChainableResult to maintain chaining
    const mockEqChain = jest.fn().mockReturnValue(mockEqChainableResult);

    // Set .eq property on mockEqChainableResult for chaining
    mockEqChainableResult.eq = mockEqChain;

    // mockEq returns mockEqChainableResult for the FIRST .eq() call
    mockEq = jest.fn().mockReturnValue(mockEqChainableResult);

    mockSelect = jest.fn().mockReturnValue({
      in: mockIn,
      eq: mockEq
    });

    // Create stable mockInsertSelect that will be reused across insert calls
    mockInsertSelect = jest.fn();
    mockInsert = jest.fn().mockReturnValue({
      select: mockInsertSelect
    });

    mockFrom = jest.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert
    });

    (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
  });

  /**
   * Test Case 1: Successful Batch Submission
   * Expected: 200 OK with transaction details and summary
   */
  describe('Successful batch submission', () => {
    it('should successfully register multiple production items', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 },
          { item_id: 2, quantity: 20, unit_price: 3000 }
        ],
        reference_no: 'BATCH-2025-001',
        notes: '테스트 일괄 등록',
        use_bom: true,
        created_by: 1
      };

      // Mock successful items query: supabase.from('items').select(...).in(...)
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 100, is_active: true },
          { item_id: 2, item_code: 'ITEM-002', item_name: '부품B', current_stock: 200, is_active: true }
        ],
        error: null
      });

      // Mock BOM queries (no BOM for simplicity): supabase.from('bom').select(...).eq(...).eq(...)
      mockEqChainableResult.mockResolvedValueOnce({ data: [], error: null });
      mockEqChainableResult.mockResolvedValueOnce({ data: [], error: null });

      // Mock successful transaction insert: supabase.from('inventory_transactions').insert(...).select(...)
      const mockInsertSelect1 = mockInsert().select as jest.Mock;
      mockInsertSelect1.mockResolvedValueOnce({
        data: [
          { transaction_id: 101, item_id: 1, quantity: 10 },
          { transaction_id: 102, item_id: 2, quantity: 20 }
        ],
        error: null
      });

      // Mock updated items query: supabase.from('items').select(...).in(...)
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 110 },
          { item_id: 2, item_code: 'ITEM-002', item_name: '부품B', current_stock: 220 }
        ],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.transactions).toHaveLength(2);
      expect(responseData.data.summary).toMatchObject({
        total_count: 2,
        total_quantity: 30,
        total_value: 110000
      });
      expect(responseData.message).toContain('생산 일괄 등록이 완료되었습니다');
    });

    it('should handle Korean characters correctly in notes and reference', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 5, unit_price: 10000 }
        ],
        reference_no: '참조번호-한글-001',
        notes: '특수문자 테스트: !@#$%^&*() 한글 테스트',
        use_bom: false,
        created_by: 1
      };

      // Query 1: Get items - .in()
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 50, is_active: true }
        ],
        error: null
      });

      // Query 2: Insert transactions - .insert().select()
      const mockInsertSelect1 = mockInsert().select as jest.Mock;
      mockInsertSelect1.mockResolvedValueOnce({
        data: [{ transaction_id: 101, item_id: 1, quantity: 5 }],
        error: null
      });

      // Query 3: Get updated items - .in()
      mockIn.mockResolvedValueOnce({
        data: [{ item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 55 }],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });
  });

  /**
   * Test Case 2: Validation Errors
   * Expected: 400 Bad Request with specific error messages
   */
  describe('Validation errors', () => {
    it('should return 400 if transaction_date is missing', async () => {
      const requestBody = {
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 }
        ]
      };

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('필수 필드가 누락되었습니다');
    });

    it('should return 400 if items array is empty', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: []
      };

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('필수 필드가 누락되었습니다');
    });

    it('should return 400 if items is not an array', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: { item_id: 1, quantity: 10 } // Not an array
      };

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
    });

    it('should return 400 for malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: '{invalid json'
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('잘못된 JSON 형식입니다');
    });
  });

  /**
   * Test Case 3: Item Validation Errors
   * Expected: 400 Bad Request with detailed validation errors
   */
  describe('Item validation errors', () => {
    it('should return 400 if item_id is missing', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { quantity: 10, unit_price: 5000 } // Missing item_id
        ]
      };

      mockIn.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.details).toContain('품목 1: 필수 필드가 누락되었습니다. (품목, 수량 필수)');
    });

    it('should return 400 if quantity is zero or negative', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 0, unit_price: 5000 },
          { item_id: 2, quantity: -5, unit_price: 3000 }
        ]
      };

      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 100, is_active: true },
          { item_id: 2, item_code: 'ITEM-002', item_name: '부품B', current_stock: 200, is_active: true }
        ],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.details.length).toBeGreaterThan(0);
    });

    it('should return 400 if item does not exist', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 9999, quantity: 10, unit_price: 5000 }
        ]
      };

      mockIn.mockResolvedValueOnce({
        data: [], // Item not found
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.details).toContain('품목 1: 존재하지 않는 품목입니다.');
    });

    it('should return 400 if item is inactive', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 }
        ]
      };

      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 100, is_active: false }
        ],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.details).toContain('품목 1: 비활성화된 품목입니다.');
    });
  });

  /**
   * Test Case 4: BOM Stock Shortage Scenarios
   * Expected: 400 Bad Request with shortage details
   */
  describe('BOM stock shortage scenarios', () => {
    it('should return 400 if BOM materials have insufficient stock', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 }
        ],
        use_bom: true
      };

      // Query 1: Get product items - .in()
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'PROD-001', item_name: '완성품A', current_stock: 50, is_active: true }
        ],
        error: null
      });

      // Query 2: Get BOM data - .eq() (twice: parent_item_id and is_active)
      mockEqChainableResult.mockResolvedValueOnce({
        data: [
          {
            child_item_id: 10,
            quantity_required: 5,
            child_item: {
              item_id: 10,
              item_code: 'MAT-001',
              item_name: '원자재A',
              current_stock: 30, // Need 50 (5 * 10), but only have 30
              unit: 'kg'
            }
          }
        ],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.details[0]).toContain('원자재 재고 부족');
      expect(responseData.details[0]).toContain('원자재A');
    });

    it('should succeed if use_bom is false even with insufficient stock', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 }
        ],
        use_bom: false // BOM check disabled
      };

      // Query 1: Get items - .in()
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'PROD-001', item_name: '완성품A', current_stock: 50, is_active: true }
        ],
        error: null
      });

      // Query 2: Insert transactions - .insert().select()
      const mockInsertSelect6 = mockInsert().select as jest.Mock;
      mockInsertSelect6.mockResolvedValueOnce({
        data: [{ transaction_id: 101, item_id: 1, quantity: 10 }],
        error: null
      });

      // Query 3: Get updated items - .in()
      mockIn.mockResolvedValueOnce({
        data: [{ item_id: 1, item_code: 'PROD-001', item_name: '완성품A', current_stock: 60 }],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });

    it('should handle multiple items with mixed BOM scenarios', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 }, // Has BOM, sufficient stock
          { item_id: 2, quantity: 5, unit_price: 3000 }   // Has BOM, insufficient stock
        ],
        use_bom: true
      };

      // Query 1: Get product items - .in()
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'PROD-001', item_name: '완성품A', current_stock: 50, is_active: true },
          { item_id: 2, item_code: 'PROD-002', item_name: '완성품B', current_stock: 30, is_active: true }
        ],
        error: null
      });

      // Query 2: BOM for item 1 - .eq() (sufficient stock)
      mockEqChainableResult.mockResolvedValueOnce({
        data: [
          {
            child_item_id: 10,
            quantity_required: 2,
            child_item: {
              item_id: 10,
              item_code: 'MAT-001',
              item_name: '원자재A',
              current_stock: 100,
              unit: 'kg'
            }
          }
        ],
        error: null
      });

      // Query 3: BOM for item 2 - .eq() (insufficient stock)
      mockEqChainableResult.mockResolvedValueOnce({
        data: [
          {
            child_item_id: 11,
            quantity_required: 10,
            child_item: {
              item_id: 11,
              item_code: 'MAT-002',
              item_name: '원자재B',
              current_stock: 20, // Need 50, have 20
              unit: 'kg'
            }
          }
        ],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.details.length).toBeGreaterThan(0);
      expect(responseData.details.some((msg: string) => msg.includes('원자재B'))).toBe(true);
    });
  });

  /**
   * Test Case 5: Database Error Scenarios
   * Expected: 500 Internal Server Error
   */
  describe('Database error scenarios', () => {
    it('should return 500 if items query fails', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 }
        ]
      };

      // Query 1: Items query fails - .in()
      mockIn.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection error' }
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('품목 조회 중 오류가 발생했습니다');
    });

    it('should return 500 if transaction insert fails', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 }
        ],
        use_bom: false
      };

      // Query 1: Get items - .in()
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 100, is_active: true }
        ],
        error: null
      });

      // Query 2: Insert fails - .insert().select()
      const mockInsertSelect7 = mockInsert().select as jest.Mock;
      mockInsertSelect7.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' }
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('생산 일괄 등록 중 오류가 발생했습니다');
    });
  });

  /**
   * Test Case 6: Edge Cases
   * Expected: Proper handling of edge scenarios
   */
  describe('Edge cases', () => {
    it('should handle large batch with 50 items', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        item_id: i + 1,
        quantity: 10,
        unit_price: 5000
      }));

      const requestBody = {
        transaction_date: '2025-02-01',
        items,
        use_bom: false
      };

      const mockItems = items.map((item, i) => ({
        item_id: item.item_id,
        item_code: `ITEM-${String(i + 1).padStart(3, '0')}`,
        item_name: `부품${i + 1}`,
        current_stock: 100,
        is_active: true
      }));

      // Query 1: Get all 50 items - .in()
      mockIn.mockResolvedValueOnce({
        data: mockItems,
        error: null
      });

      // Query 2: Insert 50 transactions - .insert().select()
      const mockInsertSelect8 = mockInsert().select as jest.Mock;
      mockInsertSelect8.mockResolvedValueOnce({
        data: items.map((item, i) => ({
          transaction_id: 100 + i,
          item_id: item.item_id,
          quantity: item.quantity
        })),
        error: null
      });

      // Query 3: Get updated items - .in()
      mockIn.mockResolvedValueOnce({
        data: mockItems.map(item => ({
          ...item,
          current_stock: item.current_stock + 10
        })),
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.transactions).toHaveLength(50);
      expect(responseData.data.summary.total_count).toBe(50);
    });

    it('should handle item with zero unit_price', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 0 }
        ],
        use_bom: false
      };

      // Query 1: Get items - .in()
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 100, is_active: true }
        ],
        error: null
      });

      // Query 2: Insert transactions - .insert().select()
      const mockInsertSelect9 = mockInsert().select as jest.Mock;
      mockInsertSelect9.mockResolvedValueOnce({
        data: [{ transaction_id: 101, item_id: 1, quantity: 10 }],
        error: null
      });

      // Query 3: Get updated items - .in()
      mockIn.mockResolvedValueOnce({
        data: [{ item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 110 }],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.summary.total_value).toBe(0);
    });

    it('should handle duplicate item_ids in batch', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 },
          { item_id: 1, quantity: 5, unit_price: 5000 } // Same item twice
        ],
        use_bom: false
      };

      // Query 1: Get items - .in()
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 100, is_active: true }
        ],
        error: null
      });

      // Query 2: Insert transactions - .insert().select()
      const mockInsertSelect10 = mockInsert().select as jest.Mock;
      mockInsertSelect10.mockResolvedValueOnce({
        data: [
          { transaction_id: 101, item_id: 1, quantity: 10 },
          { transaction_id: 102, item_id: 1, quantity: 5 }
        ],
        error: null
      });

      // Query 3: Get updated items - .in()
      mockIn.mockResolvedValueOnce({
        data: [{ item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 115 }],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.transactions).toHaveLength(2);
      expect(responseData.data.summary.total_quantity).toBe(15);
    });
  });

  /**
   * Test Case 7: Response Structure Validation
   * Expected: Consistent response format
   */
  describe('Response structure validation', () => {
    it('should return correct response structure on success', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [
          { item_id: 1, quantity: 10, unit_price: 5000 }
        ],
        use_bom: false
      };

      // Query 1: Get items - .in()
      mockIn.mockResolvedValueOnce({
        data: [
          { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 100, is_active: true }
        ],
        error: null
      });

      // Query 2: Insert transactions - .insert().select()
      const mockInsertSelect11 = mockInsert().select as jest.Mock;
      mockInsertSelect11.mockResolvedValueOnce({
        data: [{ transaction_id: 101, item_id: 1, quantity: 10 }],
        error: null
      });

      // Query 3: Get updated items - .in()
      mockIn.mockResolvedValueOnce({
        data: [{ item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 110 }],
        error: null
      });

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(responseData).toHaveProperty('success');
      expect(responseData).toHaveProperty('data');
      expect(responseData.data).toHaveProperty('transactions');
      expect(responseData.data).toHaveProperty('items');
      expect(responseData.data).toHaveProperty('bom_validations');
      expect(responseData.data).toHaveProperty('summary');
      expect(responseData.data.summary).toHaveProperty('total_count');
      expect(responseData.data.summary).toHaveProperty('total_quantity');
      expect(responseData.data.summary).toHaveProperty('total_value');
      expect(responseData).toHaveProperty('message');
    });

    it('should return correct error structure on validation failure', async () => {
      const requestBody = {
        transaction_date: '2025-02-01',
        items: [] // Empty array
      };

      const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(responseData).toHaveProperty('success', false);
      expect(responseData).toHaveProperty('error');
      expect(typeof responseData.error).toBe('string');
    });
  });
});
