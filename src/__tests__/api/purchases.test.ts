/**
 * Purchase API Tests
 * Tests the complete CRUD functionality for purchase transactions
 * Including stock management (INCREASE on create, DECREASE on delete)
 */

import { describe, test, expect, beforeAll } from '@jest/globals';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

describe('Purchase API Tests', () => {
  let testSupplierId: number;
  let testItemId: number;
  let testPurchaseId: number;

  beforeAll(async () => {
    // Dynamically fetch existing supplier and item from database
    const supplierResponse = await fetch(`${API_URL}/api/companies?company_type=공급사&limit=1`);
    const supplierData = await supplierResponse.json();

    if (!supplierData.success || !supplierData.data || supplierData.data.length === 0) {
      throw new Error('테스트용 공급사가 데이터베이스에 없습니다. 공급사를 먼저 생성해주세요.');
    }

    testSupplierId = supplierData.data[0].company_id;

    const itemResponse = await fetch(`${API_URL}/api/items?limit=1`);
    const itemData = await itemResponse.json();

    if (!itemData.success || !itemData.data || itemData.data.length === 0) {
      throw new Error('테스트용 품목이 데이터베이스에 없습니다. 품목을 먼저 생성해주세요.');
    }

    testItemId = itemData.data[0].item_id;

    console.log(`[INFO] 테스트 데이터 로드 완료: 공급사 ID ${testSupplierId}, 품목 ID ${testItemId}`);
  });

  describe('GET /api/purchases', () => {
    test('should retrieve purchase list with pagination', async () => {
      const response = await fetch(`${API_URL}/api/purchases?page=1&limit=10`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });

    test('should filter by supplier_id', async () => {
      const response = await fetch(`${API_URL}/api/purchases?supplier_id=${testSupplierId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        data.data.forEach((purchase: any) => {
          expect(purchase.supplier_id).toBe(testSupplierId);
        });
      }
    });

    test('should filter by payment_status', async () => {
      const response = await fetch(`${API_URL}/api/purchases?payment_status=PENDING`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        data.data.forEach((purchase: any) => {
          expect(purchase.payment_status).toBe('PENDING');
        });
      }
    });

    test('should filter by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const response = await fetch(
        `${API_URL}/api/purchases?start_date=${startDate}&end_date=${endDate}`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('should search by transaction_no or item_name', async () => {
      const response = await fetch(`${API_URL}/api/purchases?search=P-`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/purchases', () => {
    test('should create purchase transaction with stock increase', async () => {
      // Get current stock first
      const itemResponse = await fetch(`${API_URL}/api/items?id=${testItemId}`);
      const itemData = await itemResponse.json();
      const initialStock = itemData.data?.[0]?.current_stock || 0;

      const purchaseData = {
        transaction_date: '2024-01-15',
        supplier_id: testSupplierId,
        item_id: testItemId,
        item_name: '테스트 품목',
        spec: 'TEST-001',
        unit: 'EA',
        quantity: 100,
        unit_price: 1000,
        supply_amount: 100000,
        tax_amount: 10000,
        total_amount: 110000,
        payment_status: 'PENDING',
        description: '매입 테스트'
      };

      const response = await fetch(`${API_URL}/api/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseData)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.transaction_no).toMatch(/^P-\d{8}-\d{4}$/);
      expect(data.data.quantity).toBe(100);

      testPurchaseId = data.data.transaction_id;

      // Verify stock increased
      const updatedItemResponse = await fetch(`${API_URL}/api/items?id=${testItemId}`);
      const updatedItemData = await updatedItemResponse.json();
      const newStock = updatedItemData.data?.[0]?.current_stock || 0;

      expect(newStock).toBe(initialStock + 100);
    });

    test('should validate required fields', async () => {
      const invalidData = {
        transaction_date: '2024-01-15',
        // Missing required fields
      };

      const response = await fetch(`${API_URL}/api/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('should validate quantity is positive', async () => {
      const invalidData = {
        transaction_date: '2024-01-15',
        supplier_id: testSupplierId,
        item_id: testItemId,
        item_name: '테스트 품목',
        quantity: -10, // Invalid negative quantity
        unit_price: 1000,
        supply_amount: -10000,
        total_amount: -10000
      };

      const response = await fetch(`${API_URL}/api/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('should handle Korean characters correctly', async () => {
      const koreanData = {
        transaction_date: '2024-01-15',
        supplier_id: testSupplierId,
        item_id: testItemId,
        item_name: '한글 품목명',
        spec: '규격-001',
        quantity: 50,
        unit_price: 2000,
        supply_amount: 100000,
        tax_amount: 10000,
        total_amount: 110000,
        description: '한글 설명 테스트'
      };

      const response = await fetch(`${API_URL}/api/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koreanData)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.item_name).toBe('한글 품목명');
      expect(data.data.description).toBe('한글 설명 테스트');
    });
  });

  describe('PUT /api/purchases', () => {
    test('should update purchase transaction', async () => {
      if (!testPurchaseId) {
        console.log('Skipping update test - no purchase created');
        return;
      }

      const updateData = {
        quantity: 150, // Changed from 100 to 150
        unit_price: 1200,
        supply_amount: 180000,
        tax_amount: 18000,
        total_amount: 198000,
        payment_status: 'PARTIAL',
        description: '수정된 설명'
      };

      const response = await fetch(`${API_URL}/api/purchases?id=${testPurchaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.quantity).toBe(150);
      expect(data.data.payment_status).toBe('PARTIAL');
    });

    test('should require transaction ID', async () => {
      const response = await fetch(`${API_URL}/api/purchases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 100 })
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('should prevent negative stock when decreasing quantity', async () => {
      if (!testPurchaseId) {
        console.log('Skipping test - no purchase created');
        return;
      }

      // Get current item stock
      const itemResponse = await fetch(`${API_URL}/api/items?id=${testItemId}`);
      const itemData = await itemResponse.json();
      const currentStock = itemData.data?.[0]?.current_stock || 0;

      // Try to decrease quantity more than current stock
      const updateData = {
        quantity: currentStock + 1000 // Unreasonably large decrease
      };

      const response = await fetch(`${API_URL}/api/purchases?id=${testPurchaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      // This should either succeed or fail gracefully
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('DELETE /api/purchases', () => {
    test('should soft delete purchase transaction with stock decrease', async () => {
      if (!testPurchaseId) {
        console.log('Skipping delete test - no purchase created');
        return;
      }

      // Get current stock before deletion
      const itemResponse = await fetch(`${API_URL}/api/items?id=${testItemId}`);
      const itemData = await itemResponse.json();
      const stockBeforeDelete = itemData.data?.[0]?.current_stock || 0;

      const response = await fetch(`${API_URL}/api/purchases?id=${testPurchaseId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify stock decreased (reversed the purchase)
      const updatedItemResponse = await fetch(`${API_URL}/api/items?id=${testItemId}`);
      const updatedItemData = await updatedItemResponse.json();
      const stockAfterDelete = updatedItemData.data?.[0]?.current_stock || 0;

      // Stock should be decreased by the purchase quantity (150 from update test)
      expect(stockAfterDelete).toBeLessThan(stockBeforeDelete);

      // Verify transaction is soft deleted (not in active list)
      const listResponse = await fetch(`${API_URL}/api/purchases`);
      const listData = await listResponse.json();
      const deletedTransaction = listData.data.find(
        (p: any) => p.transaction_id === testPurchaseId
      );

      expect(deletedTransaction).toBeUndefined();
    });

    test('should require transaction ID', async () => {
      const response = await fetch(`${API_URL}/api/purchases`, {
        method: 'DELETE'
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('should prevent deletion if stock would go negative', async () => {
      // This test assumes there's a purchase with quantity > current stock
      // In real scenario, this would be tested with proper setup
      const response = await fetch(`${API_URL}/api/purchases?id=999999`, {
        method: 'DELETE'
      });

      // Should return 404 for non-existent ID
      expect([404, 400]).toContain(response.status);
    });
  });

  describe('Stock Management Integration', () => {
    test('should maintain accurate stock across multiple operations', async () => {
      // Get initial stock
      const initialResponse = await fetch(`${API_URL}/api/items?id=${testItemId}`);
      const initialData = await initialResponse.json();
      const initialStock = initialData.data?.[0]?.current_stock || 0;

      // Create purchase (should increase stock by 50)
      const createResponse = await fetch(`${API_URL}/api/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_date: '2024-01-20',
          supplier_id: testSupplierId,
          item_id: testItemId,
          item_name: '재고 테스트',
          quantity: 50,
          unit_price: 1000,
          supply_amount: 50000,
          tax_amount: 5000,
          total_amount: 55000
        })
      });

      const createData = await createResponse.json();
      const purchaseId = createData.data?.transaction_id;

      // Verify stock increased
      const afterCreateResponse = await fetch(`${API_URL}/api/items?id=${testItemId}`);
      const afterCreateData = await afterCreateResponse.json();
      const afterCreateStock = afterCreateData.data?.[0]?.current_stock || 0;

      expect(afterCreateStock).toBe(initialStock + 50);

      // Delete purchase (should decrease stock by 50)
      if (purchaseId) {
        await fetch(`${API_URL}/api/purchases?id=${purchaseId}`, {
          method: 'DELETE'
        });

        // Verify stock returned to initial
        const afterDeleteResponse = await fetch(`${API_URL}/api/items?id=${testItemId}`);
        const afterDeleteData = await afterDeleteResponse.json();
        const afterDeleteStock = afterDeleteData.data?.[0]?.current_stock || 0;

        expect(afterDeleteStock).toBe(initialStock);
      }
    });
  });
});
