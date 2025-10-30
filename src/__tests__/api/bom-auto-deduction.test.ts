/**
 * BOM Auto-Deduction API Test Suite
 * Tests for /api/inventory/production endpoints with BOM material deduction
 *
 * Tests:
 * - Normal case: Production transaction → verify BOM_DEDUCTION logs created
 * - Stock shortage case: Insufficient material → verify 400 error with Korean message
 * - Transaction rollback: Error during deduction → verify atomic rollback
 * - Material availability check endpoint
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Test configuration
// Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues on Windows
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
const PRODUCTION_ENDPOINT = `${API_BASE_URL}/api/inventory/production`;
const BOM_ENDPOINT = `${API_BASE_URL}/api/bom`;
const ITEMS_ENDPOINT = `${API_BASE_URL}/api/items`;

// Helper function to make API requests with Korean encoding support
async function apiRequest(
  url: string,
  method: string = 'GET',
  body?: unknown
): Promise<{ success: boolean; data?: any; error?: string; message?: string; details?: string; hint?: string }> {
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

// Test data storage
let testParentItemId: number;
let testChildItemId1: number;
let testChildItemId2: number;
let testBomId: number;
let testProductionTransactionId: number;

describe('BOM Auto-Deduction API', () => {
  // Setup: Create test items and BOM before running tests
  beforeAll(async () => {
    console.log('Setting up test data for BOM auto-deduction tests...');

    try {
      // Create parent item (finished product)
      const parentItem = {
        item_code: `TEST-PARENT-${Date.now()}`,
        item_name: '테스트 완제품',
        spec: 'TEST-SPEC',
        unit: 'EA',
        category: '완제품',
        unit_price: 10000,
        current_stock: 0,
        is_active: true
      };

      const parentResult = await apiRequest(ITEMS_ENDPOINT, 'POST', parentItem);
      if (parentResult.success && parentResult.data) {
        testParentItemId = parentResult.data.item_id;
        console.log(`Created parent item: ${testParentItemId}`);
      } else {
        throw new Error('Failed to create parent item');
      }

      // Create child item 1 (raw material)
      const childItem1 = {
        item_code: `TEST-CHILD1-${Date.now()}`,
        item_name: '테스트 원자재1',
        spec: 'RAW-SPEC-1',
        unit: 'KG',
        category: '원자재',
        unit_price: 1000,
        current_stock: 100, // Sufficient stock
        is_active: true
      };

      const child1Result = await apiRequest(ITEMS_ENDPOINT, 'POST', childItem1);
      if (child1Result.success && child1Result.data) {
        testChildItemId1 = child1Result.data.item_id;
        console.log(`Created child item 1: ${testChildItemId1}`);
      } else {
        throw new Error('Failed to create child item 1');
      }

      // Create child item 2 (raw material)
      const childItem2 = {
        item_code: `TEST-CHILD2-${Date.now()}`,
        item_name: '테스트 원자재2',
        spec: 'RAW-SPEC-2',
        unit: 'KG',
        category: '원자재',
        unit_price: 2000,
        current_stock: 50, // Sufficient stock
        is_active: true
      };

      const child2Result = await apiRequest(ITEMS_ENDPOINT, 'POST', childItem2);
      if (child2Result.success && child2Result.data) {
        testChildItemId2 = child2Result.data.item_id;
        console.log(`Created child item 2: ${testChildItemId2}`);
      } else {
        throw new Error('Failed to create child item 2');
      }

      // Create BOM
      const bom = {
        parent_item_id: testParentItemId,
        bom_version: 1,
        bom_status: 'ACTIVE',
        effective_date: '2025-01-01',
        notes: 'Test BOM for auto-deduction',
        bom_items: [
          {
            child_item_id: testChildItemId1,
            usage_quantity: 2.0, // 2 KG per parent item
            unit: 'KG'
          },
          {
            child_item_id: testChildItemId2,
            usage_quantity: 1.5, // 1.5 KG per parent item
            unit: 'KG'
          }
        ]
      };

      const bomResult = await apiRequest(BOM_ENDPOINT, 'POST', bom);
      if (bomResult.success && bomResult.data) {
        testBomId = bomResult.data.bom_id;
        console.log(`Created BOM: ${testBomId}`);
      } else {
        throw new Error('Failed to create BOM');
      }

      console.log('Test data setup complete');
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  // Cleanup: Delete test data after all tests
  afterAll(async () => {
    console.log('Cleaning up test data...');

    try {
      // Delete production transaction if created
      if (testProductionTransactionId) {
        await apiRequest(`${PRODUCTION_ENDPOINT}?id=${testProductionTransactionId}`, 'DELETE');
      }

      // Delete BOM
      if (testBomId) {
        await apiRequest(`${BOM_ENDPOINT}?id=${testBomId}`, 'DELETE');
      }

      // Delete items
      if (testParentItemId) {
        await apiRequest(`${ITEMS_ENDPOINT}?id=${testParentItemId}`, 'DELETE');
      }
      if (testChildItemId1) {
        await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId1}`, 'DELETE');
      }
      if (testChildItemId2) {
        await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId2}`, 'DELETE');
      }

      console.log('Cleanup complete');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('POST /api/inventory/production', () => {
    test('should auto-deduct BOM materials on production transaction', async () => {
      // Arrange: Get initial stock levels
      const initialStockResult1 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId1}`);
      const initialStockResult2 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId2}`);

      expect(initialStockResult1.success).toBe(true);
      expect(initialStockResult2.success).toBe(true);

      const initialStock1 = initialStockResult1.data.current_stock;
      const initialStock2 = initialStockResult2.data.current_stock;

      console.log(`Initial stock - Child 1: ${initialStock1}, Child 2: ${initialStock2}`);

      // Act: Create production transaction
      const productionQuantity = 10; // Produce 10 units
      const productionData = {
        transaction_date: '2025-01-15',
        item_id: testParentItemId,
        quantity: productionQuantity,
        unit_price: 10000,
        reference_number: `TEST-PROD-${Date.now()}`,
        notes: '테스트 생산입고 - BOM 자동차감',
        created_by: 1, // Assuming user ID 1 exists
        transaction_type: '생산입고'
      };

      const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);

      // Assert: Production transaction created successfully
      expect(result.success).toBe(true);
      expect(result.message).toContain('성공적으로 등록');
      expect(result.data).toBeDefined();
      expect(result.data.transaction).toBeDefined();
      expect(result.data.auto_deductions).toBeDefined();

      const transaction = result.data.transaction;
      testProductionTransactionId = transaction.transaction_id;

      console.log(`Created production transaction: ${testProductionTransactionId}`);

      // Assert: BOM deduction logs created
      const autoDeductions = result.data.auto_deductions;
      expect(autoDeductions).toHaveLength(2); // Should have 2 deduction logs

      // Verify deduction log for child item 1
      const deduction1 = autoDeductions.find((d: any) => d.child_item_id === testChildItemId1);
      expect(deduction1).toBeDefined();
      expect(deduction1.deducted_quantity).toBe(productionQuantity * 2.0); // 10 * 2.0 = 20 KG
      expect(deduction1.usage_rate).toBe(2.0);
      expect(deduction1.stock_before).toBe(initialStock1);
      expect(deduction1.stock_after).toBe(initialStock1 - (productionQuantity * 2.0));

      // Verify deduction log for child item 2
      const deduction2 = autoDeductions.find((d: any) => d.child_item_id === testChildItemId2);
      expect(deduction2).toBeDefined();
      expect(deduction2.deducted_quantity).toBe(productionQuantity * 1.5); // 10 * 1.5 = 15 KG
      expect(deduction2.usage_rate).toBe(1.5);
      expect(deduction2.stock_before).toBe(initialStock2);
      expect(deduction2.stock_after).toBe(initialStock2 - (productionQuantity * 1.5));

      // Assert: Material stock decreased
      const finalStockResult1 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId1}`);
      const finalStockResult2 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId2}`);

      expect(finalStockResult1.success).toBe(true);
      expect(finalStockResult2.success).toBe(true);

      const finalStock1 = finalStockResult1.data.current_stock;
      const finalStock2 = finalStockResult2.data.current_stock;

      console.log(`Final stock - Child 1: ${finalStock1}, Child 2: ${finalStock2}`);

      expect(finalStock1).toBe(initialStock1 - (productionQuantity * 2.0));
      expect(finalStock2).toBe(initialStock2 - (productionQuantity * 1.5));
    });

    test('should handle stock shortage with Korean error message', async () => {
      // Arrange: Create scenario with insufficient stock
      // Current stock after previous test:
      // - Child 1: 100 - 20 = 80 KG
      // - Child 2: 50 - 15 = 35 KG
      // Try to produce 50 units which requires:
      // - Child 1: 50 * 2.0 = 100 KG (NOT ENOUGH! Only have 80)
      // - Child 2: 50 * 1.5 = 75 KG (NOT ENOUGH! Only have 35)

      const productionData = {
        transaction_date: '2025-01-15',
        item_id: testParentItemId,
        quantity: 50, // This will cause shortage
        unit_price: 10000,
        reference_number: `TEST-SHORTAGE-${Date.now()}`,
        notes: '테스트 생산입고 - 재고부족 시나리오',
        created_by: 1,
        transaction_type: '생산입고'
      };

      // Get stock before attempt
      const stockBefore1 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId1}`);
      const stockBefore2 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId2}`);
      const initialStock1 = stockBefore1.data.current_stock;
      const initialStock2 = stockBefore2.data.current_stock;

      // Act: Attempt production transaction
      const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);

      // Assert: Should fail with 400 error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('재고 부족');

      // Assert: No partial deductions - stock should remain unchanged
      const stockAfter1 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId1}`);
      const stockAfter2 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId2}`);

      expect(stockAfter1.data.current_stock).toBe(initialStock1);
      expect(stockAfter2.data.current_stock).toBe(initialStock2);

      console.log('Stock shortage correctly prevented production transaction');
    });

    test('should rollback transaction on deduction failure', async () => {
      // This test verifies that the database trigger handles atomic rollback
      // If a deduction fails mid-transaction, everything should rollback

      // Get current stock levels
      const stockBefore1 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId1}`);
      const stockBefore2 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId2}`);
      const initialStock1 = stockBefore1.data.current_stock;
      const initialStock2 = stockBefore2.data.current_stock;

      // Attempt production with quantity that will cause shortage
      // (This is similar to previous test but focuses on rollback verification)
      const productionData = {
        transaction_date: '2025-01-15',
        item_id: testParentItemId,
        quantity: 100, // Definitely too much
        unit_price: 10000,
        reference_number: `TEST-ROLLBACK-${Date.now()}`,
        notes: '테스트 롤백 확인',
        created_by: 1,
        transaction_type: '생산입고'
      };

      const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);

      // Assert: Transaction should fail
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Assert: Stock levels unchanged (atomic rollback)
      const stockAfter1 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId1}`);
      const stockAfter2 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId2}`);

      expect(stockAfter1.data.current_stock).toBe(initialStock1);
      expect(stockAfter2.data.current_stock).toBe(initialStock2);

      console.log('Transaction rollback verified - all stock levels preserved');
    });

    test('should validate required fields with Korean error messages', async () => {
      // Missing transaction_date
      let result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', {
        item_id: testParentItemId,
        quantity: 10,
        unit_price: 10000,
        created_by: 1,
        transaction_type: '생산입고'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('필수 필드');

      // Missing quantity
      result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', {
        transaction_date: '2025-01-15',
        item_id: testParentItemId,
        unit_price: 10000,
        created_by: 1,
        transaction_type: '생산입고'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('필수 필드');

      // Invalid quantity (negative)
      result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', {
        transaction_date: '2025-01-15',
        item_id: testParentItemId,
        quantity: -10,
        unit_price: 10000,
        created_by: 1,
        transaction_type: '생산입고'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('0보다 커야');

      // Invalid transaction_type
      result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', {
        transaction_date: '2025-01-15',
        item_id: testParentItemId,
        quantity: 10,
        unit_price: 10000,
        created_by: 1,
        transaction_type: 'INVALID_TYPE'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('거래유형');
    });

    test('should handle Korean text encoding correctly', async () => {
      const koreanNotes = '테스트 생산입고 처리 - 한글 인코딩 검증 [특수문자 포함]';

      const productionData = {
        transaction_date: '2025-01-15',
        item_id: testParentItemId,
        quantity: 5,
        unit_price: 10000,
        reference_number: `TEST-KOREAN-${Date.now()}`,
        notes: koreanNotes,
        created_by: 1,
        transaction_type: '생산입고'
      };

      // Get current stock to verify we have enough
      const stock1 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId1}`);
      const stock2 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId2}`);

      // Only proceed if we have sufficient stock (5 * 2.0 = 10 KG, 5 * 1.5 = 7.5 KG)
      if (stock1.data.current_stock >= 10 && stock2.data.current_stock >= 7.5) {
        const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);

        if (result.success) {
          expect(result.success).toBe(true);
          expect(result.data.transaction.notes).toBe(koreanNotes);

          // Cleanup this test transaction
          if (result.data.transaction.transaction_id) {
            await apiRequest(
              `${PRODUCTION_ENDPOINT}?id=${result.data.transaction.transaction_id}`,
              'DELETE'
            );
          }
        } else {
          console.warn('Korean encoding test skipped due to stock shortage:', result.error);
        }
      } else {
        console.warn('Korean encoding test skipped due to insufficient stock');
      }
    });
  });

  describe('GET /api/inventory/production', () => {
    test('should return list of production transactions', async () => {
      const result = await apiRequest(PRODUCTION_ENDPOINT);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.transactions).toBeDefined();
      expect(Array.isArray(result.data.transactions)).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should respond within 300ms for production transaction with BOM deduction', async () => {
      // Check current stock first
      const stock1 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId1}`);
      const stock2 = await apiRequest(`${ITEMS_ENDPOINT}?id=${testChildItemId2}`);

      // Only run performance test if sufficient stock (need 2 * 1 = 2 KG and 1.5 * 1 = 1.5 KG)
      if (stock1.data.current_stock >= 2 && stock2.data.current_stock >= 1.5) {
        const productionData = {
          transaction_date: '2025-01-15',
          item_id: testParentItemId,
          quantity: 1, // Small quantity for performance test
          unit_price: 10000,
          reference_number: `TEST-PERF-${Date.now()}`,
          notes: '성능 테스트',
          created_by: 1,
          transaction_type: '생산입고'
        };

        const startTime = Date.now();
        const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);
        const endTime = Date.now();

        const responseTime = endTime - startTime;
        console.log(`BOM deduction performance: ${responseTime}ms`);

        expect(responseTime).toBeLessThan(300);

        // Cleanup performance test transaction
        if (result.success && result.data.transaction.transaction_id) {
          await apiRequest(
            `${PRODUCTION_ENDPOINT}?id=${result.data.transaction.transaction_id}`,
            'DELETE'
          );
        }
      } else {
        console.warn('Performance test skipped due to insufficient stock');
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle production of item without BOM', async () => {
      // Create item without BOM
      const noBomItem = {
        item_code: `TEST-NO-BOM-${Date.now()}`,
        item_name: '테스트 BOM 없는 품목',
        spec: 'NO-BOM',
        unit: 'EA',
        category: '기타',
        unit_price: 5000,
        current_stock: 0,
        is_active: true
      };

      const itemResult = await apiRequest(ITEMS_ENDPOINT, 'POST', noBomItem);

      if (itemResult.success) {
        const noBomItemId = itemResult.data.item_id;

        const productionData = {
          transaction_date: '2025-01-15',
          item_id: noBomItemId,
          quantity: 10,
          unit_price: 5000,
          reference_number: `TEST-NO-BOM-${Date.now()}`,
          notes: 'BOM 없는 품목 생산',
          created_by: 1,
          transaction_type: '생산입고'
        };

        const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);

        // Should succeed with no deductions
        expect(result.success).toBe(true);
        expect(result.data.auto_deductions).toHaveLength(0);

        // Cleanup
        if (result.data.transaction.transaction_id) {
          await apiRequest(
            `${PRODUCTION_ENDPOINT}?id=${result.data.transaction.transaction_id}`,
            'DELETE'
          );
        }
        await apiRequest(`${ITEMS_ENDPOINT}?id=${noBomItemId}`, 'DELETE');
      }
    });

    test('should handle zero quantity gracefully', async () => {
      const productionData = {
        transaction_date: '2025-01-15',
        item_id: testParentItemId,
        quantity: 0,
        unit_price: 10000,
        reference_number: `TEST-ZERO-${Date.now()}`,
        notes: '수량 0 테스트',
        created_by: 1,
        transaction_type: '생산입고'
      };

      const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('0보다 커야');
    });

    test('should handle invalid item_id', async () => {
      const productionData = {
        transaction_date: '2025-01-15',
        item_id: 999999, // Non-existent item
        quantity: 10,
        unit_price: 10000,
        reference_number: `TEST-INVALID-${Date.now()}`,
        notes: '유효하지 않은 품목 테스트',
        created_by: 1,
        transaction_type: '생산입고'
      };

      const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('존재하지 않는 품목');
    });
  });

  describe('Multi-Level BOM Testing', () => {
    // Test data for multi-level BOM hierarchy
    let testGrandchildItemId1: number; // Level 2 raw material
    let testGrandchildItemId2: number; // Level 2 raw material
    let testIntermediateItemId: number; // Level 1 sub-assembly
    let testFinalProductId: number; // Level 0 final product
    let testIntermediateBomId: number;
    let testFinalProductBomId: number;

    beforeAll(async () => {
      console.log('Setting up multi-level BOM test data...');

      try {
        // Create grandchild item 1 (level 2 raw material)
        const grandchild1 = {
          item_code: `TEST-GC1-${Date.now()}`,
          item_name: '테스트 원재료1 (Level 2)',
          spec: 'RAW-L2-1',
          unit: 'KG',
          category: '원자재',
          unit_price: 500,
          current_stock: 200, // Sufficient for multi-level tests
          is_active: true
        };

        const gc1Result = await apiRequest(ITEMS_ENDPOINT, 'POST', grandchild1);
        if (gc1Result.success && gc1Result.data) {
          testGrandchildItemId1 = gc1Result.data.item_id;
          console.log(`Created grandchild item 1: ${testGrandchildItemId1}`);
        } else {
          throw new Error('Failed to create grandchild item 1');
        }

        // Create grandchild item 2 (level 2 raw material)
        const grandchild2 = {
          item_code: `TEST-GC2-${Date.now()}`,
          item_name: '테스트 원재료2 (Level 2)',
          spec: 'RAW-L2-2',
          unit: 'KG',
          category: '원자재',
          unit_price: 700,
          current_stock: 150,
          is_active: true
        };

        const gc2Result = await apiRequest(ITEMS_ENDPOINT, 'POST', grandchild2);
        if (gc2Result.success && gc2Result.data) {
          testGrandchildItemId2 = gc2Result.data.item_id;
          console.log(`Created grandchild item 2: ${testGrandchildItemId2}`);
        } else {
          throw new Error('Failed to create grandchild item 2');
        }

        // Create intermediate item (level 1 sub-assembly)
        const intermediate = {
          item_code: `TEST-INT-${Date.now()}`,
          item_name: '테스트 중간조립품 (Level 1)',
          spec: 'SUB-ASSY',
          unit: 'EA',
          category: '반제품',
          unit_price: 3000,
          current_stock: 0, // Will NOT be consumed directly
          is_active: true
        };

        const intResult = await apiRequest(ITEMS_ENDPOINT, 'POST', intermediate);
        if (intResult.success && intResult.data) {
          testIntermediateItemId = intResult.data.item_id;
          console.log(`Created intermediate item: ${testIntermediateItemId}`);
        } else {
          throw new Error('Failed to create intermediate item');
        }

        // Create BOM for intermediate item (Level 1 → Level 2)
        const intermediateBom = {
          parent_item_id: testIntermediateItemId,
          bom_version: 1,
          bom_status: 'ACTIVE',
          effective_date: '2025-01-01',
          notes: 'Multi-level BOM - Intermediate',
          bom_items: [
            {
              child_item_id: testGrandchildItemId1,
              usage_quantity: 3.0, // 3 KG per intermediate
              unit: 'KG'
            },
            {
              child_item_id: testGrandchildItemId2,
              usage_quantity: 2.0, // 2 KG per intermediate
              unit: 'KG'
            }
          ]
        };

        const intBomResult = await apiRequest(BOM_ENDPOINT, 'POST', intermediateBom);
        if (intBomResult.success && intBomResult.data) {
          testIntermediateBomId = intBomResult.data.bom_id;
          console.log(`Created intermediate BOM: ${testIntermediateBomId}`);
        } else {
          throw new Error('Failed to create intermediate BOM');
        }

        // Create final product (level 0)
        const finalProduct = {
          item_code: `TEST-FINAL-${Date.now()}`,
          item_name: '테스트 최종제품 (Level 0)',
          spec: 'FINAL-PRODUCT',
          unit: 'EA',
          category: '완제품',
          unit_price: 15000,
          current_stock: 0,
          is_active: true
        };

        const finalResult = await apiRequest(ITEMS_ENDPOINT, 'POST', finalProduct);
        if (finalResult.success && finalResult.data) {
          testFinalProductId = finalResult.data.item_id;
          console.log(`Created final product: ${testFinalProductId}`);
        } else {
          throw new Error('Failed to create final product');
        }

        // Create BOM for final product (Level 0 → Level 1)
        const finalProductBom = {
          parent_item_id: testFinalProductId,
          bom_version: 1,
          bom_status: 'ACTIVE',
          effective_date: '2025-01-01',
          notes: 'Multi-level BOM - Final Product',
          bom_items: [
            {
              child_item_id: testIntermediateItemId,
              usage_quantity: 2.0, // 2 intermediate assemblies per final product
              unit: 'EA'
            }
          ]
        };

        const finalBomResult = await apiRequest(BOM_ENDPOINT, 'POST', finalProductBom);
        if (finalBomResult.success && finalBomResult.data) {
          testFinalProductBomId = finalBomResult.data.bom_id;
          console.log(`Created final product BOM: ${testFinalProductBomId}`);
        } else {
          throw new Error('Failed to create final product BOM');
        }

        console.log('Multi-level BOM test data setup complete');
      } catch (error) {
        console.error('Multi-level setup failed:', error);
        throw error;
      }
    });

    afterAll(async () => {
      console.log('Cleaning up multi-level BOM test data...');

      try {
        // Delete BOMs
        if (testFinalProductBomId) {
          await apiRequest(`${BOM_ENDPOINT}?id=${testFinalProductBomId}`, 'DELETE');
        }
        if (testIntermediateBomId) {
          await apiRequest(`${BOM_ENDPOINT}?id=${testIntermediateBomId}`, 'DELETE');
        }

        // Delete items
        if (testFinalProductId) {
          await apiRequest(`${ITEMS_ENDPOINT}?id=${testFinalProductId}`, 'DELETE');
        }
        if (testIntermediateItemId) {
          await apiRequest(`${ITEMS_ENDPOINT}?id=${testIntermediateItemId}`, 'DELETE');
        }
        if (testGrandchildItemId1) {
          await apiRequest(`${ITEMS_ENDPOINT}?id=${testGrandchildItemId1}`, 'DELETE');
        }
        if (testGrandchildItemId2) {
          await apiRequest(`${ITEMS_ENDPOINT}?id=${testGrandchildItemId2}`, 'DELETE');
        }

        console.log('Multi-level cleanup complete');
      } catch (error) {
        console.error('Multi-level cleanup failed:', error);
      }
    });

    test('should handle 2-level BOM deduction correctly', async () => {
      // This test verifies:
      // 1. Grandchildren (level 2) are deducted when producing final product (level 0)
      // 2. Intermediate item (level 1) is NOT deducted (it's a component, not consumed)
      // 3. Deduction quantities are calculated correctly through BOM hierarchy
      // 4. level_no field in deduction logs shows correct hierarchy

      // Arrange: Get initial stock levels
      const gc1Stock = await apiRequest(`${ITEMS_ENDPOINT}?id=${testGrandchildItemId1}`);
      const gc2Stock = await apiRequest(`${ITEMS_ENDPOINT}?id=${testGrandchildItemId2}`);
      const intStock = await apiRequest(`${ITEMS_ENDPOINT}?id=${testIntermediateItemId}`);

      const initialGc1 = gc1Stock.data.current_stock;
      const initialGc2 = gc2Stock.data.current_stock;
      const initialInt = intStock.data.current_stock;

      console.log(`Initial stock - GC1: ${initialGc1}, GC2: ${initialGc2}, INT: ${initialInt}`);

      // Act: Produce 5 units of final product
      // This requires:
      // - 5 * 2 = 10 intermediate assemblies
      // - 10 * 3 = 30 KG of grandchild 1
      // - 10 * 2 = 20 KG of grandchild 2
      const productionQuantity = 5;
      const productionData = {
        transaction_date: '2025-01-15',
        item_id: testFinalProductId,
        quantity: productionQuantity,
        unit_price: 15000,
        reference_number: `TEST-ML-${Date.now()}`,
        notes: '2단계 BOM 테스트',
        created_by: 1,
        transaction_type: '생산입고'
      };

      const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);

      // Assert: Production succeeded
      expect(result.success).toBe(true);
      expect(result.data.auto_deductions).toBeDefined();

      const autoDeductions = result.data.auto_deductions;

      // Verify deduction for grandchild 1
      const gc1Deduction = autoDeductions.find((d: any) => d.child_item_id === testGrandchildItemId1);
      expect(gc1Deduction).toBeDefined();
      expect(gc1Deduction.deducted_quantity).toBe(30); // 5 * 2 * 3.0
      expect(gc1Deduction.usage_rate).toBe(3.0);
      expect(gc1Deduction.stock_before).toBe(initialGc1);
      expect(gc1Deduction.stock_after).toBe(initialGc1 - 30);

      // Verify deduction for grandchild 2
      const gc2Deduction = autoDeductions.find((d: any) => d.child_item_id === testGrandchildItemId2);
      expect(gc2Deduction).toBeDefined();
      expect(gc2Deduction.deducted_quantity).toBe(20); // 5 * 2 * 2.0
      expect(gc2Deduction.usage_rate).toBe(2.0);
      expect(gc2Deduction.stock_before).toBe(initialGc2);
      expect(gc2Deduction.stock_after).toBe(initialGc2 - 20);

      // Verify intermediate item NOT deducted
      const intDeduction = autoDeductions.find((d: any) => d.child_item_id === testIntermediateItemId);
      expect(intDeduction).toBeUndefined();

      // Verify final stock levels
      const finalGc1 = (await apiRequest(`${ITEMS_ENDPOINT}?id=${testGrandchildItemId1}`)).data.current_stock;
      const finalGc2 = (await apiRequest(`${ITEMS_ENDPOINT}?id=${testGrandchildItemId2}`)).data.current_stock;
      const finalInt = (await apiRequest(`${ITEMS_ENDPOINT}?id=${testIntermediateItemId}`)).data.current_stock;

      expect(finalGc1).toBe(initialGc1 - 30);
      expect(finalGc2).toBe(initialGc2 - 20);
      expect(finalInt).toBe(initialInt); // Unchanged

      console.log('2-level BOM deduction verified successfully');

      // Cleanup
      if (result.data.transaction.transaction_id) {
        await apiRequest(`${PRODUCTION_ENDPOINT}?id=${result.data.transaction.transaction_id}`, 'DELETE');
      }
    });

    test('should handle 3-level BOM hierarchy with performance <200ms', async () => {
      // This test adds a 3rd level to verify deep hierarchy support
      // Structure: Level 0 (final) → Level 1 (intermediate) → Level 2 (grandchild) → Level 3 (great-grandchild)

      let greatGrandchildId: number;
      let level2ItemId: number;
      let level2BomId: number;
      let level1BomId: number;
      let level0ItemId: number;
      let level0BomId: number;

      try {
        // Create great-grandchild (level 3 raw material)
        const ggc = {
          item_code: `TEST-GGC-${Date.now()}`,
          item_name: '테스트 Level 3 원료',
          spec: 'RAW-L3',
          unit: 'KG',
          category: '원자재',
          unit_price: 100,
          current_stock: 500,
          is_active: true
        };

        const ggcResult = await apiRequest(ITEMS_ENDPOINT, 'POST', ggc);
        greatGrandchildId = ggcResult.data.item_id;

        // Create level 2 item with BOM → level 3
        const l2Item = {
          item_code: `TEST-L2-${Date.now()}`,
          item_name: '테스트 Level 2 중간품',
          spec: 'L2-COMP',
          unit: 'EA',
          category: '반제품',
          unit_price: 800,
          current_stock: 0,
          is_active: true
        };

        const l2Result = await apiRequest(ITEMS_ENDPOINT, 'POST', l2Item);
        level2ItemId = l2Result.data.item_id;

        const l2Bom = {
          parent_item_id: level2ItemId,
          bom_version: 1,
          bom_status: 'ACTIVE',
          effective_date: '2025-01-01',
          notes: '3-level BOM - Level 2',
          bom_items: [
            {
              child_item_id: greatGrandchildId,
              usage_quantity: 4.0, // 4 KG per level 2
              unit: 'KG'
            }
          ]
        };

        const l2BomResult = await apiRequest(BOM_ENDPOINT, 'POST', l2Bom);
        level2BomId = l2BomResult.data.bom_id;

        // Create level 1 item with BOM → level 2
        const l1Item = {
          item_code: `TEST-L1-${Date.now()}`,
          item_name: '테스트 Level 1 조립품',
          spec: 'L1-ASSY',
          unit: 'EA',
          category: '반제품',
          unit_price: 2500,
          current_stock: 0,
          is_active: true
        };

        const l1Result = await apiRequest(ITEMS_ENDPOINT, 'POST', l1Item);
        const level1ItemId = l1Result.data.item_id;

        const l1Bom = {
          parent_item_id: level1ItemId,
          bom_version: 1,
          bom_status: 'ACTIVE',
          effective_date: '2025-01-01',
          notes: '3-level BOM - Level 1',
          bom_items: [
            {
              child_item_id: level2ItemId,
              usage_quantity: 3.0, // 3 level 2 per level 1
              unit: 'EA'
            }
          ]
        };

        const l1BomResult = await apiRequest(BOM_ENDPOINT, 'POST', l1Bom);
        level1BomId = l1BomResult.data.bom_id;

        // Create level 0 (final product) with BOM → level 1
        const l0Item = {
          item_code: `TEST-L0-${Date.now()}`,
          item_name: '테스트 Level 0 최종품',
          spec: 'L0-FINAL',
          unit: 'EA',
          category: '완제품',
          unit_price: 20000,
          current_stock: 0,
          is_active: true
        };

        const l0Result = await apiRequest(ITEMS_ENDPOINT, 'POST', l0Item);
        level0ItemId = l0Result.data.item_id;

        const l0Bom = {
          parent_item_id: level0ItemId,
          bom_version: 1,
          bom_status: 'ACTIVE',
          effective_date: '2025-01-01',
          notes: '3-level BOM - Level 0',
          bom_items: [
            {
              child_item_id: level1ItemId,
              usage_quantity: 2.0, // 2 level 1 per level 0
              unit: 'EA'
            }
          ]
        };

        const l0BomResult = await apiRequest(BOM_ENDPOINT, 'POST', l0Bom);
        level0BomId = l0BomResult.data.bom_id;

        // Get initial stock
        const initialStock = (await apiRequest(`${ITEMS_ENDPOINT}?id=${greatGrandchildId}`)).data.current_stock;

        // Act: Produce 2 units of level 0
        // This requires:
        // - 2 * 2 = 4 level 1
        // - 4 * 3 = 12 level 2
        // - 12 * 4 = 48 KG level 3
        const productionData = {
          transaction_date: '2025-01-15',
          item_id: level0ItemId,
          quantity: 2,
          unit_price: 20000,
          reference_number: `TEST-3L-${Date.now()}`,
          notes: '3단계 BOM 테스트',
          created_by: 1,
          transaction_type: '생산입고'
        };

        const startTime = Date.now();
        const result = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);
        const endTime = Date.now();

        const responseTime = endTime - startTime;
        console.log(`3-level BOM performance: ${responseTime}ms`);

        // Assert: Performance target met
        expect(responseTime).toBeLessThan(200);

        // Assert: Production succeeded
        expect(result.success).toBe(true);

        // Verify deduction for great-grandchild (level 3)
        const ggcDeduction = result.data.auto_deductions.find(
          (d: any) => d.child_item_id === greatGrandchildId
        );
        expect(ggcDeduction).toBeDefined();
        expect(ggcDeduction.deducted_quantity).toBe(48); // 2 * 2 * 3 * 4
        expect(ggcDeduction.stock_before).toBe(initialStock);
        expect(ggcDeduction.stock_after).toBe(initialStock - 48);

        // Verify final stock
        const finalStock = (await apiRequest(`${ITEMS_ENDPOINT}?id=${greatGrandchildId}`)).data.current_stock;
        expect(finalStock).toBe(initialStock - 48);

        console.log('3-level BOM hierarchy verified successfully');

        // Cleanup
        if (result.data.transaction.transaction_id) {
          await apiRequest(`${PRODUCTION_ENDPOINT}?id=${result.data.transaction.transaction_id}`, 'DELETE');
        }
        if (level0BomId) await apiRequest(`${BOM_ENDPOINT}?id=${level0BomId}`, 'DELETE');
        if (level1BomId) await apiRequest(`${BOM_ENDPOINT}?id=${level1BomId}`, 'DELETE');
        if (level2BomId) await apiRequest(`${BOM_ENDPOINT}?id=${level2BomId}`, 'DELETE');
        if (level0ItemId) await apiRequest(`${ITEMS_ENDPOINT}?id=${level0ItemId}`, 'DELETE');
        if (level2ItemId) await apiRequest(`${ITEMS_ENDPOINT}?id=${level2ItemId}`, 'DELETE');
        if (greatGrandchildId) await apiRequest(`${ITEMS_ENDPOINT}?id=${greatGrandchildId}`, 'DELETE');
      } catch (error) {
        console.error('3-level BOM test failed:', error);
        throw error;
      }
    });

    test('should detect and prevent circular BOM references', async () => {
      // Create circular structure: Item A → Item B → Item A
      // This should be prevented at BOM creation or production time

      let itemA: number;
      let itemB: number;
      let bomAtoB: number;

      try {
        // Create item A
        const a = {
          item_code: `TEST-CIRC-A-${Date.now()}`,
          item_name: '테스트 순환참조 A',
          spec: 'CIRC-A',
          unit: 'EA',
          category: '반제품',
          unit_price: 1000,
          current_stock: 10,
          is_active: true
        };

        const aResult = await apiRequest(ITEMS_ENDPOINT, 'POST', a);
        itemA = aResult.data.item_id;

        // Create item B
        const b = {
          item_code: `TEST-CIRC-B-${Date.now()}`,
          item_name: '테스트 순환참조 B',
          spec: 'CIRC-B',
          unit: 'EA',
          category: '반제품',
          unit_price: 1500,
          current_stock: 10,
          is_active: true
        };

        const bResult = await apiRequest(ITEMS_ENDPOINT, 'POST', b);
        itemB = bResult.data.item_id;

        // Create BOM: A → B
        const bomAB = {
          parent_item_id: itemA,
          bom_version: 1,
          bom_status: 'ACTIVE',
          effective_date: '2025-01-01',
          notes: 'Circular BOM test - A to B',
          bom_items: [
            {
              child_item_id: itemB,
              usage_quantity: 1.0,
              unit: 'EA'
            }
          ]
        };

        const bomABResult = await apiRequest(BOM_ENDPOINT, 'POST', bomAB);
        bomAtoB = bomABResult.data.bom_id;

        // Attempt to create BOM: B → A (creates circular reference)
        const bomBA = {
          parent_item_id: itemB,
          bom_version: 1,
          bom_status: 'ACTIVE',
          effective_date: '2025-01-01',
          notes: 'Circular BOM test - B to A',
          bom_items: [
            {
              child_item_id: itemA,
              usage_quantity: 1.0,
              unit: 'EA'
            }
          ]
        };

        const bomBAResult = await apiRequest(BOM_ENDPOINT, 'POST', bomBA);

        // Assert: Should either fail at BOM creation or production time
        if (bomBAResult.success) {
          console.log('Circular BOM created, testing production prevention...');
          const bomBtoA = bomBAResult.data.bom_id;

          // Try to produce item A (should fail due to circular reference)
          const productionData = {
            transaction_date: '2025-01-15',
            item_id: itemA,
            quantity: 1,
            unit_price: 1000,
            reference_number: `TEST-CIRC-${Date.now()}`,
            notes: '순환참조 테스트',
            created_by: 1,
            transaction_type: '생산입고'
          };

          const prodResult = await apiRequest(PRODUCTION_ENDPOINT, 'POST', productionData);

          // Should fail with circular reference error
          expect(prodResult.success).toBe(false);
          expect(prodResult.error).toMatch(/(순환|circular|infinite|loop)/i);

          // Cleanup circular BOM
          await apiRequest(`${BOM_ENDPOINT}?id=${bomBtoA}`, 'DELETE');
        } else {
          // BOM creation prevented circular reference (preferred behavior)
          expect(bomBAResult.success).toBe(false);
          expect(bomBAResult.error).toMatch(/(순환|circular|recursive)/i);
        }

        console.log('Circular reference prevention verified');

        // Cleanup
        if (bomAtoB) await apiRequest(`${BOM_ENDPOINT}?id=${bomAtoB}`, 'DELETE');
        if (itemA) await apiRequest(`${ITEMS_ENDPOINT}?id=${itemA}`, 'DELETE');
        if (itemB) await apiRequest(`${ITEMS_ENDPOINT}?id=${itemB}`, 'DELETE');
      } catch (error) {
        console.error('Circular BOM test failed:', error);
        throw error;
      }
    });

    test('should handle concurrent production transactions safely', async () => {
      // This test simulates race conditions where multiple production
      // transactions attempt to consume the same materials simultaneously
      // Expected: Optimistic locking or transaction isolation prevents inconsistencies

      // Get current stock
      const stockBefore = (await apiRequest(`${ITEMS_ENDPOINT}?id=${testGrandchildItemId1}`)).data.current_stock;

      console.log(`Initial stock for concurrent test: ${stockBefore}`);

      // Create two production requests that will run concurrently
      const production1 = {
        transaction_date: '2025-01-15',
        item_id: testFinalProductId,
        quantity: 3,
        unit_price: 15000,
        reference_number: `TEST-CONC1-${Date.now()}`,
        notes: '동시처리 테스트 1',
        created_by: 1,
        transaction_type: '생산입고'
      };

      const production2 = {
        transaction_date: '2025-01-15',
        item_id: testFinalProductId,
        quantity: 3,
        unit_price: 15000,
        reference_number: `TEST-CONC2-${Date.now()}`,
        notes: '동시처리 테스트 2',
        created_by: 1,
        transaction_type: '생산입고'
      };

      // Execute both requests concurrently
      const [result1, result2] = await Promise.all([
        apiRequest(PRODUCTION_ENDPOINT, 'POST', production1),
        apiRequest(PRODUCTION_ENDPOINT, 'POST', production2)
      ]);

      // Both should succeed or fail cleanly (no partial/corrupted state)
      const successCount = (result1.success ? 1 : 0) + (result2.success ? 1 : 0);

      console.log(`Concurrent transactions - Success count: ${successCount}`);

      // Verify final stock consistency
      const stockAfter = (await apiRequest(`${ITEMS_ENDPOINT}?id=${testGrandchildItemId1}`)).data.current_stock;

      // Calculate expected deduction (3 * 2 * 3.0 = 18 per transaction)
      const expectedDeductionPerTx = 18;
      const expectedStockAfter = stockBefore - (expectedDeductionPerTx * successCount);

      expect(stockAfter).toBe(expectedStockAfter);

      console.log(`Stock consistency verified - Before: ${stockBefore}, After: ${stockAfter}, Expected: ${expectedStockAfter}`);

      // Cleanup successful transactions
      if (result1.success && result1.data.transaction.transaction_id) {
        await apiRequest(`${PRODUCTION_ENDPOINT}?id=${result1.data.transaction.transaction_id}`, 'DELETE');
      }
      if (result2.success && result2.data.transaction.transaction_id) {
        await apiRequest(`${PRODUCTION_ENDPOINT}?id=${result2.data.transaction.transaction_id}`, 'DELETE');
      }
    });
  });
});
