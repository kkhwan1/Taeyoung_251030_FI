/**
 * Simplified Batch Production API Unit Tests
 *
 * This file demonstrates the correct Supabase mocking pattern for the batch production endpoint.
 * Once verified working, the pattern should be applied to the full batch.test.ts file.
 *
 * Mocking Strategy:
 * - Each Supabase query chain ends with a method that returns Promise<{data, error}>
 * - We mock each method in the chain to return the next method
 * - The final method (.in(), .eq(), .select() after .insert()) returns the Promise
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/inventory/production/batch/route';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock metrics
jest.mock('@/lib/metrics', () => ({
  metricsCollector: {
    trackRequest: jest.fn()
  }
}));

describe('POST /api/inventory/production/batch - Simplified Tests', () => {
  let mockFrom: jest.Mock;
  let mockSelect: jest.Mock;
  let mockInsert: jest.Mock;
  let mockIn: jest.Mock;
  let mockEq: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create chainable mocks
    // The chain is: from() → select() → in() → Promise<{data, error}>
    //           or: from() → insert() → select() → Promise<{data, error}>
    //           or: from() → select() → eq() → Promise<{data, error}>

    mockIn = jest.fn();
    mockEq = jest.fn();
    mockSelect = jest.fn().mockReturnValue({
      in: mockIn,
      eq: mockEq
    });
    mockInsert = jest.fn().mockReturnValue({
      select: jest.fn()  // .insert().select() has its own select
    });
    mockFrom = jest.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert
    });

    (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
  });

  /**
   * TEST 1: Successful batch submission
   */
  it('should successfully register 2 production items', async () => {
    const requestBody = {
      transaction_date: '2025-02-01',
      items: [
        { item_id: 1, quantity: 10, unit_price: 5000 },
        { item_id: 2, quantity: 20, unit_price: 3000 }
      ],
      reference_no: 'BATCH-TEST-001',
      notes: '테스트 일괄 등록',
      use_bom: false,  // Disable BOM for simplicity
      created_by: 1
    };

    // Query 1: Get items - from('items').select(...).in('item_id', [...])
    mockIn.mockResolvedValueOnce({
      data: [
        { item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 100, is_active: true },
        { item_id: 2, item_code: 'ITEM-002', item_name: '부품B', current_stock: 200, is_active: true }
      ],
      error: null
    });

    // Query 2: Insert transactions - from('inventory_transactions').insert(...).select(...)
    const mockInsertSelect = mockInsert().select as jest.Mock;
    mockInsertSelect.mockResolvedValueOnce({
      data: [
        { transaction_id: 101, item_id: 1, quantity: 10 },
        { transaction_id: 102, item_id: 2, quantity: 20 }
      ],
      error: null
    });

    // Query 3: Get updated items - from('items').select(...).in('item_id', [...])
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
    expect(responseData.data.summary.total_count).toBe(2);
    expect(responseData.data.summary.total_quantity).toBe(30);
  });

  /**
   * TEST 2: Validation error - missing transaction_date
   */
  it('should return 400 if transaction_date is missing', async () => {
    const requestBody = {
      // transaction_date missing
      items: [{ item_id: 1, quantity: 10 }]
    };

    const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toContain('필수 필드가 누락');
  });

  /**
   * TEST 3: Item validation - non-existent item
   */
  it('should return 400 if item does not exist', async () => {
    const requestBody = {
      transaction_date: '2025-02-01',
      items: [{ item_id: 999, quantity: 10 }],
      use_bom: false
    };

    // Mock empty items query result
    mockIn.mockResolvedValueOnce({
      data: [],  // No items found
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
    expect(responseData.details).toEqual(expect.arrayContaining([
      expect.stringContaining('존재하지 않는 품목')
    ]));
  });

  /**
   * TEST 4: Database error - items query fails
   */
  it('should return 500 if items query fails', async () => {
    const requestBody = {
      transaction_date: '2025-02-01',
      items: [{ item_id: 1, quantity: 10 }],
      use_bom: false
    };

    // Mock database error
    mockIn.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database connection failed', code: '500' }
    });

    const request = new NextRequest('http://localhost:3000/api/inventory/production/batch', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toContain('품목 조회 중 오류');
  });

  /**
   * TEST 5: Korean character encoding
   */
  it('should handle Korean characters correctly', async () => {
    const requestBody = {
      transaction_date: '2025-02-01',
      items: [{ item_id: 1, quantity: 10, unit_price: 5000 }],
      reference_no: '배치-2025-001',
      notes: '한글 노트 테스트: 생산입고 일괄등록',
      use_bom: false
    };

    mockIn.mockResolvedValueOnce({
      data: [{ item_id: 1, item_code: 'ITEM-001', item_name: '부품A', current_stock: 100, is_active: true }],
      error: null
    });

    const mockInsertSelect = mockInsert().select as jest.Mock;
    mockInsertSelect.mockResolvedValueOnce({
      data: [{ transaction_id: 101, item_id: 1, quantity: 10 }],
      error: null
    });

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
    expect(responseData.message).toContain('일괄 등록이 완료');
  });
});
